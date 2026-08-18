// =============================================================================
//  SUNUCU ENDPOINT ÇÖZÜMLEYİCİ — TEK KAYNAK
// =============================================================================
//  Çok-instance'lı dağıtımda TEK bir client imajı N farklı oyun sunucusuna
//  hizmet eder (bkz. Dockerfile + docker-entrypoint.d/). Bu yüzden endpoint'in
//  HİÇBİR parçası pakete gömülemez; hepsi ya çalışma anında yazılan
//  config.json'dan, ya VITE_* derleme yedeğinden, ya da sayfanın kendi
//  origin'inden türetilir.
//
//  Bu modül hem menü akışı (main.js) hem de oyun soketi (NetWorkManager.js)
//  tarafından kullanılır. İki ayrı kopya tutmak, birinin diğerinden sapması
//  demekti — ve sapma, oyuncunun menüde bir instance görüp başka birine
//  bağlanması anlamına gelirdi.
// =============================================================================

/**
 * Bir değeri normalize eder; "değer yok" durumunu boş string olarak döndürür.
 *
 * Render edilmemiş bir şablon ("${WS_SERVER_URL}") config.json'a sızarsa bunu
 * DEĞER SAYMAZ: entrypoint çalışmamış demektir ve o dizgeyi host gibi kullanmak
 * anlamsız bir bağlantı denemesi üretirdi. Boş dönerek türetme yoluna düşürür.
 */
export function cleanValue(v) {
    const s = (v === undefined || v === null) ? '' : String(v).trim();
    return (s === '' || s.includes('${')) ? '' : s;
}

/**
 * Tam ws(s) URL'i üretir.
 *
 * Öncelik sırası — ilk dolu olan kazanır:
 *   1. server.wsUrl        : entrypoint'in yazdığı tam URL (mutlak otorite)
 *   2. server.ws*          : parçalar (scheme/host/port/path)
 *   3. env (VITE_*)        : derleme zamanı yedeği — yalnız yerel dev
 *   4. location.*          : sayfanın servis edildiği origin
 *
 * PORT'un özel durumu: sayfa CLIENT_HOST_PORT'tan, oyun sunucusu ise FARKLI bir
 * SERVER_HOST_PORT'tan yayınlanır. Host origin'den türetilebilse bile port
 * türetilemez — o mutlaka config'ten ya da env'den gelmelidir. Hiçbiri yoksa
 * PORTSUZ bir URL üretilir (reverse-proxy arkasındaki 80/443 senaryosu);
 * uydurma bir varsayılan port ASLA yazılmaz, çünkü sessizce yanlış bir
 * instance'a bağlanmak açıkça başarısız olmaktan çok daha kötüdür.
 *
 * @param {object} server   config.json'daki sunucu girdisi.
 * @param {object} env      import.meta.env (ya da testte sahtesi).
 * @param {object} location window.location (ya da testte sahtesi).
 * @returns {string} Tam URL; hiçbir host bulunamazsa boş string.
 */
export function resolveServerEndpoint(server = {}, env = {}, location = {}) {
    const explicit = cleanValue(server.wsUrl);
    if (explicit) return explicit;

    // wss, sayfa HTTPS ile servis edildiyse ZORUNLUDUR: tarayıcı güvenli bir
    // sayfadan düz ws:// bağlantısına izin vermez (mixed content bloğu).
    const secure = location.protocol === 'https:';
    const scheme = cleanValue(server.wsScheme)
        || cleanValue(env.VITE_SERVER_SCHEME)
        || (secure ? 'wss' : 'ws');

    const host = cleanValue(server.wsHost)
        || cleanValue(env.VITE_SERVER_URL)     // eski isim: tam URL değil, HOST taşır
        || cleanValue(env.VITE_SERVER_HOST)
        || cleanValue(location.hostname);

    const port = cleanValue(server.wsPort)
        || cleanValue(env.VITE_SERVER_PORT);

    const path = cleanValue(server.wsPath)
        || cleanValue(env.VITE_SERVER_PATH)
        || '/ws';

    if (!host) return '';   // türetilecek hiçbir şey yok — çağıran karar versin

    return port ? `${scheme}://${host}:${port}${path}` : `${scheme}://${host}${path}`;
}

/** Tarayıcı ortamından env/location okuyan ince sarmalayıcı. */
export function resolveFromBrowser(server = {}) {
    return resolveServerEndpoint(
        server,
        import.meta.env ?? {},
        (typeof window !== 'undefined' && window.location) ? window.location : {},
    );
}
