// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE IDENTITY SERVICES — AUTH MANAGER
//
// Google Sign-In akışının tek sahiplik noktası. SDK (accounts.google.com/gsi/
// client) index.html'de async yüklenir; bu modül SDK hazır olana kadar bekler,
// butonu render eder ve credential callback'ini karşılar.
//
// AKIŞ
//   1. initGoogleAuth()  → SDK'yı bekler, google.accounts.id.initialize()
//   2. Kullanıcı butona basar (ya da One Tap otomatik açılır)
//   3. handleCredentialResponse() → response.credential = ID Token (JWT)
//   4. Token window.googleIdToken'a + modül state'ine yazılır, dinleyiciler
//      tetiklenir (LootLocker oturumu burada başlatılacak)
//
// GÜVENLİK
//   - Client Secret bu dosyaya ASLA girmez; web istemcisinde secret yoktur.
//   - JWT burada yalnızca GÖRÜNTÜLEME için decode edilir. İmza doğrulaması
//     sunucu tarafının işidir (LootLocker / game-server), istemci payload'a
//     güvenerek yetki vermez.
//   - Token disk'e yazılmaz. Geri dönen kullanıcı için auto_select kullanılır:
//     Google sessizce yeni ve taze bir token üretir, biz eskisini saklamayız.
// ─────────────────────────────────────────────────────────────────────────────

export const GOOGLE_CLIENT_ID =
    '902030391377-7g6fe410bnv8mp63bf8i2k2ktmo4bkg6.apps.googleusercontent.com';

// SDK bloklanmış olabilir (adblock, offline, kurumsal proxy). Süresiz beklemek
// yerine hata veriyoruz ki UI "Sign in" butonunu boş bir kutu olarak bırakmasın.
const SDK_READY_TIMEOUT_MS = 10_000;

// exp kontrolünde saat kayması payı.
const CLOCK_SKEW_SEC = 60;

// ── Modül state ──────────────────────────────────────────────────────────────

let idToken = null;
let profile = null;          // { sub, email, name, picture, exp }
let initialized = false;
const listeners = new Set();

// ── SDK hazır olma ───────────────────────────────────────────────────────────

/** google.accounts.id yüklenene kadar bekler. */
function whenSdkReady(timeoutMs = SDK_READY_TIMEOUT_MS) {
    if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);

    return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const tick = () => {
            if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
            if (Date.now() - startedAt > timeoutMs) {
                return reject(new Error(
                    'Google Identity Services yüklenemedi. index.html\'deki gsi/client script ' +
                    'etiketini, ağ bağlantısını ve reklam engelleyiciyi kontrol edin.'
                ));
            }
            setTimeout(tick, 100);
        };
        tick();
    });
}

// ── JWT ──────────────────────────────────────────────────────────────────────

/**
 * ID Token payload'ını okur. SADECE görüntüleme amaçlı — imza doğrulanmaz.
 * Yetkilendirme kararları token'ı doğrulayan sunucuya aittir.
 */
export function decodeJwtPayload(jwt) {
    try {
        const [, payload] = String(jwt).split('.');
        if (!payload) return null;
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
        );
        return JSON.parse(json);
    } catch (err) {
        console.warn('[auth] ID Token decode edilemedi:', err);
        return null;
    }
}

/** Token süresi dolmuş mu? (exp saniye cinsindendir, ms değil.) */
export function isTokenExpired() {
    if (!profile?.exp) return true;
    return profile.exp - CLOCK_SKEW_SEC <= Math.floor(Date.now() / 1000);
}

// ── Credential callback ──────────────────────────────────────────────────────

/**
 * google.accounts.id.initialize({ callback }) tarafından çağrılır.
 * response.credential = Google ID Token (JWT).
 */
function handleCredentialResponse(response) {
    const token = response?.credential;
    if (!token) {
        console.error('[auth] Credential response boş geldi:', response);
        return;
    }

    const payload = decodeJwtPayload(token);

    idToken = token;
    profile = payload && {
        sub: payload.sub,            // Google'ın kalıcı kullanıcı kimliği
        email: payload.email,
        emailVerified: payload.email_verified,
        name: payload.name,
        picture: payload.picture,
        exp: payload.exp,
    };

    // Sonraki adım (LootLocker / game-server) global üzerinden okuyabilsin.
    window.googleIdToken = token;

    // İstenen doğrulama çıktısı. ÜRETİMDE KALDIRIN: JWT bir taşıyıcı kimlik
    // bilgisidir, konsol dökümü ekran görüntüsü/destek kaydıyla sızabilir.
    console.log('[auth] Google ID Token (JWT):', token);
    console.log('[auth] Oturum açan kullanıcı:', profile?.email, `(sub: ${profile?.sub})`);

    for (const fn of listeners) {
        try {
            fn({ idToken: token, profile });
        } catch (err) {
            console.error('[auth] onSignIn dinleyicisi hata verdi:', err);
        }
    }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * SDK'yı başlatır ve resmî "Sign in with Google" butonunu render eder.
 *
 * @param {object}      opts
 * @param {HTMLElement} opts.buttonContainer  Butonun çizileceği boş DOM düğümü.
 * @param {function}    [opts.onSignIn]       Başarılı girişte çağrılır.
 * @param {boolean}     [opts.autoPrompt]     One Tap istemi de açılsın mı.
 * @returns {Promise<void>} SDK yüklenemezse reject eder.
 */
export async function initGoogleAuth({ buttonContainer, onSignIn, autoPrompt = true } = {}) {
    if (typeof onSignIn === 'function') listeners.add(onSignIn);
    if (initialized) {
        if (buttonContainer) renderSignInButton(buttonContainer);
        return;
    }

    const gid = await whenSdkReady();

    gid.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        // Geri dönen kullanıcı için sessiz giriş: token'ı saklamak yerine
        // Google'dan her açılışta yenisini alırız.
        auto_select: true,
        cancel_on_tap_outside: false,
        // Chrome üçüncü taraf çerezleri kaldırdığı için One Tap artık FedCM
        // üzerinden çalışır. Bu bayrak olmadan istem sessizce açılmaz.
        use_fedcm_for_prompt: true,
    });

    initialized = true;

    if (buttonContainer) renderSignInButton(buttonContainer);
    if (autoPrompt) gid.prompt();   // FedCM ile notification callback'i desteklenmez
}

/** Resmî Google butonunu verilen kabın içine çizer. */
export function renderSignInButton(container) {
    if (!container || !window.google?.accounts?.id) return;
    container.innerHTML = '';
    window.google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        logo_alignment: 'left',
        // Google butonu piksel genişliği ister; kabın ölçüsüne uyarlıyoruz.
        width: Math.min(320, Math.max(200, container.clientWidth || 280)),
    });
}

/** Geçerli (süresi dolmamış) ID Token, yoksa null. */
export function getIdToken() {
    if (!idToken || isTokenExpired()) return null;
    return idToken;
}

/** { sub, email, name, picture, exp } — imza doğrulanmamış payload. */
export function getProfile() {
    return profile;
}

export function isSignedIn() {
    return Boolean(getIdToken());
}

/**
 * Giriş olayına abone olur. Zaten girilmişse handler hemen çağrılır.
 * @returns {function} Aboneliği sonlandıran fonksiyon.
 */
export function onSignIn(handler) {
    if (typeof handler !== 'function') return () => {};
    listeners.add(handler);
    if (isSignedIn()) handler({ idToken, profile });
    return () => listeners.delete(handler);
}

/**
 * Yerel oturumu temizler. Google hesabından çıkış YAPMAZ; yalnızca bu
 * uygulamadaki otomatik seçimi kapatır ve token'ı düşürür.
 */
export function signOut() {
    idToken = null;
    profile = null;
    window.googleIdToken = null;
    window.google?.accounts?.id?.disableAutoSelect();
}

// ── Phaser entegrasyonu ──────────────────────────────────────────────────────

/**
 * Bir Phaser sahnesini auth olaylarına bağlar ve sahne kapanınca aboneliği
 * otomatik söker. DOM overlay'i Phaser canvas'ının DIŞINDA yaşar (bkz.
 * src/ui/overlays.js); sahne yalnızca "giriş yapıldı mı" bilgisini tüketir.
 *
 *   // MainMenu.js
 *   create() {
 *       attachToScene(this, ({ profile }) => {
 *           this.playerName = profile?.name ?? 'Guest';
 *           this.scene.start('Game');
 *       });
 *   }
 *
 * shutdown/destroy'da sökmek şart: sahne yeniden başlatıldığında (Play Again)
 * eski closure'lar ölü sahneye yazmaya çalışır ve sessiz sızıntı oluşur.
 */
export function attachToScene(scene, handler) {
    const unsubscribe = onSignIn(handler);
    scene.events.once('shutdown', unsubscribe);
    scene.events.once('destroy', unsubscribe);
    return unsubscribe;
}
