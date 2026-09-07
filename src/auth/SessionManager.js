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
//   GoogleAuth → onSignIn(idToken)
//     → GET /api/me   (Authorization: Bearer <ID Token> — ApiClient otomatik ekler)
//         → 200  oyuncu kaydı; proxy LootLocker /game/session/google ile eşledi
//         → 401  token geçersiz/süresi dolmuş → yeniden giriş istenir
//         → 503  LootLocker Sign-In kapalı    → banner, oyun engellenmez
//
// ── NEDEN GÖVDESİZ GET ──────────────────────────────────────────────────────
// Proxy ham Google ID Token'ı kendisi LootLocker'ın native /game/session/google
// ucuna aktarıyor; custom player_identifier mantığı kaldırıldı. Yani istemcinin
// göndereceği EK bir alan yok: token zaten Authorization başlığında. Oturum
// kurulumu bu yüzden ayrı bir POST gövdesi değil, korumalı bir okuma çağrısıdır.
//
// Backend ayrı bir POST /api/auth/session ucu açarsa değişmesi gereken tek yer
// aşağıdaki SESSION_ROUTE/SESSION_METHOD ikilisidir.
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

/** Oturum kurulum ucu. Backend değişirse tek dokunulacak yer burası. */
export const SESSION_ROUTE = '/api/me';
const SESSION_METHOD = 'GET';

const UNAVAILABLE_MESSAGE = 'Login temporarily unavailable, please try again later.';
const REAUTH_MESSAGE = 'Your session expired. Please sign in with Google again.';

/** Misafir takma adı yeniden ziyarette hatırlansın (token DEĞİL, sadece isim). */
const GUEST_NICKNAME_KEY = 'snake_nickname';

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

    const name = String(nickname ?? '').trim().slice(0, 16) || `Player${Math.floor(Math.random() * 10000)}`;
    try { localStorage.setItem(GUEST_NICKNAME_KEY, name); } catch (_) { /* private mode */ }

    mode = 'guest';
    player = null;
    profile = { playerId: null, nickname: name, email: null, picture: null, walletId: null, raw: null };
    emitSessionChange();
    return { ok: true, mode };
}

/**
 * Oturumu tamamen düşürür (misafir ya da google).
 *
 * @param {boolean} [revokeGoogle=true] Google yerel state'i de temizlensin mi.
 */
export function endSession(revokeGoogle = true) {
    if (revokeGoogle && mode === 'google') googleSignOut();
    mode = null;
    player = null;
    profile = null;
    hideServiceBanner();
    emitSessionChange();
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
            player = await apiFetch(SESSION_ROUTE, { method: SESSION_METHOD });
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
            console.warn(`[session] ${SESSION_ROUTE} beklenmeyen yanıt:`, err.status, err.message);
            return { ok: false, reason: 'http', status: err.status };
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
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
