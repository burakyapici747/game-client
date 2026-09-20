// ─────────────────────────────────────────────────────────────────────────────
// SESSION MANAGER — oturum durumunun TEK sahiplik noktası
//
// İki oturum KİPİ vardır ve ikisi de buradan yönetilir:
//
//   'guest'   Yerel takma ad. Sunucuya hiç gidilmez, token yoktur. Oyuncu
//             oynayabilir; cüzdan/mağaza/envanter gibi hesaba bağlı modüller
//             kapalıdır (UI bunu "sign in to unlock" olarak gösterir).
//   'google'  Google ID Token ile proxy oturumu. GET /api/me çağrısı LootLocker
//             hesabını bağlar/oluşturur ve korumalı modüller açılır.
//
// ── AKIŞ (google) ───────────────────────────────────────────────────────────
//   GİRİŞ     GoogleAuth → onSignIn(idToken)
//               → POST /api/auth/session  (Authorization: Bearer <ID Token>)
//                   → 200 + Set-Cookie: HttpOnly oturum çerezi
//                   → 401 token geçersiz → yeniden giriş
//                   → 503 LootLocker kapalı → banner, oyun engellenmez
//
//   YENİLEME  sayfa açılışı → GET /api/auth/me   (yalnızca çerez)
//               → 200 oturum GERİ GELİR (kullanıcı hiçbir şey yapmaz)
//               → 401 oturum yok → MİSAFİR kipine düşülür
//
//   ÇIKIŞ     POST /api/auth/logout → çerez silinir
//
// ── NEDEN ÇEREZ ─────────────────────────────────────────────────────────────
// Google ID Token yalnızca JS bellepindeydi: F5 ile kayboluyor, kullanıcı her
// yenilemede "giriş yapmamış" görünüyordu. Token'ı localStorage'a yazmak bu
// sorunu çözerdi ama XSS ile çalınabilir hale getirirdi. Sunucunun imzaladığı
// HttpOnly çerez ikisini birden çözer: JS okuyamaz, tarayıcı otomatik taşır.
//
// İstemci oturum jetonunu HİÇBİR ZAMAN GÖRMEZ. Bu dosyada token saklayan bir
// değişken YOKTUR ve olmamalıdır.
//
// ── OYUN DÖNGÜSÜ GÜVENLİĞİ ──────────────────────────────────────────────────
// Buradaki hiçbir fonksiyon THROW ETMEZ. Tümü {ok, reason, status} döner.
// Oturum kurulumu Phaser boot'unu ne bloklar ne de yakalanmamış bir promise
// reddi üretir — 503 alan oyuncu yine de oynayabilir, yalnızca hesaba bağlı
// özellikler o an çalışmaz.
//
// ── DEĞİŞİKLİK YAYINI ───────────────────────────────────────────────────────
// UI (yan panel, login sekmeleri) oturumu POLL ETMEZ; onSessionChange ile
// abone olur. Böylece "giriş yapıldı" bilgisini kimin ilk öğrendiği önemsizdir
// ve panel her kip geçişinde tek bir yerden yeniden çizilir.
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, onUnauthorized, onServiceUnavailable } from '../network/ApiClient.js';
import { normalizeProfile } from '../network/GameApi.js';
import { getIdToken, getProfile, onSignIn, promptReauth, signOut as googleSignOut } from './GoogleAuth.js';
import {
    showAuthOverlay,
    showAuthError,
    showServiceBanner,
    hideServiceBanner,
} from '../ui/overlays.js';

// ── SUNUCU UÇLARI ───────────────────────────────────────────────────────────
// Üçü birlikte oturumun yaşam döngüsüdür; backend değişirse tek dokunulacak
// yer burasıdır.
//
//   LOGIN_ROUTE    Google ID Token'ı HttpOnly çereze çevirir (Set-Cookie).
//   RESTORE_ROUTE  "hâlâ girişli miyim?" — sayfanın İLK karesinde sorulur.
//   LOGOUT_ROUTE   çerezi siler.
export const LOGIN_ROUTE = '/api/auth/session';
export const RESTORE_ROUTE = '/api/auth/me';
export const LOGOUT_ROUTE = '/api/auth/logout';

/** Geriye dönük ad: eski çağrı yerleri kırılmasın. */
export const SESSION_ROUTE = LOGIN_ROUTE;

const UNAVAILABLE_MESSAGE = 'Login temporarily unavailable, please try again later.';
// Sağlayıcıdan bağımsız metin: ileride ikinci bir giriş yöntemi eklendiğinde
// bu cümlenin değişmesi gerekmemeli.
const REAUTH_MESSAGE = 'Your session expired. Please sign in again.';

/** Misafir takma adı yeniden ziyarette hatırlansın (token DEĞİL, sadece isim). */
const GUEST_NICKNAME_KEY = 'snake_nickname';

/** Oyun içi görünen adın azami uzunluğu (sunucu da kırpar). */
const MAX_NICKNAME_LENGTH = 16;

/**
 * VARSAYILAN MİSAFİR ADI — `Guest_1234`.
 *
 * <p>Üretilen ad HEMEN saklanır: aynı ziyaretçi sayfayı yenilediğinde başka bir
 * numarayla karşılaşmamalı. "Guest_" öneki bilinçli; oyuncu adının hesaba bağlı
 * OLMADIĞINI ilk bakışta belli eder.
 */
export function defaultGuestNickname() {
    try {
        const saved = localStorage.getItem(GUEST_NICKNAME_KEY);
        if (saved && saved.trim()) return saved.trim().slice(0, MAX_NICKNAME_LENGTH);
    } catch (_) { /* private mode */ }

    const name = `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
    try { localStorage.setItem(GUEST_NICKNAME_KEY, name); } catch (_) { /* private mode */ }
    return name;
}

// ── Durum ────────────────────────────────────────────────────────────────────

let mode = null;            // null | 'guest' | 'google'
let player = null;          // proxy'nin döndürdüğü HAM oyuncu kaydı
let profile = null;         // normalizeProfile(player) — UI'ın tükettiği şekil
let inFlight = null;        // aynı anda tek istek (çift tetikleme koruması)
let bridgeInstalled = false;

const sessionListeners = new Set();

// ── Sorgular ─────────────────────────────────────────────────────────────────

/** Proxy'den gelen HAM oyuncu kaydı; oturum kurulmadıysa null. */
export function getPlayer() {
    return player;
}

/**
 * UI'ın tükettiği normalize profil.
 *
 * <p>Misafir kipinde de DOLU döner (yerel takma adla): yan panel tek bir şekil
 * bilir, kipe göre dallanmaz.
 */
export function getSessionProfile() {
    return profile;
}

/** null | 'guest' | 'google' */
export function getAuthMode() {
    return mode;
}

/** Korumalı /api/** çağrıları yapılabilir mi? SADECE google kipinde true. */
export function isAuthenticated() {
    return mode === 'google' && player !== null;
}

/** Herhangi bir kipte oturum var mı (misafir dahil)? */
export function hasSession() {
    return mode !== null;
}

// ── Değişiklik yayını ────────────────────────────────────────────────────────

/**
 * Oturum kipi/profili değiştiğinde çağrılır. Abone olurken MEVCUT durum da
 * hemen iletilir, böylece geç bağlanan bir dinleyici ilk çizimini kaçırmaz.
 *
 * @returns {function} aboneliği sonlandırır
 */
export function onSessionChange(handler) {
    if (typeof handler !== 'function') return () => {};
    sessionListeners.add(handler);
    handler(snapshot());
    return () => sessionListeners.delete(handler);
}

function snapshot() {
    return { mode, profile, player, authenticated: isAuthenticated() };
}

// Dinleyici patlarsa oturum akışı KIRILMAMALI — hata yutulur, loglanır.
function emitSessionChange() {
    const state = snapshot();
    for (const fn of sessionListeners) {
        try { fn(state); } catch (err) {
            console.error('[session] dinleyici hata verdi:', err);
        }
    }
}

// ── Misafir kipi ─────────────────────────────────────────────────────────────

/**
 * Sunucuya gitmeden yerel oturum açar.
 *
 * <p>Google oturumu AÇIKKEN çağrılmaz: kimliği düşürmek kullanıcının açıkça
 * istemediği bir yan etki olurdu. Bu yüzden sessizce mevcut durumu döndürür.
 */
export function startGuestSession(nickname) {
    if (mode === 'google') return { ok: true, mode };

    const name = String(nickname ?? '').trim().slice(0, MAX_NICKNAME_LENGTH) || defaultGuestNickname();
    try { localStorage.setItem(GUEST_NICKNAME_KEY, name); } catch (_) { /* private mode */ }

    mode = 'guest';
    player = null;
    profile = { playerId: null, nickname: name, email: null, picture: null, walletId: null, raw: null };
    emitSessionChange();
    return { ok: true, mode };
}

/**
 * OYUN İÇİ GÖRÜNEN ADI GÜNCELLER — kullanıcı yazdıkça.
 *
 * <p>Ad, HESAP kimliği değildir: Google ile girmiş bir oyuncu da yılanının
 * üstünde başka bir ad görmeyi seçebilir. Bu yüzden her iki kipte de çalışır ve
 * hesap kimliğine (e-posta, avatar) DOKUNMAZ.
 *
 * <p>Misafir kipinde ad kalıcılaştırılır; Google kipinde kalıcılaştırılmaz,
 * çünkü orada kalıcı kimlik zaten sunucudadır ve yerel bir kopya ikisinin
 * ayrışmasına davetiye çıkarırdı.
 *
 * <p>Değer DEĞİŞMEDİYSE hiçbir şey yayınlanmaz: aksi halde her tuş vuruşu tüm
 * panel dinleyicilerini yeniden çizdirirdi.
 */
export function setPlayNickname(nickname) {
    const name = String(nickname ?? '').trim().slice(0, MAX_NICKNAME_LENGTH);
    if (!profile || profile.nickname === name) return;

    profile = { ...profile, nickname: name };
    if (mode === 'guest' && name) {
        try { localStorage.setItem(GUEST_NICKNAME_KEY, name); } catch (_) { /* private mode */ }
    }
    emitSessionChange();
}

/**
 * Oturumu tamamen düşürür (misafir ya da google).
 *
 * @param {boolean} [revokeGoogle=true] Google yerel state'i de temizlensin mi.
 */
export function endSession(revokeGoogle = true) {
    const wasGoogle = mode === 'google';
    if (revokeGoogle && wasGoogle) googleSignOut();

    mode = null;
    player = null;
    profile = null;
    hideServiceBanner();
    emitSessionChange();

    // ÇEREZİ SUNUCUYA SİLDİR. Yerel durumu temizlemek YETMEZ: çerez JS'e
    // kapalıdır (HttpOnly), dolayısıyla istemci onu kendisi silemez. Bu çağrı
    // yapılmazsa kullanıcı "çıkış yaptım" sanır, sayfayı yenilediğinde geri
    // girişli olurdu.
    //
    // Sonucu BEKLENMEZ: çıkış kullanıcı arayüzünde ANINDA olmalı ve ağ hatası
    // onu ekranda kilitlememeli. Çağrı başarısız olsa bile jeton kısa ömürlüdür.
    if (wasGoogle) {
        apiFetch(LOGOUT_ROUTE, { method: 'POST', auth: true })
            .catch((err) => console.warn('[session] çıkış çağrısı başarısız:', err.message));
    }
}

// ── Google kipi ──────────────────────────────────────────────────────────────

/**
 * ID Token ile proxy oturumunu kurar/tazeler.
 *
 * <p>ASLA throw etmez.
 *
 * @returns {Promise<{ok: boolean, player?: object, reason?: string, status?: number}>}
 *          reason: 'no-token' | 'unauthorized' | 'unavailable' | 'network' | 'http'
 */
export async function establishSession() {
    // Eşzamanlı çağrılar (onSignIn + manuel Retry) tek istekte birleşsin.
    if (inFlight) return inFlight;

    if (!getIdToken()) {
        return { ok: false, reason: 'no-token' };
    }

    inFlight = (async () => {
        try {
            // POST: bu çağrı sunucuda DURUM YARATIR (Set-Cookie). GET olsaydı
            // araya giren her önbellek katmanı için yanıltıcı olurdu.
            player = await apiFetch(LOGIN_ROUTE, { method: 'POST' });
            mode = 'google';

            // Proxy bazı alanları boş bırakabilir (ör. henüz takma ad yok).
            // Google ID Token payload'ı GÖRÜNTÜLEME için güvenli bir yedek:
            // yetki kararı değil, yalnızca panelde ne yazacağımız.
            const google = getProfile();
            const merged = normalizeProfile(player);
            profile = {
                ...merged,
                nickname: merged.nickname ?? google?.name ?? null,
                email:    merged.email    ?? google?.email ?? null,
                picture:  merged.picture  ?? google?.picture ?? null,
            };

            hideServiceBanner();
            emitSessionChange();
            return { ok: true, player };
        } catch (err) {
            player = null;
            profile = null;
            if (mode === 'google') mode = null;
            emitSessionChange();

            // 401/503 kullanıcı bildirimi ApiClient kancalarında yapılır
            // (bkz. initSessionBridge); burada yalnızca sonuç raporlanır.
            if (err.isUnauthorized) return { ok: false, reason: 'unauthorized', status: 401 };
            if (err.isServiceUnavailable) return { ok: false, reason: 'unavailable', status: 503 };
            if (err.isNetwork) {
                console.warn('[session] proxy\'ye ulaşılamadı:', err.message);
                return { ok: false, reason: 'network', status: 0 };
            }
            console.warn(`[session] ${LOGIN_ROUTE} beklenmeyen yanıt:`, err.status, err.message);
            return { ok: false, reason: 'http', status: err.status };
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
}

/**
 * SAYFA AÇILIŞINDA OTURUMU GERİ GETİRİR.
 *
 * <p>Uygulamanın İLK ağ çağrısıdır ve tek soruyu sorar: "tarayıcıda geçerli bir
 * oturum çerezi var mı?". Google SDK'sını, One Tap'i ya da kullanıcı etkileşimini
 * BEKLEMEZ — beklerse menü, kimliği belli olmayan bir ara durumda çizilirdi.
 *
 * <p>401 bir HATA DEĞİLDİR: "bu ziyaretçi girişli değil" demektir ve çağıran
 * tarafın misafir kipini başlatması beklenir (bkz. main.js).
 *
 * <p>ASLA throw etmez.
 *
 * @returns {Promise<{ok: boolean, mode?: string, reason?: string}>}
 */
export async function restoreSession() {
    if (inFlight) return inFlight;

    inFlight = (async () => {
        try {
            const body = await apiFetch(RESTORE_ROUTE, { method: 'GET' });
            player = body;
            mode = 'google';
            profile = profileFromIdentity(body);
            hideServiceBanner();
            emitSessionChange();
            return { ok: true, mode };
        } catch (err) {
            // 401 = misafir. Burada overlay/banner GÖSTERİLMEZ: kullanıcı henüz
            // hiçbir şey yapmadı, ona "oturumun düştü" demek yanlış olurdu.
            if (err.isUnauthorized) return { ok: false, reason: 'no-session' };
            if (err.isNetwork) {
                console.warn('[session] oturum kontrolü ağa ulaşamadı:', err.message);
                return { ok: false, reason: 'network' };
            }
            console.warn(`[session] ${RESTORE_ROUTE} beklenmeyen yanıt:`, err.status, err.message);
            return { ok: false, reason: 'http' };
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
}

/**
 * {@code /api/auth/*} kimlik gövdesini panelin tükettiği profile çevirir.
 *
 * <p>Gövde {user:{...}, player:{...}} şeklindedir; normalizeProfile yalnızca
 * `player` dalına bakar, bu yüzden görüntülenecek alanlar (ad, e-posta, avatar)
 * `user` dalından TAMAMLANIR. Yenileme sonrası Google SDK'sı henüz yüklenmemiş
 * olabileceği için bu alanların tek kaynağı sunucudur.
 */
function profileFromIdentity(body) {
    const user = body?.user ?? {};
    const merged = normalizeProfile(body);
    return {
        ...merged,
        nickname: merged.nickname ?? user.name ?? null,
        email:    merged.email    ?? user.email ?? null,
        picture:  merged.picture  ?? user.pictureUrl ?? null,
    };
}

/** 503 banner'ındaki "Retry" düğmesinin hedefi. */
export async function retrySession() {
    hideServiceBanner();
    const result = await establishSession();
    if (!result.ok && result.reason === 'network') {
        showServiceBanner(UNAVAILABLE_MESSAGE, { onRetry: retrySession });
    }
    return result;
}

/**
 * Global hata kancalarını ve giriş aboneliğini kurar. Uygulama başlarken BİR
 * KEZ çağrılır (bkz. src/main.js).
 *
 * <p>Kancalar ApiClient üzerinde global olduğu için, oturum çağrısı kadar
 * cüzdan/skin gibi HERHANGİ bir korumalı çağrının 401/503'ü de aynı kullanıcı
 * deneyimini tetikler — her çağrı yerinde ayrı ayrı ele alınmaz.
 */
export function initSessionBridge() {
    if (bridgeInstalled) return;
    bridgeInstalled = true;

    onUnauthorized(({ path }) => {
        // ── AÇILIŞTAKİ 401 BİR HATA DEĞİLDİR ────────────────────────────────
        // /api/auth/me sayfanın ilk karesinde "çerezin var mı?" diye sorar ve
        // girişsiz her ziyaretçi için 401 döner. Bu yolu diğer 401'lerle aynı
        // kefeye koymak, oyunu ilk kez açan herkese "oturumun süresi doldu"
        // modalı göstermek demekti — kullanıcı henüz hiçbir şey yapmamışken.
        // Doğru cevap sessizce misafir kipine düşmektir (bkz. restoreSession).
        if (path === RESTORE_ROUTE) return;

        // 401 SADECE google kipini düşürür. Misafir oyuncu korumalı bir uç
        // çağırmaz; yine de yarış hâlinde bir 401 gelirse onun yerel oturumunu
        // koparmak yanlış olurdu.
        if (mode === 'google' || mode === null) {
            player = null;
            profile = null;
            mode = null;
            emitSessionChange();

            console.warn(`[session] 401 (${path}) — yeniden kimlik doğrulama isteniyor.`);
            showAuthOverlay();
            showAuthError(REAUTH_MESSAGE);
            promptReauth();
        }
    });

    onServiceUnavailable(({ path }) => {
        console.warn(`[session] 503 (${path}) — LootLocker bağlantısı kullanılamıyor.`);
        showServiceBanner(UNAVAILABLE_MESSAGE, { onRetry: retrySession });
    });

    // Her TAZE token (ilk giriş, One Tap sessiz yenileme, yeniden giriş)
    // oturumu yeniden kurar.
    onSignIn(() => { establishSession(); });
}
