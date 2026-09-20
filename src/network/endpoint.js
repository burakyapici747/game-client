// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT ÇÖZÜMLEME — "backend nerede?" sorusunun tek sahiplik noktası
//
// İki adres üretir ve ikisi de AYNI mantıkla çözülür:
//   resolveWsUrl()      → oyun sunucusunun WebSocket adresi
//   resolveApiBaseUrl() → Java proxy'nin HTTP kökü (/api/** buraya gider)
//
// Sayfa HTTPS üzerinden servis edildiğinde tarayıcı ws:// bağlantısını mixed
// content olarak bloklar; soket açılmadan 1006 ile kapanır. Bu yüzden şema
// hiçbir yerde sabit yazılmaz, çalışma anında şu sırayla çözülür:
//
//   1. Menüden seçilen sunucunun mutlak wsUrl'i (public/config.json)
//   2. Sayfa uzak bir HTTPS origin'inden geliyorsa → aynı origin: wss://<host>/ws
//   3. Vite dev sunucusu → .env değerleri (yereldeki oyun sunucusu)
//   4. Diğer her durum (native kabuk, config.json okunamadı) → PROD_WS_URL
//
// (2) adımı native build'lerde kasıtlı olarak atlanır: Capacitor WebView'ında
// origin http://localhost (Android) ya da capacitor://localhost (iOS) olur,
// yani oyun sunucusu değil paketin kendisidir. Native kabuk config.json'ı
// okuyamazsa 127.0.0.1'e değil doğrudan üretime düşer — telefonda localhost
// diye bir oyun sunucusu yok.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PATH = '/ws';
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '']);

/** Üretim endpoint'i. Build sırasında VITE_WS_URL ile ezilebilir. */
const PROD_WS_URL = import.meta.env?.VITE_WS_URL || 'wss://seanakes.io/ws';

/**
 * Vite dev sunucusu mu?
 * Android Capacitor da http://localhost'tan servis edilir; ayırt edici olan
 * port: dev sunucusu her zaman explicit bir portta (3000/5173) çalışır, native
 * kabuk varsayılan portu kullanır (location.port === '').
 */
function isDevServer() {
    const { protocol, hostname, port } = window.location;
    if (import.meta.env?.DEV === true) return true;
    return protocol.startsWith('http') && LOCAL_HOSTNAMES.has(hostname) && port !== '';
}

/** Native kabuk (Capacitor) veya dosya sisteminden açılmış bir sayfa mı? */
function isNativeShell() {
    const { protocol, hostname } = window.location;
    return protocol === 'capacitor:'
        || protocol === 'file:'
        || LOCAL_HOSTNAMES.has(hostname);
}

/** VITE_SERVER_URL "http://1.2.3.4" gibi şema taşıyabilir; sadece host lazım. */
function bareHost(value) {
    return String(value || '').replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/+$/, '');
}

/** .env tabanlı endpoint — yalnızca dev sunucusu yolu. */
function fromEnv() {
    const env = import.meta.env ?? {};
    const scheme = env.VITE_SERVER_SCHEME || 'ws';
    const host = bareHost(env.VITE_SERVER_URL) || '127.0.0.1';
    const port = String(env.VITE_SERVER_PORT || '8080');
    const path = env.VITE_SERVER_PATH || DEFAULT_PATH;

    // Varsayılan portlar URL'de yazılmaz.
    const implicitPort = (scheme === 'wss' && port === '443') || (scheme === 'ws' && port === '80');

    return `${scheme}://${host}${implicitPort ? '' : `:${port}`}${path}`;
}

/**
 * HTTPS sayfada kalmış ws:// adresini kurtarır. Aksi halde tarayıcı bağlantıyı
 * SecurityError ile reddeder ve oyuncu sebebini göremez.
 */
function enforceSecureScheme(url) {
    if (window.location.protocol !== 'https:') return url;
    if (!url.startsWith('ws://')) return url;

    const host = bareHost(url).split('/')[0].split(':')[0];
    if (LOCAL_HOSTNAMES.has(host)) return url;   // localhost mixed content'ten muaf

    const upgraded = `wss://${url.slice('ws://'.length)}`;
    console.warn(
        `[endpoint] HTTPS sayfada ws:// adres bulundu, wss://'e yükseltildi: ${url} → ${upgraded}. ` +
        'public/config.json güncellenmeli.'
    );
    return upgraded;
}

/**
 * Kullanılacak WebSocket adresini döndürür.
 * @param {string} [explicitUrl] Çağıranın elindeki mutlak adres (varsa kazanır).
 */
export function resolveWsUrl(explicitUrl) {
    const chosen = explicitUrl || window.gameSettings?.serverUrl;
    if (chosen) return enforceSecureScheme(chosen);

    // TLS varsa önünde mutlaka bir proxy vardır ve /ws'i o proxy taşır.
    if (!isNativeShell() && window.location.protocol === 'https:') {
        return `wss://${window.location.host}${DEFAULT_PATH}`;
    }

    if (isDevServer()) return enforceSecureScheme(fromEnv());

    return PROD_WS_URL;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP API KÖKÜ (Java proxy)
//
// Proxy, sayfayla AYNI nginx'in arkasında yaşar — tıpkı /ws gibi. Bu yüzden
// uzak bir HTTPS origin'inden servis edilen build'de doğru cevap "aynı origin"
// yani BOŞ STRING'tir: istekler `/api/me` şeklinde göreli gider, tarayıcı
// cross-origin saymaz ve CORS preflight'i hiç devreye girmez.
//
// Mutlak bir adres YALNIZCA gerçekten başka bir origin'e gidildiğinde
// üretilir (dev sunucusu → localhost:8080, native kabuk → üretim host'u).
// ─────────────────────────────────────────────────────────────────────────────

/** Üretim HTTP kökü — WS endpoint'iyle aynı host'tan türetilir (tek kaynak). */
function prodApiBaseUrl() {
    try {
        const url = new URL(PROD_WS_URL.replace(/^ws/, 'http'));
        return `${url.protocol}//${url.host}`;
    } catch (_) {
        return 'https://seanakes.io';
    }
}

/**
 * Dev sunucusunda Java proxy'nin adresi — WS ile aynı host, HTTP şeması.
 *
 * ── HOST, SAYFANIN HOST'UYLA AYNI OLMALI (ÇEREZ ŞARTI) ──────────────────────
 * Varsayılan eskiden `127.0.0.1` idi. Sayfa `localhost:3000`'den servis edilip
 * API `127.0.0.1:8080`'e çağrıldığında tarayıcı bunu SİTELER ARASI sayar
 * ("localhost" ile "127.0.0.1" farklı host'lardır) ve `SameSite=Lax` olan
 * oturum çerezini İSTEĞE EKLEMEZ. Sonuç: üretimde (aynı origin) çalışan
 * "girişli kal" akışı, yalnızca geliştirmede sessizce kırılır — hata ayıklaması
 * pahalı, sebebi görünmez bir kırılma.
 *
 * <p>Bu yüzden host ÖNCE sayfanınkinden alınır; .env açıkça başka bir host
 * verirse o kazanır (uzak makinedeki proxy'ye bağlanma senaryosu).
 */
function devApiBaseUrl() {
    const env = import.meta.env ?? {};
    const host = bareHost(env.VITE_SERVER_URL) || window.location.hostname || 'localhost';
    const port = String(env.VITE_API_PORT || env.VITE_SERVER_PORT || '8080');
    const scheme = (env.VITE_SERVER_SCHEME === 'wss') ? 'https' : 'http';
    return `${scheme}://${host}:${port}`;
}

/**
 * Java proxy'nin HTTP kökünü döndürür. Sondaki '/' YOKTUR.
 *
 * <p>Dönüş '' (boş string) ise adres AYNI ORIGIN demektir ve çağıran isteği
 * göreli yol ile atar — bu, preflight'sız en hızlı ve en az kırılgan yoldur.
 *
 * <p>Çözüm sırası WS ile bilinçli olarak aynıdır:
 *   1. config.json → apiBaseUrl (container start'ta enjekte edilir)
 *   2. VITE_API_BASE_URL (build/dev override)
 *   3. Uzak HTTPS origin → aynı origin ('')
 *   4. Vite dev sunucusu → .env'deki Java portu (8080)
 *   5. Native kabuk / diğer → üretim host'u
 *
 * Her çağrıda yeniden hesaplanır (önbelleğe ALINMAZ): window.gameConfig,
 * ilk API isteğinden sonra da dolabilir (bkz. src/main.js → loadClientConfig).
 */
export function resolveApiBaseUrl() {
    const fromConfig = window.gameConfig?.apiBaseUrl;
    if (fromConfig) return String(fromConfig).replace(/\/+$/, '');

    const fromEnvVar = import.meta.env?.VITE_API_BASE_URL;
    if (fromEnvVar) return String(fromEnvVar).replace(/\/+$/, '');

    // Sayfa gerçek bir HTTPS host'undan geliyorsa proxy aynı nginx'in ardında.
    if (!isNativeShell() && window.location.protocol === 'https:') return '';

    if (isDevServer()) return devApiBaseUrl();

    return prodApiBaseUrl();
}

/** Göreli API yolunu tam adrese çevirir. '/api/me' → '<base>/api/me'. */
export function apiUrl(path) {
    const clean = path.startsWith('/') ? path : `/${path}`;
    return `${resolveApiBaseUrl()}${clean}`;
}

/** config.json okunamadığında kullanılan tek sunuculu fallback girdisi. */
export function fallbackServerEntry() {
    const wsUrl = resolveWsUrl();
    const url = new URL(wsUrl.replace(/^ws/, 'http'));
    const local = LOCAL_HOSTNAMES.has(url.hostname);
    return {
        id: local ? 'local' : 'default',
        name: local ? 'Local Server' : url.hostname,
        ip: `${url.protocol}//${url.host}`,
        port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
        wsUrl,
    };
}
