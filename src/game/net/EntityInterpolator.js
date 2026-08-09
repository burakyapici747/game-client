/**
 * ADAPTIVE ENTITY INTERPOLATION & EXTRAPOLATION
 * ==============================================================================
 * Uzak entity'lerin (remote snake) görsel konumunu, paket varış ritminden
 * TAMAMEN bağımsız hale getiren oynatma (playout) katmanı. Phaser'a bağımlı
 * değildir — saf matematik, entity başına bir örnek.
 *
 * ── NEDEN BU MİMARİ (protokol kısıtı) ────────────────────────────────────────
 * Sunucu protokolünde (newproto/server/upgrade/entity-collection.proto)
 * SUNUCU ZAMAN DAMGASI YOKTUR. Elimizdeki tek zaman ekseni paketin YEREL VARIŞ
 * anıdır (performance.now()):
 *
 *      arrival(n) = serverSendTime(n) + oneWayDelay(n)
 *
 * Bu yüzden buffer'daki damgalar "varış saati" üzerindedir ve renderTime de aynı
 * saatte tanımlanır. ÖNEMLİ SONUÇ: ortalama tek-yön gecikme (ping/2) bu saatin
 * içine ZATEN gömülüdür. Kanonik `interpolationDelay = meanPing + k·jitter`
 * formülü, damgaların SUNUCU saatinde olduğu protokoller içindir; burada mean
 * ping terimini eklemek gecikmeyi ikinci kez saymak (90-150 ms pingde ~120 ms
 * bedava lag) olurdu. Gerçekten telafi edilmesi gereken şey oneWayDelay'in
 * VARYANSIDIR — yani jitter. Formül bu yüzden şu hale gelir:
 *
 *      interpolationDelay = tickInterval·headroom
 *                         + k_arr · arrivalJitter      (RFC 3550 tahmincisi)
 *                         + k_ping · pingJitter        (RTT sapması, heartbeat)
 *                         + w_mean · meanPing          (w_mean = 0, bkz. altta)
 *
 * PING_MEAN_WEIGHT yine de yapılandırılabilir bir katsayı olarak durur: sunucu
 * ileride paketlere gerçek bir zaman damgası eklerse (damgalar sunucu saatine
 * taşınırsa) 1.0 yapılması yeterlidir.
 *
 * ── KATMANLAR ────────────────────────────────────────────────────────────────
 *  1. RING BUFFER      — sabit kapasiteli dairesel tampon (shift/GC yok).
 *  2. DE-JITTER SAAT   — varış damgası, "en düşük gecikmeli paket referanstır"
 *                        ilkesiyle ideal tick ızgarasına oturtulur. Jitter'ın
 *                        büyük kısmı interpolasyona ULAŞMADAN silinir → aynı
 *                        pürüzsüzlük için DAHA AZ buffer gecikmesi.
 *  3. PLAYOUT SAATİ    — renderTime kendi MONOTON saatidir ve hızı (playback
 *                        rate, ±%12) hedef gecikmeye yakınsayacak şekilde
 *                        ayarlanır. Gecikmeyi doğrudan renderTime'a yazmak
 *                        saati geriye sıçratır (görünür geri sarma); hız
 *                        ayarlaması bunu tamamen ortadan kaldırır.
 *  4. HERMITE ÖRNEKLEME— sınır iki snapshot arasında α ∈ [0,1] ve
 *                        Catmull-Rom teğetli kübik Hermite (teğet büyüklüğü
 *                        kelepçeli → keskin dönüşte overshoot yok).
 *  5. DEAD RECKONING   — buffer açlığında son bilinen hız/heading vektörüyle
 *                        SÖNÜMLÜ ekstrapolasyon (durmak/donmak yerine).
 *  6. OFFSET UZLAŞMASI — ekstrapolasyondan interpolasyona dönüşte oluşan fark
 *                        anında yazılmaz; bir ofset olarak emilir ve üstel
 *                        sönümle 0'a iner → hiçbir koşulda ışınlanma yok.
 */

// ── Yardımcılar (Phaser'a bağımlılık YOK) ────────────────────────────────────
const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
}

// Açıyı (-π, π] aralığına sarar.
function wrapAngle(a) {
    let r = a % TAU;
    if (r > Math.PI) r -= TAU;
    else if (r <= -Math.PI) r += TAU;
    return r;
}

export const InterpolatorConfig = {
    // ── Ring buffer ─────────────────────────────────────────────────────────
    // 32 örnek @ ~15 Hz ≈ 2.1 s geçmiş — DELAY_MAX_MS'in kat kat üstünde.
    BUFFER_CAPACITY: 32,

    // ── Adaptif gecikme bütçesi ─────────────────────────────────────────────
    DELAY_MIN_MS: 45,
    DELAY_MAX_MS: 300,
    // Bir tam tick'lik taban pay: renderTime her zaman en yeni snapshot'ın
    // GERİSİNDE kalsın, tek bir paket bile kaçsa açlığa düşmesin.
    INTERVAL_HEADROOM: 1.15,
    // Varış jitter'ı katsayısı (RFC 3550 tahmincisi). 2.5σ ≈ paketlerin %99'u.
    JITTER_K: 2.5,
    // RTT sapması katsayısı. Heartbeat 2.5 s'de bir örneklendiği için bu terim
    // yavaş hareket eden bir taban; asıl iş JITTER_K'da.
    PING_JITTER_K: 0.75,
    // Bkz. dosya başlığı: varış-saati damgalarında mean ping ZATEN gömülü.
    // Sunucu gerçek zaman damgası göndermeye başlarsa 1.0 yapılır.
    PING_MEAN_WEIGHT: 0,
    // Hedef gecikme filtresi: jitter patlamasına ANINDA aç, sakinlikte YAVAŞ
    // kapat (asimetrik). Kapanış hızlı olsaydı her sakin pencerede buffer
    // sığlaşıp bir sonraki spike'ta yeniden açlık yaşanırdı.
    DELAY_GROW_RATE: 12,     // 1/s
    DELAY_SHRINK_RATE: 0.35, // 1/s

    // ── Playout saati (renderTime hız kontrolü) ─────────────────────────────
    // rate = 1 + gain·err(ms), |rate - 1| ≤ MAX_RATE_DEV.
    // %12 sapma insan gözüne görünmez ama 50 ms'lik bir bütçe farkını ~0.4 s'de
    // kapatır.
    PLAYBACK_RATE_GAIN: 0.0022,
    PLAYBACK_MAX_RATE_DEV: 0.12,
    // Bu eşiği aşan sapma artık "ayarlanacak" bir hata değil, kopukluktur
    // (sekme arka planda kaldı, uzun donma): saat doğrudan yeniden kurulur.
    PLAYBACK_RESYNC_MS: 500,

    // ── De-jitter saati ─────────────────────────────────────────────────────
    // Izgara, ölçülen tick aralığıyla ilerler ve gerçek varışa yalnızca KÜÇÜK
    // bir oranla çekilir. Oranlar asimetriktir (erken > geç): "en düşük
    // gecikmeli paket gerçeğe en yakındır" ilkesi ızgarayı jitter dağılımının
    // alt çeyreğine oturtur ve orada DENGEDE tutar (kaçış/sürüklenme yok).
    //
    // KRİTİK: bu bir tam snap OLAMAZ. Erken pakette ızgara doğrudan varışa
    // çekilseydi ızgara aralıkları jitter'ın kendisini taşırdı (ölçüldü:
    // 66 ms nominal aralık 31-79 ms arasında salınıyor, ima edilen hız ±%50) —
    // yani de-jitter katmanı jitter'ı silmek yerine aynen geçirirdi.
    DEJITTER_EARLY_PULL: 0.30,
    DEJITTER_LATE_PULL: 0.18,
    // Izgara ile gerçek varış bu kadar ayrışırsa tahminci güvenilmezdir
    // (sunucu tick hızı değişti / uzun kesinti) → damga varışa sıfırlanır.
    DEJITTER_RESYNC_MS: 250,

    // ── Paket istatistikleri ────────────────────────────────────────────────
    INTERVAL_EMA_ALPHA: 0.12,
    INTERVAL_OUTLIER_MS: 1000,  // bunun üstü "kesinti"dir, EMA'ya girmez
    JITTER_EMA_DIVISOR: 16,     // RFC 3550: jitter += (|D| - jitter)/16
    DEFAULT_INTERVAL_MS: 66,    // ilk paketler gelene kadarki varsayım (~15 Hz)

    // ── Dead reckoning (ekstrapolasyon) ─────────────────────────────────────
    // Sönümlü model: disp = v·τ·(1 - e^(-t/τ)). Küçük t'de v·t (doğru), büyük
    // t'de v·τ'ya doyar — yani entity "uçup gitmez", yumuşakça yavaşlar.
    EXTRAPOLATION_DAMP_MS: 170,
    // Bu süreden sonra ekstrapolasyon TAMAMEN durur (entity son bilinen
    // yönünde donar). Ötesinde tahmin, faydadan çok yanlış üretir.
    EXTRAPOLATION_MAX_MS: 320,
    // Hız tahmini snapshot'lar arası sonlu farktan gelir; EMA tek bir gürültülü
    // paketin dead reckoning yönünü savurmasını engeller.
    VELOCITY_EMA: 0.45,

    // ── Uzlaşma (post-extrapolation reconciliation) ─────────────────────────
    RECONCILE_RATE: 9,            // 1/s — ofset yarı ömrü ≈ 77 ms
    // Bu mesafenin üstündeki tek kare farkı ofsete emilir (görsel süreklilik),
    // altındakiler zaten görünmez.
    RECONCILE_ABSORB_PX: 0.5,
    // Bunun üstü artık uzlaştırılacak bir hata değil ışınlanmadır
    // (respawn / AOI yeniden girişi): ofset atılır, konum doğrudan yazılır.
    RECONCILE_SNAP_PX: 600,

    // ── Hermite ─────────────────────────────────────────────────────────────
    HERMITE_ENABLED: true,
    // Catmull-Rom teğeti keskin dönüşte segment dışına taşabilir; teğet
    // büyüklüğü kiriş uzunluğunun bu katıyla sınırlanır.
    HERMITE_TANGENT_CLAMP: 1.5,
};

export class EntityInterpolator {
    /**
     * @param {object} [overrides] InterpolatorConfig alanlarının üzerine yazar.
     */
    constructor(overrides = null) {
        this.config = overrides ? { ...InterpolatorConfig, ...overrides } : InterpolatorConfig;

        const cap = this.config.BUFFER_CAPACITY;
        // ── Ring buffer (SoA: parça başına düz tipli dizi, tahsis yok) ──────
        this._t = new Float64Array(cap);   // de-jitter edilmiş varış damgası (ms)
        this._x = new Float64Array(cap);
        this._y = new Float64Array(cap);
        // au: SARILMAMIŞ (unwrapped) açı — ardışık örneklere en kısa yay
        // farkları eklenerek üretilir. Böylece hem LERP hem Hermite doğrudan
        // uygulanabilir; ±π sınırında sıçrama İMKÂNSIZDIR.
        this._au = new Float64Array(cap);

        this._head = 0;    // en yeni örneğin indeksi
        this._count = 0;

        this.reset();
    }

    // ── Tam sıfırlama ───────────────────────────────────────────────────────
    // Respawn / AOI yeniden girişi / sekme dönüşü / hard resync sonrası ÇAĞRILIR:
    // eski yaşamın hiçbir örneği yeni yaşama sızamaz.
    reset() {
        this._head = 0;
        this._count = 0;

        // Playout saati
        this._renderTime = 0;
        this._hasRenderClock = false;
        this._playbackRate = 1;

        // De-jitter saati
        this._gridTime = 0;
        this._hasGrid = false;

        // Paket istatistikleri
        this._intervalEma = null;
        this._arrivalJitter = 0;
        this._lastArrival = 0;

        // Dead reckoning
        this._vx = 0;
        this._vy = 0;
        this._va = 0;              // açısal hız (rad/ms)
        this._hasVelocity = false;

        // Uzlaşma
        this._offX = 0;
        this._offY = 0;
        this._offA = 0;
        this._hasRendered = false;
        this._lastRenderX = 0;
        this._lastRenderY = 0;
        this._lastRenderA = 0;
        this._wasExtrapolating = false;

        // Adaptif gecikme — ilk kare için makul bir başlangıç.
        this._delayMs = this.config.DELAY_MIN_MS;

        // Teşhis
        this.stats = {
            delayMs: this._delayMs,
            playbackRate: 1,
            bufferCount: 0,
            intervalMs: 0,
            arrivalJitterMs: 0,
            extrapolating: false,
            extrapolatedMs: 0,
            offsetPx: 0,
        };
    }

    // ── Ring buffer erişimi (i = 0 → EN ESKİ, i = count-1 → EN YENİ) ────────
    _idx(i) {
        const cap = this.config.BUFFER_CAPACITY;
        // _head en yeniyi gösterir; en eski = head - (count-1).
        return (this._head - (this._count - 1 - i) + cap * 2) % cap;
    }

    get bufferLength() { return this._count; }

    /**
     * Sunucudan gelen bir konum örneğini tampona yazar.
     *
     * @param {number} x
     * @param {number} y
     * @param {number} angle    radyan (sarılmış ya da sarılmamış, fark etmez)
     * @param {number} arrivalMs performance.now() — paketin VARIŞ anı
     */
    push(x, y, angle, arrivalMs) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(arrivalMs)) return;
        const cfg = this.config;
        const cap = cfg.BUFFER_CAPACITY;

        // ── 1) Ortalama paket aralığı + RFC 3550 varış jitter'ı ─────────────
        // TASARIM NOTU — burada TICK SAYISI KESTİRİLMEZ.
        // Protokolde sıra numarası yok; "bu aralık 1 tick mi 2 tick mi?"
        // sorusu ancak jitter tick süresinin çeyreğinden küçükse yanıtlanabilir.
        // Ardışık iki varışın farkındaki gürültü, paket başına jitter'ın İKİ
        // KATIDIR (iki bağımsız sapmanın farkı), yani sınıflandırma hedef
        // bandın hemen dışında çöker. Denendi ve ÖLÇÜLDÜ: round() tabanlı
        // sınıflandırma, yanlış sınıflanan aralıklarda perTick'i yarıya
        // bölerek intervalEma'yı aşağı sürüklüyor, bu da daha çok yanlış
        // sınıflandırma üretiyordu (kaçak döngü: gecikme bütçesi 157 ms →
        // 46 ms, ekstrapolasyon %35, geri sarma 244 kare).
        //
        // Bunun yerine: jitter'ın ORTALAMASI sıfırdır, dolayısıyla ham
        // aralıkların düz EMA'sı gerçek ORTALAMA paket aralığına yakınsar
        // (kayıpsız 66 ms, %10 kayıpta ~73 ms) — sapmasız ve kaçaksız.
        // Kayıptan doğan boşluk, aşağıdaki PLL'nin (bkz. _dejitter) birkaç
        // paket içinde yuttuğu SINIRLI bir geçici hatadır.
        if (this._lastArrival > 0) {
            const interval = arrivalMs - this._lastArrival;
            if (interval > 0 && interval < cfg.INTERVAL_OUTLIER_MS) {
                const expected = this._intervalEma ?? cfg.DEFAULT_INTERVAL_MS;
                // RFC 3550: hem jitter hem paket kaybı bu tahmini büyütür —
                // ikisi de daha derin buffer gerektirdiği için bu DOĞRUDUR.
                const d = Math.abs(interval - expected);
                this._arrivalJitter += (d - this._arrivalJitter) / cfg.JITTER_EMA_DIVISOR;

                this._intervalEma = this._intervalEma === null
                    ? interval
                    : this._intervalEma * (1 - cfg.INTERVAL_EMA_ALPHA) + interval * cfg.INTERVAL_EMA_ALPHA;
            }
        }
        this._lastArrival = arrivalMs;

        // ── 2) De-jitter: damgayı ideal tick ızgarasına oturt ───────────────
        const t = this._dejitter(arrivalMs);

        // Sıra dışı (out-of-order) / aynı damgalı paket: ring'in monotonluğu
        // interpolasyonun ön koşuludur. Damga geriye gidiyorsa örnek TAMAMEN
        // atılır — hız tahminine bile dokunmadan (aksi halde tek bir yanlış
        // sıralı paket dead reckoning yönünü savururdu).
        if (this._count > 0 && t <= this._t[this._head]) return;

        // ── 3) Sarılmamış açı zinciri ──────────────────────────────────────
        let au;
        if (this._count === 0) {
            au = wrapAngle(angle);
        } else {
            const prevAu = this._au[this._head];
            au = prevAu + wrapAngle(angle - prevAu);
        }

        // ── 4) Hız tahmini (dead reckoning yakıtı) ─────────────────────────
        if (this._count > 0) {
            const pi = this._head;
            const dt = t - this._t[pi];
            if (dt > 0.0001) {
                const vx = (x - this._x[pi]) / dt;
                const vy = (y - this._y[pi]) / dt;
                const va = (au - this._au[pi]) / dt;
                if (this._hasVelocity) {
                    const a = cfg.VELOCITY_EMA;
                    this._vx += (vx - this._vx) * a;
                    this._vy += (vy - this._vy) * a;
                    this._va += (va - this._va) * a;
                } else {
                    this._vx = vx; this._vy = vy; this._va = va;
                    this._hasVelocity = true;
                }
            }
        }

        // ── 5) Yaz ─────────────────────────────────────────────────────────
        this._head = this._count === 0 ? 0 : (this._head + 1) % cap;
        this._t[this._head] = t;
        this._x[this._head] = x;
        this._y[this._head] = y;
        this._au[this._head] = au;
        if (this._count < cap) this._count++;
    }

    // ── DE-JITTER SAATİ ─────────────────────────────────────────────────────
    // Sunucu SABİT tick'te yayın yapar; varıştaki dalgalanma tamamen ağ
    // jitter'ıdır. Izgara bu bilgiyi kullanır: bir sonraki damga "önceki damga
    // + ölçülen tick aralığı" olarak TAHMİN edilir, gerçek varış ise bu tahmini
    // yalnızca küçük bir oranla düzeltir (faz kilitli döngü / PLL mantığı).
    //
    // Sonuç: buffer'daki komşu damga farkları ≈ sabit → iki snapshot arasından
    // türetilen ima edilen hız da sabit. Jitter, interpolasyona ULAŞMADAN
    // filtrelenir; adaptif gecikmenin kapatması gereken artık yalnızca kalan
    // paydır. 90-150 ms ping bandında stutter'ın asıl kaynağı buydu.
    _dejitter(arrivalMs) {
        const cfg = this.config;
        if (!this._hasGrid) {
            this._gridTime = arrivalMs;
            this._hasGrid = true;
            return arrivalMs;
        }

        const step = this._intervalEma ?? cfg.DEFAULT_INTERVAL_MS;
        const predicted = this._gridTime + step;
        const err = arrivalMs - predicted;   // <0 erken, >0 geç

        // Kopukluk (uzun boşluk / sunucu tick hızı değişti / sekme dönüşü):
        // tahminci artık geçerli değil, ızgara doğrudan varışa kurulur.
        if (Math.abs(err) > cfg.DEJITTER_RESYNC_MS) {
            this._gridTime = arrivalMs;
            return arrivalMs;
        }

        // Asimetrik ama ILIMLI çekim (PLL):
        //  • Oran küçük olduğu için jitter ~1/4'e iner (asıl amaç).
        //  • Yine de sıfırdan büyük olduğu için paket kaybından doğan gerçek
        //    boşluklar birkaç paket içinde YAKALANIR — ızgara serbest koşan
        //    bir osilatör değil, kilitli bir takipçidir.
        //  • Erken > geç: "en düşük gecikmeli paket gerçeğe en yakındır"
        //    ilkesi ızgarayı jitter dağılımının alt çeyreğinde DENGEDE tutar.
        const pull = err < 0 ? cfg.DEJITTER_EARLY_PULL : cfg.DEJITTER_LATE_PULL;
        this._gridTime = predicted + err * pull;
        return this._gridTime;
    }

    // ── ADAPTİF GECİKME BÜTÇESİ ─────────────────────────────────────────────
    _updateDelay(dtMs, netStats) {
        const cfg = this.config;
        const interval = this._intervalEma ?? cfg.DEFAULT_INTERVAL_MS;

        const pingMean = Number.isFinite(netStats?.pingMs) ? netStats.pingMs : 0;
        const pingJitter = Number.isFinite(netStats?.pingJitterMs) ? netStats.pingJitterMs : 0;

        const target = clamp(
            interval * cfg.INTERVAL_HEADROOM
            + cfg.JITTER_K * this._arrivalJitter
            + cfg.PING_JITTER_K * pingJitter
            + cfg.PING_MEAN_WEIGHT * pingMean,
            cfg.DELAY_MIN_MS,
            cfg.DELAY_MAX_MS
        );

        // Asimetrik takip: aç hızlı, kapat yavaş.
        const rate = target > this._delayMs ? cfg.DELAY_GROW_RATE : cfg.DELAY_SHRINK_RATE;
        const a = 1 - Math.exp(-rate * (dtMs / 1000));
        this._delayMs += (target - this._delayMs) * a;
        return this._delayMs;
    }

    // ── PLAYOUT SAATİ ───────────────────────────────────────────────────────
    // renderTime MONOTON ilerler; hedefe hız ayarıyla (±%12) yakınsar.
    // Gecikme bütçesi büyüdüğünde saat geriye SIÇRAMAZ, sadece bir süre
    // yavaşlar — 90-150 ms pingde jitter telafisinin görünür olmamasının
    // asıl sebebi budur.
    _advanceRenderClock(nowMs, dtMs, delayMs) {
        const cfg = this.config;
        const desired = nowMs - delayMs;

        if (!this._hasRenderClock) {
            this._renderTime = desired;
            this._hasRenderClock = true;
            this._playbackRate = 1;
            return this._renderTime;
        }

        this._renderTime += dtMs * this._playbackRate;

        const err = desired - this._renderTime;   // >0 → geride kaldık, hızlan
        if (Math.abs(err) > cfg.PLAYBACK_RESYNC_MS) {
            // Kopukluk: ayarlanacak bir hata değil. Saat yeniden kurulur;
            // oluşan görsel fark aşağıda ofsete emilir (ışınlanma yok).
            this._renderTime = desired;
            this._playbackRate = 1;
            return this._renderTime;
        }

        this._playbackRate = clamp(
            1 + err * cfg.PLAYBACK_RATE_GAIN,
            1 - cfg.PLAYBACK_MAX_RATE_DEV,
            1 + cfg.PLAYBACK_MAX_RATE_DEV
        );
        return this._renderTime;
    }

    /**
     * Bu kare için görsel konumu üretir.
     *
     * @param {number} nowMs   performance.now()
     * @param {number} dtMs    kare süresi (ms)
     * @param {object} [netStats] { pingMs, pingJitterMs } — opsiyonel
     * @returns {{x:number, y:number, angle:number, extrapolating:boolean}|null}
     *          Tampon boşsa null (çağıran mevcut konumu korur).
     */
    sample(nowMs, dtMs, netStats = null) {
        if (this._count === 0) return null;

        const cfg = this.config;
        const dt = clamp(dtMs, 0, 100);

        const delay = this._updateDelay(dt, netStats);
        const renderTime = this._advanceRenderClock(nowMs, dt, delay);

        const newestIdx = this._head;
        const newestT = this._t[newestIdx];
        const oldestIdx = this._idx(0);
        const oldestT = this._t[oldestIdx];

        let raw;
        let extrapolating = false;

        if (this._count === 1 || renderTime >= newestT) {
            // ── DEAD RECKONING ─────────────────────────────────────────────
            // Buffer açlığı: paket düştü/gecikti. Durmak yerine son bilinen
            // hız ve heading vektörüyle sönümlü ekstrapolasyon.
            raw = this._extrapolate(renderTime - newestT, newestIdx);
            extrapolating = renderTime > newestT;
        } else if (renderTime <= oldestT) {
            // renderTime tamponun gerisinde (yeni girilen entity / uzun
            // duraklama sonrası): en eski örneğe yaslan, saat ileride
            // kendiliğinden bandın içine girer.
            raw = { x: this._x[oldestIdx], y: this._y[oldestIdx], a: this._au[oldestIdx] };
        } else {
            // ── İNTERPOLASYON ──────────────────────────────────────────────
            raw = this._interpolateAt(renderTime);
        }

        // ── UZLAŞMA (offset absorption) ────────────────────────────────────
        // raw, interpolasyon bandı içinde süreklidir; ancak ekstrapolasyondan
        // interpolasyona dönüşte (ya da saat resync'inde) sıçrayabilir.
        // Sıçrama ekrana YAZILMAZ: ofsete emilir ve üstel sönümle 0'a iner.
        if (this._hasRendered) {
            const jx = this._lastRenderX - (raw.x + this._offX);
            const jy = this._lastRenderY - (raw.y + this._offY);
            const jd = Math.hypot(jx, jy);

            if (jd > cfg.RECONCILE_SNAP_PX) {
                // Işınlanma (respawn / AOI yeniden girişi): emme YOK.
                this._offX = 0; this._offY = 0; this._offA = 0;
            } else if (this._wasExtrapolating && !extrapolating && jd > cfg.RECONCILE_ABSORB_PX) {
                // Devir teslim: bu karede görsel konum DEĞİŞMEZ (C0 süreklilik).
                this._offX += jx;
                this._offY += jy;
                this._offA += wrapAngle(this._lastRenderA - (raw.a + this._offA));
            }
        }

        const decay = Math.exp(-cfg.RECONCILE_RATE * (dt / 1000));
        this._offX *= decay;
        this._offY *= decay;
        this._offA *= decay;

        const outX = raw.x + this._offX;
        const outY = raw.y + this._offY;
        const outA = raw.a + this._offA;

        this._lastRenderX = outX;
        this._lastRenderY = outY;
        this._lastRenderA = outA;
        this._hasRendered = true;
        this._wasExtrapolating = extrapolating;

        const s = this.stats;
        s.delayMs = delay;
        s.playbackRate = this._playbackRate;
        s.bufferCount = this._count;
        s.intervalMs = this._intervalEma ?? 0;
        s.arrivalJitterMs = this._arrivalJitter;
        s.extrapolating = extrapolating;
        s.extrapolatedMs = extrapolating ? renderTime - newestT : 0;
        s.offsetPx = Math.hypot(this._offX, this._offY);

        return { x: outX, y: outY, angle: wrapAngle(outA), extrapolating };
    }

    // Sönümlü dead reckoning: disp = v·τ·(1 − e^(−t/τ)).
    // t≪τ iken v·t (doğru birinci derece tahmin), t≫τ iken v·τ'ya doyar —
    // paket uzun süre gelmezse entity uçup gitmez, yumuşakça durur.
    _extrapolate(aheadMs, idx) {
        const cfg = this.config;
        const base = { x: this._x[idx], y: this._y[idx], a: this._au[idx] };
        if (!(aheadMs > 0) || !this._hasVelocity) return base;

        const t = Math.min(aheadMs, cfg.EXTRAPOLATION_MAX_MS);
        const tau = cfg.EXTRAPOLATION_DAMP_MS;
        const k = tau * (1 - Math.exp(-t / tau));

        return {
            x: base.x + this._vx * k,
            y: base.y + this._vy * k,
            a: base.a + this._va * k,
        };
    }

    // renderTime'ı çevreleyen (S1, S2) çiftini bulur, α'yı hesaplar ve
    // Hermite (yoksa LERP) uygular.
    _interpolateAt(renderTime) {
        // Tamponun sonundan geriye tara: aranan çift neredeyse her zaman
        // son birkaç örnektir → pratikte O(1).
        let i = this._count - 2;
        for (; i >= 0; i--) {
            if (this._t[this._idx(i)] <= renderTime) break;
        }
        if (i < 0) i = 0;

        const i1 = this._idx(i);
        const i2 = this._idx(i + 1);
        const t1 = this._t[i1];
        const t2 = this._t[i2];
        const span = t2 - t1;
        const alpha = span > 0.0001 ? clamp((renderTime - t1) / span, 0, 1) : 1;

        if (!this.config.HERMITE_ENABLED || this._count < 3) {
            return {
                x: this._x[i1] + (this._x[i2] - this._x[i1]) * alpha,
                y: this._y[i1] + (this._y[i2] - this._y[i1]) * alpha,
                a: this._au[i1] + (this._au[i2] - this._au[i1]) * alpha,
            };
        }

        // ── Catmull-Rom teğetleri (uçlarda tek yönlü fark) ─────────────────
        const i0 = i > 0 ? this._idx(i - 1) : i1;
        const i3 = (i + 2) <= (this._count - 1) ? this._idx(i + 2) : i2;
        const t0 = this._t[i0];
        const t3 = this._t[i3];

        // Teğetler [t1,t2] parametre aralığına ölçeklenir (h ile çarpım).
        const d1 = (t3 !== t1) ? span / (t3 - t1) : 0;   // S2'nin teğet ölçeği
        const d0 = (t2 !== t0) ? span / (t2 - t0) : 0;   // S1'in teğet ölçeği

        const mx1 = (this._x[i2] - this._x[i0]) * d0;
        const my1 = (this._y[i2] - this._y[i0]) * d0;
        const ma1 = (this._au[i2] - this._au[i0]) * d0;

        const mx2 = (this._x[i3] - this._x[i1]) * d1;
        const my2 = (this._y[i3] - this._y[i1]) * d1;
        const ma2 = (this._au[i3] - this._au[i1]) * d1;

        return {
            x: this._hermite1D(this._x[i1], this._x[i2], mx1, mx2, alpha),
            y: this._hermite1D(this._y[i1], this._y[i2], my1, my2, alpha),
            a: this._hermite1D(this._au[i1], this._au[i2], ma1, ma2, alpha),
        };
    }

    // Kübik Hermite + teğet kelepçesi.
    // Kelepçe olmadan Catmull-Rom, keskin dönüşlerde (yılan U dönüşü yapıyor)
    // segment dışına taşar ve entity görünür biçimde "savrulur".
    _hermite1D(p1, p2, m1, m2, s) {
        const chord = p2 - p1;
        const lim = Math.abs(chord) * this.config.HERMITE_TANGENT_CLAMP;
        const t1 = clamp(m1, -lim, lim);
        const t2 = clamp(m2, -lim, lim);

        const s2 = s * s;
        const s3 = s2 * s;
        const h00 = 2 * s3 - 3 * s2 + 1;
        const h10 = s3 - 2 * s2 + s;
        const h01 = -2 * s3 + 3 * s2;
        const h11 = s3 - s2;

        return h00 * p1 + h10 * t1 + h01 * p2 + h11 * t2;
    }
}
