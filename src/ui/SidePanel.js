// ─────────────────────────────────────────────────────────────────────────────
// SIDE PANEL — tam boy, katlanabilir sol panel
//
// DOM iskeleti index.html'de (#side-panel), stiller public/style.css'te. Bu
// modül yalnızca DAVRANIŞI sahiplenir: görünürlük, veri çekme, durum çizimi.
//
// ── İKİ PARÇA ───────────────────────────────────────────────────────────────
//   ŞERİT (.sp-rail)   Her zaman görünür, tam boy ikon şeridi. Panelin var
//                      olduğunu bildiren tek şey budur; eskiden bu görev 32px
//                      genişliğinde bir tutamaktaydı ve fark edilmiyordu.
//   ÇEKMECE (.side-panel-drawer)  Açıldığında bağlamın tamamını gösterir.
//
// ── İKİ BÖLÜM ───────────────────────────────────────────────────────────────
//   'profile'  hesap yönetimi · bakiye · ilerleme · başarımlar · sahip olunan
//              kozmetikler (skinler/eşyalar). "Bende ne var" sorusu.
//   'shop'     satın alınabilir katalog içeriği. "Ne alabilirim" sorusu.
//
// Envanter mağazada DEĞİL profilde: sahip olunan eşya, oyuncunun kendi
// durumudur; mağaza sekmesi satın alınabilir olanı gösterir. İkisini aynı
// sekmede toplamak "hangisi benim" sorusunu her seferinde yeniden sordururdu.
//
// ── OTURUM KİPİNE GÖRE DAVRANIŞ ─────────────────────────────────────────────
// Panel oturum kipini POLL ETMEZ; SessionManager.onSessionChange ile abone olur.
//
//   null      panel gizli.
//   'guest'   panel açık. Mağaza ÇALIŞIR (katalog uçları public), cüzdan ve
//             envanter "login required" satırıyla kilitli gösterilir.
//   'google'  hepsi açık.
//
// Mağazanın misafire de açık olması bilinçli: /api/catalogs ve
// /api/catalogs/{key}/prices token istemez, dolayısıyla onları kilitlemek
// sunucunun izin verdiği bir şeyi sebepsiz kısıtlamak olurdu.
//
// ── BAYAT YANIT KORUMASI ────────────────────────────────────────────────────
// Her yükleyici, başlarken o anki `generation` sayacını fotoğraflar. Oturum
// değişir ya da panel sıfırlanırsa sayaç artar ve geç dönen yanıt ÇİZİLMEZ.
// Bu olmadan: kullanıcı çıkış yapar, önceki oturumun envanteri 200ms sonra
// gelir ve boş panele başkasının eşyalarını basardı.
//
// ── TEMBEL YÜKLEME ──────────────────────────────────────────────────────────
// Mağaza/envanter yalnızca ilgili görünüm İLK kez açıldığında istek atar ve
// sonuç önbelleğe alınır. Çekmeceyi açıp kapatmak yeniden istek üretmez;
// tazeleme kullanıcının açık talebiyle (yenile düğmesi) yapılır.
// ─────────────────────────────────────────────────────────────────────────────

import {
    getCatalogs, getCatalogPrices, getMyWalletBalances, getMySkins, getAssets, buildAssetImageIndex,
    setActiveSkin, clearActiveSkin, updateNickname,
    normalizeCatalogs, normalizeCatalogItems, normalizeBalances, normalizeSkins,
} from '../network/GameApi.js';
import { onSessionChange, getAuthMode, setPlayNickname, getSessionProfile } from '../auth/SessionManager.js';
import { readStats } from './PlayerStats.js';
import { showAuthOverlay } from './overlays.js';

const $ = (id) => document.getElementById(id);

// Bakiye/fiyat gösterimi tek biçimlendiriciden geçer (bkz. overlays.formatScore
// ile aynı gerekçe: aynı hücrenin iki farklı biçimde görünmesini önler).
const AMOUNT_FORMATTER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const formatAmount = (value) => AMOUNT_FORMATTER.format(Math.max(0, Math.trunc(Number(value) || 0)));

// Para birimi kodundan ikon. Bilinmeyen kodlar nötr bir jeton ikonuna düşer —
// backend yeni bir para birimi eklediğinde UI kırılmaz, sadece jenerik görünür.
const CURRENCY_ICONS = {
    GOLD: 'paid', COIN: 'paid', COINS: 'paid', SILVER: 'paid',
    GEM: 'diamond', GEMS: 'diamond', DIAMOND: 'diamond',
    WOOD: 'forest', TIMBER: 'forest',
    STONE: 'landscape', IRON: 'hardware', ENERGY: 'bolt',
};
const currencyIcon = (code) => CURRENCY_ICONS[String(code || '').toUpperCase()] ?? 'toll';

// ── Durum ────────────────────────────────────────────────────────────────────

let initialized = false;
let expanded = false;
let activeView = 'profile';        // 'profile' | 'shop'
let mode = null;                   // SessionManager kipi aynası

/** Bayat yanıt koruması — bkz. dosya başı. */
let generation = 0;

/** Görünüm başına "bu oturumda yüklendi mi" işareti (tembel yükleme). */
const loaded = { wallet: false, store: false, inventory: false };

/** Seçili katalog anahtarı; kataloglar geldiğinde ilkine ayarlanır. */
let activeCatalogKey = null;

/**
 * Varlık görselleri (ulid → url). Katalog yanıtı görsel taşımadığı için
 * /api/assets ile BİR KEZ doldurulur ve panel oturumu boyunca saklanır
 * (uç zaten sunucuda 30 dk önbellekli; her katalog sekmesinde yeniden
 * istemek boşuna tur olurdu).
 */
let assetImageIndex = null;

/**
 * Görsel indeksini hazırlar. Başarısız olursa SESSİZCE boş döner: görseli
 * olmayan bir mağaza hâlâ kullanılabilir, ama görsel yüzünden mağazanın hiç
 * açılmaması kabul edilemez.
 */
async function ensureAssetImages() {
    if (assetImageIndex) return assetImageIndex;
    try {
        assetImageIndex = buildAssetImageIndex(await getAssets());
    } catch (err) {
        console.warn('[shop] varlık görselleri alınamadı:', err.message);
        assetImageIndex = new Map();
    }
    return assetImageIndex;
}

/** Envanterdeki skin listesi ve aktif skin — equip sonrası yerel güncellenir. */
let skinState = { skins: [], activeSkinId: null };

// ── Küçük DOM yardımcıları ───────────────────────────────────────────────────

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
}

/**
 * Bir konteynere tek satırlık durum çizer (yükleniyor / hata / boş / kilitli).
 *
 * <p>Hata durumunda "Retry" düğmesi verilir: async çağrının başarısızlığı
 * kullanıcının çıkmaz sokağa girmesi anlamına gelmemeli.
 */
function renderState(container, { kind, message, onRetry, actionLabel }) {
    if (!container) return;
    const box = el('div', `sp-state sp-state-${kind}`);

    if (kind === 'loading') {
        // Metin + iskelet: "bir şey oluyor" hissi anında verilir.
        box.append(el('span', 'sp-spinner'), el('span', 'sp-state-text', message ?? 'Loading…'));
        container.replaceChildren(box, skeletonRows(3));
        return;
    }

    const icon = el('span', 'material-symbols-outlined sp-state-icon');
    icon.textContent = kind === 'error' ? 'error' : kind === 'locked' ? 'lock' : 'inbox';
    box.append(icon, el('span', 'sp-state-text', message ?? ''));

    if (typeof onRetry === 'function') {
        const btn = el('button', 'sp-state-btn', actionLabel ?? 'Retry');
        btn.type = 'button';
        btn.addEventListener('click', onRetry);
        box.append(btn);
    }
    container.replaceChildren(box);
}

/** Yükleme sırasında yerini tutan gri satırlar (layout zıplamasını önler). */
function skeletonRows(count) {
    const wrap = el('div', 'sp-skeletons');
    for (let i = 0; i < count; i++) wrap.append(el('div', 'sp-skeleton'));
    return wrap;
}

/**
 * ApiError'ı kullanıcıya gösterilebilir tek satıra indirger.
 *
 * <p>401/503 için ayrı metin: bunlar kullanıcının yaptığı bir hatanın sonucu
 * DEĞİL ve global kancalar zaten overlay/banner gösteriyor — buradaki satır
 * sadece panelin neden boş olduğunu açıklar.
 */
function errorText(err) {
    if (err?.isUnauthorized) return 'Session expired — please sign in again.';
    if (err?.isServiceUnavailable) return 'Service temporarily unavailable.';
    if (err?.isNetwork) return 'Can\'t reach the server.';
    return err?.message ? String(err.message).slice(0, 120) : 'Something went wrong.';
}

// ── Görünürlük ───────────────────────────────────────────────────────────────

function setExpanded(next) {
    expanded = next;
    const panel = $('side-panel');
    const toggle = $('side-panel-toggle');
    if (!panel) return;
    panel.classList.toggle('is-expanded', expanded);
    panel.classList.toggle('is-collapsed', !expanded);
    if (toggle) {
        toggle.setAttribute('aria-expanded', String(expanded));
        // Etiket durumu ANLATMALI: ekran okuyucu kullanıcısı için "Toggle"
        // hangi yöne gittiğini söylemez.
        const label = expanded ? 'Collapse player panel' : 'Expand player panel';
        toggle.setAttribute('aria-label', label);
        toggle.title = expanded ? 'Collapse' : 'Expand';
    }

    // Çekmece AÇILDIĞINDA görünür sekmenin verisi yoksa şimdi çek. Kapalıyken
    // istek atmak, kullanıcının hiç bakmayacağı veri için kota harcamak olurdu.
    if (expanded) ensureViewLoaded(activeView);
}

/** Oyun başlarken panel canvas'ı kapatmasın; menüye dönünce geri gelir. */
export function hideSidePanel() {
    const panel = $('side-panel');
    if (!panel) return;
    panel.hidden = true;
    setExpanded(false);
}

export function showSidePanelIfSignedIn() {
    const panel = $('side-panel');
    if (!panel) return;
    panel.hidden = mode === null;
}

// ── Profil başlığı ───────────────────────────────────────────────────────────

function renderProfile(profile) {
    const nameEl = $('sp-nickname');
    const mailEl = $('sp-email');
    const avatarEl = $('sp-avatar');
    const badgeEl = $('sp-mode-badge');

    // Düzenleme açıkken ÜZERİNE YAZMA: oturum yayını (ör. başka bir alan
    // değişti) kullanıcının yazdığı formu silip götürürdü.
    if (nameEl && nameEl.dataset.editing !== 'true') {
        nameEl.textContent = profile?.nickname || 'Player';
    }

    // Kalem yalnızca hesabı olan oyuncuda görünür: misafirin kaydedeceği bir
    // hesap yoktur ve düğme tıklanınca hiçbir şey yapmazdı.
    const editBtn = $('sp-nickname-edit');
    if (editBtn) editBtn.classList.toggle('hidden', mode !== 'google');

    if (mailEl) {
        // Misafirin e-postası YOKTUR. Boş bir satır bırakmak yerine kipin ne
        // olduğunu söylüyoruz — kullanıcı neden cüzdanının kilitli olduğunu
        // buradan anlar.
        mailEl.textContent = profile?.email || (mode === 'guest' ? 'Playing as guest' : '—');
        mailEl.classList.toggle('is-muted', !profile?.email);
    }

    if (badgeEl) {
        badgeEl.textContent = mode === 'google' ? 'GOOGLE' : 'GUEST';
        badgeEl.dataset.mode = mode ?? '';
    }

    if (avatarEl) {
        // ── GOOGLE AVATARI KULLANILMAZ ──────────────────────────────────────
        // Profil resmi Google CDN'inden gelir; oyunun görsel dili ise kendi
        // skin/avatar sistemidir. Dış bir resmi bu sisteme karıştırmak üç şey
        // getirir: üçüncü taraf bir isteğe (ve oyuncunun IP'sinin o CDN'e
        // gitmesine) bağımlılık, oyun estetiğiyle uyumsuz bir kare, ve hesap
        // türüne göre DEĞİŞEN bir arayüz. Harf rozeti her kip için aynıdır.
        const initial = (profile?.nickname || 'P').trim().charAt(0).toUpperCase();
        avatarEl.replaceChildren(el('span', 'sp-avatar-letter', initial));
    }
}

// ── Hesap durumu ─────────────────────────────────────────────────────────────

/**
 * Profil panelinin ilk bloğu: oyuncu şu an KİM ve ne kazanabilir.
 *
 * <p>Metinler SAĞLAYICIDAN BAĞIMSIZDIR. Panelde "Google ile giriş yap" yazsaydı,
 * ikinci bir sağlayıcı eklendiği gün bu metinlerin hepsi yalan olurdu; giriş
 * YÖNTEMİ giriş ekranının işidir, panelin değil.
 */
function renderAccount() {
    const box = $('sp-account-body');
    if (!box) return;

    if (mode === 'google') {
        box.replaceChildren(
            el('span', 'sp-account-title', 'Account connected'),
            el('span', 'sp-account-text',
                'Your balance, inventory and cosmetics are synced to this account.'),
        );
        return;
    }

    const title = el('span', 'sp-account-title', 'Playing as guest');
    const text = el('span', 'sp-account-text',
        'You can play right away. Log in to unlock your balance, inventory and cosmetics, '
        + 'and to keep your progress on any device.');
    const btn = el('button', 'sp-account-btn', 'Log in');
    btn.type = 'button';
    btn.addEventListener('click', () => showAuthOverlay());

    box.replaceChildren(title, text, btn);
}

// ── İlerleme (yerel) ─────────────────────────────────────────────────────────

/**
 * Seviye + istatistikler.
 *
 * <p>KAYNAK YEREL: proxy'de henüz istatistik ucu yok (bkz. PlayerStats). Panel
 * bunu gizlemez — "this device" ibaresi, sayıların hesapla senkron OLMADIĞINI
 * söyler. Uydurma bir sunucu istatistiği göstermek, backend geldiğinde sessizce
 * yanlış olurdu.
 */
function renderStats() {
    const body = $('sp-stats-body');
    if (!body) return;

    const stats = readStats();

    // SEVIYE CUBUGU KALDIRILDI: seviye, yerel toplam skordan TURETILMIS bir
    // sayiydi ve sunucuda karsiligi yoktu. Ilerleme cubugu, arkasinda gercek
    // bir ilerleme sistemi varmis izlenimi verir; sayilar ise gercek.
    const grid = el('div', 'sp-stat-grid');
    grid.append(
        stat(formatAmount(stats.bestScore), 'Best score'),
        stat(formatAmount(stats.gamesPlayed), 'Games played'),
        stat(formatAmount(stats.totalScore), 'Total score'),
        stat(formatAmount(stats.foodEaten), 'Food eaten'),
    );

    const note = el('span', 'sp-account-text', 'Progress is tracked on this device.');
    note.style.padding = '0 14px';

    body.replaceChildren(grid, note);
}

function stat(value, label) {
    const box = el('div', 'sp-stat');
    box.append(el('span', 'sp-stat-value', value), el('span', 'sp-stat-label', label));
    return box;
}

// ── Takma ad düzenleme ───────────────────────────────────────────────────────

/**
 * GİRİŞ YAPMIŞ oyuncunun adını panelden değiştirmesini sağlar.
 *
 * <p>Ad, ana menüdeki kutu ile AYNI değerdir (bkz. main.js çift yönlü senkron);
 * burada düzenlenmesi o senkronu bozmaz, çünkü yazma yine tek noktadan
 * (SessionManager) geçer ve sunucuya da oradan gider.
 *
 * <p>MİSAFİR İÇİN KAPALI: kaydedilecek bir hesap yoktur. Misafir adını ana
 * menüdeki kutudan değiştirir ve değer yerelde saklanır.
 *
 * <p>İYİMSER DEĞİL: ad, sunucu 200 dönene kadar panelde DEĞİŞMEZ. Kaydedilmemiş
 * bir adı kaydedilmiş gibi göstermek, oyuncunun yenilediğinde eski adını
 * bulmasına yol açardı — sessiz ve kafa karıştırıcı.
 */
function beginNicknameEdit() {
    if (mode !== 'google') return;
    const nameEl = $('sp-nickname');
    const editBtn = $('sp-nickname-edit');
    if (!nameEl || nameEl.dataset.editing === 'true') return;

    const current = getSessionProfile()?.nickname ?? '';
    nameEl.dataset.editing = 'true';
    if (editBtn) editBtn.classList.add('hidden');

    const form = el('form', 'sp-nickname-form');
    const input = el('input', 'sp-nickname-input');
    input.type = 'text';
    input.value = current;
    input.maxLength = 16;
    input.setAttribute('aria-label', 'Nickname');

    const save = el('button', 'sp-nickname-save', 'Save');
    save.type = 'submit';

    const cancel = el('button', 'sp-icon-btn sp-icon-btn-sm');
    cancel.type = 'button';
    cancel.title = 'Cancel';
    cancel.append(el('span', 'material-symbols-outlined', 'close'));

    const finish = () => {
        nameEl.dataset.editing = 'false';
        if (editBtn) editBtn.classList.remove('hidden');
        renderProfile(getSessionProfile());
    };

    cancel.addEventListener('click', finish);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const value = input.value.trim();
        if (!value || value === current) { finish(); return; }

        save.disabled = true;
        input.disabled = true;
        save.textContent = 'Saving…';
        clearSkinError();

        try {
            const result = await updateNickname(value);
            // Sunucu adı temizleyip kırpabilir (kontrol karakterleri, 16 sınırı);
            // panelde GÖSTERİLECEK olan sunucunun döndürdüğü addır, yazılan değil.
            setPlayNickname(result?.nickname ?? value);
            finish();
        } catch (err) {
            save.disabled = false;
            input.disabled = false;
            save.textContent = 'Save';
            showSkinError(errorText(err));
        }
    });

    form.append(input, save, cancel);
    nameEl.replaceChildren(form);
    input.focus();
    input.select();
}

// ── Cüzdan ───────────────────────────────────────────────────────────────────

async function loadWallet({ force = false } = {}) {
    const body = $('sp-wallet-body');
    if (!body) return;

    if (mode !== 'google') {
        loaded.wallet = false;
        // SAĞLAYICI ADI GEÇMEZ: yarın Apple/Discord eklendiğinde bu metnin
        // değişmesi gerekmemeli (bkz. sp-account bloğundaki aynı gerekçe).
        renderState(body, { kind: 'locked', message: 'Login required to access your balance.' });
        return;
    }
    if (loaded.wallet && !force) return;

    const gen = generation;
    renderState(body, { kind: 'loading', message: 'Fetching balances…' });

    try {
        const balances = normalizeBalances(await getMyWalletBalances());
        if (gen !== generation) return;                 // oturum değişti — çizme
        loaded.wallet = true;

        if (balances.length === 0) {
            renderState(body, { kind: 'empty', message: 'No currencies yet.' });
            return;
        }

        const grid = el('div', 'sp-wallet-grid');
        for (const balance of balances) {
            const chip = el('div', 'sp-balance');
            const icon = el('span', 'material-symbols-outlined sp-balance-icon', currencyIcon(balance.code));
            const text = el('div', 'sp-balance-text');
            text.append(
                el('span', 'sp-balance-amount', formatAmount(balance.amount)),
                el('span', 'sp-balance-name', balance.name),
            );
            chip.append(icon, text);
            grid.append(chip);
        }
        body.replaceChildren(grid);
    } catch (err) {
        if (gen !== generation) return;
        loaded.wallet = false;
        renderState(body, { kind: 'error', message: errorText(err), onRetry: () => loadWallet({ force: true }) });
    }
}

// ── Mağaza ───────────────────────────────────────────────────────────────────

async function loadStore({ force = false } = {}) {
    const body = $('sp-store-body');
    const tabs = $('sp-catalog-tabs');
    if (!body) return;
    if (loaded.store && !force) return;

    const gen = generation;
    if (tabs) tabs.replaceChildren();
    renderState(body, { kind: 'loading', message: 'Loading store…' });

    try {
        const catalogs = normalizeCatalogs(await getCatalogs());
        if (gen !== generation) return;

        if (catalogs.length === 0) {
            loaded.store = true;
            renderState(body, { kind: 'empty', message: 'The store is empty right now.' });
            return;
        }

        // Seçili katalog hâlâ listede mi? Değilse ilkine dön.
        if (!activeCatalogKey || !catalogs.some((c) => c.key === activeCatalogKey)) {
            activeCatalogKey = catalogs[0].key;
        }

        // Katalog sekmeleri yalnızca BİRDEN FAZLA katalog varsa anlamlı.
        if (tabs) {
            tabs.replaceChildren();
            if (catalogs.length > 1) {
                for (const catalog of catalogs) {
                    const chip = el('button', 'sp-chip', catalog.name);
                    chip.type = 'button';
                    chip.classList.toggle('is-active', catalog.key === activeCatalogKey);
                    chip.addEventListener('click', () => {
                        if (activeCatalogKey === catalog.key) return;
                        activeCatalogKey = catalog.key;
                        tabs.querySelectorAll('.sp-chip').forEach((c) =>
                            c.classList.toggle('is-active', c === chip));
                        loadCatalogItems(catalog.key);
                    });
                    tabs.append(chip);
                }
            }
        }

        loaded.store = true;
        await loadCatalogItems(activeCatalogKey);
    } catch (err) {
        if (gen !== generation) return;
        loaded.store = false;
        renderState(body, { kind: 'error', message: errorText(err), onRetry: () => loadStore({ force: true }) });
    }
}

async function loadCatalogItems(catalogKey) {
    const body = $('sp-store-body');
    if (!body || !catalogKey) return;

    const gen = generation;
    renderState(body, { kind: 'loading', message: 'Loading prices…' });

    try {
        // İKİ UÇ BİRLİKTE: fiyatlar katalogdan, görseller varlık ucundan.
        // Paralel çağrılır — görsel indeksi sıralı beklenirse mağaza açılışı
        // gereksiz yere bir tur gecikir.
        const [pricesPayload, images] = await Promise.all([
            getCatalogPrices(catalogKey),
            ensureAssetImages(),
        ]);
        if (gen !== generation || activeCatalogKey !== catalogKey) return;

        const items = normalizeCatalogItems(pricesPayload).map((item) => (
            item.imageUrl ? item : { ...item, imageUrl: images.get(String(item.assetId)) ?? null }
        ));

        if (items.length === 0) {
            renderState(body, { kind: 'empty', message: 'No items in this catalog.' });
            return;
        }

        const list = el('div', 'sp-list');
        for (const item of items) list.append(storeRow(item));
        body.replaceChildren(list);
    } catch (err) {
        if (gen !== generation || activeCatalogKey !== catalogKey) return;
        renderState(body, {
            kind: 'error',
            message: errorText(err),
            onRetry: () => loadCatalogItems(catalogKey),
        });
    }
}

function storeRow(item) {
    const row = el('div', 'sp-row');
    row.append(thumb(item.imageUrl, item.name, item.kind));

    const info = el('div', 'sp-row-info');
    info.append(el('span', 'sp-row-name', item.name));
    info.append(el('span', 'sp-row-sub', item.kind));
    row.append(info);

    const priceWrap = el('div', 'sp-price-wrap');
    if (item.prices.length === 0) {
        priceWrap.append(el('span', 'sp-price-empty', '—'));
    } else {
        for (const price of item.prices) {
            const tag = el('span', 'sp-price');
            tag.append(
                el('span', 'material-symbols-outlined sp-price-icon', currencyIcon(price.code)),
                el('span', 'sp-price-amount', formatAmount(price.amount)),
            );
            tag.title = price.name ?? price.code ?? '';
            priceWrap.append(tag);
        }
    }
    row.append(priceWrap);
    return row;
}

/**
 * Görsel varsa <img>, yoksa kalem türüne göre bir ikon kutusu.
 *
 * <p>SIRA ÖNEMLİ: `error` dinleyicisi `src` ATANMADAN ÖNCE bağlanır. Ters
 * sırada, önbellekten gelen ya da anında başarısız olan bir istek error
 * olayını dinleyici takılmadan tetikleyebilir ve kutuda kırık bir resim
 * kalırdı.
 *
 * <p>`loading="lazy"` KULLANILMAZ: panel kapalıyken kartlar zaten çizilmiyor,
 * açıkken de hepsi görünür alandadır — lazy yalnızca fallback'i geciktirirdi.
 */
function thumb(imageUrl, name, kind) {
    const box = el('div', 'sp-thumb');
    if (!imageUrl) {
        box.append(thumbIcon(kind));
        return box;
    }

    const img = el('img');
    img.alt = name ?? '';
    img.addEventListener('error', () => box.replaceChildren(thumbIcon(kind)), { once: true });
    img.src = imageUrl;
    box.append(img);
    return box;
}

function thumbIcon(kind) {
    const icon = el('span', 'material-symbols-outlined sp-thumb-icon');
    const k = String(kind || '').toLowerCase();
    icon.textContent = k.includes('skin') ? 'palette'
        : k.includes('currency') ? 'paid'
        : k.includes('bundle') ? 'inventory_2'
        : 'category';
    return icon;
}

// ── Skinler ──────────────────────────────────────────────────────────────────
//
// GENEL "ITEMS" BOLUMU KALDIRILDI. Oyunun sahip oldugu tek kozmetik tur skin;
// ikinci bir liste, her zaman ya bos ya skinlerin kopyasi olan bir bolum
// demekti. Envanter ucu (/api/me/inventory) artik BURADAN cagrilmaz — skin
// ucu zaten sahip olunan skinleri ve aktif secimi birlikte donuyor.

async function loadSkins({ force = false } = {}) {
    const body = $('sp-skins-body');
    if (!body) return;

    if (mode !== 'google') {
        loaded.inventory = false;
        renderState(body, { kind: 'locked', message: 'Login required to access your skins.' });
        return;
    }
    if (loaded.inventory && !force) return;

    const gen = generation;
    renderState(body, { kind: 'loading', message: 'Loading skins…' });

    try {
        // Skinler + görsel indeksi PARALEL: önizleme görseli önce proxy'nin
        // skin kaydından (`imageUrl`, envanter varlığının `files` dizisinden)
        // gelir; envanter yanıtı dosyaları taşımıyorsa mağazayla AYNI indeksten
        // (/api/assets → files[].url) tamamlanır. İki kaynak da aynı LootLocker
        // `files` verisidir, yalnızca geldikleri uç farklıdır.
        const [result, images] = await Promise.all([getMySkins(), ensureAssetImages()]);
        if (gen !== generation) return;   // oturum değişti — çizme
        const normalized = normalizeSkins(result);
        normalized.skins = normalized.skins.map((skin) => (skin.imageUrl ? skin : {
            ...skin,
            imageUrl: images.get(String(skin.assetId))
                ?? images.get(String(skin.raw?.assetUlid ?? ''))
                ?? null,
        }));
        skinState = normalized;
        loaded.inventory = true;
        renderSkins();
    } catch (err) {
        if (gen !== generation) return;
        loaded.inventory = false;
        renderState(body, {
            kind: 'error',
            message: errorText(err),
            onRetry: () => loadSkins({ force: true }),
        });
    }
}

function renderSkins() {
    const body = $('sp-skins-body');
    if (!body) return;

    const { skins, activeSkinId } = skinState;
    if (skins.length === 0) {
        renderState(body, { kind: 'empty', message: 'No skins owned yet.' });
        return;
    }

    const grid = el('div', 'sp-skin-grid');
    for (const skin of skins) {
        const id = String(skin.assetId ?? skin.id ?? '');
        const isActive = id !== '' && id === String(activeSkinId ?? '');

        const card = el('button', 'sp-skin');
        card.type = 'button';
        card.classList.toggle('is-active', isActive);
        card.dataset.skinId = id;
        card.append(thumb(skin.imageUrl, skin.name, 'skin'));
        card.append(el('span', 'sp-skin-name', skin.name));
        // TAKILI SKIN ARTIK PASIF DEGIL: uzerine basmak onu CIKARIR. Eskiden
        // devre disi birakiliyordu, yani oyuncunun "hicbir skin takili degil"
        // durumuna donmesinin HICBIR yolu yoktu — ancak baska bir skin
        // takabiliyordu.
        card.append(el('span', 'sp-skin-state', isActive ? 'UNEQUIP' : 'EQUIP'));
        card.title = isActive ? 'Unequip this skin' : 'Equip this skin';
        card.addEventListener('click', () => (isActive ? unequipSkin(card) : equipSkin(id, card)));
        grid.append(card);
    }
    body.replaceChildren(grid);
}

/**
 * Skini takar. Sunucu sahipliği doğrular; başarıda yerel aktif skin güncellenir.
 *
 * <p>İyimser güncelleme YAPILMAZ: PUT reddedilirse (sahiplik yok, 409) yanlış
 * skini "takılı" göstermiş olurduk. Bunun yerine düğme bekleme durumuna geçer.
 */
async function equipSkin(skinId, card) {
    if (!skinId) return;
    const gen = generation;
    const stateEl = card.querySelector('.sp-skin-state');
    const previous = stateEl?.textContent;

    card.disabled = true;
    card.classList.add('is-busy');
    if (stateEl) stateEl.textContent = 'EQUIPPING…';
    clearSkinError();

    try {
        await setActiveSkin(skinId);
        if (gen !== generation) return;
        skinState.activeSkinId = String(skinId);
        renderSkins();
    } catch (err) {
        if (gen !== generation) return;
        card.disabled = false;
        card.classList.remove('is-busy');
        if (stateEl) stateEl.textContent = previous ?? 'EQUIP';
        showSkinError(errorText(err));
    }
}

/**
 * TAKILI SKINI CIKARIR.
 *
 * <p>{@link equipSkin} ile ayni iskelet: iyimser gorsel geri bildirim, bayat
 * yanit korumasi (generation) ve hata durumunda ONCEKI etikete donus. Ayri bir
 * fonksiyon olmasinin sebebi tek satirlik fark degil, FARKLI UCU cagirmasidir
 * (DELETE .../active) — birlestirilmis bir fonksiyon her cagrida "hangi yol"
 * dallanmasi tasirdi.
 */
async function unequipSkin(card) {
    const gen = generation;
    const stateEl = card.querySelector('.sp-skin-state');
    const previous = stateEl?.textContent;

    card.disabled = true;
    card.classList.add('is-busy');
    if (stateEl) stateEl.textContent = 'REMOVING…';
    clearSkinError();

    try {
        await clearActiveSkin();
        if (gen !== generation) return;
        skinState.activeSkinId = null;
        renderSkins();
    } catch (err) {
        if (gen !== generation) return;
        card.disabled = false;
        card.classList.remove('is-busy');
        if (stateEl) stateEl.textContent = previous ?? 'UNEQUIP';
        showSkinError(errorText(err));
    }
}

function showSkinError(message) {
    const box = $('sp-skin-error');
    if (!box) return;
    box.textContent = message;
    box.classList.remove('hidden');
}

function clearSkinError() {
    const box = $('sp-skin-error');
    if (!box) return;
    box.textContent = '';
    box.classList.add('hidden');
}

// ── Görünüm anahtarlama ──────────────────────────────────────────────────────

function setView(view) {
    activeView = view;
    // Şerit düğmeleri panel KAPALIYKEN de aktif bölümü gösterir: açıldığında
    // nereye düşeceği sürpriz olmamalı.
    for (const btn of document.querySelectorAll('.sp-rail-btn[data-view]')) {
        const isActive = btn.dataset.view === view;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-current', isActive ? 'true' : 'false');
    }
    $('sp-view-profile')?.classList.toggle('hidden', view !== 'profile');
    $('sp-view-shop')?.classList.toggle('hidden', view !== 'shop');
    ensureViewLoaded(view);
}

function ensureViewLoaded(view) {
    if (!expanded || mode === null) return;
    if (view === 'shop') {
        loadStore();
        return;
    }
    // Profil: hesap/ilerleme blokları ağ GEREKTİRMEZ, anında çizilir; bakiye ve
    // envanter kipe göre ya yüklenir ya kilitli satır gösterir.
    renderAccount();
    renderStats();
    loadWallet();
    loadSkins();
}

// ── Oturum geçişleri ─────────────────────────────────────────────────────────

/**
 * Kip değiştiğinde tüm önbelleği düşürür ve uçuştaki yanıtları geçersiz kılar.
 * Yeni kipin verisi sıfırdan çekilir.
 */
function resetForNewSession() {
    generation += 1;
    loaded.wallet = false;
    loaded.store = false;
    loaded.inventory = false;
    skinState = { skins: [], activeSkinId: null };
    clearSkinError();
}

function applySession({ mode: nextMode, profile }) {
    const changed = nextMode !== mode;
    mode = nextMode;

    if (changed) resetForNewSession();

    const panel = $('side-panel');
    if (!panel) return;

    if (mode === null) {
        panel.hidden = true;
        setExpanded(false);
        return;
    }

    panel.hidden = false;
    panel.dataset.mode = mode;
    renderProfile(profile);
    // Kipe bağlı bloklar çekmece kapalıyken de güncel tutulur: açılış anında
    // "bir an eski durumu gösterip sonra düzelen" panel istemiyoruz.
    renderAccount();

    // Cüzdan her zaman görünür (google'da veri, misafirde kilit satırı) —
    // çekmece kapalıyken bile ilk açılışta hazır olsun diye burada çizilir.
    loadWallet();
    if (expanded) ensureViewLoaded(activeView);
}

// ── Kurulum ──────────────────────────────────────────────────────────────────

/**
 * Paneli bağlar. Uygulama başlarken BİR KEZ çağrılır (bkz. src/main.js).
 *
 * @param {object}   opts
 * @param {function} [opts.onSignOut] Çıkış düğmesine basıldığında çağrılır.
 *                   Oturumu düşürmek main.js'in işi: panel kimliği sahiplenmez.
 */
export function initSidePanel({ onSignOut } = {}) {
    if (initialized) return;
    const panel = $('side-panel');
    if (!panel) return;
    initialized = true;

    $('side-panel-toggle')?.addEventListener('click', () => setExpanded(!expanded));

    // ŞERİT DÜĞMESİ İKİ İŞ YAPAR: bölümü seçer VE panel kapalıysa açar.
    // Ayrı bir "önce aç, sonra sekme seç" adımı istemek, tek tıkla ulaşılması
    // gereken bir şeyi iki tıka çıkarırdı. Açıkken aynı bölüme basmak paneli
    // KAPATIR — şerit böylece aç/kapa için de tutarlı bir kol olur.
    for (const btn of document.querySelectorAll('.sp-rail-btn[data-view]')) {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            if (expanded && activeView === view) {
                setExpanded(false);
                return;
            }
            setView(view);
            if (!expanded) setExpanded(true);
        });
    }

    $('sp-wallet-refresh')?.addEventListener('click', () => loadWallet({ force: true }));
    $('sp-nickname-edit')?.addEventListener('click', beginNicknameEdit);
    $('sp-signout')?.addEventListener('click', () => onSignOut?.());

    // Escape ile kapat — modal olmayan ama ekranı kaplayan her çekmecenin borcu.
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && expanded) setExpanded(false);
    });

    setExpanded(false);
    setView(activeView);

    // Abone olurken mevcut durum da hemen iletilir (bkz. onSessionChange).
    onSessionChange(applySession);
    mode = getAuthMode();
}
