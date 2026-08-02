import Phaser from 'phaser';

const SnakeConfig = {
    // ── Boyut senkronu (SUNUCU ile BIREBIR) ─────────────────────────────
    // Sunucu: game-server com/common/SnakeGeometryConfig.java →
    // HEAD_RADIUS_PX / SEGMENT_RADIUS_PX. Texture'lar 48x48 px daire
    // (snake_head48 / snake_body48, origin 0.5) → görünen yarıçap =
    // 24 * scale px. Bu değerler değişirse SUNUCUDAKİ config de değişmeli;
    // aksi halde görsel temas ile sunucu ölüm anı ayrışır.
    HEAD_RADIUS: 24,
    SEGMENT_RADIUS: 24,

    PHYS_CONST: 60,
    BASE_SPEED_FACTOR: 3.75,
    SPEED_REDUCTION_PER_SCALE: 0.5 / 106,
    BOOST_SPEED_FACTOR: 7.5,
    BOOST_DRAIN_INTERVAL_MS: 400,
    BOOST_MIN_SEGMENTS: 10,
    TURN_ANGLE_BASE: 3.3,
    TURN_SPEED_INFLUENCE: 4.8,
    INITIAL_SEGMENT_COUNT: 32,
    SEGMENT_SPACING_BASE: 12.5,
    PATH_SAMPLE_MIN_STEP: 0,
    REMOTE_INTERPOLATION_FACTOR: 0.35,

    // ── Frame-rate decoupling / 120Hz+ support ──────────────────────────
    // KÖK NEDEN (120Hz micro-tremor): Arcade physics varsayılanı
    // fixedStep=true @60Hz — 120/144Hz ekranda render döngüsü fizik
    // adımından 2+ kat hızlı koşar; kafa her iki frame'de bir AYNI
    // pozisyonda çizilir, sonra çift adım sıçrar (merdiven aliasing'i).
    // Çözüm: kafa artık fizik body ile DEĞİL, manuel entegrasyonla
    // (capped dt, saniye-normalize) mantıksal `sim` pozisyonunda simüle
    // edilir; sprite ise sim'i frame-rate-agnostik üstel yumuşatmayla
    // izleyen SAF GÖRSEL katmandır: alpha = 1 - exp(-RATE * dtSec).
    MAX_SIM_DT_MS: 50,            // entegrasyon dt tavanı (GC/sekme spike koruması)
    VISUAL_SMOOTHING_RATE: 22,    // 1/s — τ≈45ms: 60/120/144Hz'de aynı his
    VISUAL_SNAP_DISTANCE: 200,    // px — bu üstü fark görsel katmanda anında kapanır

    // ── Remote snapshot-buffer interpolation ────────────────────────────
    // Uzak yılanlar son iki SUNUCU SNAPSHOT'ı arasında render zamanına göre
    // lerp edilir: renderTime = now - interpolationDelay. Delay, ölçülen
    // paket aralığına adaptiftir (×2, min/max kelepçeli). Buffer açlığında
    // eski üstel takip (REMOTE_INTERPOLATION_FACTOR) devreye girer.
    INTERP_DELAY_MIN_MS: 60,
    INTERP_DELAY_MAX_MS: 250,
    INTERP_DELAY_INTERVAL_FACTOR: 2.0,
    SNAPSHOT_BUFFER_MS: 1000,     // tutulan snapshot penceresi

    // ── ADAPTIF BUFFER (jitter + kare süresi farkındalı) ────────────────
    // Eski gecikme YALNIZCA ortalama paket aralığına bakıyordu. Ama buffer'ı
    // kurutan şey ortalama DEĞİL, VARYANSTIR: aralık ortalaması 33ms'te sabit
    // dururken tek bir 90ms'lik gecikme buffer'ı boşaltır. Ayrıca kare süresi
    // hiç hesaba katılmıyordu — 30fps'te bir kare 33ms tüketir ve aynı ağ
    // koşulunda 144fps'ten çok daha fazla pay gerekir.
    //   delay = aralıkEMA*FACTOR + jitterEMA*JITTER_FACTOR + kareSüresiEMA
    INTERP_JITTER_FACTOR: 2.0,    // ölçülen sapmanın kaç katı pay bırakılacağı
    PACKET_JITTER_EMA: 0.15,      // |aralık - ortalama| yumuşatma ağırlığı
    FRAME_TIME_EMA: 0.10,         // kare süresi yumuşatma ağırlığı
    // Gecikmenin KENDİSİ de yumuşatılır: ani sıçraması render saatini
    // zamanda ileri/geri atlatır ve bu da tam olarak önlemeye çalıştığımız
    // stutter'ı üretir.
    INTERP_DELAY_SMOOTHING: 0.08,

    // ── HERMITE (Catmull-Rom) POZİSYON İNTERPOLASYONU ───────────────────
    // Doğrusal lerp yalnızca C⁰ süreklidir: her snapshot sınırında hız
    // vektörü ANINDA değişir ve dönen yılanlarda bu görünür bir "köşe"
    // olarak okunur. Hermite, komşu snapshot'lardan türetilen teğetlerle
    // C¹ süreklilik (sürekli hız) verir.
    // Teğet uzunluğu kiriş uzunluğuna göre kelepçelenir: bozuk/sıçramış bir
    // örnek aksi halde eğriyi aşırı savurur (overshoot).
    HERMITE_TANGENT_CLAMP: 2.0,

    // ── EKSTRAPOLASYON KORKULUĞU (anti-pop) ─────────────────────────────
    // Paket gecikirse hareket DURMAZ; son geçerli hız vektörü boyunca
    // sürtünmeli (decaying) devam eder:
    //     yerdeğiştirme(dt) = v * τ * (1 - e^(-dt/τ))
    // Bu ifade dt→∞ iken v*τ'ya DOYAR — uzun bir kesintide yılan asla
    // fırlamaz, yumuşakça durur. dt=0'da türevi tam olarak v'dir, yani
    // interpolasyondan ekstrapolasyona geçiş C¹ pürüzsüzdür.
    EXTRAPOLATION_MAX_MS: 250,
    EXTRAPOLATION_DECAY_TAU_MS: 90,
    // Paketler döndüğünde ekstrapole konum ile interpolasyonun söylediği
    // konum arasındaki fark ANINDA kapatılsa "pop" olurdu. Fark bir ofset
    // olarak saklanır ve smoothstep ile bu süre boyunca sıfıra eritilir.
    REJOIN_BLEND_MS: 160,
    REJOIN_MAX_OFFSET_PX: 400,    // üstü: gerçek ışınlanma, eritmeye çalışma

    // ── Time-aligned reconciliation (v2) ─────────────────────────────────
    // The old model compared the head's position NOW against a server sample
    // that is ~RTT/2 old — the "error" it measured was mostly latency, which
    // fluctuates with packet timing and produced a permanently noisy
    // correction signal (the residual micro-stutter). v2 keeps a short ring
    // buffer of predicted positions and compares each server packet against
    // where the client thought it was ONE-WAY-DELAY ago: the true prediction
    // error, time-aligned and stable.
    RECON_HISTORY_MS: 1500,          // prediction history window
    RECON_DEFAULT_ONE_WAY_MS: 50,    // fallback before ping is calibrated
    RECON_ERROR_EMA: 0.45,           // per-packet error smoothing weight
    RECON_START_THRESHOLD: 3,        // px — begin correcting above this…
    RECON_STOP_THRESHOLD: 1,         // px — …stop below this (hysteresis)
    RECON_LATERAL_DEAD_ZONE: 2,      // px — lateral is timing-insensitive
    RECON_LONGITUDINAL_DEAD_FACTOR: 0.03, // * speed → px (timing noise scales with speed)
    RECON_IDLE_ERROR_DECAY: 0.06,    // per-frame decay while inside dead zone
    RECONCILIATION_POSITION_FACTOR: 0.10,  // blend fraction per frame
    RECONCILIATION_MAX_CORRECTION_SPEED: 300, // px/s cap — corrections stay sub-perceptual
    RECON_HARD_SNAP_DISTANCE: 800,   // death/respawn/teleport only

    // ── Segment ekleme/çıkarma yumuşak animasyonları (game feel) ─────────
    // Büyüme: yeni segment ölçek/opaklık 0'dan başlar, üstel yaklaşımla 1'e
    //   çıkar → scale = 1 - exp(-k·t) (kare-bağımsız artımlı biçim).
    // Çıkış: çıkarılan segment anında yok edilmez; yerinde 1→0 çöker (~180ms).
    SEGMENT_GROW_RATE: 14,        // 1/s — büyüme üstel oranı (τ≈71ms)
    SEGMENT_DESPAWN_MS: 180,      // çıkış çöküş süresi (ms)

    // ── Segment isolation (anti-cascade) ────────────────────────────────
    // The body path is sampled from a low-pass "follower" of the head, not
    // the head itself. Reconciliation micro-corrections on the head are
    // high-frequency signals — the follower filters them out, so the body
    // no longer magnifies head snapping. 0.5 @60fps ≈ 3-4 px constant
    // trailing lag (invisible: it only shifts the body back a hair) while
    // per-frame alternating corrections are attenuated ~3x.
    PATH_SMOOTHING_FACTOR: 0.5,

    // ── GÖRSEL DECIMATION (mantıksal sct'den BAĞIMSIZ) ───────────────────
    // Gövde, yarıçapı `SEGMENT_RADIUS * scale` olan dairelerin `spacing`
    // aralıklarla dizilmesiyle çizilir. spacing scale ile BÜYÜMEZ (12.5→16.9)
    // ama yarıçap büyür (24→144) — yani yılan büyüdükçe komşu sprite'lar
    // katlanarak üst üste biner: scale=1'de ~4×, scale=6'da ~17×. Bu fazlalık
    // saf israftır. Çizilen sprite aralığı (stride*spacing) yarıçapı aşmadığı
    // sürece siluet KATI kalır, dolayısıyla stride ölçekle birlikte güvenle
    // artırılabilir: scale=1 → 1 (değişiklik yok), scale=6 → 8 (8× az sprite).
    //
    // KRİTİK: bu YALNIZCA çizim katmanıdır. `sct`, path uzunluğu, spacing ve
    // sunucu hitbox'ı hiç DEĞİŞMEZ — çarpışma/ölüm senkronu birebir korunur.
    RENDER_DECIMATION_ENABLED: true,
    RENDER_MAX_DRAWN_SPACING_RATIO: 1.0, // çizilen aralık ≤ 1.0 × yarıçap (≥2× binme)
    RENDER_MAX_STRIDE: 8,
    SEGMENT_POOL_MAX: 512,               // havuz tavanı (üstü gerçekten destroy)

    // ── Viewport culling ────────────────────────────────────────────────
    // Kamera görüş dikdörtgeninin dışındaki segmentler için transform yazımı
    // ve çizim atlanır. Padding, segment yarıçapı ÜSTÜNE eklenir; kenardan
    // giren gövdenin bir kare geç belirmesini önler.
    CULL_PADDING_PX: 96,

    // DEBUG: render a ghost marker at the raw server-authoritative head
    // position (player snake only). Visual overlay only — no effect on
    // prediction or reconciliation. Set to false to hide.
    DEBUG_SERVER_POSITION_MARKER: false,
};

export class Snake {
    // SUNUCU FORMÜLÜNÜN AYNASI — game-server SnakeDynamicsSystem.calculateScale:
    // Math.min(6.0, 1.0 + (segmentCount - 2) / 106.0). Burada değişiklik
    // yapılacaksa sunucuyla birlikte yapılmalı.
    static calculateScaleFromSegmentCount(segmentCount) {
        return Math.min(6.0, 1.0 + (segmentCount - 2) / 106.0);
    }

    constructor(scene, isPlayerControlled, x, y, initialSegmentCount = SnakeConfig.INITIAL_SEGMENT_COUNT, initialAngleRaw = 0, nickname = '') {
        this.scene = scene;
        this.config = SnakeConfig;
        this.isPlayerControlled = isPlayerControlled;
        this.alive = true;
        this.sct = this._normalizeSegmentCount(initialSegmentCount);
        // İlk scale, sunucunun SnakeDynamicsSystem.calculateScale(segmentCount)
        // formülünün BIREBIR aynısıyla hesaplanır — ilk snapshot gelmeden önce
        // de görsel boyut sunucu hitbox'ıyla eşittir. (Eski sabit 0.5, sunucu
        // minimumu ~1.28 iken yılanı yarı boyutta çizip boyut asimetrisi
        // yaratıyordu; sonraki paketler zaten sunucu scale'ini uygular.)
        this.scale = Snake.calculateScaleFromSegmentCount(this.sct);
        this.speed = 0;
        this.turnSpeed = 0;
        this.isBoosting = false;
        this.nickname = nickname;
        this.lastReconciledSequenceId = 0;
        
        const initialAngle = this._decodeServerAngle(initialAngleRaw);
        // MANTIKSAL HAREKET AÇISI — yılanın fiilen gittiği yön. Movement
        // sistemi (updateFromInput) bunu günceller, velocity bundan türetilir
        // ve head.rotation her frame buna AYNEN eşitlenir (mirror).
        this.movementAngle = initialAngle;
        this.networkTarget = { x: x, y: y, angle: initialAngle };
        this.selfServerTarget = { x: x, y: y, angle: initialAngle };
        this.selfServerTargetHeading = initialAngle;
        this.hasServerState = false;
        this.hasSelfServerState = false;

        // ── SPAWN BASELINE (yalnızca oyuncunun kendi yılanı) ─────────────────
        // İlk otoriter SelfPosition karesi işlenene kadar false. İki şeyi yönetir:
        //   1. İlk kare LERP'SİZ uygulanır (ışınlanma) — sim, sprite, path ve
        //      kamera tek adımda otoriter konuma oturur.
        //   2. Baseline kurulana kadar reconciliation TAMAMEN kapalıdır. Aksi
        //      halde spawn öncesi/asenkron tahmin geçmişi üzerinden hata birikip
        //      baseline'dan hemen sonra toplu bir düzeltme olarak boşalıyordu —
        //      "2-3 sn sonra ani kayma / agresif lerp"in kök nedeni.
        this._hasSpawnBaseline = false;

        // Sunucunun verdiği başlangıç yönü uygulandı mı? Yılan, StartInformation'dan
        // ÖNCE gelen bir pakette yaratılırsa açısız (0 rad) kurulur; bu bayrak
        // yönün sonradan bir kez düzeltilebilmesini sağlar (bkz. applyServerHeading).
        this._hasServerHeading = false;

        // ── Logical simulation state (player-controlled) ─────────────────
        // sim = tahmin edilen OTORITER-YEREL pozisyon. updateFromInput
        // entegre eder, reconciliation düzeltmeleri BURAYA uygulanır.
        // head sprite'ı sim'i üstel yumuşatmayla izleyen görsel katmandır.
        this.sim = { x: x, y: y };
        this.vel = { x: 0, y: 0 };

        // ── Remote snapshot buffer (remote-controlled) ───────────────────
        this._snapshots = [];                 // {t, x, y, angle} (performance.now)
        this._packetIntervalEmaMs = null;     // sunucu paket aralığı EMA'sı
        this._lastSnapshotAt = 0;

        // ── Adaptif buffer / interpolasyon durumu ────────────────────────
        this._packetJitterEmaMs = null;       // |aralık - ortalama| EMA'sı (varyans payı)
        this._frameTimeEmaMs = null;          // kare süresi EMA'sı
        this._interpDelayMs = null;           // yumuşatılmış render gecikmesi
        // Son iki snapshot'tan türetilen hız — ekstrapolasyonun dayanağı.
        // (Bu alan daha önce yalnızca temizlik kodlarında REFERANS ediliyor
        // ama hiç TANIMLANMIYORDU; artık gerçekten sürdürülüyor.)
        this._remoteVel = { x: 0, y: 0 };     // px/ms
        this._remoteAngVel = 0;               // rad/ms
        // Ekstrapolasyondan interpolasyona dönüşte "pop"u engelleyen ofset.
        this._rejoinOffset = { x: 0, y: 0, angle: 0 };
        this._rejoinRemainingMs = 0;
        this._wasExtrapolating = false;

        // Time-aligned reconciliation state (player-controlled only)
        this._predHistory = [];               // ring of {t, x, y} (performance.now)
        this._smoothedError = { x: 0, y: 0 }; // EMA of time-aligned prediction error
        this._correcting = false;             // hysteresis latch
        // this.segments artık MANTIKSAL segment listesi DEĞİL — ÇİZİLEN sprite
        // listesidir. Uzunluğu ceil(sct / _stride) kadardır; mantıksal uzunluk
        // her zaman this.sct'tir (sunucu otoritesi, hitbox ile birebir).
        this.segments = [];
        // Çıkış animasyonundaki (çökmekte olan) segmentler — this.segments'ten
        // ÇIKARILMIŞ ama henüz görsel olarak yok olmamış ghost'lar: { sprite, t }.
        this._despawningSegments = [];
        // Kaç mantıksal düğümde bir sprite çizildiği (≥1). _syncVisualSegments
        // her yeniden boyutlandırmada scale/spacing'den yeniden hesaplar.
        this._stride = 1;
        // Son karede gerçekten çizilen (cull edilmemiş) sprite sayısı — teşhis.
        this._visibleSegmentCount = 0;
        // Sprite havuzu: büyüyen/küçülen yılanların her karede sprite
        // yaratıp yok etmesini (GC spike) önler. Serbest bırakılanlar
        // görünmez+pasif olarak burada bekler.
        this._spritePool = [];
        this.segmentPrimaryColor = 0xD4AF37;
        this.segmentSecondaryColor = 0x2B2B2B;
        this.segmentStripeWidth = 3;
        this.colors = [
            0xFF3333, 0xFF8D33, 0xFFD433, 0x9CFF33, 0x33FF57,
            0x33FFB8, 0x33D4FF, 0x338DFF, 0x3333FF, 0x9C33FF,
            0xFF33F5, 0xFF338D, 0xFFFF00, 0x00FF00, 0x00FFFF,
            0xFFFFFF, 0xFF7F50, 0xDA70D6, 0x4169E1, 0xFF6347
        ];
        this.path = [];
        this.pathSegLens = [];
        this.totalPathLen = 0;
        // Path, sunucunun ilk-karşılaşma tohumundan mı geldi? True ise elimizde
        // GERÇEK geometri var demektir ve düz warmup ile ezilmesi yasaktır.
        this._pathSeeded = false;
        this.GRID = 1;
        this.head = null;
        this.trail = null;
        this.eyeL = null; this.eyeR = null;
        this.pupilL = null; this.pupilR = null;
        this._lookVec = new Phaser.Math.Vector2(1, 0);
        this.create(x, y, initialAngle);
    }

    calculateBaseSpeed() {
        const baseSpeed = this.config.BASE_SPEED_FACTOR * this.config.PHYS_CONST;
        const scaleFactor = 1.0 / (1.0 + (this.scale - 1.0) * 0.2);
        return baseSpeed * scaleFactor;
    }

    calculateBoostSpeed() {
        const boostSpeed = this.config.BOOST_SPEED_FACTOR * this.config.PHYS_CONST;
        const scaleFactor = 1.0 / (1.0 + (this.scale - 1.0) * 0.2);
        return boostSpeed * scaleFactor;
    }
    calculateScaleTurnFactor() { return 0.13 + 0.87 * Math.pow((7.5 - this.scale) / 6, 2); }
    calculateSpeedTurnFactor() { return Math.min(1, this.speed / this.config.TURN_SPEED_INFLUENCE); }
    getSegmentSpacing() {
        const base = this.config.SEGMENT_SPACING_BASE;
        const lenF = Phaser.Math.Clamp((this.sct - 30) / 200, 0, 1);
        const scF = Phaser.Math.Clamp((this.scale - 1) / 5, 0, 1);
        const extra = 0.35 * (0.7 * lenF + 0.3 * scF);
        return base * (1 + extra);
    }
    getSampleMinStep() { return Math.max(this.config.PATH_SAMPLE_MIN_STEP, this.getSegmentSpacing() * 0.1); }
    setBoost(b) { this.isBoosting = b; }

    _normalizeSegmentCount(rawCount) {
        const count = Math.round(Number(rawCount));
        if (!Number.isFinite(count) || count <= 0) {
            return this.config.INITIAL_SEGMENT_COUNT;
        }
        return count;
    }

    _getSegmentColor(index) {
        return (Math.floor(index / this.segmentStripeWidth) % 2 === 0)
            ? this.segmentPrimaryColor
            : this.segmentSecondaryColor;
    }

    // ── Sprite havuzu ────────────────────────────────────────────────────
    // Yılan sürekli büyüyüp küçüldüğü (ve stride değiştikçe görsel sprite
    // sayısı oynadığı) için sprite'lar destroy edilmez, havuza iade edilir.
    // Böylece steady-state'te sıfır tahsis → GC spike yok.
    _acquireSegmentSprite(x, y, animateIn = false) {
        let seg = this._spritePool.pop();
        if (seg && seg.scene) {
            seg.setActive(true);
            seg.setVisible(true);
            seg.setPosition(x, y);
            seg.setRotation(0);
        } else {
            // registerWorld: world-space objects render via the zoomed main camera
            // only — the zoom-1 UI camera must ignore them (see Game.js).
            seg = this.scene.registerWorld(
                this.scene.add.sprite(x, y, 'snake_body48').setOrigin(0.5)
            );
        }
        // _animScale: this.scale ile ÇARPILAN büyüme/çöküş çarpanı (0..1).
        // animateIn=true → 0'dan başlar, _updateSegmentLifecycle ile 1'e büyür.
        seg._animScale = animateIn ? 0 : 1;
        seg._growing = animateIn;
        seg.setScale(animateIn ? 0 : this.scale);
        seg.setAlpha(animateIn ? 0 : 1);
        return seg;
    }

    _releaseSegmentSprite(seg) {
        if (!seg) return;
        // Sahneden kopmuş/yok edilmiş sprite havuza girmemeli.
        if (!seg.scene) { seg.destroy?.(); return; }
        seg._growing = false;
        seg._animScale = 1;
        if (this._spritePool.length >= this.config.SEGMENT_POOL_MAX) {
            seg.destroy();
            return;
        }
        seg.setVisible(false);
        seg.setActive(false);
        this._spritePool.push(seg);
    }

    // Kaç mantıksal düğümde bir sprite çizileceği. Çizilen aralık
    // (stride*spacing) segment YARIÇAPINI aşmadığı sürece komşu daireler en az
    // 2× biner ve siluet katı kalır — bu yüzden tavan yarıçaptan türetilir.
    // scale=1'de sonuç 1'dir: küçük yılanlarda davranış BİREBİR eskisi gibi.
    _computeRenderStride() {
        if (!this.config.RENDER_DECIMATION_ENABLED) return 1;
        const spacing = this.getSegmentSpacing();
        if (!(spacing > 0.0001)) return 1;
        const radius = this.config.SEGMENT_RADIUS * this.scale;
        const maxDrawnSpacing = radius * this.config.RENDER_MAX_DRAWN_SPACING_RATIO;
        const stride = Math.floor(maxDrawnSpacing / spacing);
        return Phaser.Math.Clamp(
            Number.isFinite(stride) ? stride : 1,
            1,
            this.config.RENDER_MAX_STRIDE
        );
    }

    // Görsel sprite sayısını mantıksal sct + güncel stride'a göre uzlaştırır.
    // sct'yi ASLA yazmaz — tek yönlü bağımlılık (mantık → görsel).
    _syncVisualSegments(animateIn = false, animateOut = false) {
        this._stride = this._computeRenderStride();
        const want = this.sct > 0
            ? Math.max(1, Math.ceil(this.sct / this._stride))
            : 0;

        while (this.segments.length > want) {
            const seg = this.segments.pop();
            // animateOut: sunucu segment SİLDİĞİ için küçülüyoruz → yerinde
            // çöküş animasyonu. Aksi halde (yalnızca stride değişti) sprite
            // sessizce havuza döner; gövde uzunluğu değişmediğinden animasyon
            // yanlış olurdu.
            if (animateOut) this._beginSegmentDespawn(seg);
            else this._releaseSegmentSprite(seg);
        }
        while (this.segments.length < want) {
            const spawn = this._resolveSegmentSpawnPositionBehindTail();
            this.segments.push(this._acquireSegmentSprite(spawn.x, spawn.y, animateIn));
        }

        this._refreshSegmentDepths();
    }

    _refreshSegmentDepths() {
        if (this.head) {
            this.head.setDepth(this.sct + 1);
            this.head.setTint(this.segmentPrimaryColor);

            // Fix eye depth disappearing
            this.eyeL?.setDepth(this.head.depth + 1);
            this.eyeR?.setDepth(this.head.depth + 1);
            this.pupilL?.setDepth(this.head.depth + 2);
            this.pupilR?.setDepth(this.head.depth + 2);
        }
        const stride = this._stride || 1;
        for (let i = 0; i < this.segments.length; i++) {
            // Derinlik mantıksal indekse göre (kafa üstte, kuyruk altta).
            this.segments[i].setDepth(this.sct - i * stride);
            // Şerit rengi ÇİZİLEN indekse göre: mantıksal indeks kullanılsaydı
            // stride, şerit periyodunu (segmentStripeWidth) örnekleyerek moire
            // üretirdi. Çizilen indeksle bantlar stride'dan bağımsız olarak
            // decimation'sız haldeki görünümü korur.
            this.segments[i].setTint(this._getSegmentColor(i));
        }
    }

    syncSegmentCountFromServer(segmentCount) {
        const targetCount = this._normalizeSegmentCount(segmentCount);
        if (targetCount === this.sct) return;

        // Mantıksal uzunluk doğrudan sunucudan alınır — görsel sprite sayısıyla
        // artık ilişkisi yok (eski kod sct'yi segments.length'ten türetiyordu).
        this.sct = targetCount;
        this._syncVisualSegments(false);

        // Tohumlanmış gerçek geometri varsa path'i SIFIRDAN kurmak onu yok
        // eder ve gövdeyi düz çubuğa döndürürdü — ilk karşılaşmadan hemen
        // sonraki ilk büyüme tick'inde hatanın geri gelmesi tam olarak budur.
        // Bu durumda yalnızca yeni uzunluğa yetecek kadar UZATILIR.
        if (this._pathSeeded && this.path.length >= 2) {
            this._ensurePathCapacityForCurrentLength();
        } else {
            this._initPathWarmup(this.head.x, this.head.y);
        }
    }

    _resolveSegmentSpawnPositionBehindTail() {
        const tail = this.segments[this.segments.length - 1];
        const prevTail = this.segments[this.segments.length - 2];

        const anchorX = tail?.active ? tail.x : this.head.x;
        const anchorY = tail?.active ? tail.y : this.head.y;

        let dirX = 0;
        let dirY = 0;

        if (tail?.active && prevTail?.active) {
            dirX = tail.x - prevTail.x;
            dirY = tail.y - prevTail.y;
        } else if (tail?.active) {
            dirX = tail.x - this.head.x;
            dirY = tail.y - this.head.y;
        }

        let length = Math.hypot(dirX, dirY);
        if (length < 0.0001) {
            dirX = -Math.cos(this.head.rotation);
            dirY = -Math.sin(this.head.rotation);
            length = Math.hypot(dirX, dirY);
        }

        if (length < 0.0001) {
            return { x: anchorX, y: anchorY };
        }

        // Komşu SPRITE'lar arası mesafe stride*spacing'dir; yeni sprite kuyruğun
        // o kadar arkasında doğar. (Konum aynı karede _positionSegmentsByPath
        // tarafından kesinleştirilir — bu yalnızca doğuş anındaki başlangıç.)
        const spacing = this.getSegmentSpacing() * (this._stride || 1);
        return {
            x: anchorX + (dirX / length) * spacing,
            y: anchorY + (dirY / length) * spacing
        };
    }

    _ensurePathCapacityForCurrentLength() {
        if (this.path.length < 2) {
            this._initPathWarmup(this.head.x, this.head.y);
            return;
        }

        const spacing = this.getSegmentSpacing();
        // MANTIKSAL uzunluk (sct) üzerinden — path, çizilen sprite sayısını
        // değil gövdenin GERÇEK yay uzunluğunu kapsamalıdır.
        const requiredLength = (this.sct + 2) * spacing + 600;

        while (this.totalPathLen < requiredLength) {
            const tail = this.path[this.path.length - 1];
            const beforeTail = this.path[this.path.length - 2];
            if (!tail || !beforeTail) break;

            let dirX = tail.x - beforeTail.x;
            let dirY = tail.y - beforeTail.y;
            let length = Math.hypot(dirX, dirY);

            if (length < 0.0001) {
                dirX = -Math.cos(this.head.rotation);
                dirY = -Math.sin(this.head.rotation);
                length = Math.hypot(dirX, dirY);
            }

            if (length < 0.0001) break;

            const next = new Phaser.Math.Vector2(
                tail.x + (dirX / length) * spacing,
                tail.y + (dirY / length) * spacing
            );
            this.path.push(next);
            this.pathSegLens.push(spacing);
            this.totalPathLen += spacing;
        }
    }

    addSegmentsFromServer(addedSegmentCount) {
        const normalizedAddCount = Math.floor(Number(addedSegmentCount));
        if (!Number.isFinite(normalizedAddCount) || normalizedAddCount <= 0) return;

        // Mantıksal uzunluk her zaman TAM eklenen kadar artar; kaç sprite
        // ekleneceğine (stride'a göre 0 da olabilir) _syncVisualSegments karar
        // verir. animateIn=true: yeni sprite 0 ölçek/opaklıktan yumuşakça büyür
        // (Issue #3 — ani "pop" yerine üstel yaklaşım).
        this.sct += normalizedAddCount;
        this._syncVisualSegments(true);
        this._ensurePathCapacityForCurrentLength();
    }

    removeSegmentsFromServer(removedSegmentCount) {
        const normalizedRemoveCount = Math.floor(Number(removedSegmentCount));
        if (!Number.isFinite(normalizedRemoveCount) || normalizedRemoveCount <= 0) return;

        // Mantıksal uzunluktan düşülür (0'ın altına inmez); sprite tarafı
        // yerinde çöküş animasyonuyla (Issue #3) uzlaştırılır.
        const removeCount = Math.min(normalizedRemoveCount, this.sct);
        if (removeCount <= 0) return;

        this.sct -= removeCount;
        this._syncVisualSegments(false, true);
    }

    // Segmenti this.segments'ten çıkarıp yerinde 1→0 çöküşe alır (anında değil).
    // this.segments'ten çıkarıldığı için gövde path'ini artık takip etmez —
    // en son konumunda küçülüp solar, tamamlanınca _updateSegmentLifecycle
    // sprite'ı yok eder.
    _beginSegmentDespawn(seg) {
        if (!seg) return;
        if (!seg.active) { this._releaseSegmentSprite(seg); return; }
        seg._growing = false;
        // NOT: görünürlük ZORLANMAZ. Cull edilmiş (ekran dışı) bir segment
        // burada görünür yapılsaydı, bayat konumunda bir kare için belirirdi.
        this._despawningSegments.push({ sprite: seg, t: seg._animScale ?? 1 });
    }

    // Her karede çağrılır: büyüyen segmentleri 1'e yaklaştırır, çökenleri 0'a
    // indirip yok eder. dtMs frame-rate agnostiktir.
    _updateSegmentLifecycle(dtMs) {
        const dtSec = Math.min(dtMs, this.config.MAX_SIM_DT_MS) / 1000;

        // Büyüme: scale = 1 - exp(-k·t) — artımlı, kare-bağımsız üstel yaklaşım.
        const growAlpha = 1 - Math.exp(-this.config.SEGMENT_GROW_RATE * dtSec);
        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            if (!seg || !seg.active || !seg._growing) continue;
            seg._animScale += (1 - seg._animScale) * growAlpha;
            if (seg._animScale > 0.995) {
                seg._animScale = 1;
                seg._growing = false;
            }
            seg.setScale(this.scale * seg._animScale);
            seg.setAlpha(seg._animScale);
        }

        // Çıkış: 1→0 doğrusal çöküş (~SEGMENT_DESPAWN_MS), tamamlanınca yok et.
        if (this._despawningSegments.length > 0) {
            const shrinkStep = dtMs / this.config.SEGMENT_DESPAWN_MS;
            for (let i = this._despawningSegments.length - 1; i >= 0; i--) {
                const d = this._despawningSegments[i];
                d.t -= shrinkStep;
                if (d.t <= 0 || !d.sprite || !d.sprite.active) {
                    // Yok etme yerine havuza iade — büyü/küçül döngüsünde
                    // tahsis baskısı oluşmaz.
                    this._releaseSegmentSprite(d.sprite);
                    this._despawningSegments.splice(i, 1);
                } else {
                    d.sprite.setScale(this.scale * d.t);
                    d.sprite.setAlpha(d.t);
                }
            }
        }
    }

    applySegmentMutationFromServer(mutation) {
        const mutationType = mutation?.mutationType ?? mutation?.mutation_type;
        const normalizedType = typeof mutationType === 'string'
            ? mutationType
            : Number(mutationType);

        if (normalizedType === 'SEGMENT_ADD' || normalizedType === 0) {
            const addedSegmentCount = mutation?.addedSegmentCount ?? mutation?.added_segment_count;
            this.addSegmentsFromServer(addedSegmentCount);
            return;
        }

        if (normalizedType === 'SEGMENT_REMOVE' || normalizedType === 1) {
            const removedSegmentCount =
                mutation?.removedSegmentCount ?? mutation?.removed_segment_count;
            this.removeSegmentsFromServer(removedSegmentCount);
        }
    }

    create(x, y, angle) {
        // Path follower: the smoothed position that actually feeds the body
        // path (see _sampleHeadToPath). Initialized on the head; snapped back
        // to the head in _initPathWarmup (spawn / hard resync).
        this._pathFollower = { x, y };
        this.head = this.scene.registerWorld(this.scene.add.sprite(x, y, 'snake_head48')
            .setOrigin(0.5));
        this.head.rotation = angle;
        // NOT: kafada artık Arcade physics body YOK. Body yalnızca hız
        // entegrasyonu için kullanılıyordu (client'ta collider yok; ölüm
        // sunucuda, yem yeme mesafe kontrolüyle). Arcade'in fixedStep@60Hz
        // adımı 120Hz+ ekranlarda merdiven aliasing'i (micro-tremor) üretiyordu.
        // Entegrasyon artık updateFromInput içinde manuel (capped dt) yapılır,
        // sprite pozisyonu postPhysicsUpdate'te sim'den görsel yumuşatmayla türetilir.
        // Görsel sprite'lar mantıksal sct'den stride ile türetilir (decimation).
        this._syncVisualSegments(false);
        // İlk kare dahil doğru boyut: constructor'da hesaplanan (sunucu
        // formülüne eş) scale sprite'lara hemen uygulanır — daha önce ilk
        // snapshot gelene kadar scale=1 texture boyutunda çiziliyordu.
        this._updateSegmentScaling();
        this._refreshSegmentDepths();
        this._initPathWarmup(x, y);
        this.trail = this.scene.add.particles(this.head.x, this.head.y, 'px32', {
            lifespan: 200, speed: { min: 15, max: 35 }, angle: { min: 160, max: 200 },
            quantity: 1, alpha: { start: 1, end: 0 }, scale: { start: 1.5, end: 0 },
            blendMode: Phaser.BlendModes.ADD, frequency: -1
        });
        this.trail.startFollow(this.head);
        this.scene.registerWorld(this.trail);
        this.eyeL = this.scene.registerWorld(this.scene.add.image(x, y, 'eye10').setOrigin(0.5).setDepth(this.head.depth + 2));
        this.eyeR = this.scene.registerWorld(this.scene.add.image(x, y, 'eye10').setOrigin(0.5).setDepth(this.head.depth + 2));
        this.pupilL = this.scene.registerWorld(this.scene.add.image(x, y, 'pupil4').setOrigin(0.5).setDepth(this.head.depth + 3));
        this.pupilR = this.scene.registerWorld(this.scene.add.image(x, y, 'pupil4').setOrigin(0.5).setDepth(this.head.depth + 3));
        this._eyeLocalL = new Phaser.Math.Vector2(+15, -6);
        this._eyeLocalR = new Phaser.Math.Vector2(+15, +6);
        this._pupilMax = 3;

        // ── DEBUG: server-authoritative position ghost (player only) ────────
        // Moves ONLY when a server packet arrives (updateSelfPositionFromServer),
        // so it shows the exact raw coordinates at the server's tick rate.
        if (this.isPlayerControlled && this.config.DEBUG_SERVER_POSITION_MARKER) {
            this.serverDebugMarker = this.scene.add.circle(x, y, 24, 0x00ffcc, 0.08)
                .setStrokeStyle(2, 0x00ffcc, 0.9)
                .setDepth(5000);
            this.serverDebugDot = this.scene.add.circle(x, y, 3, 0x00ffcc, 1)
                .setDepth(5001);
        }
        if (this.nickname) {
            this.setNickname(this.nickname);
        }
    }

    destroy() {
        // İdempotent: aynı objeye ikinci destroy çağrısı no-op.
        if (this._destroyed) return;
        this._destroyed = true;

        this.alive = false;
        if (this.vel) {
            this.vel.x = 0;
            this.vel.y = 0;
        }

        // 1) Sahnedeki HER görsel düğümü söküp yok et — gizleme değil, imha.
        this.head?.destroy();
        this.segments.forEach(seg => seg?.destroy());
        // Çıkış animasyonundaki ghost segmentler de imha edilir (sızıntı önleme).
        this._despawningSegments?.forEach(d => d.sprite?.destroy());
        this._despawningSegments = [];
        // Havuzdaki pasif sprite'lar da GERÇEKTEN imha edilir — aksi halde
        // yılan başına bir sprite kümesi sahnede sızıntı olarak kalırdı.
        this._spritePool?.forEach(seg => seg?.destroy());
        this._spritePool = [];
        this.trail?.destroy();
        this.eyeL?.destroy();
        this.eyeR?.destroy();
        this.pupilL?.destroy();
        this.pupilR?.destroy();
        this.nicknameText?.destroy();
        this.serverDebugMarker?.destroy();
        this.serverDebugDot?.destroy();
        this.head = null;
        this.trail = null;
        this.eyeL = null; this.eyeR = null;
        this.pupilL = null; this.pupilR = null;
        this.nicknameText = null;

        // 2) NÜKLEER BUFFER SIFIRLAMA — geri dönüştürülmüş entity id'leri
        // (respawn aynı id'yi geri alabilir) için SIFIR miras garantisi.
        // Segment dizisi ve gövde path'i pristine boş duruma döner; aynı id
        // için gelecek EntityFull tamamen boş tuvalden inşa edilir.
        this.segments = [];
        this.sct = 0;
        this._stride = 1;
        this.path = [];
        this.pathSegLens = [];
        this.totalPathLen = 0;
        this._pathSeeded = false;
        this._pathFollower = null;

        // 3) İnterpolasyon / tahmin buffer'ları — eski yaşamın yörünge verisi
        // yeni yaşama sızamaz. TÜM alanlar null-guard'lı kalır.
        //
        // TARİHÇE: `_remoteVel` bir dönem constructor'da TANIMSIZDI (ileri-
        // projeksiyon özelliği revert edilmişti) ve buradaki korumasız
        // `this._remoteVel.x = 0` TypeError fırlatıyordu; destroy() yarıda
        // kalınca yılan snakes map'inden silinemiyor, ayrılan oyuncular
        // yeniden karşılaşmada KALICI görünmez kalıyordu. Alan artık
        // ekstrapolasyon için GERÇEKTEN sürdürülüyor (constructor'da tanımlı),
        // ama guard'lar aynı hatanın bir daha oluşamaması için korunuyor.
        if (this._predHistory) this._predHistory.length = 0;
        if (this._smoothedError) {
            this._smoothedError.x = 0;
            this._smoothedError.y = 0;
        }
        this._correcting = false;
        if (this._remoteVel) {
            this._remoteVel.x = 0;
            this._remoteVel.y = 0;
        }
        this._remoteLastPacketAt = 0;
        if (this._snapshots) this._snapshots.length = 0;
        this._packetIntervalEmaMs = null;
        this._lastSnapshotAt = 0;
        // Süreksizlikten (spawn, sekme dönüşü, yükleme perdesi, respawn) sonra
        // TÜM interpolasyon durumu bayattır. Özellikle _wasExtrapolating: açık
        // kalsaydı ilk temiz örnekte sahte bir "yeniden katılma" ofseti
        // hesaplanır ve yılan bayat konumdan yeni konuma doğru erirdi.
        this._packetJitterEmaMs = null;
        this._interpDelayMs = null;
        this._remoteAngVel = 0;
        this._rejoinRemainingMs = 0;
        this._wasExtrapolating = false;
        this.hasServerState = false;
        this.hasSelfServerState = false;
        this._hasSpawnBaseline = false;
        this._hasServerHeading = false;
        this.lastReconciledSequenceId = 0;
    }

    setNickname(nickname) {
        if (!nickname) return;
        this.nickname = nickname;
        if (this.nicknameText) {
            this.nicknameText.setText(nickname);
        } else {
            this.nicknameText = this.scene.registerWorld(this.scene.add.text(this.head.x, this.head.y - 35 * this.scale, nickname, {
                fontFamily: 'Outfit, Inter, Arial, sans-serif',
                fontSize: '14px',
                fontStyle: 'bold',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(2000));
        }
    }

    updateFromInput(targetAngleRad, isBoosting, delta, sequenceId = 0) {
        if (!this.alive || !this.isPlayerControlled || !this.head) return;

        const canBoost = this.sct > this.config.BOOST_MIN_SEGMENTS;
        const effectiveBoosting = isBoosting && canBoost;
        this.setBoost(effectiveBoosting);

        const baseSpeed = this.calculateBaseSpeed();
        const boostSpeed = this.calculateBoostSpeed();
        this.speed = effectiveBoosting ? boostSpeed : baseSpeed;

        const turn = this.config.TURN_ANGLE_BASE * this.calculateScaleTurnFactor() * this.calculateSpeedTurnFactor();
        this.turnSpeed = turn;

        // dt SANIYE cinsinden ve TAVANLI: GC duraksaması / sekme dönüşü gibi
        // dev delta spike'ları tek frame'de ışınlanma üretmesin — kalan fark
        // reconciliation tarafından zamana yayılarak kapatılır. 60/120/144Hz
        // hepsi aynı sürekli-zaman entegrasyonundan geçer (frame-rate agnostik).
        const dtSec = Math.min(delta, this.config.MAX_SIM_DT_MS) / 1000;

        // 1) Movement sistemi MANTIKSAL açıyı günceller (hız-sınırlı dönüş).
        const diff = Phaser.Math.Angle.Wrap(targetAngleRad - this.movementAngle);
        const maxTurn = this.turnSpeed * dtSec;
        this.movementAngle = Phaser.Math.Angle.Wrap(
            this.movementAngle + Phaser.Math.Clamp(diff, -maxTurn, maxTurn));

        // 2) Mantıksal SIM pozisyonu manuel entegre edilir — Arcade fixed-step
        //    yok, render frame'i başına tam bir sürekli-zaman adımı var.
        this.vel.x = Math.cos(this.movementAngle) * this.speed;
        this.vel.y = Math.sin(this.movementAngle) * this.speed;
        this.sim.x += this.vel.x * dtSec;
        this.sim.y += this.vel.y * dtSec;

        // 3) Görsel açı = mantıksal hareket açısı. Doğrudan ayna; mouse'a
        //    bakan hiçbir atama yok. (Pozisyon burada YAZILMAZ — sprite,
        //    postPhysicsUpdate'teki görsel yumuşatma katmanında sim'i izler.)
        this.head.rotation = this.movementAngle;
    }

    // Reconcile / interpolate — update() içinde çağrılır (physics step öncesi)
    postUpdate(delta = 16.67) {
        if (!this.alive || !this.head?.active) return;
        if (!this.isPlayerControlled) {
            this._interpolateRemoteSnake(delta);
        }
        // _reconcilePlayerWithServer BURADA ÇAĞRILMAZ. Phaser frame sırası:
        // [fizik adımı] → [scene.update: burası] → [fizik write-back] → render.
        // Burada düzeltme uygulamak (setPosition + updateFromGameObject) body'yi
        // adım ÖNCESİ pozisyona sıfırlayıp o frame'in İLERİ hareketini siliyordu:
        // düzeltme olan her frame'de yılan movementAngle yönünde ilerleyemiyor,
        // hata yönünde kayıyordu — dönüşlerdeki "kafa yoldan ayrık" görüntüsünün
        // kök nedeni. Düzeltme artık postPhysicsUpdate'te (write-back SONRASI).
        // _sampleHeadToPath, _positionSegmentsByPath ve _updateEyes artık
        // Phaser'ın postupdate event'inde çağrılıyor (physics step SONRASI, render ÖNCESİ).
        // Bu sayede segmentler ve gözler head'in o frame'deki gerçek fiziksel pozisyonunu
        // yakalar — update() sırasında physics henüz çalışmadığından 1 frame gecikme (esniyor
        // hissi) oluşuyordu.
        this._delta = delta;
    }

    // Physics step sonrası segment + göz güncelleme — scene.events 'postupdate' içinde çağrılır
    postPhysicsUpdate() {
        if (!this.alive || !this.head?.active) return;

        // Update the low-pass follower BEFORE sampling the path.
        // Player snake: exponential smoothing filters reconciliation
        // micro-corrections out of the body path (anti-cascade).
        // Remote snakes: their head is already interpolation-smoothed, extra
        // filtering would only add lag — follow exactly.
        if (this.isPlayerControlled) {
            const dMs = this._delta || 16.67;

            // 1) Reconciliation: hata SIM pozisyonuna uygulanır (sprite'a değil).
            this._reconcilePlayerWithServer(dMs);

            // 2) GÖRSEL KATMAN — sprite, mantıksal sim'i frame-rate-agnostik
            //    üstel yumuşatmayla izler: alpha = 1 - exp(-RATE * dt).
            //    60/120/144Hz'de birebir aynı zaman sabiti (τ≈45ms) → aynı his;
            //    reconciliation mikro-düzeltmeleri ve entegrasyon dt jitter'ı
            //    render'a ulaşamadan filtrelenir.
            const dtSec = Math.min(dMs, this.config.MAX_SIM_DT_MS) / 1000;
            const alpha = 1 - Math.exp(-this.config.VISUAL_SMOOTHING_RATE * dtSec);
            const gapX = this.sim.x - this.head.x;
            const gapY = this.sim.y - this.head.y;
            if (Math.hypot(gapX, gapY) > this.config.VISUAL_SNAP_DISTANCE) {
                // Teleport/respawn/hard-snap: görsel katman sürüklenmesin.
                this.head.setPosition(this.sim.x, this.sim.y);
            } else {
                this.head.setPosition(this.head.x + gapX * alpha, this.head.y + gapY * alpha);
            }

            const k = this._frameAdjustedFactor(this.config.PATH_SMOOTHING_FACTOR, dMs);
            this._pathFollower.x += (this.head.x - this._pathFollower.x) * k;
            this._pathFollower.y += (this.head.y - this._pathFollower.y) * k;

            // Record the final post-correction SIM position into the prediction
            // history ring — server packets are compared against the LOGICAL
            // trajectory (time-aligned), never the smoothed visual, so the
            // visual layer stays completely outside the control loop.
            const now = performance.now();
            this._predHistory.push({ t: now, x: this.sim.x, y: this.sim.y });
            const cutoff = now - this.config.RECON_HISTORY_MS;
            while (this._predHistory.length > 0 && this._predHistory[0].t < cutoff) {
                this._predHistory.shift();
            }
        } else {
            this._pathFollower.x = this.head.x;
            this._pathFollower.y = this.head.y;
        }

        this._sampleHeadToPath();
        this._positionSegmentsByPath();
        // Segment büyüme/çöküş animasyonları (Issue #3) — konumlandırmadan sonra,
        // ölçeği/opaklığı bu karenin dt'siyle ilerlet.
        this._updateSegmentLifecycle(this._delta || 16.67);
        // Gözler imlece bakar — ANCAK masaüstünde, spawn'da fare henüz
        // oynatılmamışsa activePointer bayat bir konum taşır (bkz.
        // Game._pointerSteeringArmed) ve yılan hareket yönüne giderken gözleri
        // alakasız bir noktaya kayardı. O aşamada gözler hareket yönüne bakar.
        // Mobil davranışı DEĞİŞMEZ: dokunmatik akışta koşul hiç kurulmaz.
        const pointerSteeringPending = this.isPlayerControlled
            && !window.mobileInput?.enabled
            && this.scene._pointerSteeringArmed === false;
        if (pointerSteeringPending) {
            this._updateEyes(
                this.head.x + Math.cos(this.movementAngle) * 100,
                this.head.y + Math.sin(this.movementAngle) * 100
            );
        } else {
            const worldPoint = this.scene.cameras.main.getWorldPoint(
                this.scene.input.activePointer.x, this.scene.input.activePointer.y);
            this._updateEyes(worldPoint.x, worldPoint.y);
        }
        if (this.nicknameText) {
            this.nicknameText.setPosition(this.head.x, this.head.y - 35 * this.scale);
        }
    }

    _frameAdjustedFactor(baseFactor, delta) {
        // Exponential decay: frame-rate independent smooth lerp.
        // At 60 FPS (delta=16.67ms) this equals baseFactor; at other rates it scales correctly.
        return 1 - Math.pow(1 - baseFactor, delta / (1000 / 60));
    }

    // Kare süresi EMA'sı — adaptif buffer'ın kare-hızı bileşeni.
    _updateFrameTimeEma(delta) {
        const d = Phaser.Math.Clamp(Number(delta) || 16.67, 1, 100);
        this._frameTimeEmaMs = this._frameTimeEmaMs === null
            ? d
            : this._frameTimeEmaMs + (d - this._frameTimeEmaMs) * this.config.FRAME_TIME_EMA;
    }

    // ADAPTİF RENDER GECİKMESİ.
    //   delay = aralıkEMA*FACTOR + jitterEMA*JITTER_FACTOR + kareSüresiEMA
    // Ortalama aralık taban payı, jitter EMA'sı varyans payı, kare süresi ise
    // "bu kare zaten bu kadar zaman tüketecek" payıdır. Sonuç ayrıca kendi
    // içinde yumuşatılır; aksi halde gecikmedeki ani değişim render saatini
    // zamanda sıçratır (düzeltmeye çalıştığımız stutter'ın ta kendisi).
    _computeInterpDelayMs() {
        const cfg = this.config;
        let target = cfg.INTERP_DELAY_MIN_MS;

        if (Number.isFinite(this._packetIntervalEmaMs)) {
            const jitter = Number.isFinite(this._packetJitterEmaMs) ? this._packetJitterEmaMs : 0;
            const frame = Number.isFinite(this._frameTimeEmaMs) ? this._frameTimeEmaMs : 0;
            target = this._packetIntervalEmaMs * cfg.INTERP_DELAY_INTERVAL_FACTOR
                + jitter * cfg.INTERP_JITTER_FACTOR
                + frame;
        }
        target = Phaser.Math.Clamp(target, cfg.INTERP_DELAY_MIN_MS, cfg.INTERP_DELAY_MAX_MS);

        this._interpDelayMs = this._interpDelayMs === null
            ? target
            : this._interpDelayMs + (target - this._interpDelayMs) * cfg.INTERP_DELAY_SMOOTHING;
        return this._interpDelayMs;
    }

    // ── HERMITE (Catmull-Rom) ÖRNEKLEME ─────────────────────────────────
    // buf[i] ile buf[i+1] arasını, komşulardan (buf[i-1], buf[i+2]) türetilen
    // teğetlerle C¹ sürekli olarak örnekler.
    //
    // Teğetler ZAMAN-AĞIRLIKLIDIR: snapshot aralıkları eşit değildir, bu
    // yüzden hız (px/ms) olarak hesaplanıp segment süresiyle ölçeklenir.
    // Düzgün Catmull-Rom formülü eşit aralık varsayar ve değişken tick
    // aralığında hız dalgalanması üretirdi.
    //
    // AÇI: örnekler önce buf[i].angle etrafında AÇILIR (unwrap) — her değer
    // komşusunun ±π'si içine taşınır — sonra skaler Hermite uygulanır. Böylece
    // 360°→0° sarmalı yapısal olarak imkânsızdır ve dönüş de C¹ olur.
    _hermiteSampleSnapshots(buf, i, renderTime) {
        const p1 = buf[i];
        const p2 = buf[i + 1];
        const span = p2.t - p1.t;
        if (!(span > 0)) {
            return { x: p2.x, y: p2.y, angle: p2.angle };
        }

        const t = Phaser.Math.Clamp((renderTime - p1.t) / span, 0, 1);
        const p0 = (i - 1 >= 0) ? buf[i - 1] : p1;
        const p3 = (i + 2 < buf.length) ? buf[i + 2] : p2;

        // Merkezî fark hızları (px/ms) → segment süresiyle ölçekli teğetler.
        const d02 = (p2.t - p0.t) > 0 ? (p2.t - p0.t) : span;
        const d13 = (p3.t - p1.t) > 0 ? (p3.t - p1.t) : span;

        let m1x = (p2.x - p0.x) / d02 * span;
        let m1y = (p2.y - p0.y) / d02 * span;
        let m2x = (p3.x - p1.x) / d13 * span;
        let m2y = (p3.y - p1.y) / d13 * span;

        // Overshoot koruması: teğet, kirişin katından uzun olamaz.
        const chord = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const maxTangent = Math.max(chord * this.config.HERMITE_TANGENT_CLAMP, 0.0001);
        const m1len = Math.hypot(m1x, m1y);
        if (m1len > maxTangent) {
            const s = maxTangent / m1len;
            m1x *= s; m1y *= s;
        }
        const m2len = Math.hypot(m2x, m2y);
        if (m2len > maxTangent) {
            const s = maxTangent / m2len;
            m2x *= s; m2y *= s;
        }

        // Hermite taban fonksiyonları.
        const t2 = t * t;
        const t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        const x = h00 * p1.x + h10 * m1x + h01 * p2.x + h11 * m2x;
        const y = h00 * p1.y + h10 * m1y + h01 * p2.y + h11 * m2y;

        // Açı zinciri p1 etrafında açılır (her adım en kısa yoldan).
        const a1 = p1.angle;
        const a0 = a1 + Phaser.Math.Angle.Wrap(p0.angle - a1);
        const a2 = a1 + Phaser.Math.Angle.Wrap(p2.angle - a1);
        const a3 = a2 + Phaser.Math.Angle.Wrap(p3.angle - a2);

        const ma1 = (a2 - a0) / d02 * span;
        const ma2 = (a3 - a1) / d13 * span;
        const angle = h00 * a1 + h10 * ma1 + h01 * a2 + h11 * ma2;

        return { x, y, angle };
    }

    // ── SÜRTÜNMELİ EKSTRAPOLASYON ───────────────────────────────────────
    // yerdeğiştirme(dt) = v * τ * (1 - e^(-dt/τ))
    //   • dt→0  : türev = v  → interpolasyondan geçiş C¹ pürüzsüz
    //   • dt→∞  : v*τ'ya DOYAR → uzun kesintide yılan fırlamaz, yumuşakça durur
    _extrapolateRemote(buf, renderTime) {
        const last = buf[buf.length - 1];
        const prev = buf.length >= 2 ? buf[buf.length - 2] : null;

        let vx = 0;
        let vy = 0;
        let va = 0;
        if (prev) {
            const dt = last.t - prev.t;
            if (dt > 0) {
                vx = (last.x - prev.x) / dt;
                vy = (last.y - prev.y) / dt;
                va = Phaser.Math.Angle.Wrap(last.angle - prev.angle) / dt;
            }
        }
        this._remoteVel.x = vx;
        this._remoteVel.y = vy;
        this._remoteAngVel = va;

        const tau = this.config.EXTRAPOLATION_DECAY_TAU_MS;
        const dtAhead = Phaser.Math.Clamp(
            renderTime - last.t, 0, this.config.EXTRAPOLATION_MAX_MS);
        const s = tau * (1 - Math.exp(-dtAhead / tau));

        return {
            x: last.x + vx * s,
            y: last.y + vy * s,
            angle: last.angle + va * s
        };
    }

    _interpolateRemoteSnake(delta) {
        if (!this.hasServerState) return;

        this._updateFrameTimeEma(delta);

        const buf = this._snapshots;
        if (buf.length < 2) {
            // Buffer henüz kurulmadı — eski üstel takip (dt-normalize).
            this._followNetworkTargetExponentially(delta);
            return;
        }

        const renderTime = performance.now() - this._computeInterpDelayMs();
        const last = buf[buf.length - 1];

        let sample;
        let extrapolating = false;

        if (renderTime > last.t) {
            // Buffer açlığı: DURMAK yerine son hız vektörü boyunca sürtünmeli
            // devam et (eski kod burada üstel takibe düşüp yavaşlıyor, paket
            // dönünce de sıçrıyordu).
            sample = this._extrapolateRemote(buf, renderTime);
            extrapolating = true;
        } else {
            sample = null;
            for (let i = buf.length - 2; i >= 0; i--) {
                if (buf[i].t <= renderTime) {
                    sample = this._hermiteSampleSnapshots(buf, i, renderTime);
                    break;
                }
            }
            if (sample === null) {
                // renderTime buffer'ın BAŞINDAN eski (yeni AOI girişi/spawn):
                // en eski örneğe kelepçele. Eski kod burada üstel takibe
                // düşüyordu — buffer yolu ile farklı bir konum üretip ilk
                // karelerde görünür bir sapma bırakıyordu.
                const first = buf[0];
                sample = { x: first.x, y: first.y, angle: first.angle };
            }
        }

        // ── Yeniden katılma (anti-pop) ───────────────────────────────────
        // Ekstrapolasyondan interpolasyona dönerken iki yolun ürettiği konum
        // farkı ANINDA uygulanırsa "pop" olur. Fark bir ofset olarak alınır ve
        // smoothstep ile eritilir.
        if (this._wasExtrapolating && !extrapolating) {
            const dx = this.head.x - sample.x;
            const dy = this.head.y - sample.y;
            // Gerçek ışınlanma (respawn/teleport) eritilmez — anında uygulanır.
            if (Math.hypot(dx, dy) <= this.config.REJOIN_MAX_OFFSET_PX) {
                this._rejoinOffset.x = dx;
                this._rejoinOffset.y = dy;
                this._rejoinOffset.angle = Phaser.Math.Angle.Wrap(this.head.rotation - sample.angle);
                this._rejoinRemainingMs = this.config.REJOIN_BLEND_MS;
            } else {
                this._rejoinRemainingMs = 0;
            }
        }
        this._wasExtrapolating = extrapolating;

        let ox = 0;
        let oy = 0;
        let oa = 0;
        if (this._rejoinRemainingMs > 0) {
            this._rejoinRemainingMs = Math.max(0, this._rejoinRemainingMs - (Number(delta) || 16.67));
            const k = this._rejoinRemainingMs / this.config.REJOIN_BLEND_MS; // 1 → 0
            const w = k * k * (3 - 2 * k);                                   // smoothstep
            ox = this._rejoinOffset.x * w;
            oy = this._rejoinOffset.y * w;
            oa = this._rejoinOffset.angle * w;
        }

        // Sonuç sonlu değilse (bozuk snapshot) sprite'a HİÇ yazma — NaN bir kez
        // girerse path/segment boru hattının tamamını kalıcı olarak zehirler.
        const nx = sample.x + ox;
        const ny = sample.y + oy;
        const na = sample.angle + oa;
        if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(na)) return;

        this.head.x = nx;
        this.head.y = ny;
        this.head.rotation = na;
    }

    // Buffer kurulmadan önceki yedek yol — frame-rate-agnostik üstel takip.
    _followNetworkTargetExponentially(delta) {
        const interpFactor = this._frameAdjustedFactor(this.config.REMOTE_INTERPOLATION_FACTOR, delta);
        this.head.x = Phaser.Math.Linear(this.head.x, this.networkTarget.x, interpFactor);
        this.head.y = Phaser.Math.Linear(this.head.y, this.networkTarget.y, interpFactor);

        const wrappedAngle = Phaser.Math.Angle.Wrap(this.networkTarget.angle - this.head.rotation);
        this.head.rotation += wrappedAngle * interpFactor;
        // Phaser rotation setter'ı WrapAngle uygular; ayrıca normalize gerekmez.
    }

    // ── Time-aligned reconciliation (v2) ─────────────────────────────────
    // The measured error (this._smoothedError, maintained by
    // updateSelfPositionFromServer) already compares the server position with
    // the HISTORICAL predicted position at the packet's simulation time — it
    // contains no latency component. Here we only dampen that true error into
    // the head: hysteresis + dead zones + exponential blend + px/s cap.
    _reconcilePlayerWithServer(delta) {
        if (!this.hasSelfServerState) return;
        // Baseline kurulmadan düzeltme YOK. İlk otoriter kare ışınlanma ile
        // uygulanır (_establishSpawnBaseline); ondan önce elde güvenilir bir
        // tahmin geçmişi yoktur ve ölçülen "hata" gerçekte spawn ile ilk paket
        // arasındaki mesafedir — uygulanırsa spawn'da toplu bir kayma üretir.
        if (!this._hasSpawnBaseline) return;

        // Hard snap only on absurd desync (death, respawn, teleport).
        const rawDx = this.selfServerTarget.x - this.sim.x;
        const rawDy = this.selfServerTarget.y - this.sim.y;
        if (Math.hypot(rawDx, rawDy) > this.config.RECON_HARD_SNAP_DISTANCE) {
            this.sim.x = this.selfServerTarget.x;
            this.sim.y = this.selfServerTarget.y;
            this.head.setPosition(this.sim.x, this.sim.y); // görsel katman da anında hizalanır
            this._resetReconciliationState();
            return;
        }

        // Decompose the smoothed error on the heading captured at packet
        // arrival: residual time-alignment noise projects almost entirely
        // longitudinally, so the two axes deserve different dead zones.
        const cos = Math.cos(this.selfServerTargetHeading);
        const sin = Math.sin(this.selfServerTargetHeading);
        let lon = this._smoothedError.x * cos + this._smoothedError.y * sin;
        let lat = this._smoothedError.x * -sin + this._smoothedError.y * cos;

        const lonDead = Math.max(4, (this.speed || 225) * this.config.RECON_LONGITUDINAL_DEAD_FACTOR);
        if (Math.abs(lon) <= lonDead) lon = 0;
        if (Math.abs(lat) <= this.config.RECON_LATERAL_DEAD_ZONE) lat = 0;

        const cx = lon * cos - lat * sin;
        const cy = lon * sin + lat * cos;
        const mag = Math.hypot(cx, cy);

        // Hysteresis: don't chatter on/off around a single threshold.
        if (!this._correcting && mag > this.config.RECON_START_THRESHOLD) this._correcting = true;
        if (this._correcting && mag < this.config.RECON_STOP_THRESHOLD) this._correcting = false;

        if (!this._correcting || mag === 0) {
            // Inside the dead zone: let the accumulated error dissipate
            // quietly so it can't wind up and fire a burst later.
            const decay = this._frameAdjustedFactor(this.config.RECON_IDLE_ERROR_DECAY, delta);
            this._smoothedError.x *= (1 - decay);
            this._smoothedError.y *= (1 - decay);
            return;
        }

        const posFactor = this._frameAdjustedFactor(this.config.RECONCILIATION_POSITION_FACTOR, delta);
        const maxStep = this.config.RECONCILIATION_MAX_CORRECTION_SPEED * (delta / 1000);
        const step = Math.min(mag * posFactor, maxStep);
        const ux = cx / mag;
        const uy = cy / mag;

        // ── HIZ KORUMA: düzeltme yılanı FRENLEYEMEZ ─────────────────────────
        // Dönüşlerde sunucu istemcinin arkını ~½RTT geriden izler; düzeltme
        // vektörünün hareket yönüne (movementAngle) TERS bileşeni net ekran
        // hızını düşürüyordu ("dönüşte yavaşlama"). Geri bileşen, frame'in
        // velocity adımının %15'iyle sınırlanır — hata yanal/ileri bileşenle
        // ve zamana yayılarak kapanır, skaler hız gözle görülür düşmez.
        const hx = Math.cos(this.movementAngle);
        const hy = Math.sin(this.movementAngle);
        let corrLon = (ux * step) * hx + (uy * step) * hy;
        const corrLat = -(ux * step) * hy + (uy * step) * hx;
        const velStepLen = (this.speed || 225) * (delta / 1000);
        corrLon = Math.max(corrLon, -0.15 * velStepLen);
        const appliedX = corrLon * hx - corrLat * hy;
        const appliedY = corrLon * hy + corrLat * hx;

        // Düzeltme MANTIKSAL sim'e uygulanır — sprite'a asla doğrudan yazılmaz.
        // Görsel katman (postPhysicsUpdate) bu kaymayı üstel yumuşatmayla emer:
        // paket başına pozisyon "pop"u fiziksel olarak imkânsız hale gelir.
        this.sim.x += appliedX;
        this.sim.y += appliedY;

        // Consume the applied portion of the error…
        this._smoothedError.x -= appliedX;
        this._smoothedError.y -= appliedY;

        // …and shift the prediction history by the same amount. Server packets
        // still in flight were computed against the UNCORRECTED trajectory; if
        // the history isn't shifted, those packets re-report the error we just
        // fixed and the head over-corrects (classic reconciliation
        // rubber-banding). Shifting keeps future error measurements
        // self-consistent with the correction already applied.
        // (GERÇEKTEN uygulanan — geri bileşeni kırpılmış — vektör kadar kaydır.)
        for (let i = 0; i < this._predHistory.length; i++) {
            this._predHistory[i].x += appliedX;
            this._predHistory[i].y += appliedY;
        }
    }

    _resetReconciliationState() {
        this._predHistory.length = 0;
        this._smoothedError.x = 0;
        this._smoothedError.y = 0;
        this._correcting = false;
    }

    // Linearly interpolate the predicted position at time t from the history
    // ring. Returns null if history doesn't cover t yet (e.g. right after
    // spawn/resync) — reconciliation simply skips that packet.
    _samplePredictionHistory(t) {
        const h = this._predHistory;
        if (h.length === 0 || t < h[0].t) return null;
        if (t >= h[h.length - 1].t) return h[h.length - 1];
        for (let i = h.length - 2; i >= 0; i--) {
            if (h[i].t <= t) {
                const a = h[i];
                const b = h[i + 1];
                const span = b.t - a.t;
                const f = span > 0 ? (t - a.t) / span : 0;
                return {
                    x: a.x + (b.x - a.x) * f,
                    y: a.y + (b.y - a.y) * f
                };
            }
        }
        return null;
    }

    // Sekme değişimi sonrası tek seferlik sert resync (bkz. Game._resyncAfterTabReturn):
    // kafayı bilinen son otoriter konuma taşır ve segment path'ini o noktadan
    // yeniden kurar — böylece birikmiş fark, kademeli düzeltme sarsıntısı yerine
    // görünmez tek bir hizalamayla kapanır (sekme zaten gizliyken gerçekleşir).
    hardResync() {
        if (!this.alive || !this.head?.active) return;

        const hasTarget = this.isPlayerControlled ? this.hasSelfServerState : this.hasServerState;
        if (hasTarget) {
            const target = this.isPlayerControlled ? this.selfServerTarget : this.networkTarget;
            this.head.setPosition(target.x, target.y);
            if (this.isPlayerControlled) {
                // Mantıksal sim de otoriter konuma taşınır — görsel katman ve
                // sim ayrışık kalırsa dönüşte tek yönlü sürüklenme oluşurdu.
                this.sim.x = target.x;
                this.sim.y = target.y;
            }
            if (!this.isPlayerControlled && Number.isFinite(target.angle)) {
                this.head.rotation = target.angle;
            }
        }

        // Uzak yılan snapshot buffer'ı bayat — sekme gizliyken biriken eski
        // örnekler dönüşte geriye doğru interpolasyon (geri sarma) üretmesin.
        this._snapshots.length = 0;
        this._packetIntervalEmaMs = null;
        this._lastSnapshotAt = 0;
        // Süreksizlikten (spawn, sekme dönüşü, yükleme perdesi, respawn) sonra
        // TÜM interpolasyon durumu bayattır. Özellikle _wasExtrapolating: açık
        // kalsaydı ilk temiz örnekte sahte bir "yeniden katılma" ofseti
        // hesaplanır ve yılan bayat konumdan yeni konuma doğru erirdi.
        this._packetJitterEmaMs = null;
        this._interpDelayMs = null;
        this._remoteAngVel = 0;
        this._rejoinRemainingMs = 0;
        this._wasExtrapolating = false;

        // Path geçmişi artık bayat — kafanın güncel konumundan yeniden kur ve
        // segmentleri hemen yerine oturt.
        this._initPathWarmup(this.head.x, this.head.y);
        this._positionSegmentsByPath();

        // Tahmin geçmişi ve birikmiş hata da bayat — sıfırla, aksi halde eski
        // yörüngeye göre ölçülmüş hatalar yeni konuma uygulanır.
        this._resetReconciliationState();
    }

    _updateEyes(tx, ty) {
        if (!this.head.active) return;
        const dir = new Phaser.Math.Vector2(tx - this.head.x, ty - this.head.y);
        if (dir.lengthSq() < 0.0001) {
            dir.setTo(Math.cos(this.head.rotation), Math.sin(this.head.rotation));
        }
        dir.normalize();
        this._lookVec.copy(dir);
        
        const rot = this.head.rotation;
        const cos = Math.cos(rot), sin = Math.sin(rot);
        const l = this._eyeLocalL;
        const r = this._eyeLocalR;
        
        // Scale offset by snake scale
        const curScale = this.scale;
        const lx = this.head.x + (l.x * curScale * cos - l.y * curScale * sin);
        const ly = this.head.y + (l.x * curScale * sin + l.y * curScale * cos);
        const rx = this.head.x + (r.x * curScale * cos - r.y * curScale * sin);
        const ry = this.head.y + (r.x * curScale * sin + r.y * curScale * cos);
        
        this.eyeL.setPosition(lx, ly).setScale(curScale);
        this.eyeR.setPosition(rx, ry).setScale(curScale);

        const maxR = this._pupilMax * curScale;
        const px = Phaser.Math.Clamp(dir.x * maxR, -maxR, maxR);
        const py = Phaser.Math.Clamp(dir.y * maxR, -maxR, maxR);

        this.pupilL.setPosition(lx + px, ly + py).setScale(curScale);
        this.pupilR.setPosition(rx + px, ry + py).setScale(curScale);
    }

    // ── İLK KARŞILAŞMA PATH TOHUMU ───────────────────────────────────────
    // Sunucudan gelen gövde polyline'ını DOĞRUDAN path tamponuna yazar; düz
    // ışın warmup'ı tamamen atlanır, gövde daha ilk karede gerçek kıvrımıyla
    // çizilir. Kablo formatı (delta/kuantalama) ağ katmanında çözülür — burası
    // yalnızca DÜNYA KOORDİNATI alır (bkz. newproto/server/upgrade/path-seed.proto).
    //
    // @param {Array<{x:number,y:number}>|number[]} points
    //        KAFADAN GERİYE sıralı noktalar. Düz sayı dizisi de kabul edilir
    //        ([x0,y0,x1,y1,...]).
    // @returns {boolean} tohum uygulandıysa true (uygulanmadıysa çağıran
    //        taraf mevcut warmup'ta kalır — sessiz bozulma yok).
    seedPathFromServer(points) {
        if (!this.head || !this.alive) return false;

        const pts = this._normalizeSeedPoints(points);
        // Tek nokta yön tanımlamaz — düz warmup'ta kalmak daha doğru.
        if (pts.length < 2) return false;

        // ── Tampon inşası ────────────────────────────────────────────────
        // Tek geçişli yürüyüşün (bkz. _positionSegmentsByPath) güvenliği şu
        // DEĞİŞMEZLERE bağlıdır ve burada zorlanır:
        //   • path.length === pathSegLens.length + 1
        //   • her pathSegLens[i] > 0        (sıfır uzunluk → sıfıra bölme)
        //   • totalPathLen === Σ pathSegLens
        const path = [new Phaser.Math.Vector2(pts[0].x, pts[0].y)];
        const lens = [];
        let total = 0;

        for (let i = 1; i < pts.length; i++) {
            const prev = path[path.length - 1];
            const d = Math.hypot(pts[i].x - prev.x, pts[i].y - prev.y);
            // Yinelenen/dejenere nokta ATLANIR: diziyi kısaltır ama geometriyi
            // bozmaz ve sıfır uzunluklu parça oluşmasını engeller.
            if (!(d > 0.0001)) continue;
            path.push(new Phaser.Math.Vector2(pts[i].x, pts[i].y));
            lens.push(d);
            total += d;
        }

        if (lens.length === 0) return false;

        this.path = path;
        this.pathSegLens = lens;
        this.totalPathLen = total;

        // Follower path'in başına oturur — bayat ofset yeni geometriyi çekmesin.
        if (this._pathFollower) {
            this._pathFollower.x = path[0].x;
            this._pathFollower.y = path[0].y;
        }

        // Tohum gövdenin tamamını kapsamıyorsa (sunucu kısa gönderdi ya da
        // yılan bu arada uzadı) kalanı son yön boyunca düz uzat. Yalnızca
        // kuyruk ucunu etkiler; kıvrımlı kısım olduğu gibi korunur.
        this._ensurePathCapacityForCurrentLength();

        this._pathSeeded = true;

        // Sprite'lar AYNI karede yerleşir — tek kare bile düz gövde görünmez.
        this._positionSegmentsByPath();
        return true;
    }

    // Hem {x,y} dizisini hem düz [x0,y0,x1,y1,...] dizisini kabul eder;
    // sonlu olmayan değerleri eler.
    _normalizeSeedPoints(points) {
        const out = [];
        if (!points || typeof points.length !== 'number') return out;

        if (points.length > 0 && typeof points[0] === 'number') {
            for (let i = 0; i + 1 < points.length; i += 2) {
                const x = Number(points[i]);
                const y = Number(points[i + 1]);
                if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y });
            }
            return out;
        }

        for (let i = 0; i < points.length; i++) {
            const x = Number(points[i]?.x);
            const y = Number(points[i]?.y);
            if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y });
        }
        return out;
    }

    _initPathWarmup(x, y) {
        // Hard resets (spawn, tab-return resync, segment-count sync) rebuild
        // the path from scratch — snap the follower too, so it doesn't drag
        // stale offset into the fresh path.
        // Sert sıfırlama tohumu da geçersiz kılar: bu noktadan sonra elimizdeki
        // geometri yeniden sentetiktir.
        this._pathSeeded = false;
        if (this._pathFollower) {
            this._pathFollower.x = x;
            this._pathFollower.y = y;
        }
        this.path = [new Phaser.Math.Vector2(x, y)];
        this.pathSegLens = [];
        this.totalPathLen = 0;
        const spacing = this.getSegmentSpacing();
        // MANTIKSAL uzunluk (sct) — decimation path'i KISALTMAZ.
        const needLen = (this.sct + 1) * spacing + 400;
        const angle = this.head ? this.head.rotation : 0;
        const dir = new Phaser.Math.Vector2(-Math.cos(angle), -Math.sin(angle));
        for (let carried = 0; carried < needLen; carried += spacing) {
            const last = this.path[this.path.length - 1];
            const next = new Phaser.Math.Vector2(last.x + dir.x * spacing, last.y + dir.y * spacing);
            this.path.push(next);
            this.pathSegLens.push(spacing);
            this.totalPathLen += spacing;
        }
    }

    _sampleHeadToPath() {
        if (!this.head.active) return;
        // Sample the SMOOTHED follower, not the raw head — the raw head
        // carries reconciliation micro-corrections that the body must not see.
        const hp = new Phaser.Math.Vector2(this._pathFollower.x, this._pathFollower.y);
        const last = this.path[0];
        if (!last) {
            this.path.unshift(hp.clone());
            return;
        }
        const step = this.getSampleMinStep();
        const dist = Phaser.Math.Distance.Between(hp.x, hp.y, last.x, last.y);
        if (dist >= step) {
            this.path.unshift(hp.clone());
            this.pathSegLens.unshift(dist);
            this.totalPathLen += dist;
            const spacing = this.getSegmentSpacing();
            const maxNeeded = (this.sct + 2) * spacing + 600;
            while (this.totalPathLen > maxNeeded && this.path.length > 2) {
                const rem = this.pathSegLens.pop();
                if (rem !== undefined) this.totalPathLen -= rem;
                this.path.pop();
            }
        }
    }

    // Gövdenin her karedeki SICAK DÖNGÜSÜ. Üç optimizasyon içerir:
    //
    //  1. DECIMATION — sprite i, mantıksal düğüm min((i+1)*stride, sct)'e
    //     yerleşir. Son sprite her zaman TAM kuyrukta (sct*spacing) durur, yani
    //     gövdenin görsel uzunluğu decimation'dan bağımsız olarak DEĞİŞMEZ.
    //
    //  2. TEK GEÇİŞLİ YÜRÜYÜŞ — eski kod her segment için
    //     _pointAndAngleAtDistance ile path'i BAŞTAN yürüyordu: O(sprite × path).
    //     Sorgu mesafeleri monoton arttığı için imleç (walkIdx/walkBase)
    //     kareler arası değil, döngü içinde ileri taşınır → O(sprite + path).
    //     Sonuç değerleri _pointAndAngleAtDistance ile BİREBİR aynıdır.
    //
    //  3. CULLING — kamera görüş dikdörtgeni dışındaki sprite için transform
    //     yazımı ve çizim atlanır (setVisible(false) → render listesinden düşer).
    _positionSegmentsByPath() {
        if (this.path.length < 2) return;
        const segs = this.segments;
        if (segs.length === 0) return;

        const head = this.head;
        if (!head) return;

        const spacing = this.getSegmentSpacing();
        const stride = this._stride || 1;

        // ── Culling penceresi (dünya uzayı) ──────────────────────────────
        // Padding'e segment YARIÇAPI eklenir: merkezi hemen dışarıda olan ama
        // gövdesi hâlâ görünen büyük segmentler kırpılmamalı.
        // AYRICA: worldView kameranın BİR ÖNCEKİ karedeki görüşüdür (burası
        // render'dan önce, update fazında çalışır). CULL_PADDING_PX bu bir
        // karelik gecikmeyi de soğuracak kadar cömert tutulmuştur — boost
        // hızında (~7.5 px/kare) 96 px ≈ 12 kare pay.
        const view = this.scene?.cameras?.main?.worldView;
        const cullActive = !!(view && view.width > 0 && view.height > 0);
        const pad = this.config.CULL_PADDING_PX + this.config.SEGMENT_RADIUS * this.scale;
        const minX = cullActive ? view.x - pad : 0;
        const maxX = cullActive ? view.right + pad : 0;
        const minY = cullActive ? view.y - pad : 0;
        const maxY = cullActive ? view.bottom + pad : 0;

        // ── Yürüyüş durumu ───────────────────────────────────────────────
        // Öncü stub (kafa → path[0]) follower gecikmesini soğurur; bkz.
        // _pointAndAngleAtDistance başlığındaki ayrıntılı gerekçe.
        const p0 = this.path[0];
        let stubLen = p0 ? Math.hypot(p0.x - head.x, p0.y - head.y) : 0;
        if (!(stubLen > 0.0001)) stubLen = 0;

        const lens = this.pathSegLens;
        const lastPathPoint = this.path[this.path.length - 1];
        let walkIdx = 0;
        let walkBase = 0;
        let visibleCount = 0;

        for (let i = 0; i < segs.length; i++) {
            const seg = segs[i];
            if (!seg || !seg.active) continue;

            // Mantıksal düğüm eşlemesi — kuyruk sprite'ı tam sct'ye kelepçelenir.
            const logicalIndex = Math.min((i + 1) * stride, this.sct);
            const d = logicalIndex * spacing;

            let px, py, pa;

            if (stubLen > 0 && d <= stubLen) {
                const t = d / stubLen;
                px = Phaser.Math.Linear(head.x, p0.x, t);
                py = Phaser.Math.Linear(head.y, p0.y, t);
                pa = Phaser.Math.Angle.Between(head.x, head.y, p0.x, p0.y);
            } else {
                const dd = d - stubLen;
                // İmleci ileri taşı (d monoton arttığı için asla geri gitmez).
                while (walkIdx < lens.length && walkBase + lens[walkIdx] < dd) {
                    walkBase += lens[walkIdx];
                    walkIdx++;
                }
                const a = this.path[walkIdx];
                const b = this.path[walkIdx + 1];
                if (walkIdx >= lens.length || !a || !b) {
                    // Path tükendi → kuyruk noktasına yasla (eski davranış).
                    const tail = lastPathPoint ?? head;
                    px = tail.x;
                    py = tail.y;
                    pa = head.rotation;
                } else {
                    const segLen = lens[walkIdx];
                    const t = segLen > 0.0001 ? (dd - walkBase) / segLen : 0;
                    px = Phaser.Math.Linear(a.x, b.x, t);
                    py = Phaser.Math.Linear(a.y, b.y, t);
                    pa = Phaser.Math.Angle.Between(a.x, a.y, b.x, b.y);
                }
            }

            // ── Culling ──────────────────────────────────────────────────
            // Ekran dışında: transform YAZILMAZ (konum bir sonraki görünür
            // karede zaten yeniden hesaplanıp yazılır, bayatlık kalıcı değil).
            if (cullActive && (px < minX || px > maxX || py < minY || py > maxY)) {
                if (seg.visible) seg.setVisible(false);
                continue;
            }
            if (!seg.visible) seg.setVisible(true);
            seg.setPosition(px, py);
            seg.rotation = pa;
            visibleCount++;
        }

        this._visibleSegmentCount = visibleCount;
        // Konum entegrasyonundan SONRA rijit boyun kısıtı (bkz. _enforceNeckJoint).
        // Hedef mesafe stride ile ölçeklenir: segments[0] artık mantıksal
        // düğüm `stride`'a karşılık gelir, `1`'e değil.
        this._enforceNeckJoint(spacing * stride);
    }

    // ── RİJİT BOYUN EKLEMİ (kafa ↔ segment[0]) ───────────────────────────────
    // Yukarıdaki stub matematiği kafa↔segment[0] mesafesini zaten TAM `spacing`
    // yapar; bu yüzden normal akışta bu fonksiyon bir NO-OP'tur (tolerans içi).
    // Yine de son bir sert kısıt olarak durur: path'in dejenere olduğu (hard
    // resync, respawn, teleport, tek noktaya çökmüş path) karelerde segment[0]
    // kafadan kopamaz. Yalnızca BOYUN düzeltilir — segment[0] zaten doğru
    // konumdayken hiçbir yazma yapılmadığından gövdenin geri kalanının
    // yay-uzunluğu geometrisi bozulmaz.
    _enforceNeckJoint(spacing) {
        const neck = this.segments[0];
        if (!neck || !neck.active || !this.head?.active) return;
        // Cull edilmiş boyun: konumu bu karede yazılmadığı için bayattır ve
        // salt görsel olan bu kısıtın ekran dışında bir karşılığı yok.
        if (!neck.visible) return;

        const dx = neck.x - this.head.x;
        const dy = neck.y - this.head.y;
        const dist = Math.hypot(dx, dy);

        // Dejenere durum: boyun kafanın tam üstünde → yönü hareket açısından türet
        // (kafanın TAM arkasına yerleştir).
        if (dist < 0.0001) {
            neck.setPosition(
                this.head.x - Math.cos(this.head.rotation) * spacing,
                this.head.y - Math.sin(this.head.rotation) * spacing
            );
            return;
        }

        // Zaten hedef aralıktaysa dokunma (stub yolunda beklenen durum).
        if (Math.abs(dist - spacing) < 0.01) return;

        // Yönü koru, mesafeyi tam `spacing`e kilitle.
        const inv = spacing / dist;
        neck.setPosition(this.head.x + dx * inv, this.head.y + dy * inv);
    }

    // Yay uzunluğu KAFANIN GERÇEK konumundan ölçülür (path[0]'dan DEĞİL).
    //
    // KÖK NEDEN (boost'ta boyun esnemesi): path[0], kafayı üstel olarak izleyen
    // _pathFollower'dır. Bu alçak-geçiren filtre kararlı durumda kafanın
    // GERİSİNDE v·dt kadar sabit bir gecikme taşır (PATH_SMOOTHING_FACTOR=0.5)
    // ve bu gecikme HIZLA ORANTILIDIR: taban hızda ~3.75px, boost'ta (2× hız)
    // ~7.5px. Segmentler yay uzunluğuyla path[0]'dan ölçüldüğünden segment↔
    // segment aralıkları tam `spacing` kalıyor, ama kafa↔segment[0] aralığı
    // `spacing + v·dt` oluyordu → boost'a girince YALNIZCA boyun uzuyordu
    // (12.5+3.75=16.25px → 12.5+7.5=20px, %23; 120Hz'de %27).
    //
    // NOT: sunucu tarafında bu sorun YOKTUR — TailSystem.sampleHeadToPath ham
    // kafa konumunu her tick örnekler (follower yok), dolayısıyla path[0] zaten
    // kafanın kendisidir. Sapma tamamen client'ın görsel filtresinden gelir.
    //
    // ÇÖZÜM: kafa → path[0] arasına sanal bir "stub" parça eklenir, yay uzunluğu
    // buradan itibaren sayılır. Böylece segment[0] hız ne olursa olsun kafadan
    // TAM `spacing` uzaklıkta kalır; follower gecikmesi stub içinde soğurulur.
    // _pathFollower'ın anti-cascade filtresi path'in ŞEKLİ için aynen korunur —
    // yalnızca ölçümün başlangıç noktası değişir.
    // DURUM: sıcak döngü (_positionSegmentsByPath) artık bu mantığı tek geçişli
    // imleçle SATIR İÇİNE almış durumda; burası tek seferlik yay-uzunluğu
    // sorguları için duran REFERANS uygulamadır. İkisi aynı sonucu vermek
    // ZORUNDADIR — burada bir değişiklik yapılırsa oradaki yürüyüş de
    // güncellenmelidir.
    _pointAndAngleAtDistance(distanceFromHead) {
        if (!this.head.active) {
            return { x: 0, y: 0, angle: 0 };
        }
        if (distanceFromHead <= 0 || this.path.length === 0) {
            return { x: this.head.x, y: this.head.y, angle: this.head.rotation };
        }
        let d = distanceFromHead;

        // Öncü stub: kafa → path[0]. Follower gecikmesini soğurur.
        const p0 = this.path[0];
        if (p0) {
            const stubLen = Math.hypot(p0.x - this.head.x, p0.y - this.head.y);
            if (stubLen > 0.0001) {
                if (d <= stubLen) {
                    const t = d / stubLen;
                    return {
                        x: Phaser.Math.Linear(this.head.x, p0.x, t),
                        y: Phaser.Math.Linear(this.head.y, p0.y, t),
                        angle: Phaser.Math.Angle.Between(this.head.x, this.head.y, p0.x, p0.y)
                    };
                }
                d -= stubLen;
            }
        }

        for (let i = 0; i < this.pathSegLens.length; i++) {
            const segLen = this.pathSegLens[i];
            if (d <= segLen) {
                const a = this.path[i];
                const b = this.path[i + 1];
                if (!a || !b) return { x: a?.x ?? this.head.x, y: a?.y ?? this.head.y, angle: this.head.rotation };
                const t = d / segLen;
                const x = Phaser.Math.Linear(a.x, b.x, t);
                const y = Phaser.Math.Linear(a.y, b.y, t);
                const angle = Phaser.Math.Angle.Between(a.x, a.y, b.x, b.y);
                return { x, y, angle };
            }
            d -= segLen;
        }
        const tail = this.path[this.path.length - 1] ?? new Phaser.Math.Vector2(this.head.x, this.head.y);
        return { x: tail.x, y: tail.y, angle: this.head.rotation };
    }

    updateFromServerState(entityData) {
        if (this.isPlayerControlled) return;

        const x = Number(entityData?.x);
        const y = Number(entityData?.y);
        const rawAngle = Number(entityData?.angle);
        const scaleVal = Number(entityData?.scale);

        if (Number.isFinite(x)) {
            this.networkTarget.x = x;
        }
        if (Number.isFinite(y)) {
            this.networkTarget.y = y;
        }
        if (Number.isFinite(rawAngle)) {
            this.networkTarget.angle = this._decodeServerAngle(rawAngle);
        }
        if (Number.isFinite(scaleVal) && scaleVal > 0) {
            this.scale = scaleVal;
            this._updateSegmentScaling();
        }

        // ── Snapshot buffer besleme ─────────────────────────────────────
        // Her sunucu örneği zaman damgasıyla saklanır; render tarafı iki
        // snapshot ARASINDA (renderTime = now - delay) lerp eder. Paket
        // aralığı EMA'sı adaptif interpolation delay için ölçülür.
        if (Number.isFinite(x) && Number.isFinite(y)) {
            const now = performance.now();
            if (this._lastSnapshotAt > 0) {
                const interval = now - this._lastSnapshotAt;
                if (interval > 0 && interval < 1000) {
                    // JITTER: sapma, ORTALAMA GÜNCELLENMEDEN ÖNCE ölçülür —
                    // aksi halde ortalama örneğe doğru kayar ve sapmayı kendi
                    // içinde soğurarak jitter'ı olduğundan küçük gösterirdi.
                    // Buffer'ı kurutan şey ortalama değil bu sapmadır.
                    if (this._packetIntervalEmaMs !== null) {
                        const deviation = Math.abs(interval - this._packetIntervalEmaMs);
                        this._packetJitterEmaMs = this._packetJitterEmaMs === null
                            ? deviation
                            : this._packetJitterEmaMs
                                + (deviation - this._packetJitterEmaMs) * this.config.PACKET_JITTER_EMA;
                    }

                    this._packetIntervalEmaMs = this._packetIntervalEmaMs === null
                        ? interval
                        : this._packetIntervalEmaMs * 0.8 + interval * 0.2;
                }
            }
            this._lastSnapshotAt = now;

            this._snapshots.push({
                t: now,
                x: x,
                y: y,
                angle: this.networkTarget.angle
            });
            const cutoff = now - this.config.SNAPSHOT_BUFFER_MS;
            while (this._snapshots.length > 2 && this._snapshots[0].t < cutoff) {
                this._snapshots.shift();
            }
        }

        this.hasServerState = true;
    }

    _updateSegmentScaling() {
        if (this.head) this.head.setScale(this.scale);

        // Stride yarıçaptan (= SEGMENT_RADIUS * scale) türediği için sunucudan
        // gelen her scale değişimi decimation yoğunluğunu değiştirebilir.
        // Değiştiyse sprite sayısı yeniden uzlaştırılır — bu bir UZUNLUK
        // değişimi değil yeniden bölmelemedir, o yüzden animasyonsuz.
        if (this._computeRenderStride() !== this._stride) {
            this._syncVisualSegments(false);
        }

        this.segments.forEach(seg => {
            // Büyüme animasyonundaki segmentin ölçeği _animScale ile çarpılır —
            // aksi halde sunucu scale güncellemesi büyüme "pop"unu geri getirirdi.
            if (seg && seg.active) seg.setScale(this.scale * (seg._animScale ?? 1));
        });
    }

    /**
     * Sunucunun verdiği başlangıç yönünü (ham ağ açısı) yılana uygular.
     *
     * Yılan, StartInformation'dan ÖNCE işlenen bir pakette yaratılmış olabilir;
     * o durumda 0 rad (sağa bakar) ile kurulur ve ilk girdi paketine kadar
     * yanlış yöne bakar. Bu metot yönü GERİYE DÖNÜK olarak düzeltir.
     *
     * YALNIZCA BİR KEZ uygular (_hasServerHeading): oyuncu dönmeye başladıktan
     * sonra gelen geç bir StartInformation tekrarının yılanı geri çevirmesini
     * önler.
     */
    applyServerHeading(rawAngle) {
        if (this._hasServerHeading || !Number.isFinite(Number(rawAngle))) return false;

        const angle = this._decodeServerAngle(Number(rawAngle));
        if (!Number.isFinite(angle)) return false;

        this.movementAngle = angle;
        this.networkTarget.angle = angle;
        this.selfServerTarget.angle = angle;
        this.selfServerTargetHeading = angle;
        if (this.head) this.head.rotation = angle;

        // Gövde, yılanın kafanın ARKASINDA uzandığı varsayımıyla kurulur; yön
        // değiştiğinde eski path bayat kalır ve segmentler bir kare boyunca
        // yanlış tarafa savrulur. Kafanın yeni yönüne göre yeniden kur.
        if (this.head) {
            this._initPathWarmup(this.head.x, this.head.y);
            this._positionSegmentsByPath();
        }

        this._hasServerHeading = true;
        return true;
    }

    /**
     * SPAWN BASELINE — ilk otoriter kare LERP'SİZ uygulanır (ışınlanma).
     *
     * Neden: normal akışta sprite sim'i üstel yumuşatmayla izler ve sim de
     * reconciliation ile kademeli düzeltilir. Spawn anında iki katman da
     * otoriter konumdan sapmış olabilir (tahmin, StartInformation ile ilk
     * SelfPosition arasında geçen sürede zaten ilerlemiştir). O farkı
     * yumuşatarak kapatmak, oyunun ilk saniyesinde görünür bir kayma üretir.
     * Baseline'da fark SIFIRLANIR: tüm katmanlar tek adımda hizalanır.
     *
     * @returns {boolean} bu çağrıda baseline kurulduysa true (kamerayı ışınlamak
     *                    için Game.onSelfPosition bunu kullanır).
     */
    _establishSpawnBaseline(x, y) {
        this.sim.x = x;
        this.sim.y = y;
        this.vel.x = 0;
        this.vel.y = 0;

        this.selfServerTarget.x = x;
        this.selfServerTarget.y = y;

        if (this.head) {
            // Görsel katman da ANINDA hizalanır — üstel yumuşatma devreye girmez.
            this.head.setPosition(x, y);
            this._pathFollower.x = x;
            this._pathFollower.y = y;
            // Gövde path'i spawn konumundan yeniden kurulur; segmentler ilk
            // karede doğru yerde olur (aksi halde eski konumdan sürüklenirlerdi).
            this._initPathWarmup(x, y);
            this._positionSegmentsByPath();
        }

        // Tahmin geçmişi ve birikmiş hata bayat: baseline ÖNCESİ örneklere göre
        // ölçülmüş hatalar yeni otoriter konuma uygulanamaz.
        this._resetReconciliationState();

        this._hasSpawnBaseline = true;
        return true;
    }

    /**
     * REVEAL SNAP — perde kalkmadan hemen önce EN SON otoriter konuma ışınla.
     *
     * Neden ayrı bir adım: sunucu, oyuncu daha yükleme perdesini izlerken
     * simülasyona başlar. O süre boyunca client'ın update() döngüsü kapalıdır
     * (gameStarted false) — yani sim spawn noktasında beklerken selfServerTarget
     * yüzlerce piksel ötelenir. Perde kalktığı anda reconciliation bu farkı
     * kapatmaya çalışır: fark RECON_HARD_SNAP_DISTANCE'in altındaysa yılan
     * ekranda hızla süzülür ("fast-forward"), üstündeyse görünür bir ışınlanma
     * yapar. Her iki durumda da oyuncu, oyunun ilk anını bir düzeltme olarak
     * görür.
     *
     * Çözüm: perde kalkmadan ÖNCE farkı sıfırla. Görsel katman, mantıksal sim,
     * gövde path'i ve segmentler tek adımda en son otoriter konuma oturur;
     * yükleme boyunca birikmiş TÜM tampon (tahmin geçmişi, EMA hata, uzak
     * snapshot'lar, hız) atılır — hiçbir şey yükleme aralığı boyunca
     * interpolasyona sokulmaz.
     *
     * @returns {{x:number, y:number}|null} kameranın kilitleneceği nihai konum.
     */
    snapToServerBaseline() {
        if (!this.head?.active) return null;

        // Oyuncunun yılanı için otoriter kaynak selfServerTarget, uzak yılanlar
        // için networkTarget'tir. Henüz hiç paket gelmediyse mevcut konumda kal
        // (uydurma bir koordinata ışınlanmak, olmayan bir sorunu kötüleştirirdi).
        const hasTarget = this.isPlayerControlled ? this.hasSelfServerState : this.hasServerState;
        const target = this.isPlayerControlled ? this.selfServerTarget : this.networkTarget;
        const x = hasTarget && Number.isFinite(target.x) ? target.x : this.head.x;
        const y = hasTarget && Number.isFinite(target.y) ? target.y : this.head.y;

        if (this.isPlayerControlled) {
            this.sim.x = x;
            this.sim.y = y;
            this.vel.x = 0;
            this.vel.y = 0;
            // Rotasyon: SelfPosition açı TAŞIMAZ (bkz. self-position.proto) —
            // otoriter yön, sunucunun spawn'da verdiği ve o günden beri client
            // girdisiyle ilerleyen movementAngle'dır. Sprite'ı ona AYNEN eşitle
            // ki perde kalktığında görsel açı ile mantıksal açı ayrışmasın.
            this.head.rotation = this.movementAngle;
            this.selfServerTargetHeading = this.movementAngle;
        } else if (Number.isFinite(target.angle)) {
            this.head.rotation = target.angle;
        }

        this.head.setPosition(x, y);
        this._pathFollower.x = x;
        this._pathFollower.y = y;

        // Gövdeyi kafanın ARKASINA yeniden kur ve segmentleri hemen oturt:
        // yükleme boyunca örneklenmiş bayat path, perde kalktığında yılanı
        // eski konuma doğru uzayan bir kuyrukla gösterirdi.
        this._initPathWarmup(x, y);
        this._positionSegmentsByPath();

        // ── TÜM YÜKLEME-DÖNEMİ TAMPONLARINI AT ──────────────────────────────
        // Tahmin geçmişi + EMA hata + hysteresis latch.
        this._resetReconciliationState();
        // Uzak yılan snapshot buffer'ı: yükleme boyunca birikmiş örnekler
        // arasında interpolasyon, perde kalkınca geriye sarma üretirdi.
        this._snapshots.length = 0;
        this._packetIntervalEmaMs = null;
        this._lastSnapshotAt = 0;
        // Süreksizlikten (spawn, sekme dönüşü, yükleme perdesi, respawn) sonra
        // TÜM interpolasyon durumu bayattır. Özellikle _wasExtrapolating: açık
        // kalsaydı ilk temiz örnekte sahte bir "yeniden katılma" ofseti
        // hesaplanır ve yılan bayat konumdan yeni konuma doğru erirdi.
        this._packetJitterEmaMs = null;
        this._interpDelayMs = null;
        this._remoteAngVel = 0;
        this._rejoinRemainingMs = 0;
        this._wasExtrapolating = false;
        if (this._remoteVel) {
            this._remoteVel.x = 0;
            this._remoteVel.y = 0;
        }
        this._remoteLastPacketAt = 0;

        // Baseline artık kesinlikle kurulu: reconciliation bir sonraki paketten
        // itibaren normal (yumuşatmalı) modda çalışır.
        this._hasSpawnBaseline = true;

        return { x, y };
    }

    updateSelfPositionFromServer(entityData) {
        const x = Number(entityData?.x);
        const y = Number(entityData?.y);
        const scaleVal = Number(entityData?.scale);
        const serverSeqId = Number(entityData?.lastProcessedSequenceId ?? entityData?.last_processed_sequence_id);

        if (Number.isFinite(scaleVal) && scaleVal > 0) {
            this.scale = scaleVal;
            this._updateSegmentScaling();
        }

        // ── İLK OTORİTER KARE: LERP YOK, IŞINLA ─────────────────────────────
        // Baseline kurulup çıkılır; bu karede hata ÖLÇÜLMEZ (ölçecek geçmiş
        // yok) ve reconciliation çalışmaz. Yumuşatma 2. paketten itibaren
        // devreye girer.
        if (!this._hasSpawnBaseline && Number.isFinite(x) && Number.isFinite(y)) {
            if (Number.isFinite(serverSeqId) && serverSeqId > 0) {
                this.lastReconciledSequenceId = serverSeqId;
            }
            this.selfServerTargetHeading = this.head ? this.head.rotation : 0;
            this.serverDebugMarker?.setPosition(x, y);
            this.serverDebugDot?.setPosition(x, y);
            this._establishSpawnBaseline(x, y);
            this.hasSelfServerState = true;
            return true;
        }

        if (Number.isFinite(x) && Number.isFinite(y)) {
            this.selfServerTarget.x = x;
            this.selfServerTarget.y = y;

            // DEBUG overlay: place the ghost at the raw server coordinates.
            this.serverDebugMarker?.setPosition(x, y);
            this.serverDebugDot?.setPosition(x, y);
            // Snapshot the heading at the moment this server packet arrives.
            // Reconciliation uses this fixed heading for lateral/longitudinal decomposition
            // so that a client turn between server updates does not rotate the expected
            // longitudinal lag into the lateral axis and fire false corrections.
            this.selfServerTargetHeading = this.head ? this.head.rotation : 0;

            if (Number.isFinite(serverSeqId) && serverSeqId > 0) {
                this.lastReconciledSequenceId = serverSeqId;
            }

            // ── Time-aligned error measurement ──────────────────────────────
            // This packet describes the server state ~one-way-delay ago. Compare
            // it against the HISTORICAL predicted position at that time, not
            // the current one — otherwise the "error" is dominated by latency
            // itself and fluctuates with packet timing (the old micro-stutter).
            const rttMs = this.scene?.networkManager?.pingEmaMs;
            const oneWayMs = Number.isFinite(rttMs) && rttMs !== null
                ? rttMs / 2
                : this.config.RECON_DEFAULT_ONE_WAY_MS;
            const hist = this._samplePredictionHistory(performance.now() - oneWayMs);
            if (hist) {
                const ex = x - hist.x;
                const ey = y - hist.y;
                // Per-packet EMA: a single late/early packet cannot yank the
                // error estimate — it takes a few consistent packets to move it.
                const a = this.config.RECON_ERROR_EMA;
                this._smoothedError.x = this._smoothedError.x * (1 - a) + ex * a;
                this._smoothedError.y = this._smoothedError.y * (1 - a) + ey * a;
            }
        }

        this.hasSelfServerState = true;
        return false;
    }

    // Statik: Game.js spawn yönünü bir Snake örneği OLMADAN çözebilsin diye
    // (onStartGame, yılan yaratılmadan önce girdi katmanını sunucunun verdiği
    // başlangıç yönüne göre tohumlamak zorunda — bkz. _lastCommittedAngleRad).
    static decodeServerAngle(rawAngle) {
        // Bu projede client -> server açı 0..250 sıkıştırılmış aralıkta gönderiliyor.
        // Server aynı formatı dönüyorsa önce onu çöz.
        if (Number.isInteger(rawAngle) && rawAngle >= 0 && rawAngle <= 252) {
            return Phaser.Math.DegToRad(rawAngle * 1.44);
        }

        // Sonra olası radyan formatı.
        if (rawAngle >= -Math.PI * 2 - 0.001 && rawAngle <= Math.PI * 2 + 0.001) {
            return rawAngle;
        }

        // Aksi durumda derece kabul et.
        return Phaser.Math.DegToRad(rawAngle);
    }

    _decodeServerAngle(rawAngle) {
        return Snake.decodeServerAngle(rawAngle);
    }

    getHead() { return this.head; }
}
