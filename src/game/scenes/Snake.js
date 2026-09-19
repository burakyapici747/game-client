import Phaser from 'phaser';
import { EntityInterpolator } from '../net/EntityInterpolator.js';
import * as SnakeSkin from '../render/SnakeSkin.js';
import { SnakeTexture } from '../render/SnakeSkin.js';

// ── NICKNAME TYPOGRAPHY (High-DPI) ──────────────────────────────────────────
// Nicknames are sized in CSS px ON SCREEN, independent of camera zoom:
//
//   screenPx  = clamp(NICK_FONT_PX · cssZoom, NICK_MIN_SCREEN_PX, NICK_FONT_PX)
//   objScale  = screenPx / (NICK_FONT_PX · cssZoom)     // counter-scale in world
//
// The glyph canvas is rasterized at `resolution = D` (render density), so one
// glyph texel covers 1/D CSS px. Drawn by the world camera at zoom cssZoom·D:
//   buffer px per texel = objScale · cssZoom · D / D = screenPx / NICK_FONT_PX
// → between 12/14 and 1.0: never magnified, at most ~14% minified. Crisp.
//
// WHY WORLD CAMERA (not UI camera + world→screen projection): the world
// camera follows the head with lerp, and Phaser computes that scroll inside
// Camera.preRender — i.e. AFTER update(). A UI-space label positioned in
// update() would trail the camera by one frame and visibly jitter against
// the head at boost speed. Counter-scaling in world space keeps the label in
// the same transform as the head (zero lag) and costs no texture redraw:
// only setScale changes per frame, the glyph canvas is redrawn on setText.
const NICK_FONT_PX = 14;          // raster size and max on-screen size (CSS px)
const NICK_MIN_SCREEN_PX = 12;    // legibility floor regardless of zoom
const NICK_GAP_PX = 4;            // screen gap between head edge and label (CSS px)

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

    // ── BOOST UYGUNLUGU: SKOR ESIGI + HISTEREZIS BANDI ──────────────────
    // SUNUCU AYNASI — game-server com/common/ScoreConfig.java
    //   BOOST_ENTRY_SCORE / BOOST_EXIT_SCORE. Ayrisirlarsa client tahmini ile
    //   sunucu otoritesi taban civarinda FARKLI kararlar verir ve her tur
    //   ~225 px/sn ile hata biriktirir.
    //
    // ESKI KAPI segment sayisi uzerindeydi (BOOST_MIN_SEGMENTS = 10). Dogum
    // 5 segment oldugundan gercek giris bedeli 300 puandi ve esigi yeni gecen
    // oyuncunun toplam rezervi 400 ms (~90 px) idi — taktik degeri olmayan
    // bir kilit. Artik esik dogrudan SKOR uzerinde.
    //
    // IKI ESIK SART: tek esikle tabanda duran oyuncu her kare ac/kapa yapar
    // (60 Hz kare dalga). Ayni kalip asagida reconciliation esiklerinde de
    // kullanilir (RECON_START_THRESHOLD / RECON_STOP_THRESHOLD).
    BOOST_ENTRY_SCORE: 150,   // boost'u BASLATMAK icin gereken skor
    BOOST_EXIT_SCORE: 120,    // boost'un ACIK KALABILECEGI skor
    TURN_ANGLE_BASE: 3.3,
    TURN_SPEED_INFLUENCE: 4.8,
    INITIAL_SEGMENT_COUNT: 32,
    SEGMENT_SPACING_BASE: 12.5,
    PATH_SAMPLE_MIN_STEP: 0,

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

    // ── Remote entity interpolation ─────────────────────────────────────
    // Uzak yılanların tüm oynatma (playout) mantığı EntityInterpolator'a
    // taşındı: ring buffer + de-jitter saati + adaptif gecikme + Hermite
    // örnekleme + dead reckoning + ofset uzlaşması. Ayarlar için bkz.
    // src/game/net/EntityInterpolator.js → InterpolatorConfig.
    // Buradaki tek şey, o modülün varsayılanlarına yapılan yılana-özgü
    // düzeltmelerdir (yoksa boş bırakılır).
    REMOTE_INTERP_OVERRIDES: null,

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
    // no longer magnifies head snapping.
    //
    // UZAMSAL FİLTRE: follower zamana göre değil KAFANIN KAT ETTİĞİ MESAFEYE
    // göre ilerler:  a = 1 − exp(−Δs / L),  follower += (head − follower)·a.
    // Böylece süzme miktarı kare hızından (60/120/144 Hz) ve yılan hızından
    // (taban/boost/ölçek) BAĞIMSIZDIR; kararlı gecikme ≈ L px'te sabit kalır
    // ve kafa→path[0] stub'ı tarafından soğurulur. Uzak yılanlar da artık bu
    // filtreden geçer: interpolasyon uzlaşma tümsekleri (paket gecikmesi →
    // ekstrapolasyon → ofset sönümü) eskiden gövde path'ine OLDUĞU GİBİ
    // yazılıyor ve gövde boyunca ilerleyen bir dalga olarak görünüyordu.
    PATH_SPATIAL_SMOOTHING_PX: 10.0,  // px — dar dönüşte (r≈68) iç sapma ≤0.7 px

    // ── DOGUM DOKUNULMAZLIGI GORSELI ────────────────────────────────────────
    //
    // NEDEN setTint(0xffffff) DEGIL: Phaser'da tint bir BOYAMA degil CARPMADIR
    // (sonuc = doku_rgb x tint_rgb). Beyaz (0xffffff) carpmanin ETKISIZ
    // ELEMANIDIR — yani `setTint(0xffffff)` tam renkli bir doku uzerinde
    // GORUNUR HICBIR SEY YAPMAZ. (Eski daire dokulari beyaz oldugu icin tint
    // orada renklendirme gibi calisiyordu; sprite dokulariyla artik calismaz.)
    //
    // Dogru primitif setTintFill(): dokunun rengini TAMAMEN degistirir ve
    // duz beyaz bir siluet verir. Efekt bu ikisi arasinda gidip gelir:
    //   setTintFill(0xffffff)  →  beyaz flas
    //   clearTint()            →  normal sanat
    // Ayrica hafif bir alfa nabzi eklenir; ikisi birlikte "dokunulmaz" mesajini
    // renk korlugu olan oyuncularda bile okunur kilar (yalnizca renk degil,
    // parlaklik ve saydamlik da degisir).
    //
    // OLCEK/DOKU GUVENLIGI: efekt YALNIZCA tint ve alpha yazar. setScale,
    // setTexture ve _texNorm'a HIC dokunulmaz, dolayisiyla SnakeSkin'in
    // normalizasyonu ve kuyruk/govde doku atamalari bozulmaz.
    INVULN_FLASH_HZ: 6,          // saniyedeki tam flas dongusu
    INVULN_MIN_ALPHA: 0.55,      // nabzin en saydam ani
    INVULN_FILL_COLOR: 0xffffff,

    // ── VARLIK-DUYARLI ÇİZİM ARALIKLARI (salt görsel, sürekli) ────────────
    // Mantıksal spacing (getSegmentSpacing) SUNUCUYLA SÖZLEŞMEDİR
    // (SnakeHeadPathManager.getSegmentSpacingMeters): gövde uzunluğu
    // L = sct·spacing hitbox'la birebirdir ve DEĞİŞMEZ. Sprite'ların bu uzunluk
    // üzerindeki dizilimi ise salt görseldir ve kuşanılan karakterin GERÇEK
    // doku ölçülerinden türetilir (SnakeSkin.getSkinMetrics: pişirme anında
    // opak sınır kutusundan ölçülür, sprite merkezine göre front/back/halfWidth;
    // hepsi ×scale). Varlıklar özgün oranlarını korur; ortak olan tek şey gövde
    // tüpünün 48·scale px'e (sunucu çarpışma çapı) oturmasıdır.
    //
    //   bodyLen    = body.front + body.back
    //   bodyExtent = min(bodyLen, 2·body.halfWidth)      // dönüşte de kaplama
    //
    //   GÖVDE↔GÖVDE  renderSpacing = max(spacing, overlap(scale) · bodyExtent)
    //                overlap = MIN + (MAX − MIN) · smoothstep((scale−1)/RANGE)
    //   KAFA↔BOYUN   neck = head.back + body.front − NECK_TUCK · bodyLen
    //                (boyun sprite'ının ön kenarı kafanın arka kenarının
    //                 NECK_TUCK·bodyLen kadar ALTINDA)
    //   GÖVDE↔KUYRUK kuyruk ön kenarı = L − (1+H)·renderSpacing + body.back
    //                                   − TAIL_TUCK · tailLen
    //                (H: sayım histerezisi → son gövde sprite'ının EN GERİDE
    //                 olabileceği konum; kuyruk sapı her durumda onun altında)
    //
    // DİKİŞ GARANTİLERİ (her karakter için):
    //   • boyun kafanın altında: NECK_TUCK > 0
    //   • gövde kesintisiz: renderSpacing ≤ MAX·bodyExtent < bodyLen
    //   • kuyruk sapı gövdenin altında: TAIL_TUCK > 0
    //   • kuyruk ucu görünür: tailLen·(1 − TAIL_TUCK) > (1+H)·renderSpacing
    //     (MAX=0.4 → ≤0.46·48·scale; en kısa kuyruk ~52·scale → sağlanır)
    //
    // Kalibrasyon: character-1'de sonuçlar sabit oranlı eski sürümle aynıdır
    // (bodyExtent 48 → 0.25·48=12 … 0.4·48=19.2 = eski 0.5R … 0.8R; kuyruk
    // ofseti scale=1'de ≈ eski 0.75R).
    //
    // SÜREKLİLİK: üç değer de scale'e VE karakter ölçülerine bağlıdır; her biri
    // kare kare yumuşatılır (SPACING_LERP_RATE) → büyümede ve karakter
    // değişiminde konum sıçraması yok. Sprite sayısı gövde ucunda birer birer
    // (büyüme/çöküş animasyonuyla) değişir.
    BODY_OVERLAP_MIN: 0.25,
    BODY_OVERLAP_MAX: 0.4,
    BODY_OVERLAP_SCALE_RANGE: 5,
    NECK_TUCK_RATIO: 0.5,
    TAIL_TUCK_RATIO: 0.41,
    // Karakter değişiminde parça ölçüleri eskiden yeniye smoothstep ile bu
    // sürede geçer (üstel yumuşatmanın ilk karelerdeki hızlı kaymasını önler).
    // Gövde aralığı değişimi k. sprite'ı k·Δ kadar kaydırdığı için uzun
    // yılanlarda süre kısa tutulursa gövde ucu hızlı "akordeon" yapar.
    // İlk kareden ÖNCE uygulanan karakter (doğum) geçişsiz oturur.
    SKIN_TRANSITION_MS: 900,
    // Sprite sayısı eşiğinde (L/renderSpacing ≈ tamsayı) ekle/çıkar titremesini
    // önler: son aralık (1 + H)·renderSpacing'e kadar esneyebilir.
    RENDER_COUNT_HYSTERESIS: 0.15,
    SEGMENT_POOL_MAX: 512,               // havuz tavanı (üstü gerçekten destroy)

    // ── Viewport culling ────────────────────────────────────────────────
    // Kamera görüş dikdörtgeninin dışındaki segmentler için transform yazımı
    // ve çizim atlanır. Padding, segment yarıçapı ÜSTÜNE eklenir; kenardan
    // giren gövdenin bir kare geç belirmesini önler.
    CULL_PADDING_PX: 96,

    // ── SEGMENT ROTASYONU (doku parıltısı / shimmer önleme) ─────────────
    // Sprite açısı eskiden TEK bir path parçasının (1.25–4 px) kirişinden
    // alınıyordu: 0.1 px yanal gürültü ~4.6° dönüş gürültüsü demekti ve
    // desenli gövde dokusunda titreme olarak görünüyordu. Açı artık
    // d ± ROTATION_SPAN_FACTOR·spacing noktaları arasındaki geniş kirişten
    // türetilir, ardından kare-hızından bağımsız üstel filtreden geçer.
    //
    // AÇIKLIK: yarım açıklık max(SPAN_FACTOR·spacing, RADIUS_FACTOR·yarıçap).
    // Simetrik kiriş sabit eğrilikli bir yayda orta noktadaki teğete TAM
    // paraleldir → açıklığı büyütmek dönüşte sapma üretmez, yalnızca gürültüyü
    // böler. Kafaya yakın sprite'larda açıklık d'ye kelepçelenir (asimetrik
    // kiriş kafa gürültüsünü doğrudan açıya taşırdı).
    ROTATION_SPAN_FACTOR: 0.5,
    ROTATION_SPAN_RADIUS_FACTOR: 0.6,
    // FİLTRE: adaptif (One-Euro) alçak geçiren. Kesim frekansı hedef açının
    // yumuşatılmış açısal hızıyla büyür:
    //   fc = MIN_CUTOFF_HZ + BETA · |ω̂|      α = 1 − exp(−2π·fc·dt)
    // Düz/neredeyse düz gidişte ω̂≈0 → fc≈MIN (güçlü süzme, mikro-titreme
    // emilir); dönüşte fc büyür → gecikme sınırlı kalır. Sabit oranlı eski
    // filtre (35/s) gürültüyü yalnızca ~%70 bastırıyordu.
    ROTATION_MIN_CUTOFF_HZ: 2.0,
    ROTATION_BETA: 2.5,            // Hz / (rad/s)
    ROTATION_DERIV_CUTOFF_HZ: 5.0, // ω̂ tahmininin kendi kesimi
    ROTATION_SNAP_RAD: 1.2,        // bu üstü fark filtrelenmez (respawn / teleport)

    // ── SPACING YUMUŞATMASI ─────────────────────────────────────────────
    // getSegmentSpacing sct ve scale'e SÜREKLİ bağlıdır; her segment ekleme/
    // çıkarmada k. segment k·Δspacing kadar TEK KAREDE kayıyordu (sct=200'de
    // kuyruk ~3 px). Çizimde kullanılan spacing hedefe üstel yaklaşır; hard
    // reset'lerde (_initPathWarmup) anında hedefe oturur.
    SPACING_LERP_RATE: 4.0,        // 1/s — τ=250ms
    SPACING_SNAP_EPSILON: 0.0005,  // px

    // Kuyruk görsel ofseti (bkz. ÇİZİM ARALIKLARI). Kuyruk
    // kimliği değişince ofset bu hızla geçiş yapar.
    TAIL_OFFSET_BLEND_RATE: 12,    // 1/s — kuyruk kimliği değişince ofset geçişi

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
        // M01 — SUNUCUDAN gelen son kanonik olcek. NaN = "sunucu olcegi henuz
        // alinmadi"; NaN !== NaN oldugu icin ilk gercek deger daima uygulanir.
        // Yukaridaki this.scale yalnizca YEREL bir baslangic tahminidir ve
        // buraya YAZILMAZ — aksi halde sunucunun ayni degeri gonderdigi ilk
        // paket "degismedi" sayilip gorsel baglama hic kurulmazdi.
        this._canonicalScale = NaN;
        this.speed = 0;
        this.turnSpeed = 0;
        this.isBoosting = false;

        // ── BOOST UYGUNLUGU: OTORITER SKOR ──────────────────────────────────
        // Kapi artik segment sayisina degil SKORA bakar (sunucu ile birebir).
        // Skor TAHMIN EDILMEZ; sunucu her tick SelfPosition.total_score
        // gonderir ve Game.onSelfPosition bunu buraya yazar. Ilk paket
        // gelene kadar 0'dir, yani boost dogal olarak kapalidir — dogru
        // ve guvenli varsayilan.
        this.authoritativeScore = 0;

        // ── TAHMIN AYRISMASI TESPITI ────────────────────────────────────────
        // serverBoostActive: sunucunun bildirdigi ETKIN boost (SelfPosition.
        //   boost_active). Tahmine GECIKME EKLEMEK icin kullanilmaz.
        // _boostDenied: sunucu, bizim boost ettigimizi iddia ettigimiz halde
        //   bir tam gidis-donusten uzun sure "boost yok" diyorsa kurulur;
        //   tahmin birakilir. Niyet birakildiginda veya sunucu boost'u
        //   onayladiginda temizlenir (bkz. applyAuthoritativeBoost).
        // _lastBoostChangeAtMs: son YEREL boost gecisinin zamani. Bundan
        //   once yola cikmis paketler BAYATTIR ve tespit icin kullanilamaz.
        this.serverBoostActive = false;
        this._boostDenied = false;
        this._lastBoostChangeAtMs = -Infinity;

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

        // ── Remote entity playout (remote-controlled) ────────────────────
        // Adaptif interpolasyon/ekstrapolasyon motoru. Yılan başına bir örnek;
        // tüm ağ zamanlama durumu (ring buffer, jitter ölçümü, gecikme bütçesi,
        // dead reckoning hızı, uzlaşma ofseti) burada yaşar.
        this._interp = new EntityInterpolator(this.config.REMOTE_INTERP_OVERRIDES);

        // Time-aligned reconciliation state (player-controlled only)
        this._predHistory = [];               // ring of {t, x, y} (performance.now)
        this._smoothedError = { x: 0, y: 0 }; // EMA of time-aligned prediction error
        this._correcting = false;             // hysteresis latch
        // this.segments artık MANTIKSAL segment listesi DEĞİL — ÇİZİLEN sprite
        // listesidir. Uzunluğu her zaman this.sct'tir (1:1; sunucu otoritesi,
        // hitbox ile birebir).
        this.segments = [];
        // Çıkış animasyonundaki (çökmekte olan) segmentler — this.segments'ten
        // ÇIKARILMIŞ ama henüz görsel olarak yok olmamış ghost'lar: { sprite, t }.
        this._despawningSegments = [];
        // Son karede gerçekten çizilen (cull edilmemiş) sprite sayısı — teşhis.
        this._visibleSegmentCount = 0;
        // Sprite havuzu: büyüyen/küçülen yılanların her karede sprite
        // yaratıp yok etmesini (GC spike) önler. Serbest bırakılanlar
        // görünmez+pasif olarak burada bekler.
        this._spritePool = [];
        // Dogum dokunulmazligi — SUNUCU OTORITERDIR. Istemci bu bayragi
        // yalnizca OKUR (paketten gelir) ve gorsel efekt icin kullanir;
        // sureyi uzatamaz, yenileyemez. Bayrak dustugunde efekt derhal
        // temizlenir (bkz. _updateInvulnerabilityFx).
        this._invulnerable = false;
        this._invulnPhase = 0;
        // Su an KUYRUK dokusunu tasiyan sprite. Cizilen segment sayisi her
        // karede degisebildigi icin (buyume, kisalma) kuyruk
        // kimligi de degisir; referansi tutmak, degisim OLMADIGI karelerde
        // hicbir setTexture cagrisi yapmamayi saglar.
        this._tailSprite = null;
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
        // Çizimde kullanılan yumuşatılmış spacing (bkz. SPACING_LERP_RATE).
        // null → henüz kurulmadı, getSegmentSpacing hedefi döner.
        this._smoothedSpacing = null;
        // Varlık-duyarlı çizim aralıkları (salt görsel, yumuşatılmış) — bkz.
        // ÇİZİM ARALIKLARI. null → henüz kurulmadı.
        this._smoothedRenderSpacing = null;
        this._smoothedNeck = null;
        this._smoothedTailOffset = null;
        // Kuşanılan karakter. Dokular ve ölçüler SnakeSkin'den bu id ile gelir.
        this.skinId = SnakeSkin.DEFAULT_SKIN_ID;
        this._requestedSkinId = this.skinId;
        // Karakter değişimindeki ölçü geçişi (bkz. _advanceSkinBlend); null → yok.
        this._skinBlend = null;
        // _positionSegmentsByPath yürüyüş imleci + tekrar kullanılan örnek
        // nesneleri (kare başına tahsis yok).
        this._walkIdx = 0;
        this._walkBase = 0;
        this._walkStub = 0;
        this._sampleA = { x: 0, y: 0 };
        this._sampleB = { x: 0, y: 0 };
        this._sampleC = { x: 0, y: 0 };
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

    /**
     * ω_max — yilanin FIZIKSEL donme kapasitesi (rad/s).
     *
     * SUNUCU AYNASI: game-server SnakeDynamicsSystem.process →
     *   turnSpeed = TURN_ANGLE_BASE * scaleTurnFactor(scale) * speedTurnFactor(speed)
     * ve MovementSystem bunu her tick'te maxTurn = turnSpeed * DT olarak
     * kelepceler. Burasi o formulun TEK client kopyasidir; hem yerel tahmin
     * (updateFromInput) hem de GIRDI katmanindaki slew-rate limiter
     * (Game._applySteeringLimiter) ayni degeri okur — girdi kelepcesi ile
     * simulasyon kelepcesinin ayrismasi boylece yapisal olarak imkansizdir.
     *
     * isBoosting parametresi opsiyoneldir: girdi katmani, o karede GONDERILECEK
     * boost durumunu bilir ve henuz setBoost() calismamis olabilir, bu yuzden
     * niyet edilen durumu disaridan verebilir.
     *
     * SALT OKUNUR: bu metot ve cagirdigi _resolveBoostActive HICBIR durum
     * yazmaz. Kac kez, hangi argumanla cagrilirsa cagrilsin yilanin durumu
     * degismez — ozellikle _boostDenied kilidi. (Eski surumde bu garanti
     * yoktu ve kilit her karede sessizce siliniyordu.)
     */
    getTurnRateRadPerSec(isBoosting = this.isBoosting) {
        // Kapi, simulasyonun kullandigi kapinin TA KENDISIDIR (_resolveBoostActive).
        // Girdi kelepcesi ile simulasyon kelepcesinin ayni esikten gecmesi sart.
        const speed = this._resolveBoostActive(isBoosting)
            ? this.calculateBoostSpeed()
            : this.calculateBaseSpeed();
        const speedTurnFactor = Math.min(1, speed / this.config.TURN_SPEED_INFLUENCE);
        return this.config.TURN_ANGLE_BASE * this.calculateScaleTurnFactor() * speedTurnFactor;
    }

    // Çizim/path katmanının kullandığı spacing: hedefin (formül) yumuşatılmış
    // hali. Kararlı durumda formülle BİREBİR aynıdır.
    getSegmentSpacing() {
        return this._smoothedSpacing ?? this._computeTargetSegmentSpacing();
    }

    // Sunucu formülünün aynası — anlık (yumuşatılmamış) hedef.
    _computeTargetSegmentSpacing() {
        const base = this.config.SEGMENT_SPACING_BASE;
        const lenF = Phaser.Math.Clamp((this.sct - 30) / 200, 0, 1);
        const scF = Phaser.Math.Clamp((this.scale - 1) / 5, 0, 1);
        const extra = 0.35 * (0.7 * lenF + 0.3 * scF);
        return base * (1 + extra);
    }
    // ── VARLIK-DUYARLI ÇİZİM ARALIKLARI ──────────────────────────────────
    // Tüm hedefler scale'e ve kuşanılan karakterin ÖLÇÜLEN ölçülerine bağlıdır;
    // çizimde yumuşatılmış halleri kullanılır (bkz. _updateSpacingAnimation).

    // Karakter ölçüleri × scale. Kare başına birkaç kez okunur; nesne yalnızca
    // ölçüler (karakter/geçiş) ya da scale değiştiğinde yeniden hesaplanır.
    _skinExtents() {
        const blend = this._skinBlend;
        const m = blend ? blend.out : SnakeSkin.getSkinMetrics(this.skinId);
        const version = blend ? blend.version : 0;
        const s = this.scale;
        const c = this._extentsCache ?? (this._extentsCache = {});
        if (c.metrics === m && c.version === version && c.scale === s) return c;
        c.metrics = m;
        c.version = version;
        c.scale = s;
        c.headBack = m.head.back * s;
        c.bodyFront = m.body.front * s;
        c.bodyBack = m.body.back * s;
        c.bodyLen = (m.body.front + m.body.back) * s;
        c.bodyExtent = Math.min(c.bodyLen, 2 * m.body.halfWidth * s);
        c.tailFront = m.tail.front * s;
        c.tailLen = (m.tail.front + m.tail.back) * s;
        c.maxExtent = Math.max(m.body.front, m.body.back, m.body.halfWidth,
            m.tail.front, m.tail.back, m.tail.halfWidth) * s;
        return c;
    }

    // GÖVDE↔GÖVDE hedefi.
    _computeTargetRenderSpacing() {
        const cfg = this.config;
        const t = Phaser.Math.Clamp((this.scale - 1) / cfg.BODY_OVERLAP_SCALE_RANGE, 0, 1);
        const eased = t * t * (3 - 2 * t);
        const overlap = cfg.BODY_OVERLAP_MIN + (cfg.BODY_OVERLAP_MAX - cfg.BODY_OVERLAP_MIN) * eased;
        return Math.max(this._computeTargetSegmentSpacing(), overlap * this._skinExtents().bodyExtent);
    }

    // KAFA↔BOYUN hedefi: kafa merkezinden ilk gövde sprite'ının merkezine.
    _computeTargetNeckDistance() {
        const e = this._skinExtents();
        const neck = e.headBack + e.bodyFront - this.config.NECK_TUCK_RATIO * e.bodyLen;
        // Çok büyük gövde / çok küçük kafa: boyun kafanın önüne geçmesin.
        return Math.max(this._computeTargetSegmentSpacing(), neck);
    }

    // GÖVDE↔KUYRUK hedefi: kuyruk sprite merkezinin L'ye göre ofseti (px,
    // negatif olabilir). Hesap hedef renderSpacing ile yapılır; yumuşatma
    // ikisini birlikte yürütür.
    _computeTargetTailOffset() {
        if (!SnakeSkin.isReady()) return 0;
        const cfg = this.config;
        const e = this._skinExtents();
        const lastGapMax = (1 + cfg.RENDER_COUNT_HYSTERESIS) * this._computeTargetRenderSpacing();
        const tailFrontEdge = -lastGapMax + e.bodyBack - cfg.TAIL_TUCK_RATIO * e.tailLen;
        return tailFrontEdge + e.tailFront;
    }

    // Çizimde kullanılan (yumuşatılmış) sprite aralığı. Mantıksal spacing'in
    // altına ASLA inmez → sprite sayısı hiçbir zaman sct'yi aşmaz.
    getRenderSpacing() {
        const target = this._smoothedRenderSpacing ?? this._computeTargetRenderSpacing();
        return Math.max(this.getSegmentSpacing(), target);
    }

    getNeckDistance() {
        return this._smoothedNeck ?? this._computeTargetNeckDistance();
    }

    _snapSpacingToTarget() {
        this._smoothedSpacing = this._computeTargetSegmentSpacing();
        this._smoothedRenderSpacing = this._computeTargetRenderSpacing();
        this._smoothedNeck = this._computeTargetNeckDistance();
        this._smoothedTailOffset = this._computeTargetTailOffset();
    }

    _updateSpacingAnimation(dtMs) {
        this._advanceSkinBlend(dtMs);
        const dtSec = Math.min(dtMs, this.config.MAX_SIM_DT_MS) / 1000;
        const alpha = 1 - Math.exp(-this.config.SPACING_LERP_RATE * dtSec);
        this._smoothedSpacing = this._easeToward(
            this._smoothedSpacing, this._computeTargetSegmentSpacing(), alpha);
        // Görsel aralıklar scale'e (sunucudan ~1/106'lık adımlar) ve karakter
        // ölçülerine bağlıdır. Yumuşatılmazsa k. sprite k·Δ kadar tek karede
        // kayardı.
        this._smoothedRenderSpacing = this._easeToward(
            this._smoothedRenderSpacing, this._computeTargetRenderSpacing(), alpha);
        this._smoothedNeck = this._easeToward(
            this._smoothedNeck, this._computeTargetNeckDistance(), alpha);
        this._smoothedTailOffset = this._easeToward(
            this._smoothedTailOffset, this._computeTargetTailOffset(), alpha);
    }

    _easeToward(cur, target, alpha) {
        if (cur === null || !Number.isFinite(cur)) return target;
        if (Math.abs(target - cur) <= this.config.SPACING_SNAP_EPSILON) return target;
        return cur + (target - cur) * alpha;
    }

    // Gövde boyunca çizilecek sprite sayısı, histerezisli. Sprite i,
    // d = neck + i·renderSpacing'de; son sprite (kuyruk) L'dedir:
    //   n = ceil((L − neck) / renderSpacing) + 1
    // L = sct·spacing mantıksal gövde uzunluğudur (sunucu hitbox'ı).
    _desiredSpriteCount() {
        if (!(this.sct > 0)) return 0;
        const bodyLen = this.sct * this.getSegmentSpacing();
        const raw = Math.max(0, bodyLen - this.getNeckDistance()) / this.getRenderSpacing() + 1;
        const exact = Phaser.Math.Clamp(Math.ceil(raw - 1e-6), 1, this.sct);
        const cur = this.segments.length;
        if (cur <= 0) return exact;
        const h = this.config.RENDER_COUNT_HYSTERESIS;
        // Ekleme: son aralık (1 + H)·renderSpacing'i aşana kadar bekle.
        if (exact > cur && raw <= cur + h) return Phaser.Math.Clamp(cur, 1, this.sct);
        // Çıkarma: gövde bir aralık + H kadar kısalana kadar bekle.
        if (exact < cur && raw > cur - 1 - h && cur <= this.sct) return cur;
        return exact;
    }

    // Kuyruk sprite'ının path boyunca görsel ofseti (px, negatif olabilir).
    // Daire dokusu geri düşüşünde kuyruk ayrı bir sanat değildir → ofset yok.
    _tailVisualOffset() {
        if (!SnakeSkin.isReady()) return 0;
        return this._smoothedTailOffset ?? this._computeTargetTailOffset();
    }

    // Path tamponunun mantıksal gövdenin ÖTESİNDE kapsaması gereken ek uzunluk:
    // kuyruk ofseti + rotasyon örneklemesinin yarım açıklığı.
    _visualPathOverhang() {
        return Math.max(0, this._tailVisualOffset(), this._computeTargetTailOffset())
            + this._rotationHalfSpan();
    }

    // Rotasyon kirişinin yarım açıklığı (px) — bkz. ROTATION_SPAN_* notu.
    _rotationHalfSpan() {
        const cfg = this.config;
        return Math.max(
            this.getSegmentSpacing() * cfg.ROTATION_SPAN_FACTOR,
            cfg.SEGMENT_RADIUS * this.scale * cfg.ROTATION_SPAN_RADIUS_FACTOR);
    }

    _copyMetrics(m) {
        const part = (p) => ({ front: p.front, back: p.back, halfWidth: p.halfWidth });
        return { head: part(m.head), body: part(m.body), tail: part(m.tail) };
    }

    // Karakter ölçü geçişini ilerletir: out = from + (to − from)·smoothstep(t).
    // Ölçüler karakterden karaktere farklı olduğu için geçiş ŞART: aksi halde
    // aralıklar tek karede yeni değerlerine sıçrar ve gövde "kayar".
    _advanceSkinBlend(dtMs) {
        const b = this._skinBlend;
        if (!b) return;
        b.t += Math.max(0, dtMs) / Math.max(1, this.config.SKIN_TRANSITION_MS);
        if (b.t >= 1) {
            this._skinBlend = null;
            return;
        }
        const e = b.t * b.t * (3 - 2 * b.t);
        for (const part of ['head', 'body', 'tail']) {
            const o = b.out[part], f = b.from[part], g = b.to[part];
            o.front = f.front + (g.front - f.front) * e;
            o.back = f.back + (g.back - f.back) * e;
            o.halfWidth = f.halfWidth + (g.halfWidth - f.halfWidth) * e;
        }
        b.version++;
    }

    // ── KARAKTER (SKIN) DEĞİŞİMİ ─────────────────────────────────────────
    // Karakter gerekiyorsa tembel yüklenir; hazır olduğunda tüm sprite'ların
    // dokusu ve normalizasyon çarpanı değişir. Aralıklar ANINDA değişmez: yeni
    // ölçülerden türeyen hedeflere kare kare yaklaşır (konum sıçraması yok).
    // Yükleme başarısızsa mevcut karakterde kalınır.
    setSkin(skinId) {
        const id = Number(skinId);
        if (!Number.isInteger(id) || !SnakeSkin.SKIN_IDS.includes(id)) return false;
        this._requestedSkinId = id;
        if (id === this.skinId) return true;
        SnakeSkin.ensureSkin(this.scene, id).then((ok) => {
            // Bu arada yok edildiyse ya da başka bir karakter istendiyse uygulama.
            if (!ok || this._destroyed || this._requestedSkinId !== id) return;
            this._applySkinTextures(id);
        });
        return true;
    }

    _applySkinTextures(skinId) {
        // Ölçü geçişi: şu an KULLANILAN ölçülerden (gerekirse yarım kalmış bir
        // geçişin ara değerinden) yeni karakterinkine.
        const from = this._copyMetrics(this._skinBlend
            ? this._skinBlend.out
            : SnakeSkin.getSkinMetrics(this.skinId));
        this.skinId = skinId;
        if (!this._framesRendered) {
            // Henüz hiç çizilmedi (doğumda karakter atandı): geçiş yok, yeni
            // ölçülere doğrudan otur.
            this._skinBlend = null;
            this._snapSpacingToTarget();
        } else {
            this._skinBlend = {
                from,
                to: SnakeSkin.getSkinMetrics(skinId),
                out: this._copyMetrics(from),
                t: 0,
                version: (this._skinBlend?.version ?? 0) + 1,
            };
        }
        if (this.head) {
            SnakeSkin.applyTexture(this.head, SnakeTexture.HEAD, skinId);
            SnakeSkin.setSpriteScale(this.head, this.scale);
        }
        for (const seg of this.segments) {
            if (!seg || !seg.active) continue;
            SnakeSkin.applyTexture(seg, seg._texKey === SnakeTexture.TAIL ? SnakeTexture.TAIL : SnakeTexture.BODY, skinId);
            SnakeSkin.setSpriteScale(seg, this.scale, seg._animScale ?? 1);
        }
        for (const d of this._despawningSegments) {
            if (!d?.sprite?.active) continue;
            SnakeSkin.applyTexture(d.sprite, SnakeTexture.BODY, skinId);
            SnakeSkin.setSpriteScale(d.sprite, this.scale, d.t);
        }
        // Havuzdaki sprite'lar edinimde (_acquireSegmentSprite) yeniden dokulanır.
    }

    getSampleMinStep() { return Math.max(this.config.PATH_SAMPLE_MIN_STEP, this.getSegmentSpacing() * 0.1); }
    /**
     * ETKIN boost durumunu yazar ve gecis ANINI kaydeder.
     *
     * Gecis ani, sunucudan gelen otoriter bayragin BAYAT olup olmadigina karar
     * vermek icin gereklidir: biz durumu degistirdikten sonra yola cikmis ilk
     * paketler hala eski durumu tasir (bkz. applyAuthoritativeBoost).
     */
    setBoost(b) {
        const next = !!b;
        if (next !== this.isBoosting) {
            this.isBoosting = next;
            this._lastBoostChangeAtMs = (typeof performance !== 'undefined')
                ? performance.now()
                : Date.now();
        }
    }

    /**
     * BOOST UYGUNLUK KAPISI — sunucunun SnakeDynamicsSystem.resolveBoostActive
     * fonksiyonunun aynasidir (skor esigi + histerezis), arti YALNIZCA
     * client'ta bulunan bir ayrisma kilidi.
     *
     * @param {boolean} requested Oyuncunun o karedeki NIYETI (tus basili mi).
     * @returns {boolean} ETKIN boost.
     *
     * SAF FONKSIYON — HICBIR DURUM YAZMAZ.
     *
     * NEDEN KRITIK: bu metot yalnizca girdi isleme gecisinden degil,
     * getTurnRateRadPerSec uzerinden SALT-OKUNUR sorgu yolundan da cagrilir
     * (Game._applySteeringLimiter ve updateFromInput'un kendi turnSpeed
     * hesabi). Onceki surumde burada `if (!requested) this._boostDenied = false`
     * vardi ve kilit ETKIN durumu okumak icin yapilan her cagrida siliniyordu:
     * updateFromInput once kapiyi cagirip effectiveBoosting=false aliyor
     * (kilitli oldugu icin), hemen ardindan getTurnRateRadPerSec(false)
     * cagiriyordu → `requested=false` "tus birakildi" sanilip kilit
     * temizleniyordu. Yani kilit gercek oyun dongusunde TEK KARE bile
     * yasamiyordu; oyuncu tusu basili tutarken bile her karede sifirlaniyordu.
     *
     * Kilit artik YALNIZCA iki yerde degistirilir; ikisi de acik, tekil
     * gecislerdir:
     *   • updateFromInput  — girdi isleme gecisi (tus birakildiginda temizler)
     *   • applyAuthoritativeBoost — snapshot isleyicisi (kurar / onayla temizler)
     */
    _resolveBoostActive(requested) {
        if (!requested) return false;
        if (this._boostDenied) return false;

        const score = this.authoritativeScore;

        return this.isBoosting
            ? score >= this.config.BOOST_EXIT_SCORE
            : score >= this.config.BOOST_ENTRY_SCORE;
    }

    /**
     * Sunucunun ETKIN boost durumunu uygular (SelfPosition.boost_active).
     *
     * ONEMLI — BU BIR GECIKME KAYNAGI DEGILDIR. Bayragi dogrudan isBoosting'e
     * yazmak, boost basiminin tam bir gidis-donus kadar gecikmesi demek
     * olurdu; oysa mevcut mimari boost'u zaten girdi gecikmesiyle HIZALIYOR
     * (Game.js _inputDelayQueue), yani client ve sunucu ayni simulasyon
     * aninda basliyor. Normal durumda iki taraf ayni karari verdigi icin bu
     * fonksiyon HICBIR SEY yapmaz.
     *
     * Yaptigi tek sey AYRISMA TESPITIDIR:
     *   • Sunucu "boost var" diyorsa → tahmin dogrulandi, kilit kalkar.
     *   • Sunucu "boost yok" diyor, biz boost ediyoruz VE paket son yerel
     *     gecisimizden SONRAKI bir duruma ait (bayat degil) → tahmin
     *     gercekten yanlis; kilit kurulur, tahmin birakilir.
     *
     * Kilit burada TEMIZLENMEZ (sunucu onayi disinda): temizleme kosullari
     * _resolveBoostActive'de toplanmistir. Burada da temizlenseydi, kilit
     * kurulur kurulmaz isBoosting false'a dusecegi ve bir sonraki paket
     * "anlasmazlik yok" goruecegi icin kilit her defasinda tek tick yasar,
     * ardindan tahmin yeniden acilirdi — snapshot frekansinda salinim.
     *
     * @param {boolean} serverActive Sunucunun etkin boost durumu.
     * @param {number}  staleWindowMs Bir tam gidis-donus + pay.
     */
    applyAuthoritativeBoost(serverActive, staleWindowMs) {
        this.serverBoostActive = !!serverActive;

        if (this.serverBoostActive) {
            this._boostDenied = false;

            // ── HISTEREZIS LATCH'INI SUNUCUDAN DEVRAL ───────────────────────
            // Histerezis DURUMLUDUR: "zaten acik" iken taban 120, "kapali"
            // iken 150'dir. Iki taraf ayni skoru gorse bile LATCH bitleri
            // ayrisabilir ve o zaman ayni skor farkli kararlar uretir.
            //
            // Somut ayrisma: skor 140 (banda ait), sunucu boost ediyor
            // (latch acik, 140 >= 120). Client latch'i kapaliysa 140 < 150
            // oldugu icin boost'u REDDEDER → client taban hizda, sunucu boost
            // hizinda; fark ~225 px/sn ile birikir ve reconciliation bunu
            // gorunmeyen kalici bir kafa ofseti olarak sabitler.
            //
            // Sunucu otoritedir: bayragi latch olarak DEVRALIRIZ, boylece bir
            // sonraki _resolveBoostActive CIKIS dalindan (>= 120) gecer.
            // Bu boost'u ZORLAMAZ — niyet hala gereklidir: oyuncu tusu
            // birakmissa _resolveBoostActive(false) yine false doner.
            //
            // setBoost KULLANILMAZ: o, _lastBoostChangeAtMs'i gunceller ve o
            // damga "benim YEREL kararim" anlamina gelir. Burada yaptigimiz
            // sey bir karar degil, sunucunun kararini benimsemektir; damgayi
            // ilerletmek mesru bir ayrisma tespitini bir pencere geciktirirdi.
            this.isBoosting = true;
            return;
        }
        if (!this.isBoosting) {
            // Anlasmazlik yok — degerlendirilecek bir sey de yok. Kilit
            // (varsa) KORUNUR; bkz. yukaridaki javadoc.
            return;
        }

        const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        const staleWindow = Number.isFinite(staleWindowMs) ? staleWindowMs : 250;
        if (now - this._lastBoostChangeAtMs < staleWindow) {
            // Bu paket biz durumu degistirmeden ONCE yola cikmis olabilir.
            return;
        }
        this._boostDenied = true;
    }

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
    // Yılan sürekli büyüyüp küçüldüğü için sprite'lar destroy edilmez, havuza iade edilir.
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
                this.scene.add.sprite(x, y, SnakeSkin.textureKey(SnakeTexture.BODY, this.skinId)).setOrigin(0.5)
            );
        }
        // HAVUZDAN GELEN SPRITE KUYRUK OLMUS OLABILIR: havuza iade edilirken
        // dokusu KUYRUK olan bir sprite, govde olarak yeniden kullanildiginda
        // hem yanlis doku hem YANLIS OLCEK carpani tasirdi (kuyruk 0.122,
        // govde 0.166). Her edinimde dokuyu govdeye geri almak bu sinifi
        // hatayi tamamen kapatir.
        SnakeSkin.applyTexture(seg, SnakeTexture.BODY, this.skinId);
        // Havuzdan gelen sprite eski turdan tint/blend/alpha tasiyor olabilir.
        // Alpha asagida buyume animasyonuna gore yeniden yazilir.
        if (SnakeSkin.isReady()) SnakeSkin.resetAppearance(seg);
        // _animScale: this.scale ile ÇARPILAN büyüme/çöküş çarpanı (0..1).
        // animateIn=true → 0'dan başlar, _updateSegmentLifecycle ile 1'e büyür.
        seg._animScale = animateIn ? 0 : 1;
        seg._growing = animateIn;
        // Rotasyon filtresi ilk konumlandırmada filtresiz oturur; kuyruk ofseti
        // sıfırdan başlar (havuzdan gelen sprite eski yaşamın değerini taşımasın).
        seg._rotInit = false;
        seg._rotTarget = 0;
        seg._rotDx = 0;
        seg._tailBlend = 0;
        SnakeSkin.setSpriteScale(seg, this.scale, animateIn ? 0 : 1);
        seg.setAlpha(animateIn ? 0 : 1);
        return seg;
    }

    _releaseSegmentSprite(seg) {
        if (!seg) return;
        // Sahneden kopmuş/yok edilmiş sprite havuza girmemeli.
        if (!seg.scene) { seg.destroy?.(); return; }
        seg._growing = false;
        seg._animScale = 1;
        // Kuyruk dokusu havuza SIZMASIN (bkz. _acquireSegmentSprite notu).
        if (seg._texKey === SnakeTexture.TAIL) {
            SnakeSkin.applyTexture(seg, SnakeTexture.BODY, this.skinId);
        }
        if (this._tailSprite === seg) this._tailSprite = null;
        if (this._spritePool.length >= this.config.SEGMENT_POOL_MAX) {
            seg.destroy();
            return;
        }
        seg.setVisible(false);
        seg.setActive(false);
        this._spritePool.push(seg);
    }

    // Görsel sprite sayısını gövde uzunluğu / render aralığı ile uzlaştırır
    // (bkz. _desiredSpriteCount). sct'yi ASLA yazmaz — tek yönlü bağımlılık
    // (mantık → görsel).
    //
    // @param {boolean} animateIn  yeni sprite'lar 0'dan büyüsün (segment ekleme)
    // @param {boolean} animateOut fazlalık sprite'lar yerinde çöksün (segment
    //        silme). false iken fazlalık ANINDA havuza döner (sert senkron).
    _syncVisualSegments(animateIn = false, animateOut = false) {
        const want = this._desiredSpriteCount();
        const segs = this.segments;

        // KUYRUK SPRITE'I KALICIDIR: ekleme/çıkarma kuyruğun HEMEN ÖNÜNDEKİ
        // gövde yuvasında yapılır. Kuyruk dizinin sonunda kalır ve konumu
        // min(n·renderSpacing, L) = L olduğundan hiç kıpırdamaz; yeni gövde
        // sprite'ı (n−1)·renderSpacing'de, yani zaten gövdenin içinde büyür.
        // (Sona eklemek kuyruk kimliğini yeni, 0 ölçekli sprite'a devrederdi:
        // eski kuyruk gövde dokusuyla ofset kadar dışarıda kalıp geri kayar,
        // yeni kuyruk ise sıfırdan büyürdü — her eklemede görünür bir boşluk.)
        while (segs.length > want) {
            const idx = segs.length >= 2 ? segs.length - 2 : segs.length - 1;
            const seg = segs.splice(idx, 1)[0];
            if (animateOut) this._beginSegmentDespawn(seg);
            else this._releaseSegmentSprite(seg);
        }

        while (segs.length < want) {
            if (segs.length === 0) {
                const spawn = this._resolveSegmentSpawnPositionBehindTail();
                segs.push(this._acquireSegmentSprite(spawn.x, spawn.y, animateIn));
                continue;
            }
            // Yeni gövde sprite'ı kuyruğun konumunda doğar; aynı karede
            // _positionSegmentsByPath onu (n−1)·renderSpacing'e oturtur.
            const tail = segs[segs.length - 1];
            const seg = this._acquireSegmentSprite(tail.x, tail.y, animateIn);
            segs.splice(segs.length - 1, 0, seg);
        }

        this._refreshSegmentDepths();
    }

    _refreshSegmentDepths() {
        if (this.head) {
            this.head.setDepth(this.sct + 1);
            // TINT = CARPMA. Uretilmis daire dokusu BEYAZ oldugu icin tint orada
            // bir "renklendirme" aracıydı (beyaz x altin = altin). Gercek renkli
            // PNG'de ayni islem sanati karartir. Sprite skin aktifken doku kendi
            // rengini tasir → tint NOTR kalmalidir.
            if (SnakeSkin.isReady()) {
                SnakeSkin.resetAppearance(this.head);
            } else {
                this.head.setTint(this.segmentPrimaryColor);
            }

            // Fix eye depth disappearing
            this.eyeL?.setDepth(this.head.depth + 1);
            this.eyeR?.setDepth(this.head.depth + 1);
            this.pupilL?.setDepth(this.head.depth + 2);
            this.pupilR?.setDepth(this.head.depth + 2);
        }
        for (let i = 0; i < this.segments.length; i++) {
            // Derinlik mantıksal indekse göre (kafa üstte, kuyruk altta).
            this.segments[i].setDepth(this.sct - i);
            // Şerit rengi sprite indeksine göre (1:1 = mantıksal indeks).
            // Serit rengi YALNIZCA daire dokusu yolunda uygulanir. Sprite
            // skin'de serit, sanatin kendi deseninden gelir; ayrica burada
            // uygulanan 0x2B2B2B (43,43,43) carpani dokuyu %83 karartiyordu.
            if (SnakeSkin.isReady()) {
                SnakeSkin.resetAppearance(this.segments[i]);
            } else {
                this.segments[i].setTint(this._getSegmentColor(i));
            }
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

        // Yeni sprite kuyruğun bir render aralığı arkasında doğar. (Konum aynı
        // karede _positionSegmentsByPath tarafından kesinleştirilir.)
        const spacing = this.getRenderSpacing();
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
        const requiredLength = (this.sct + 2) * spacing + 600 + this._visualPathOverhang();

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

        // Mantıksal uzunluk ve sprite sayısı TAM eklenen kadar artar (1:1).
        // animateIn=true: yeni sprite 0 ölçek/opaklıktan yumuşakça büyür
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
        for (let i = this.segments.length - 1; i >= 0; i--) {
            const seg = this.segments[i];
            if (!seg || !seg.active || !seg._growing) continue;
            seg._animScale += (1 - seg._animScale) * growAlpha;
            if (seg._animScale > 0.995) {
                seg._animScale = 1;
                seg._growing = false;
            }
            SnakeSkin.setSpriteScale(seg, this.scale, seg._animScale);
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
                    SnakeSkin.setSpriteScale(d.sprite, this.scale, d.t);
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
        // Doku SnakeSkin uzerinden atanir: anahtarla BIRLIKTE o dokuya ait
        // normalizasyon carpani da sprite'a yazilir (bkz. applyTexture).
        this.head = this.scene.registerWorld(
            this.scene.add.sprite(x, y, SnakeSkin.textureKey(SnakeTexture.HEAD, this.skinId)).setOrigin(0.5));
        SnakeSkin.applyTexture(this.head, SnakeTexture.HEAD, this.skinId);
        if (SnakeSkin.isReady()) SnakeSkin.resetAppearance(this.head);
        SnakeSkin.setSpriteScale(this.head, this.scale);
        // head.rotation MANTIKSAL hareket acisidir ve kod tabaninin her yerinde
        // bir YON VEKTORU olarak okunur. Sanatin +90°'lik yonelim farki dokuya
        // PISIRILDIGI icin burada hicbir ofset YOKTUR (bkz. SnakeSkin.bakeRotated).
        this.head.rotation = angle;
        // NOT: kafada artık Arcade physics body YOK. Body yalnızca hız
        // entegrasyonu için kullanılıyordu (client'ta collider yok; ölüm
        // sunucuda, yem yeme mesafe kontrolüyle). Arcade'in fixedStep@60Hz
        // adımı 120Hz+ ekranlarda merdiven aliasing'i (micro-tremor) üretiyordu.
        // Entegrasyon artık updateFromInput içinde manuel (capped dt) yapılır,
        // sprite pozisyonu postPhysicsUpdate'te sim'den görsel yumuşatmayla türetilir.
        // SPAWN: büyüme animasyonu yok — yılan ilk karede tam gövdeyle çizilir.
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
        // ── PROSEDUREL GOZLER: SPRITE KAFADA GEREKSIZ ───────────────────────
        // Daire dokusu ozelliksiz oldugu icin gozler ayri sprite'lar olarak
        // ciziliyordu. 1x1.png'nin KENDI gozleri var; ustune ikinci bir
        // goz cifti bindirmek ejderha yuzunu bozar. Sprite hazirsa gozler
        // yaratilmaz — yaratilmayan nesne gizlenmeye, guncellenmeye ve yok
        // edilmeye de ihtiyac duymaz (_updateEyes zaten null-guard'li).
        this._useProceduralEyes = !SnakeSkin.isReady();
        if (this._useProceduralEyes) {
        this.eyeL = this.scene.registerWorld(this.scene.add.image(x, y, 'eye10').setOrigin(0.5).setDepth(this.head.depth + 2));
        this.eyeR = this.scene.registerWorld(this.scene.add.image(x, y, 'eye10').setOrigin(0.5).setDepth(this.head.depth + 2));
        this.pupilL = this.scene.registerWorld(this.scene.add.image(x, y, 'pupil4').setOrigin(0.5).setDepth(this.head.depth + 3));
        this.pupilR = this.scene.registerWorld(this.scene.add.image(x, y, 'pupil4').setOrigin(0.5).setDepth(this.head.depth + 3));
        }
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
        // Kuyruk referansi imha edilen bir sprite'i tutmasin (GC + bayat
        // referans uzerinden setTexture cagrisi riski).
        this._tailSprite = null;
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
        this.path = [];
        this.pathSegLens = [];
        this.totalPathLen = 0;
        this._pathSeeded = false;
        this._pathFollower = null;

        // 3) İnterpolasyon / tahmin buffer'ları — eski yaşamın yörünge verisi
        // yeni yaşama sızamaz. TÜM erişimler null-guard'lı: geçmişte burada
        // korumasız bir alan yazımı TypeError fırlatıyor, destroy() yarıda
        // kalıyor ve yılan snakes map'inden silinemediği için ayrılan oyuncular
        // yeniden karşılaşmada KALICI görünmez kalıyordu (hem RemoveEntity hem
        // EntityFull yolunda). Bu dizilim korunmalıdır.
        if (this._predHistory) this._predHistory.length = 0;
        if (this._smoothedError) {
            this._smoothedError.x = 0;
            this._smoothedError.y = 0;
        }
        this._correcting = false;
        // Uzak oynatma motorunun TÜM durumu (ring buffer, jitter/aralık
        // ölçümleri, playout saati, dead reckoning hızı, uzlaşma ofseti).
        this._interp?.reset();
        this.hasServerState = false;
        this.hasSelfServerState = false;
        this._hasSpawnBaseline = false;
        this._hasServerHeading = false;
        this.lastReconciledSequenceId = 0;
    }

    /**
     * Sunucudan gelen dokunulmazlik bayragini uygular.
     *
     * <p>SUNUCU OTORITERDIR: bu metot yalnizca paketten okunan durumu yansitir.
     * Istemcide sure sayaci YOKTUR — efekt, sunucu bayragi true kaldigi surece
     * oynar ve bayrak dustugu ANDA temizlenir. Dolayisiyla istemci tarafinda
     * hile ile uzatilabilecek bir durum bulunmaz.
     */
    setInvulnerable(flag) {
        const next = !!flag;
        if (next === this._invulnerable) return;
        this._invulnerable = next;
        if (!next) {
            this._clearInvulnerabilityFx();   // bayrak dustu → aninda normale don
        } else {
            this._invulnPhase = 0;
        }
    }

    /**
     * Dokunulmazlik nabzini ilerletir. postPhysicsUpdate icinden her kare
     * cagrilir; kapaliyken maliyeti tek bir boolean kontroludur.
     */
    _updateInvulnerabilityFx(dtMs) {
        if (!this._invulnerable) return;

        this._invulnPhase += (dtMs / 1000) * this.config.INVULN_FLASH_HZ;
        // Kare-hizindan BAGIMSIZ: faz saniyeye bagli ilerler, dolayisiyla
        // 60Hz ve 144Hz'de flas hizi ayni gorunur.
        const wave = 0.5 + 0.5 * Math.sin(this._invulnPhase * Math.PI * 2);
        const filled = wave > 0.5;
        const alpha = Phaser.Math.Linear(this.config.INVULN_MIN_ALPHA, 1, wave);

        this._forEachLiveSprite((sprite) => {
            // setTintFill: dokunun rengini TAMAMEN degistirir (duz beyaz
            // siluet). setTint olsaydi beyaz carpma etkisiz kalir ve HICBIR
            // sey gorunmezdi — bkz. INVULN_FLASH_HZ basligindaki not.
            if (filled) sprite.setTintFill(this.config.INVULN_FILL_COLOR);
            else sprite.clearTint();
            sprite.setAlpha(alpha);
        });
    }

    /** Efekti sokup sprite'lari normal gorunume dondurur. */
    _clearInvulnerabilityFx() {
        this._invulnPhase = 0;
        this._forEachLiveSprite((sprite) => {
            sprite.clearTint();
            // Alfa'yi 1'e DEGIL, sprite'in kendi animasyon olcegine geri al:
            // buyumekte olan bir segment 1'e zorlanirsa dogum animasyonunun
            // ortasinda aniden tam opak olurdu.
            sprite.setAlpha(sprite._animScale ?? 1);
        });
    }

    /**
     * Kafa + aktif govde/kuyruk sprite'lari uzerinde yurur.
     *
     * <p>Yalnizca TINT ve ALPHA yazan cagiranlar icindir; olcek ve doku
     * SnakeSkin'in sorumlulugundadir ve buradan asla degistirilmez.
     */
    _forEachLiveSprite(fn) {
        if (this.head?.active) fn(this.head);
        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            if (seg && seg.active) fn(seg);
        }
    }

    setNickname(nickname) {
        if (!nickname) return;
        this.nickname = nickname;
        if (this.nicknameText) {
            this.nicknameText.setText(nickname);
        } else {
            this.nicknameText = this.scene.registerWorld(this.scene.add.text(this.head.x, this.head.y, nickname, {
                fontFamily: 'Outfit, Inter, Arial, sans-serif',
                fontSize: `${NICK_FONT_PX}px`,
                fontStyle: 'bold',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                // Rasterize at backing-buffer density (bkz. NICKNAME TYPOGRAPHY).
                // Default 0 → 1 would be upscaled D× by the camera and blur.
                resolution: this.scene.renderDensity ?? 1
            }).setOrigin(0.5).setDepth(2000));
            this._nickDensity = this.scene.renderDensity ?? 1;
        }
        this._layoutNickname();
    }

    /**
     * Places + counter-scales the nickname for the CURRENT camera zoom
     * (formulas: NICKNAME TYPOGRAPHY block at the top of this file).
     */
    _layoutNickname() {
        const text = this.nicknameText;
        if (!text || !this.head) return;

        // Density changed (monitor switch): re-rasterize once at the new D.
        const density = this.scene.renderDensity ?? 1;
        if (density !== this._nickDensity) {
            this._nickDensity = density;
            text.setResolution(density);
        }

        const cssZoom = Math.max(1e-3, this.scene.cssZoom ?? this.scene.cameras.main.zoom);
        const screenPx = Phaser.Math.Clamp(NICK_FONT_PX * cssZoom, NICK_MIN_SCREEN_PX, NICK_FONT_PX);
        const objScale = screenPx / (NICK_FONT_PX * cssZoom);
        if (text.scaleX !== objScale) text.setScale(objScale);

        // Vertical offset: the original 35·scale world px, but never closer than
        // (head radius + gap + half label height) — once the label stops
        // shrinking with zoom it would otherwise overlap the head. The CSS-px
        // terms are converted to world units by dividing by cssZoom.
        const halfLabelWorld = (text.height * objScale) / 2;
        const minOffset = this.config.HEAD_RADIUS * this.scale + NICK_GAP_PX / cssZoom + halfLabelWorld;
        const offset = Math.max(35 * this.scale, minOffset);
        text.setPosition(this.head.x, this.head.y - offset);
    }

    updateFromInput(targetAngleRad, isBoosting, delta, sequenceId = 0) {
        if (!this.alive || !this.isPlayerControlled || !this.head) return;

        // isBoosting = oyuncunun NIYETI. Etkin durum, sunucunun kapisiyla
        // BIREBIR ayni fonksiyondan gecer (skor esigi + histerezis + ayrisma
        // kilidi). Eski kapi segment sayisina bakiyordu ve sunucunun skor
        // tabanli kapisiyla ayrisabiliyordu; ustelik segment sayisi sunucudan
        // ~RTT gecikmeli geldigi icin kapi taban civarinda daima yanlis
        // taraftaydi.
        // ── KILIT TEMIZLEME: TEK GIRDI ISLEME NOKTASI ───────────────────────
        // Tus birakildiginda ayrisma kilidi kalkar. Bu, kapinin ICINDE
        // yapilamaz: kapi salt-okunur sorgu yolundan da cagrilir ve orada
        // "etkin durum false" ile "oyuncu tusu birakti" birbirine karisir
        // (bkz. _resolveBoostActive javadoc). Burasi niyetin GERCEKTEN
        // okundugu tek yerdir, dolayisiyla dogru yer burasidir.
        if (!isBoosting) {
            this._boostDenied = false;
        }

        const effectiveBoosting = this._resolveBoostActive(isBoosting);
        this.setBoost(effectiveBoosting);

        const baseSpeed = this.calculateBaseSpeed();
        const boostSpeed = this.calculateBoostSpeed();
        this.speed = effectiveBoosting ? boostSpeed : baseSpeed;

        // ω_max — girdi katmanindaki slew-rate limiter ile BIREBIR ayni kaynak
        // (bkz. getTurnRateRadPerSec). Boylece "girdi katmaninin izin verdigi
        // donus hizi" ile "simulasyonun uygulayabildigi donus hizi" asla
        // ayrisamaz.
        this.turnSpeed = this.getTurnRateRadPerSec(effectiveBoosting);

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
        // Dogum dokunulmazligi nabzi — hem oyuncu hem uzak yilanlar icin.
        // Kapaliyken tek boolean kontrolu; sicak yola olcusebilir yuk getirmez.
        this._updateInvulnerabilityFx(this._delta || 16.67);

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
        }

        // Gövde path'ini besleyen follower — oyuncu ve uzak yılanlar için AYNI
        // uzamsal filtre (bkz. PATH_SPATIAL_SMOOTHING_PX).
        this._advancePathFollower();

        // Spacing yumuşatması KONUMLANDIRMADAN ÖNCE: bu karenin spacing'i.
        this._updateSpacingAnimation(this._delta || 16.67);
        this._framesRendered = (this._framesRendered || 0) + 1;
        // Render aralığı kare kare kaydığı için sprite sayısı gövde ucunda
        // birer birer değişebilir — büyüme/çöküş animasyonuyla uzlaştırılır.
        if (this._desiredSpriteCount() !== this.segments.length) {
            this._syncVisualSegments(true, true);
        }
        this._sampleHeadToPath();
        this._positionSegmentsByPath(true);
        // Segment büyüme/çöküş/emeklilik animasyonları (Issue #3) —
        // konumlandırmadan sonra, ölçeği/opaklığı bu karenin dt'siyle ilerlet.
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
            this._layoutNickname();
        }
    }

    // ── UZAMSAL PATH FOLLOWER ────────────────────────────────────────────
    // Follower, kafanın bu karede KAT ETTİĞİ MESAFE kadar ilerleyen üstel bir
    // filtredir: a = 1 − exp(−Δs / L). Zaman tabanlı filtrenin aksine süzme
    // miktarı kare hızına ve yılan hızına bağlı değildir; dalga boyu ~2πL'den
    // kısa kafa titreşimleri (uzlaşma düzeltmeleri, interpolasyon tümsekleri)
    // gövde path'ine ulaşmadan sönümlenir. Kararlı gecikme ≈ L px'tir ve
    // _positionSegmentsByPath'in kafa→path[0] stub'ı tarafından soğurulur,
    // yani boyun mesafesi değişmez.
    _advancePathFollower() {
        const f = this._pathFollower;
        const head = this.head;
        if (!f || !head) return;

        const last = this._followerHeadPrev;
        const moved = last ? Math.hypot(head.x - last.x, head.y - last.y) : 0;
        if (last) { last.x = head.x; last.y = head.y; }
        else this._followerHeadPrev = { x: head.x, y: head.y };

        const L = this.config.PATH_SPATIAL_SMOOTHING_PX;
        const gap = Math.hypot(head.x - f.x, head.y - f.y);
        // Işınlanma / hard resync: filtre geçmişi anlamsız → otur.
        if (!(L > 0) || gap > this.config.VISUAL_SNAP_DISTANCE) {
            f.x = head.x;
            f.y = head.y;
            return;
        }
        if (!(moved > 0)) return;
        const a = 1 - Math.exp(-moved / L);
        f.x += (head.x - f.x) * a;
        f.y += (head.y - f.y) * a;
    }

    _frameAdjustedFactor(baseFactor, delta) {
        // Exponential decay: frame-rate independent smooth lerp.
        // At 60 FPS (delta=16.67ms) this equals baseFactor; at other rates it scales correctly.
        return 1 - Math.pow(1 - baseFactor, delta / (1000 / 60));
    }

    // ── UZAK YILAN OYNATMA (playout) ─────────────────────────────────────
    // Tüm ağ zamanlaması EntityInterpolator'dadır (bkz. o dosyanın başlığı).
    // Burada kalan tek iş: ölçülen ağ istatistiklerini motora geçirmek ve
    // dönen konumu sprite'a yazmak. Yedek/ikinci bir yol YOKTUR — motor her
    // durumda (buffer boş hariç) geçerli bir konum döndürür; buffer açlığında
    // dead reckoning, dönüşte ofset uzlaşması devreye girer.
    _interpolateRemoteSnake(delta) {
        if (!this.hasServerState) return;

        const net = this.scene?.networkManager;
        const sampled = this._interp.sample(performance.now(), delta, {
            pingMs: Number.isFinite(net?.pingEmaMs) ? net.pingEmaMs : null,
            pingJitterMs: Number.isFinite(net?.pingJitterMs) ? net.pingJitterMs : null,
        });
        // Tampon boş (yılan yaratıldı ama ilk paket henüz işlenmedi):
        // mevcut konumu KORU — uydurma bir koordinata atlamaktan iyidir.
        if (!sampled) return;

        this.head.x = sampled.x;
        this.head.y = sampled.y;
        this.head.rotation = sampled.angle;
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

        // Uzak yılan oynatma durumu bayat — sekme gizliyken biriken eski
        // örnekler, donmuş playout saati ve birikmiş uzlaşma ofseti dönüşte
        // geriye doğru interpolasyon (geri sarma) üretirdi.
        this._interp.reset();

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
        // Sprite kafa kullaniliyorsa goz nesneleri hic yaratilmadi.
        if (!this.eyeL) return;
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
        // Hard reset: görsel süreklilik zaten kopuk → spacing geçişi atlanır.
        this._snapSpacingToTarget();
        const spacing = this.getSegmentSpacing();
        // MANTIKSAL uzunluk (sct) — decimation path'i KISALTMAZ. Kuyruk ofseti
        // ve rotasyon açıklığı için görsel taşma payı eklenir.
        const needLen = (this.sct + 1) * spacing + 400 + this._visualPathOverhang();
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
            const maxNeeded = (this.sct + 2) * spacing + 600 + this._visualPathOverhang();
            while (this.totalPathLen > maxNeeded && this.path.length > 2) {
                const rem = this.pathSegLens.pop();
                if (rem !== undefined) this.totalPathLen -= rem;
                this.path.pop();
            }
        }
    }

    // Gövdenin her karedeki SICAK DÖNGÜSÜ. Üç optimizasyon içerir:
    //
    //  1. VARLIK-DUYARLI DİZİLİM — sprite i, d = min(neck + i·renderSpacing, L)
    //     konumuna yerleşir; son sprite (kuyruk) TAM gövde ucundadır (L) ve
    //     kuyruk ofsetiyle ötelenir.
    //
    //  2. TEK GEÇİŞLİ YÜRÜYÜŞ — eski kod her segment için
    //     _pointAndAngleAtDistance ile path'i BAŞTAN yürüyordu: O(sprite × path).
    //     Sorgu mesafeleri monoton arttığı için imleç (walkIdx/walkBase)
    //     kareler arası değil, döngü içinde ileri taşınır → O(sprite + path).
    //     Sonuç değerleri _pointAndAngleAtDistance ile BİREBİR aynıdır.
    //
    //  3. CULLING — kamera görüş dikdörtgeni dışındaki sprite için transform
    //     yazımı ve çizim atlanır (setVisible(false) → render listesinden düşer).
    // @param {boolean} [frameStep=false] true YALNIZCA kare döngüsünden
    //        (postPhysicsUpdate) çağrılırken: rotasyon filtresi bu karenin dt'si
    //        ile ilerler. Diğer tüm çağrılar (seed, respawn, heading, resync)
    //        kopuk anlardır → açılar filtresiz oturur, bayat dt ile fazladan
    //        filtre adımı atılmaz.
    _positionSegmentsByPath(frameStep = false) {
        if (this.path.length < 2) return;
        const segs = this.segments;
        if (segs.length === 0) return;

        const head = this.head;
        if (!head) return;

        const cfg = this.config;
        // Mantıksal gövde uzunluğu (hitbox) ve sprite dizilim aralığı.
        const bodyLen = this.sct * this.getSegmentSpacing();
        const renderSpacing = this.getRenderSpacing();
        const neck = Math.min(this.getNeckDistance(), bodyLen);
        const lastIndex = segs.length - 1;

        // Kuyruk kimliği KONUMLANDIRMADAN ÖNCE güncellenir: kuyruk ofseti bu
        // karenin kuyruk sprite'ına uygulanmalı (bir kare bayat değil).
        this._syncTailTexture();
        const tailSprite = this._tailSprite;
        const tailOffset = this._tailVisualOffset();
        const dtSec = Math.min(this._delta || 16.67, cfg.MAX_SIM_DT_MS) / 1000;
        const tailBlendAlpha = 1 - Math.exp(-cfg.TAIL_OFFSET_BLEND_RATE * dtSec);
        const halfSpan = this._rotationHalfSpan();
        const twoPiDt = 2 * Math.PI * dtSec;
        const derivAlpha = 1 - Math.exp(-twoPiDt * cfg.ROTATION_DERIV_CUTOFF_HZ);

        // ── Culling penceresi (dünya uzayı) ──────────────────────────────
        // Padding'e segment YARIÇAPININ İKİ KATI eklenir: kuyruk dokusu
        // merkezinden ~1.84·yarıçap uzanır; merkezi hemen dışarıda olan ama
        // gövdesi/kuyruğu hâlâ görünen sprite'lar kırpılmamalı.
        // AYRICA: worldView kameranın BİR ÖNCEKİ karedeki görüşüdür (burası
        // render'dan önce, update fazında çalışır). CULL_PADDING_PX bu bir
        // karelik gecikmeyi de soğuracak kadar cömert tutulmuştur.
        const view = this.scene?.cameras?.main?.worldView;
        const cullActive = !!(view && view.width > 0 && view.height > 0);
        // Padding'e karakterin en uzun gövde/kuyruk uzantısı (×1.1 pay) eklenir.
        const pad = cfg.CULL_PADDING_PX + this._skinExtents().maxExtent * 1.1;
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
        this._walkIdx = 0;
        this._walkBase = 0;
        this._walkStub = stubLen;

        const pos = this._sampleA;
        const front = this._sampleB;
        const back = this._sampleC;
        let visibleCount = 0;
        // Path tükendiğinde / dejenere kirişte kullanılacak son geçerli açı.
        // Gövde açı kuralı: kafaya yakın noktadan KUYRUĞA doğru (geri yön).
        let lastAngle = head.rotation + Math.PI;

        for (let i = 0; i < segs.length; i++) {
            const seg = segs[i];
            if (!seg || !seg.active) continue;

            // Sprite i: neck + i·renderSpacing. Son sprite (kuyruk) gövde UCUNA
            // (L) oturur → görsel uzunluk her zaman sct·spacing'dir.
            let d = i === lastIndex ? bodyLen : Math.min(neck + i * renderSpacing, bodyLen);

            // Kuyruk ofseti — yalnızca çizim. Kuyruk kimliği değiştiğinde
            // (büyüme/kısalma) ofset sıçramasın diye sprite başına
            // 0↔1 arasında üstel geçiş yapar.
            const blendTarget = (seg === tailSprite && tailOffset !== 0) ? 1 : 0;
            let blend = seg._tailBlend ?? 0;
            if (blend !== blendTarget) {
                blend += (blendTarget - blend) * tailBlendAlpha;
                if (Math.abs(blendTarget - blend) < 0.001) blend = blendTarget;
                seg._tailBlend = blend;
            }
            if (blend > 0) d = Math.max(0, d + tailOffset * blend);

            if (!this._samplePathAt(d, pos)) {
                // Path tükendi → kuyruk noktasına yaslan (eski davranış).
                const tail = this.path[this.path.length - 1] ?? head;
                pos.x = tail.x;
                pos.y = tail.y;
            }
            const px = pos.x;
            const py = pos.y;

            // ── Culling ──────────────────────────────────────────────────
            // Ekran dışında: transform YAZILMAZ (konum bir sonraki görünür
            // karede zaten yeniden hesaplanıp yazılır, bayatlık kalıcı değil).
            // Rotasyon filtresi de sıfırlanır: görünür olduğunda filtresiz oturur.
            if (cullActive && (px < minX || px > maxX || py < minY || py > maxY)) {
                if (seg.visible) seg.setVisible(false);
                seg._rotInit = false;
                continue;
            }

            // ── GENİŞ AÇIKLIKLI ROTASYON ─────────────────────────────────
            // Tek path parçasının kirişi yerine d ± halfSpan arasındaki kiriş:
            // alt-piksel yanal gürültünün açıya etkisi ~spacing/parça oranında
            // (≈3–10×) azalır ve açı path köşelerinde basamak yapmaz.
            // Yürüyüş imleci geri sarabildiği için sorgular monoton olmak
            // zorunda değil; geri sarma her zaman birkaç parçayla sınırlıdır.
            const h = Math.min(halfSpan, d);
            this._samplePathAt(d - h, front);
            this._samplePathAt(d + h, back);
            const cx = back.x - front.x;
            const cy = back.y - front.y;
            let targetAngle = lastAngle;
            if (cx * cx + cy * cy > 1e-6) {
                targetAngle = Math.atan2(cy, cx);
                lastAngle = targetAngle;
            }

            if (!seg.visible) seg.setVisible(true);
            seg.setPosition(px, py);

            // ── Adaptif (One-Euro) rotasyon filtresi ─────────────────────
            // Filtre durumu sprite üzerinde (sarılmamış çıktı = seg.rotation,
            // önceki ham hedef, yumuşatılmış açısal hız). Kopuk anlarda ve
            // büyük sıçramalarda filtresiz oturur.
            const jump = seg._rotInit
                ? Math.abs(Phaser.Math.Angle.Wrap(targetAngle - seg.rotation))
                : Infinity;
            if (!frameStep || !(dtSec > 0) || jump > cfg.ROTATION_SNAP_RAD) {
                seg.rotation = targetAngle;
                seg._rotTarget = targetAngle;
                seg._rotDx = 0;
                seg._rotInit = true;
            } else {
                const rawDx = Phaser.Math.Angle.Wrap(targetAngle - seg._rotTarget) / dtSec;
                seg._rotTarget = targetAngle;
                seg._rotDx += (rawDx - seg._rotDx) * derivAlpha;
                const cutoff = cfg.ROTATION_MIN_CUTOFF_HZ + cfg.ROTATION_BETA * Math.abs(seg._rotDx);
                const alpha = 1 - Math.exp(-twoPiDt * cutoff);
                const diff = Phaser.Math.Angle.Wrap(targetAngle - seg.rotation);
                // Sarılı tutulur: sürekli aynı yönde dönen yılanda değer sınırsız büyümesin.
                seg.rotation = Phaser.Math.Angle.Wrap(seg.rotation + diff * alpha);
            }
            visibleCount++;
        }

        this._visibleSegmentCount = visibleCount;
        // Konum entegrasyonundan SONRA rijit boyun kısıtı (bkz. _enforceNeckJoint).
        this._enforceNeckJoint(segs.length > 1 ? neck : bodyLen);
    }

    // Kafadan yay uzunluğu `d`'deki path noktasını `out`'a yazar.
    // _positionSegmentsByPath'in kurduğu imleci (_walkIdx/_walkBase/_walkStub)
    // kullanır; imleç hem ileri hem GERİ hareket edebilir (rotasyon örneklemesi
    // d - halfSpan sorgusu ile bir önceki sorgunun gerisine düşebilir).
    // Sonuçlar _pointAndAngleAtDistance ile aynı geometriyi izler.
    // @returns {boolean} path tükenmediyse true.
    _samplePathAt(d, out) {
        const head = this.head;
        const stubLen = this._walkStub;
        if (!(d > 0)) {
            out.x = head.x;
            out.y = head.y;
            return true;
        }
        if (stubLen > 0 && d <= stubLen) {
            const p0 = this.path[0];
            const t = d / stubLen;
            out.x = head.x + (p0.x - head.x) * t;
            out.y = head.y + (p0.y - head.y) * t;
            return true;
        }

        const dd = d - stubLen;
        const lens = this.pathSegLens;
        let idx = this._walkIdx;
        let base = this._walkBase;
        // Geri sar.
        while (idx > 0 && dd < base) {
            idx--;
            base -= lens[idx];
        }
        if (base < 0) base = 0;   // kayan nokta birikimi koruması
        // İleri taşı.
        while (idx < lens.length && base + lens[idx] < dd) {
            base += lens[idx];
            idx++;
        }
        this._walkIdx = idx;
        this._walkBase = base;

        const a = this.path[idx];
        const b = this.path[idx + 1];
        if (idx >= lens.length || !a || !b) {
            const tail = this.path[this.path.length - 1] ?? head;
            out.x = tail.x;
            out.y = tail.y;
            return false;
        }
        const segLen = lens[idx];
        const t = segLen > 0.0001 ? (dd - base) / segLen : 0;
        out.x = a.x + (b.x - a.x) * t;
        out.y = a.y + (b.y - a.y) * t;
        return true;
    }

    /**
     * KUYRUK DOKUSUNU son cizilen segmente tasir.
     *
     * <p>NEDEN HER KARE HESAPLANIR: "son segment" sabit bir indeks DEGILDIR.
     * Yilan buyudukce/kisaldikca dizinin sonu surekli el degistirir. Sabit bir
     * indekse kuyruk dokusu atamak, govdenin ortasinda kuyruk gorunmesine yol
     * acardi.
     *
     * <p>NEDEN UCUZ: geriye dogru tarama neredeyse her zaman ilk adimda biter ve
     * kimlik degismediginde HICBIR setTexture cagrilmaz — steady-state maliyeti
     * bir karsilastirmadir.
     *
     * <p>Cokmekte olan (despawn) sprite'lar this.segments'te bulunmadigi icin
     * kuyruk her zaman KALICI son segmenttir.
     */
    _syncTailTexture() {
        if (!SnakeSkin.isReady()) return;

        const segs = this.segments;
        let tail = null;
        for (let i = segs.length - 1; i >= 0; i--) {
            const seg = segs[i];
            if (seg && seg.active) { tail = seg; break; }
        }

        if (tail === this._tailSprite) return;   // degisim yok — cikis

        // Eski kuyrugu govdeye geri al (hala canliysa).
        if (this._tailSprite && this._tailSprite.scene && this._tailSprite.active) {
            SnakeSkin.applyTexture(this._tailSprite, SnakeTexture.BODY, this.skinId);
            SnakeSkin.setSpriteScale(this._tailSprite, this.scale, this._tailSprite._animScale ?? 1);
        }

        this._tailSprite = tail;
        if (tail) {
            SnakeSkin.applyTexture(tail, SnakeTexture.TAIL, this.skinId);
            // Doku degisti => normalizasyon carpani da degisti; olcek YENIDEN
            // yazilmalidir, aksi halde kuyruk bir kare boyunca govde olceginde
            // (yani ~%36 buyuk) cizilirdi.
            SnakeSkin.setSpriteScale(tail, this.scale, tail._animScale ?? 1);
        }
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
        // Tek sprite'lık gövdede boyun aynı zamanda KUYRUKTUR ve görsel kuyruk
        // ofsetiyle bilerek daha geride durur — kilitlemek ofseti silerdi.
        if (neck === this._tailSprite && (neck._tailBlend ?? 0) > 0) return;
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
    // GERİSİNDE sabit bir gecikme taşır (eski zaman tabanlı filtrede v·dt; uzamsal filtrede ≈ L)
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

    /**
     * M01 — ScaleGuard: otoriter olcegin TEK uygulama noktasi.
     *
     * DEGISMEMISSE HICBIR SEY YAPILMAZ. Bu bir mikro-optimizasyon degil,
     * tasarimin GEREGIDIR: sunucu donen keyframe'de degismemis degerleri
     * KASITLI olarak yeniden gonderir (kacirilmis gecersizlestirmeyi onarmak
     * icin). Guard olmasaydi keyframe, M01'in ortadan kaldirmak icin var
     * oldugu sprite-transform maliyetini geri getirirdi.
     *
     * KARSILASTIRMA `_canonicalScale` UZERINDEN, `this.scale` UZERINDEN DEGIL:
     * this.scale'i baska yollar da yazar (kurucu, buyume, hardResync), oysa
     * _canonicalScale yalnizca SUNUCUDAN gelen son degeri tutar. Karsilastirma
     * TAM esitliktir — epsilon YOK: olcek adimlari ~1/106'dir ve bir epsilon,
     * formul ileride daha ince adimlara ayarlanirsa mesru degisiklikleri
     * gizlerdi.
     *
     * NOT: yalnizca AG kaynakli olcek gecisini eler. Buyume/cokus animasyonu
     * (_updateSegmentLifecycle) ve yeni sprite baslatma (_acquireSegmentSprite)
     * AYRI cagri noktalaridir ve kare kare calismaya DEVAM eder.
     */
    applyCanonicalScale(canonical) {
        if (!Number.isFinite(canonical) || canonical <= 0) return;
        if (canonical === this._canonicalScale) return;   // keyframe / tekrar
        this._canonicalScale = canonical;
        this.scale = canonical;
        this._updateSegmentScaling();
    }

    updateFromServerState(entityData) {
        if (this.isPlayerControlled) return;

        const x = Number(entityData?.x);
        const y = Number(entityData?.y);
        const rawAngle = Number(entityData?.angle);

        if (Number.isFinite(x)) {
            this.networkTarget.x = x;
        }
        if (Number.isFinite(y)) {
            this.networkTarget.y = y;
        }
        if (Number.isFinite(rawAngle)) {
            this.networkTarget.angle = this._decodeServerAngle(rawAngle);
        }
        // M01: olcek ARTIK BURADA UYGULANMAZ — seyrek kanaldan gelir ve
        // applyCanonicalScale (ScaleGuard) uzerinden gecer. Eski kod, sunucu
        // olcegi her tick kosulsuz gonderdigi icin uzak yilan basina TUM cizili
        // segment sprite'larinin transformunu 60 Hz'de yeniden yaziyordu.

        // ── Ring buffer besleme ─────────────────────────────────────────
        // Paket doğrudan sprite'a UYGULANMAZ; damgalanıp tampona yazılır.
        // Aralık EMA'sı, varış jitter'ı, hız tahmini ve de-jitter saatinin
        // tamamı push() içinde güncellenir (bkz. EntityInterpolator.push).
        if (Number.isFinite(x) && Number.isFinite(y)) {
            this._interp.push(x, y, this.networkTarget.angle, performance.now());
        }

        this.hasServerState = true;
    }

    _updateSegmentScaling() {
        if (this.head) SnakeSkin.setSpriteScale(this.head, this.scale);

        this.segments.forEach(seg => {
            // Büyüme animasyonundaki segmentin ölçeği _animScale ile çarpılır —
            // aksi halde sunucu scale güncellemesi büyüme "pop"unu geri getirirdi.
            if (seg && seg.active) SnakeSkin.setSpriteScale(seg, this.scale, seg._animScale ?? 1);
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
        // Uzak yılan oynatma durumu: yükleme boyunca birikmiş örnekler
        // arasında interpolasyon, perde kalkınca geriye sarma üretirdi.
        this._interp.reset();

        // Baseline artık kesinlikle kurulu: reconciliation bir sonraki paketten
        // itibaren normal (yumuşatmalı) modda çalışır.
        this._hasSpawnBaseline = true;

        return { x, y };
    }

    updateSelfPositionFromServer(entityData) {
        const x = Number(entityData?.x);
        const y = Number(entityData?.y);
        const serverSeqId = Number(entityData?.lastProcessedSequenceId ?? entityData?.last_processed_sequence_id);

        // M01: olcek ARTIK BURADA UYGULANMAZ. SelfPosition.scale `optional`
        // oldugu icin varlik kontrolu cagiranda yapilir ve deger tek kapidan
        // (Game.applyAuthoritativeScale -> applyCanonicalScale) gecer.
        // Eski kod her tick kosulsuz _updateSegmentScaling() cagiriyordu.

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
