// ─────────────────────────────────────────────────────────────────────────────
// WS ENDPOINT ÇÖZÜMLEME — tek sahiplik noktası
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
