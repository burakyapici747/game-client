// ─────────────────────────────────────────────────────────────────────────────
// GAME API — Java proxy uç noktalarının adlandırılmış erişimcileri
//
// Ham yolları çağrı yerlerine dağıtmak yerine burada topluyoruz. Kazanç:
// bir ucun korumalı mı public mi olduğu KOD DÜZEYİNDE görünür ve rota
// yeniden adlandırıldığında tek dosya değişir.
//
// KORUMALI erişimciler apiFetch üzerinden gider → Bearer OTOMATİK eklenir.
// PUBLIC erişimciler apiGetPublic kullanır → token varsa bile GÖNDERİLMEZ.
// İkincisi bilinçli: bu uçlar oturum açılmamışken de çalışmak zorunda ve
// başlıksız istek "simple request" kalıp CORS preflight'ı hiç tetiklemez.
//
// Hata sözleşmesi: her fonksiyon başarısızlıkta ApiError fırlatır. 401/503
// kullanıcı bildirimi çağrı yerinde DEĞİL, global kancalarda yapılır
// (bkz. src/auth/SessionManager.js → initSessionBridge).
//
// ── ŞEKİL TOLERANSI (dosyanın ikinci yarısı) ────────────────────────────────
// Proxy, LootLocker yanıtlarını bazı uçlarda olduğu gibi geçirir, bazılarında
// sarmalar. İstemci UI'ı bu farkı BİLMEMELİ. Bu yüzden her koleksiyon ucu için
// bir `normalize*` fonksiyonu var: yanıtın dizi mi, `{items:[…]}` mi, yoksa
// `{data:{balances:[…]}}` mi olduğuna bakılmaksızın TEK bir domain şekli üretir.
//
// Kural: UI ASLA ham yanıt alanlarına dokunmaz — yalnızca normalize edilmiş
// nesneleri tüketir. Backend bir alanı yeniden adlandırdığında değişecek tek
// yer aşağıdaki ayıklayıcılardır.
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, apiGetPublic, apiPost, apiPut } from './ApiClient.js';

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC — Bearer gerekmez, oturumsuz çalışır
// ═════════════════════════════════════════════════════════════════════════════

/** Aktif mağaza katalogları (proxy tarafında 15 dk önbellekli). */
export const getCatalogs = (options) => apiGetPublic('/api/catalogs', options);

/** Bir katalogdaki kalem fiyatları ve para birimi eşlemeleri. */
export const getCatalogPrices = (catalogKey, options) =>
    apiGetPublic(`/api/catalogs/${encodeURIComponent(catalogKey)}/prices`, options);

/** Global oyun varlıkları (skinler vb. — proxy tarafında 30 dk önbellekli). */
export const getAssets = (options) => apiGetPublic('/api/assets', options);

/**
 * Yalnızca istenen id'ler için sadeleştirilmiş varlık kayıtları.
 *
 * <p>POST olmasına rağmen PUBLIC bir uç: `auth: false` AÇIKÇA verilir, çünkü
 * apiPost varsayılan olarak yolun korumalı olup olmadığına bakar ve /api/assets
 * korumalı listede değildir — yine de niyeti kodda görünür kılıyoruz.
 */
export const getSimplifiedAssets = (assetIds, options) =>
    apiPost('/api/assets/simplified', { filters: { asset_ids: assetIds } }, { ...options, auth: false });

/** Sunucu düzeyinde tanımlı para birimleri (60 dk önbellekli). */
export const getCurrencies = (options) => apiGetPublic('/api/currencies', options);

/** Oyun düzeyinde yapılandırılmış para birimleri. */
export const getGameCurrencies = (options) => apiGetPublic('/api/currencies/game', options);

// ═════════════════════════════════════════════════════════════════════════════
// KORUMALI — Authorization: Bearer <Google ID Token> otomatik
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Oturum açmış oyuncunun profili. Google ID Token'ı doğrular, LootLocker
 * hesabını bağlar/oluşturur. Oturum kurulum ucu da budur
 * (bkz. SessionManager.SESSION_ROUTE).
 */
export const getMe = (options) => apiFetch('/api/me', options);

/** Oturum açmış oyuncunun canlı cüzdan bakiyeleri. */
export const getMyWalletBalances = (options) => apiFetch('/api/me/wallet/balances', options);

/** Oturum açmış oyuncunun envanteri. */
export const getMyInventory = (options) => apiFetch('/api/me/inventory', options);

/** Sahip olunan skinler + o an takılı olan aktif skin. */
export const getMySkins = (options) => apiFetch('/api/me/skins', options);

/**
 * Aktif skini değiştirir. Proxy önce envanterde sahiplik doğrular.
 *
 * <p>GÖVDE SÖZLEŞMESİ tek noktada tutulur (ACTIVE_SKIN_BODY): backend alan
 * adını değiştirirse burada tek satır güncellenir, çağrı yerleri sabit kalır.
 */
export const setActiveSkin = (assetId, options) =>
    apiPut('/api/me/skins/active', ACTIVE_SKIN_BODY(assetId), options);

/**
 * PUT /api/me/skins/active gövdesi. Backend sözleşmesinin tek aynası.
 *
 * <p>Alan adı `assetId` — Java Controller/Service katmanının beklediği
 * camelCase DTO alanı. Jackson varsayılan olarak snake_case'i BU alana
 * eşlemez (SNAKE_CASE naming strategy açıkça yapılandırılmadıkça), yani
 * `skin_id` göndermek alanı sessizce null bırakırdı — istek 200 dönse bile
 * skin değişmezdi. Değer, kalemin ULID'idir (bkz. normalizeInventory:
 * assetId önceliği ULID → sayısal legacy id).
 */
export const ACTIVE_SKIN_BODY = (assetId) => ({ assetId });

/** Verilen holder/kullanıcı kimliğine ait cüzdan metadata'sı. */
export const getWalletsByHolder = (holderId, options) =>
    apiFetch(`/api/wallets/holder/${encodeURIComponent(holderId)}`, options);

/** Belirli bir cüzdanın çekirdek metadata'sı. */
export const getWallet = (walletId, options) =>
    apiFetch(`/api/wallets/${encodeURIComponent(walletId)}`, options);

/** Belirli bir cüzdanın canlı bakiyeleri. */
export const getWalletBalances = (walletId, options) =>
    apiFetch(`/api/wallets/${encodeURIComponent(walletId)}/balances`, options);

/** Belirli bir oyuncunun envanteri. */
export const getPlayerInventory = (playerId, options) =>
    apiFetch(`/api/players/${encodeURIComponent(playerId)}/inventory`, options);

/** Uygulama içi satın alma makbuzunu LootLocker üzerinden doğrular. */
export const verifyPurchase = (payload, options) =>
    apiPost('/api/purchases/verify', payload, options);

// ═════════════════════════════════════════════════════════════════════════════
// NORMALİZASYON — proxy yanıt şekli ⇄ UI domain şekli
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Yanıt gövdesinden bir koleksiyon ayıklar.
 *
 * <p>Sırayla dener: gövdenin kendisi dizi mi → adı verilen anahtarlar → yaygın
 * sarmalayıcılar (`data`, `result`) içinde aynı arama. Hiçbiri tutmazsa BOŞ
 * DİZİ döner; UI "veri yok" durumunu gösterir, patlamaz.
 */
function collection(payload, keys) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];

    for (const key of keys) {
        if (Array.isArray(payload[key])) return payload[key];
    }

    for (const wrapper of ['data', 'result', 'response']) {
        const inner = payload[wrapper];
        if (Array.isArray(inner)) return inner;
        if (inner && typeof inner === 'object') {
            for (const key of keys) {
                if (Array.isArray(inner[key])) return inner[key];
            }
        }
    }
    return [];
}

/** Bir nesneden ilk dolu alanı okur. Alan adları backend'e göre değişebilir. */
function pick(source, keys, fallback = null) {
    if (!source || typeof source !== 'object') return fallback;
    for (const key of keys) {
        const value = source[key];
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return fallback;
}

/** Sayıya çevirir; çevrilemiyorsa 0 (bakiye/fiyat alanları için güvenli). */
function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Bir alanı GÖSTERİLEBİLİR metne indirger.
 *
 * <p>LootLocker bazı alanları nesne olarak döndürüyor — `rarity` gerçekte
 * `{name: "EPIC", short_name: "EPIC", color: "c251a4"}`. Doğrudan textContent'e
 * verilirse ekranda "[object Object]" görünür; bu yüzden nesnelerden ad alanı
 * çekilir.
 */
function text(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'object') {
        return pick(value, ['name', 'short_name', 'shortName', 'title', 'label', 'code']);
    }
    return String(value);
}

/**
 * LootLocker varlık görselini bulur.
 *
 * <p>Görsel ÜÇ ayrı yerde olabilir ve sırayla denenir:
 *   1. Düz alan (`image`, `thumbnail`, …) — proxy sadeleştirilmiş kayıt verirse.
 *   2. `links` alt nesnesi (`links.thumbnail_url`).
 *   3. `files[]` dizisi — LootLocker varlıklarının GERÇEKTE kullandığı yer;
 *      her kayıt `{url, tags}` taşır. "thumbnail" etiketli dosya varsa o
 *      tercih edilir, yoksa url'i olan ilk dosya alınır.
 *
 * <p>Not: bu URL'ler imzalıdır ve `Expires` parametresi taşır — kalıcı olarak
 * saklanmamalı, her yanıtta yeniden okunmalıdır.
 */
// Dosya kaydinda adresi tasiyabilecek anahtarlar. LootLocker surumler arasinda
// `url` ve `file_url` arasinda gidip geliyor; listeyi GENIS tutmak, tek bir
// anahtara bahse girip gorseli sessizce kaybetmekten ucuzdur.
const FILE_URL_KEYS = ['url', 'file_url', 'fileUrl', 'cdn_url', 'cdnUrl', 'path', 'link', 'href'];

// Onceliklendirme: kucuk gorsel > genel gorsel. Katalog karti bir kucuk resim
// ister; tam boy dosya varsa da kabul edilir ama once thumbnail aranir.
const PREFERRED_FILE_TAGS = ['thumbnail', 'thumb', 'icon', 'image', 'preview'];

/** Dosya kaydindan adres cikarir; hicbir anahtar tutmazsa null. */
function fileUrl(file) {
    if (!file || typeof file !== 'object') return null;
    for (const key of FILE_URL_KEYS) {
        const value = file[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
}

function isImageFile(file) {
    const type = String(file?.content_type ?? file?.contentType ?? '').toLowerCase();
    if (type.startsWith('image/')) return true;
    const url = fileUrl(file);
    return typeof url === 'string' && /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(url);
}

// Gorsel bulunamayan varliklarda bir KEZ uyarir: "resimler gelmiyor" sikayeti
// ile "hangi alanda geliyor" sorusu arasindaki bosluk tam olarak buydu.
// Konsolda gercek anahtarlari gostermek, tahmin turunu bitirir.
let filesShapeWarned = false;

function warnUnknownFileShape(source) {
    if (filesShapeWarned) return;
    filesShapeWarned = true;
    const sample = Array.isArray(source?.files) ? source.files[0] : null;
    console.warn(
        '[api] Varlik dosyalarinda taninan bir gorsel adresi bulunamadi. ' +
        'Beklenen anahtarlar: ' + FILE_URL_KEYS.join(', ') + '. ' +
        'Gelen ilk dosya kaydinin anahtarlari: ' +
        (sample && typeof sample === 'object' ? Object.keys(sample).join(', ') : '(dosya yok)'),
        sample,
    );
}

/**
 * Bir varlik kaydindan gorsel adresini cikarir.
 *
 * <p>SIRA: dogrudan alanlar > `links` > `files[]`. Katalog yanitinda gorsel
 * neredeyse her zaman `files` dizisindedir ve dizideki kayitlarin bicimi
 * surumden surume degisir; bu yuzden hem ANAHTAR hem ETIKET kumesi genis
 * tutulur ve hicbiri tutmazsa durum sessizce yutulmaz (bkz. warnUnknownFileShape).
 */
function imageOf(source) {
    if (!source || typeof source !== 'object') return null;

    const direct = pick(source, ['image', 'imageUrl', 'image_url', 'thumbnail', 'icon', 'url']);
    if (direct && typeof direct === 'string') return direct;

    const links = source.links;
    if (links && typeof links === 'object') {
        const fromLinks = pick(links, ['thumbnail_url', 'thumbnailUrl', 'thumbnail', 'url', 'image']);
        if (fromLinks && typeof fromLinks === 'string') return fromLinks;
    }

    const files = Array.isArray(source.files) ? source.files : [];
    if (files.length === 0) return null;

    // 1) Etiketi tercih edilen bir dosya (thumbnail/icon/...).
    for (const tag of PREFERRED_FILE_TAGS) {
        const tagged = files.find((f) =>
            Array.isArray(f?.tags) && f.tags.some((t) => String(t).toLowerCase().includes(tag)));
        const url = fileUrl(tagged);
        if (url) return url;
    }

    // 2) Etiket yoksa GORSEL olan ilk dosya (content_type ya da uzanti).
    const imageEntry = files.find((f) => isImageFile(f) && fileUrl(f));
    if (imageEntry) return fileUrl(imageEntry);

    // 3) Son care: adresi olan ilk dosya.
    const anyEntry = files.find((f) => fileUrl(f));
    if (anyEntry) return fileUrl(anyEntry);

    warnUnknownFileShape(source);
    return null;
}

/**
 * LootLocker'ın `*_details` yan tablolarını tek bir arama haritasına çevirir.
 *
 * <p>Katalog fiyat yanıtı kalem metadata'sını satır İÇİNDE taşımaz; satırda
 * yalnızca `entity_id` bulunur ve ad/görsel `assets_details`, `currency_details`
 * gibi yan tablolarda durur. Bu tablolar ya id ile anahtarlanmış bir nesne ya da
 * düz bir dizi olabilir; ikisi de aynı Map'e indirgenir.
 */
function detailIndex(payload) {
    const index = new Map();
    if (!payload || typeof payload !== 'object') return index;

    for (const [key, table] of Object.entries(payload)) {
        if (!key.endsWith('_details') || !table || typeof table !== 'object') continue;

        const entries = Array.isArray(table) ? table : Object.entries(table);
        for (const entry of entries) {
            // Nesne biçiminde [id, kayıt]; dizi biçiminde doğrudan kayıt.
            const [maybeKey, record] = Array.isArray(table) ? [null, entry] : entry;
            if (!record || typeof record !== 'object') continue;

            // Kayıt kendi kimliğini de taşıyabilir — her iki anahtarı da yaz ki
            // satırdaki entity_id hangisiyse tutsun.
            for (const id of [maybeKey, ...['ulid', 'id', 'uuid', 'asset_id'].map((k) => record[k])]) {
                if (id !== null && id !== undefined && id !== '') index.set(String(id), record);
            }
        }
    }
    return index;
}

/**
 * GET /api/me → { playerId, nickname, email, picture, walletId, raw }
 *
 * <p>Proxy'nin oyuncu kaydı LootLocker alanlarını (`player_id`, `public_uid`)
 * ya da Google profil alanlarını (`email`, `name`) taşıyabilir; ikisi de aynı
 * domain nesnesine indirgenir. `raw` her zaman korunur — burada karşılanmayan
 * bir alana ihtiyaç doğarsa UI onu okuyabilir.
 */
/**
 * PUT /api/me/nickname — oyun ici goruntuleme adini gunceller.
 *
 * <p>Ad bir KIMLIK alani DEGILDIR: sunucu yetkiyi daima oturumdan alir ve bu
 * cagri yalnizca bir tercihi saklar. Dogrulama sunucuda da yapilir; buradaki
 * kirpma yalnizca kullaniciya aninda geri bildirim icindir.
 */
export function updateNickname(nickname) {
    return apiFetch('/api/me/nickname', { method: 'PUT', body: { nickname } });
}

/** DELETE /api/me/skins/active — takili skini cikarir (unequip). */
export function clearActiveSkin() {
    return apiFetch('/api/me/skins/active', { method: 'DELETE' });
}

/**
 * VARLIK KIMLIGI -> GORSEL ADRESI indeksi.
 *
 * <p><b>NEDEN GEREKLI:</b> katalog fiyat yaniti gorsel TASIMAZ. Olculen gercek
 * yanitta {@code assets_details[].thumbnail === null} ve {@code file_details === null};
 * dosyalar YALNIZCA tam varlik kaydinda ({@code /api/assets}) bulunur:
 * <pre>
 *   files: [{ url: "https://static.lootlocker.com/....png?Expires=...", tags: ["SKIN_1"] }]
 * </pre>
 * Dolayisiyla magaza kartlarindaki gorsel, iki ucun BIRLESTIRILMESIYLE elde
 * edilir. Bu birlestirme olmadan kartlar kalici olarak jenerik ikon gosterirdi —
 * "resimler gelmiyor" sikayetinin sebebi ayristirma hatasi degil, EKSIK VERIYDI.
 *
 * <p>Etiketler ({@code tags}) burada "thumbnail" gibi anlamli degerler degil,
 * varligin ADI olabiliyor; bu yuzden secim etikete degil, dosyanin gorsel olup
 * olmadigina dayanir (bkz. imageOf).
 *
 * @param {*} assetsPayload /api/assets yaniti
 * @returns {Map<string, string>} ulid/id/legacy_id -> gorsel adresi
 */
export function buildAssetImageIndex(assetsPayload) {
    const index = new Map();
    for (const asset of collection(assetsPayload, ['assets', 'items'])) {
        const url = imageOf(asset);
        if (!url) continue;
        // Katalog satiri varliga ULID ile atifta bulunur, envanter ise sayisal
        // legacy id kullanabilir; ikisini de anahtarliyoruz.
        for (const key of [asset?.ulid, asset?.id, asset?.legacy_id, asset?.uuid]) {
            if (key !== undefined && key !== null && key !== '') index.set(String(key), url);
        }
    }
    return index;
}

export function normalizeProfile(payload) {
    const src = (payload && typeof payload === 'object' && !Array.isArray(payload))
        ? (payload.player ?? payload.data ?? payload)
        : {};

    // Oyuncunun SECTIGI ad `user` dalinda gelir; `player` dalinda yoktur.
    // Onceligi sunucunun hesapladigi `user.nickname` alir — "hangisi gecerli"
    // karari sunucudadir (bkz. PlayerProfileService.nickname).
    const user = (payload && typeof payload === 'object') ? payload.user : null;

    return {
        playerId: pick(src, ['playerId', 'player_id', 'id', 'public_uid', 'playerUid']),
        nickname: pick(user ?? {}, ['nickname'])
                  ?? pick(src, ['nickname', 'name', 'playerName', 'player_name', 'displayName', 'display_name']),
        email:    pick(src, ['email', 'emailAddress', 'email_address']),
        picture:  pick(src, ['picture', 'avatar', 'avatarUrl', 'avatar_url', 'imageUrl']),
        walletId: pick(src, ['walletId', 'wallet_id', 'walletID']),
        raw: payload,
    };
}

/**
 * GET /api/me/wallet/balances → [{ code, name, amount, currencyId }]
 *
 * <p>LootLocker bakiye kaydı parayı iç içe bir `currency` nesnesinde taşır;
 * düzleştirilmiş varyantlar da (`currency_code` doğrudan kayıtta) görülüyor.
 * İkisi de desteklenir.
 */
export function normalizeBalances(payload) {
    return collection(payload, ['balances', 'items', 'wallets', 'currencies'])
        .map((entry) => {
            const currency = (entry && typeof entry.currency === 'object') ? entry.currency : entry;
            const code = pick(currency, ['code', 'currency_code', 'currencyCode', 'short_code'], null);
            const name = pick(currency, ['name', 'currency_name', 'currencyName'], null);
            return {
                currencyId: pick(currency, ['id', 'currency_id', 'currencyId']),
                code: code ? String(code).toUpperCase() : null,
                name: name ?? (code ? String(code).toUpperCase() : 'Currency'),
                amount: num(pick(entry, ['amount', 'balance', 'value', 'quantity'], 0)),
            };
        })
        // Adsız/kodsuz kayıt gösterilecek bir şey taşımıyor — HUD'u kirletmesin.
        .filter((b) => b.code || b.name !== 'Currency');
}

/**
 * GET /api/me/inventory → [{ id, assetId, name, kind, rarity, imageUrl, quantity }]
 */
export function normalizeInventory(payload) {
    return collection(payload, ['items', 'inventory', 'entries', 'assets'])
        .map((entry) => {
            // Kalem, varlık metadata'sını iç içe bir `asset` altında taşıyabilir.
            const asset = (entry && typeof entry.asset === 'object') ? entry.asset : entry;
            return {
                id:       pick(entry, ['instance_id', 'instanceId', 'id', 'inventory_id']),
                // ULID once: LootLocker katalog satirlari varliga ULID ile
                // referans verir, sayisal `id` eski (legacy) anahtardir.
                assetId:  pick(asset, ['asset_id', 'assetId', 'ulid', 'id']),
                name:     text(pick(asset, ['name', 'asset_name', 'entity_name', 'title'])) ?? 'Unnamed item',
                kind:     text(pick(asset, ['kind', 'entity_kind', 'type', 'asset_type', 'category', 'context'])) ?? 'item',
                // rarity NESNE olabilir ({name:"EPIC", color:…}) — text() duzler.
                rarity:   text(pick(asset, ['rarity', 'tier', 'grade'])),
                imageUrl: imageOf(asset),
                quantity: num(pick(entry, ['quantity', 'amount', 'count'], 1)) || 1,
                raw: entry,
            };
        });
}

/**
 * GET /api/me/skins → { skins: [...], activeSkinId }
 *
 * <p>Aktif skin ya ayrı bir alanda (`active_skin`), ya da listedeki kaydın
 * `equipped/active` bayrağında gelebilir. Her iki yol da tek bir
 * `activeSkinId`'ye indirgenir; UI yalnızca onu karşılaştırır.
 */
export function normalizeSkins(payload) {
    const skins = normalizeInventory(
        // Skin listesi kendi anahtarını kullanabilir; inventory ayıklayıcısını
        // ona da yönlendiriyoruz (aynı kalem şekli).
        Array.isArray(payload) ? payload
            : { items: collection(payload, ['skins', 'owned', 'owned_skins', 'items', 'inventory']) }
    );

    const activeRaw = payload && typeof payload === 'object'
        ? pick(payload, ['active_skin', 'activeSkin', 'equipped_skin', 'equippedSkin', 'active', 'active_skin_id', 'activeSkinId'])
        : null;

    let activeSkinId = null;
    if (activeRaw && typeof activeRaw === 'object') {
        activeSkinId = pick(activeRaw, ['asset_id', 'assetId', 'id', 'skin_id', 'skinId']);
    } else if (activeRaw !== null && activeRaw !== undefined) {
        activeSkinId = activeRaw;
    }

    // Ayrı alan yoksa listedeki bayrağa düş.
    if (activeSkinId === null || activeSkinId === undefined) {
        const flagged = skins.find((s) => {
            const r = s.raw;
            return r?.equipped === true || r?.active === true || r?.is_active === true || r?.isEquipped === true;
        });
        activeSkinId = flagged ? (flagged.assetId ?? flagged.id) : null;
    }

    return { skins, activeSkinId: activeSkinId === null ? null : String(activeSkinId) };
}

/** GET /api/catalogs → [{ key, name }] */
export function normalizeCatalogs(payload) {
    return collection(payload, ['catalogs', 'items', 'entries'])
        .map((entry) => ({
            key:  pick(entry, ['key', 'catalog_key', 'catalogKey', 'ulid', 'id']),
            name: pick(entry, ['name', 'catalog_name', 'title'], 'Store'),
            raw: entry,
        }))
        .filter((c) => c.key);
}

/**
 * GET /api/catalogs/{key}/prices → [{ id, name, kind, imageUrl, prices: [...] }]
 *
 * <p>Fiyat listesi kalem başına ÇOKLU olabilir (aynı skin hem Gold hem Gems
 * ile satılabilir), bu yüzden dizi olarak korunur.
 */
export function normalizeCatalogItems(payload) {
    // Kalem metadata'si satirda DEGIL, `*_details` yan tablolarindadir.
    const details = detailIndex(payload);

    return collection(payload, ['entries', 'items', 'listings', 'prices'])
        .map((entry) => {
            const entityId = pick(entry, ['entity_id', 'entityId', 'asset_id', 'assetId']);
            // Oncelik: satir ici `asset` > yan tablo kaydi > satirin kendisi.
            const inline = (entry && typeof entry.asset === 'object') ? entry.asset : null;
            const detail = entityId !== null ? details.get(String(entityId)) : null;
            const asset = inline ?? detail ?? entry;

            const rawPrices = Array.isArray(entry?.prices) ? entry.prices
                : (entry?.price !== undefined && entry?.price !== null) ? [entry] : [];

            return {
                id:       pick(entry, ['catalog_listing_id', 'catalogListingId', 'listing_id', 'id']),
                assetId:  entityId ?? pick(asset, ['ulid', 'id']),
                name:     text(pick(entry, ['entity_name', 'entityName']))
                          ?? text(pick(asset, ['name', 'title'])) ?? 'Unnamed item',
                kind:     text(pick(entry, ['entity_kind', 'entityKind']))
                          ?? text(pick(asset, ['kind', 'type', 'context'])) ?? 'item',
                imageUrl: imageOf(asset),
                prices: rawPrices.map((p) => ({
                    amount: num(pick(p, ['amount', 'price', 'value'], 0)),
                    code: String(
                        pick(p, ['currency_code', 'currencyCode', 'code'], '') ||
                        pick(p?.currency, ['code', 'currency_code'], '') || ''
                    ).toUpperCase() || null,
                    name: pick(p, ['currency_name', 'currencyName'], null)
                        ?? pick(p?.currency, ['name'], null),
                })),
                raw: entry,
            };
        });
}

/** GET /api/currencies | /api/currencies/game → [{ code, name, id }] */
export function normalizeCurrencies(payload) {
    return collection(payload, ['currencies', 'items', 'entries'])
        .map((entry) => {
            const code = pick(entry, ['code', 'currency_code', 'short_code', 'currencyCode']);
            return {
                id: pick(entry, ['id', 'currency_id', 'ulid']),
                code: code ? String(code).toUpperCase() : null,
                name: pick(entry, ['name', 'currency_name'], code ? String(code).toUpperCase() : 'Currency'),
            };
        })
        .filter((c) => c.code || c.id);
}
