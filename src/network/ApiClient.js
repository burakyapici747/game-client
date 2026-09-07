// ─────────────────────────────────────────────────────────────────────────────
// API CLIENT — Java proxy'ye giden HER HTTP isteğinin TEK geçiş noktası
//
// Kural: hiçbir modül `fetch` ile doğrudan /api/** çağırmaz. Sebebi tek bir
// cümle: Bearer başlığını UNUTMAK mümkün olmamalı. Rota koruma listesi burada
// tanımlıdır ve başlık ÇAĞIRANIN İSTEĞİNE BAKILMAKSIZIN otomatik eklenir.
//
// ── SUNUCU SÖZLEŞMESİ (Java proxy) ──────────────────────────────────────────
//   Korumalı:  /api/me/**, /api/players/**, /api/wallets/**, /api/purchases/**,
//              /api/admin/**  →  Authorization: Bearer <Google ID Token>
//   Public:    diğer her şey (/api/catalogs, /api/currencies, /api/assets ...)
//   401 → token yok/geçersiz/süresi dolmuş  → yeniden giriş istenir
//   503 → LootLocker Google Sign-In kapalı  → "geçici olarak kullanılamıyor"
//
// ── CORS DURUŞU ─────────────────────────────────────────────────────────────
// Bu dosya İSTEK üzerinde hiçbir CORS başlığı KURMAZ. Access-Control-* başlıkları
// YANIT başlıklarıdır; istekte gönderilince tarayıcı bunları "unsafe header"
// sayar, preflight'a ekler ve sunucunun allowedHeaders listesiyle uyuşmadıkları
// an istek CORS hatasıyla düşer. Çağıran yanlışlıkla böyle bir başlık verirse
// aşağıda ayıklanır ve uyarı basılır.
//
// credentials: 'omit' BİLİNÇLİDİR. Kimlik Bearer başlığıyla taşınır, çerezle
// değil. 'include' deseydik tarayıcı sunucudan `Allow-Credentials: true` VE
// joker olmayan tam bir `Allow-Origin` beklerdi; WebMvcConfig'te yaygın olan
// `allowedOrigins("*")` ayarıyla bu kombinasyon tarayıcı tarafından reddedilir.
//
// Public GET'lere HİÇBİR özel başlık eklenmez (yalnızca safelisted 'Accept').
// Böylece o istekler "simple request" kalır ve preflight HİÇ oluşmaz. Preflight
// yalnızca Authorization taşıyan korumalı çağrılarda devreye girer — bu da
// proxy'nin OPTIONS'a ve allowedHeaders'ta 'Authorization'a izin vermesini
// gerektirir (backend tarafındaki tek şart).
// ─────────────────────────────────────────────────────────────────────────────

import { apiUrl } from './endpoint.js';
import { getIdToken } from '../auth/GoogleAuth.js';

/**
 * Bearer zorunlu olan yol önekleri — Java proxy'nin güvenlik yapılandırmasının
 * (Y2) aynası. Sunucuda değişirse BURASI da değişmelidir.
 */
export const PROTECTED_PREFIXES = Object.freeze([
    '/api/me',
    '/api/players',
    '/api/wallets',
    '/api/purchases',
    '/api/admin',
]);

/** Ağ/sunucu hatalarının tek tipi. status === 0 → istek hiç ulaşamadı. */
export class ApiError extends Error {
    constructor(status, message, body = null, path = '') {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.body = body;
        this.path = path;
    }

    /** Token yok, geçersiz ya da süresi dolmuş. */
    get isUnauthorized() { return this.status === 401; }

    /** LootLocker bağlantısı kapalı/arızalı — kullanıcı hatası DEĞİL. */
    get isServiceUnavailable() { return this.status === 503; }

    /** Sunucuya hiç ulaşılamadı (offline, DNS, CORS reddi, timeout). */
    get isNetwork() { return this.status === 0; }
}

const REQUEST_TIMEOUT_MS = 15_000;

// İstekte ASLA bulunmaması gereken başlıklar. Access-Control-* yanıt
// başlığıdır; Origin/Host tarayıcının kontrolündedir ve elle set edilemez.
const FORBIDDEN_REQUEST_HEADERS = /^(access-control-|origin$|host$)/i;

const unauthorizedHandlers = new Set();
const serviceUnavailableHandlers = new Set();

/**
 * 401 dinleyicisi — "kullanıcıyı yeniden giriş yapmaya yönlendir".
 * @returns {function} aboneliği sonlandırır
 */
export function onUnauthorized(handler) {
    if (typeof handler !== 'function') return () => {};
    unauthorizedHandlers.add(handler);
    return () => unauthorizedHandlers.delete(handler);
}

/**
 * 503 dinleyicisi — "servis geçici olarak kullanılamıyor banner'ı göster".
 * @returns {function} aboneliği sonlandırır
 */
export function onServiceUnavailable(handler) {
    if (typeof handler !== 'function') return () => {};
    serviceUnavailableHandlers.add(handler);
    return () => serviceUnavailableHandlers.delete(handler);
}

// Dinleyici patlarsa istek zinciri KIRILMAMALI: hata yutulur, loglanır.
// Bu, oyun döngüsüne sızabilecek tek yol olduğu için kritik.
function emit(handlers, payload) {
    for (const fn of handlers) {
        try { fn(payload); } catch (err) {
            console.error('[api] dinleyici hata verdi:', err);
        }
    }
}

/** Yol korumalı mı? Query string yok sayılır. '/api/members' ≠ '/api/me'. */
export function isProtectedPath(path) {
    const clean = String(path).split('?')[0].split('#')[0];
    return PROTECTED_PREFIXES.some(p => clean === p || clean.startsWith(`${p}/`));
}

/** Çağıranın verdiği başlıklardan tarayıcının reddedeceklerini ayıklar. */
function sanitizeHeaders(headers) {
    const safe = {};
    for (const [key, value] of Object.entries(headers ?? {})) {
        if (FORBIDDEN_REQUEST_HEADERS.test(key)) {
            console.warn(
                `[api] '${key}' istek başlığı yok sayıldı. Access-Control-* bir YANIT ` +
                'başlığıdır; istekte gönderilmesi preflight\'ı bozar (bkz. ApiClient CORS notu).'
            );
            continue;
        }
        if (value != null) safe[key] = String(value);
    }
    return safe;
}

/**
 * Yanıt gövdesini içerik tipine göre çözer; boş gövdede null döner.
 *
 * <p>`+json` SONEKİ de JSON sayılır. Proxy hataları RFC 7807 ile
 * `application/problem+json` olarak döndürüyor ve bu dizge
 * 'application/json' İÇERMEZ — sadece substring'e bakan eski kontrol bu
 * gövdeleri ham metin sanıyor, errorMessage de kullanıcıya `detail` yerine
 * tüm JSON bloğunu gösteriyordu.
 */
async function parseBody(response) {
    if (response.status === 204 || response.status === 205) return null;
    const type = (response.headers.get('content-type') ?? '').toLowerCase();
    try {
        if (type.includes('application/json') || /\+json\b/.test(type)) return await response.json();
        const text = await response.text();
        return text.length ? text : null;
    } catch (_) {
        return null;                       // bozuk/kesik gövde hata sebebi değil
    }
}

/** Sunucunun döndürdüğü hata mesajını yakalar, yoksa jenerik metin üretir. */
function errorMessage(status, body) {
    if (body && typeof body === 'object') {
        // RFC 7807 sırası: önce insan-okur `detail`/`message`, sonra kısa `title`.
        const msg = body.message ?? body.error ?? body.detail ?? body.title;
        if (msg) return String(msg);
    }
    if (typeof body === 'string' && body.trim()) return body.trim().slice(0, 300);
    if (status === 401) return 'Unauthorized';
    if (status === 503) return 'Player link unavailable';
    return `HTTP ${status}`;
}

/**
 * Java proxy'ye istek atar.
 *
 * @param {string} path                 '/api/me' gibi göreli yol.
 * @param {object} [options]
 * @param {string} [options.method='GET']
 * @param {*}      [options.body]       Verilirse JSON'a çevrilir.
 * @param {boolean}[options.auth]       Bearer eklensin mi. VARSAYILAN: yolun
 *                                      korumalı olup olmamasına göre otomatik.
 *                                      Public bir yola elle true verilebilir.
 * @param {object} [options.headers]    Ek başlıklar (CORS başlıkları ayıklanır).
 * @param {AbortSignal} [options.signal] Çağıranın iptal sinyali.
 * @param {number} [options.timeoutMs]
 * @returns {Promise<*>} Çözülmüş yanıt gövdesi.
 * @throws {ApiError}    Her başarısız durumda — ağ hatası dahil.
 */
export async function apiFetch(path, options = {}) {
    const {
        method = 'GET',
        body,
        auth = isProtectedPath(path),
        headers: extraHeaders,
        signal,
        timeoutMs = REQUEST_TIMEOUT_MS,
    } = options;

    const headers = sanitizeHeaders(extraHeaders);

    if (auth) {
        const token = getIdToken();       // süresi dolmuşsa null döner
        if (!token) {
            // Ağa ÇIKMADAN 401 üretiyoruz: token yokken istek atmak garanti bir
            // 401 + gereksiz bir preflight demek olurdu. Kullanıcı deneyimi ve
            // sonuç birebir aynı, tur sayısı sıfır.
            const err = new ApiError(401, 'No valid Google ID token', null, path);
            emit(unauthorizedHandlers, { error: err, path });
            throw err;
        }
        headers.Authorization = `Bearer ${token}`;
    }

    if (body !== undefined) headers['Content-Type'] = 'application/json';
    // 'Accept' CORS-safelisted'dir: public GET'lerde preflight tetiklemez.
    headers.Accept = headers.Accept ?? 'application/json';

    // Timeout + çağıranın iptali birlikte çalışsın.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener('abort', onExternalAbort, { once: true });

    let response;
    try {
        response = await fetch(apiUrl(path), {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            mode: 'cors',
            // Bkz. dosya başındaki CORS notu — çerez göndermiyoruz.
            credentials: 'omit',
            cache: 'no-store',
            signal: controller.signal,
        });
    } catch (err) {
        const aborted = err?.name === 'AbortError';
        throw new ApiError(
            0,
            aborted ? `Request timed out after ${timeoutMs}ms` : `Network error: ${err?.message ?? err}`,
            null,
            path,
        );
    } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onExternalAbort);
    }

    const payload = await parseBody(response);

    if (response.ok) return payload;

    const error = new ApiError(response.status, errorMessage(response.status, payload), payload, path);

    if (error.isUnauthorized) emit(unauthorizedHandlers, { error, path });
    if (error.isServiceUnavailable) emit(serviceUnavailableHandlers, { error, path });

    throw error;
}

// ── Kısa yollar ──────────────────────────────────────────────────────────────

export const apiGet = (path, options) => apiFetch(path, { ...options, method: 'GET' });
export const apiPost = (path, body, options) => apiFetch(path, { ...options, method: 'POST', body });
export const apiPut = (path, body, options) => apiFetch(path, { ...options, method: 'PUT', body });
export const apiDelete = (path, options) => apiFetch(path, { ...options, method: 'DELETE' });

/**
 * Public (korumasız) uç noktalar için açık niyet bildirimi.
 *
 * <p>`auth: false` ZORLANIR: token varsa bile gönderilmez, böylece istek
 * "simple request" kalır ve preflight oluşmaz. /api/catalogs, /api/currencies
 * ve /api/assets oturum açılmamışken de çalışmak zorundadır — bu fonksiyon o
 * garantiyi kodda görünür kılar.
 */
export const apiGetPublic = (path, options) => apiFetch(path, { ...options, method: 'GET', auth: false });
