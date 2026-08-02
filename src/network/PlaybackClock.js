/**
 * PLAYBACK CLOCK — ağdan YALITILMIŞ, MONOTON render zaman ekseni.
 *
 * ── NEDEN VAR ────────────────────────────────────────────────────────────
 * Önceki tasarımda her yılan render zamanını şöyle hesaplıyordu:
 *
 *     renderTime = performance.now() - interpDelay      // interpDelay her kare değişir
 *
 * Bu iki yönden kırılgandı:
 *
 *  1. GERİYE AKAN SAAT. interpDelay hedefe kare başına %8 yaklaşıyordu.
 *     Kare başına ilerleme  Δrender = Δduvar - 0.08*(hedef - gecikme)  olur;
 *     yani (hedef-gecikme) > 12.5*Δt olduğunda renderTime GERİ GİDER.
 *     144Hz'de (Δt=6.9ms) bu eşik 87ms — gecikme aralığı [60,250] olduğu için
 *     tek bir jitter sıçraması saatin geri akmasına yetiyordu. 60Hz'de geri
 *     gitmez ama normal hızın %9'una düşer. Sonuç: ağ dalgalandığı anda
 *     gecikme uyarlaması KENDİSİ stutter üretiyordu.
 *
 *  2. YILAN BAŞINA AYRI SAAT. Tüm entity'ler AYNI EntityCollection zarfında
 *     gelir, yani varış zamanları birebir aynıdır. Buna rağmen her yılan kendi
 *     EMA'sını tutuyordu: az örnekle gürültülü kestirimler, birbirinden farklı
 *     yakınsayan gecikmeler ve entity'ler arasında zaman kayması.
 *
 * ── ÇÖZÜM ────────────────────────────────────────────────────────────────
 * Sahne düzeyinde TEK bir saat. Duvar saatine bir PLL (phase-locked loop) ile
 * kilitlenir: hedefe anında atlamak yerine HIZINI ±%2 oynatarak yaklaşır.
 *
 *     clock += dt * rate,      rate = 1 + clamp(hata * KP, -0.02, +0.02)
 *
 * `dt >= 0` ve `rate > 0` olduğundan saat YAPISAL OLARAK monotondur — geri
 * akması matematiksel olarak imkânsızdır. Faz hatası zamanla emilir, tek
 * karede değil; bu yüzden gecikme uyarlaması artık görünür bir sıçrama
 * üretemez.
 *
 * Tampon boşalmasında (saat en yeni snapshot'ı geçtiğinde) saat DURMAZ,
 * kademeli olarak YAVAŞLAR: böylece elde kalan veri daha uzun süreye yayılır
 * ve hareket sönümlü ekstrapolasyonla akmaya devam eder.
 */

const DEFAULTS = {
    // ── Adaptif gecikme (hedef faz) ──────────────────────────────────────
    MIN_DELAY_MS: 60,
    MAX_DELAY_MS: 250,
    INTERVAL_FACTOR: 2.0,      // ortalama paket aralığının kaç katı taban pay
    JITTER_FACTOR: 2.0,        // ölçülen sapmanın kaç katı ek pay
    INTERVAL_EMA: 0.2,
    JITTER_EMA: 0.15,
    FRAME_EMA: 0.10,
    // Gecikme yumuşatması artık renderTime'ı DOĞRUDAN sürmüyor; yalnızca PLL
    // hedefini kaydırıyor. Bu yüzden agresif olması güvenli — saatin kendisi
    // rate limitli olduğu için sıçrama üretemez.
    DELAY_SMOOTHING: 0.05,

    // ── PLL ──────────────────────────────────────────────────────────────
    // Saat hızının duvar saatinden sapabileceği azami oran. %2'de 200ms'lik
    // bir faz hatası ~10 saniyede kapanır: gözle görülemez ama kalıcı sapmayı
    // temizlemeye yeter.
    MAX_DRIFT: 0.02,
    // Faz kazancı: hata(ms) -> hız sapması. 0.002 => 10ms hata %2 sapma verir,
    // yani küçük hatalarda bile tam yetkiyle ama yumuşak düzeltme.
    PHASE_GAIN: 0.002,

    // ── Tampon boşalması ─────────────────────────────────────────────────
    // Saat en yeni snapshot'ı bu kadar ms geçtiğinde hız MIN_STARVE_RATE'e
    // kadar doğrusal olarak iner. Durmaz — durmak da bir tür sıçramadır.
    STARVE_SOFT_MS: 120,
    MIN_STARVE_RATE: 0.35,

    // ── Sert yeniden senkron ─────────────────────────────────────────────
    // Sekme dönüşü, ilk paket, uzun donma: faz hatası bu eşiği aşarsa PLL ile
    // kapatmak dakikalar sürerdi. Saat ışınlanır ve resyncSeq artırılır;
    // tüketici tarafta inertialization bu kopukluğu görsel olarak eritir.
    HARD_RESYNC_MS: 750,
};

export class PlaybackClock {
    constructor(overrides = {}) {
        this.config = { ...DEFAULTS, ...overrides };
        this.reset();
    }

    reset() {
        this._timeMs = 0;
        this._started = false;
        this._lastPacketAtMs = 0;
        this._intervalEmaMs = null;
        this._jitterEmaMs = null;
        this._frameEmaMs = null;
        this._delayMs = null;
        // Sert yeniden senkron sayacı. Tüketiciler bu değeri kendi
        // kopyalarıyla karşılaştırıp süreksizliği fark eder.
        this.resyncSeq = 0;
        // Teşhis
        this._lastRate = 1;
        this._starving = false;
    }

    /** Şu anki oynatma zamanı (ms, performance.now() ile aynı eksende). */
    get timeMs() {
        return this._timeMs;
    }

    /** Saat en az bir pakete kilitlendi mi? */
    get isReady() {
        return this._started;
    }

    /** Son karede tampon boşalması yaşandı mı (teşhis/HUD için). */
    get isStarving() {
        return this._starving;
    }

    /** Yürürlükteki oynatma hızı (1.0 = duvar saati). Teşhis için. */
    get rate() {
        return this._lastRate;
    }

    /** Yürürlükteki adaptif gecikme (ms). Teşhis için. */
    get delayMs() {
        return this._delayMs ?? this.config.MIN_DELAY_MS;
    }

    /**
     * Sunucudan bir snapshot zarfı geldiğinde ÇAĞRILIR (entity başına değil,
     * ZARF başına — tüm entity'ler aynı varış zamanını paylaşır).
     *
     * @param {number} arrivalMs performance.now() cinsinden varış zamanı
     */
    notifyPacket(arrivalMs) {
        const cfg = this.config;
        const now = Number.isFinite(arrivalMs) ? arrivalMs : performance.now();

        if (this._started && this._lastPacketAtMs > 0) {
            const interval = now - this._lastPacketAtMs;
            // 0 < aralık < 1000ms dışındakiler ölçüm değil olaydır (donma,
            // sekme dönüşü); istatistiği kirletmemeli.
            if (interval > 0 && interval < 1000) {
                // JITTER: sapma, ORTALAMA GÜNCELLENMEDEN ÖNCE ölçülür — aksi
                // halde ortalama örneğe kayıp sapmayı kendi içinde soğurur ve
                // jitter olduğundan küçük görünür. Tamponu boşaltan şey
                // ortalama değil bu sapmadır.
                if (this._intervalEmaMs !== null) {
                    const deviation = Math.abs(interval - this._intervalEmaMs);
                    this._jitterEmaMs = this._jitterEmaMs === null
                        ? deviation
                        : this._jitterEmaMs + (deviation - this._jitterEmaMs) * cfg.JITTER_EMA;
                }
                this._intervalEmaMs = this._intervalEmaMs === null
                    ? interval
                    : this._intervalEmaMs + (interval - this._intervalEmaMs) * cfg.INTERVAL_EMA;
            }
        }

        this._lastPacketAtMs = now;

        if (!this._started) {
            // İlk paket: saati doğrudan hedefe kur (kilitlenecek faz yok).
            this._started = true;
            this._delayMs = cfg.MIN_DELAY_MS;
            this._timeMs = now - this._delayMs;
        }
    }

    /**
     * Her render karesinde, entity'ler örneklenmeden ÖNCE çağrılır.
     * @param {number} deltaMs kare süresi
     */
    update(deltaMs) {
        if (!this._started) return;

        const cfg = this.config;
        const dt = clamp(Number(deltaMs) || 0, 0, 100);
        const now = performance.now();

        // Kare süresi EMA'sı: 30fps'te bir kare 33ms tüketir ve aynı ağ
        // koşulunda 144fps'ten daha fazla pay gerekir.
        this._frameEmaMs = this._frameEmaMs === null
            ? dt
            : this._frameEmaMs + (dt - this._frameEmaMs) * cfg.FRAME_EMA;

        // ── Hedef faz ────────────────────────────────────────────────────
        let targetDelay = cfg.MIN_DELAY_MS;
        if (Number.isFinite(this._intervalEmaMs)) {
            targetDelay = this._intervalEmaMs * cfg.INTERVAL_FACTOR
                + (this._jitterEmaMs ?? 0) * cfg.JITTER_FACTOR
                + (this._frameEmaMs ?? 0);
        }
        targetDelay = clamp(targetDelay, cfg.MIN_DELAY_MS, cfg.MAX_DELAY_MS);
        this._delayMs += (targetDelay - this._delayMs) * cfg.DELAY_SMOOTHING;

        const targetTime = now - this._delayMs;
        const phaseError = targetTime - this._timeMs;

        // ── Sert yeniden senkron ─────────────────────────────────────────
        if (Math.abs(phaseError) > cfg.HARD_RESYNC_MS) {
            this._timeMs = targetTime;
            this._lastRate = 1;
            this._starving = false;
            this.resyncSeq++;
            return;
        }

        // ── PLL: faz hatasını HIZLA kapat, konumla değil ──────────────────
        let rate = 1 + clamp(phaseError * cfg.PHASE_GAIN, -cfg.MAX_DRIFT, cfg.MAX_DRIFT);

        // ── Tampon boşalması: yavaşla, DURMA ─────────────────────────────
        // lead > 0  =>  saat en yeni snapshot'ı geçti (veri bitti).
        const lead = this._timeMs - this._lastPacketAtMs;
        this._starving = lead > 0;
        if (lead > 0) {
            const decel = Math.max(cfg.MIN_STARVE_RATE, 1 - lead / cfg.STARVE_SOFT_MS);
            rate *= decel;
        }

        // MONOTONLUK GARANTİSİ: dt >= 0 ve rate > 0 (alt sınır
        // 0.98 * 0.35 = 0.343) olduğundan _timeMs asla azalamaz.
        this._lastRate = rate;
        this._timeMs += dt * rate;
    }
}

function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
}
