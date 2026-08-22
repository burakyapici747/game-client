import Phaser from 'phaser';
import { Snake } from './Snake';
import { VOID_BACKGROUND_COLOR } from './Preloader';
import { NetworkManager } from './../../network/NetWorkManager';
import { MobileControls } from './../ui/MobileControls';
import {
    showConnectingOverlay,
    updateConnectingPing,
    hideConnectingOverlay,
    showGameOverOverlay,
    hideAllGameOverlays,
    showGameHUD,
    hideGameHUD,
    updateHUDStats,
    updateHUDScore,
    updateHUDLeaderboard,
} from './../../ui/overlays.js';

// Note: updateHUDLeaderboard is called with empty array [] to trigger
// the default mockup data initialization in overlays.js
const FOOD_COLOR_COUNT = 16; // Preloader'daki renk varyant sayısı

// ── YEM DOKUSU (GÖREV 1: hepsi parlayan DAİRE) ───────────────────────────────
// Polygon şekiller kaldırıldı; tüm yemler tek 'food_glow' dairesi kullanır.
const FOOD_GLOW_TEXTURE = 'food_glow';

// ── YEM ŞİMMER/GLOW (GÖREV 2) ────────────────────────────────────────────────
// Yüksek performanslı parıltı: 4000 yem için parçacık-emitter YERİNE (bu, node
// başına emitter/parçacık maliyetiyle 120fps'i çökertirdi) tek havuzlanmış
// Blitter + additive blend + her yeme faz-kaymalı alpha nabzı (twinkle). Ekstra
// draw-call YOK (Blitter tek çizim); maliyet mevcut yem döngüsünde bir sin/alpha.
const FOOD_SHIMMER_HZ = 1.6;      // nabız frekansı (saniyedeki döngü)
const FOOD_SHIMMER_MIN_ALPHA = 0.62; // en sönük an
const FOOD_SHIMMER_AMP = 0.38;    // 0.62 → 1.0 arası salınım

// ── BİRLEŞİK YEME + MAGNET EŞİĞİ (client ⇄ server sözleşmesi) ────────────────
// SUNUCU AYNASI — game-server FoodConfig.eatRadiusPx ile BİREBİR:
//   radius = min(MAX, BASE · (1 + (scale-1)·GAIN))
// Bu, HEM çekim (R_magnet) HEM de yeme (R_eat) eşiğidir — TEK, birleşik değer
// (rubber-band önlemi). GÖREV 3: menzil ~%30 büyütüldü (BASE 45→60, MAX 100→130)
// → suck-in daha erken tetiklenir, yeme daha akıcı hissedilir. Sunucu FoodConfig
// ile SİMETRİK güncellendi (desync yok).
const FOOD_EAT_RADIUS_BASE_PX = 60.0;
const FOOD_EAT_RADIUS_SCALE_GAIN = 0.35;
const FOOD_EAT_RADIUS_MAX_PX = 130.0;
function foodEatRadiusPx(scale) {
    const s = (Number.isFinite(scale) && scale > 0) ? scale : 1.0;
    return Math.min(FOOD_EAT_RADIUS_MAX_PX,
        FOOD_EAT_RADIUS_BASE_PX * (1 + (s - 1) * FOOD_EAT_RADIUS_SCALE_GAIN));
}

// ── MANYETİK YEME UÇUŞU ──────────────────────────────────────────────────────
// Basit ve anlık: yem eşiğe girdiği anda kafa MERKEZİNE frame-rate-agnostik
// üstel lerp ile SNAP eder (eğri/gecikmeli ivme yok — hedef her frame güncel
// kafa merkezi olduğundan kafa yemi geçse bile yem asla arkada süzülmez/orbit
// yapmaz), eşzamanlı olarak ölçek ZAMANA bağlı (mesafeye DEĞİL) ~100ms'de 0'a
// çöker. Ölçek biter ya da yem kafa merkezine değer değmez sprite yok edilir.
const FOOD_MAGNET_SNAP_RATE = 30;   // üstel çekim: k = 1 - e^(-30·dt) (~%39/frame @60fps)
const FOOD_EAT_SHRINK_MS = 100;     // ölçek 1 → 0 çöküş süresi (80–120ms bandı)
const FOOD_EAT_DESTROY_DIST = 6;    // px — kafa merkezine bu kadar yaklaşınca imha

// ── TAHMİN UZLAŞTIRMA (pending-consumption) ──────────────────────────────────
// Oyuncu bir yemi tahminle yediğinde, sunucu onayına (FOOD_REMOVE) kadar
// pending katmanında tutulur; onay gelince kayıt düşer (çift sayım olmaz).
// Bu süre yalnızca kaydın ne kadar bekletileceğini belirler — süre dolması
// tahminin REDDEDİLDİĞİ anlamına GELMEZ, yalnızca onayın geciktiği anlamına
// gelir. Bu yüzden süre aşımında skor geri alınmaz ve yem diriltilmez
// (bkz. update() içindeki ayrıntılı not).
const FOOD_PREDICTION_TIMEOUT_MS = 1000;

// ── GİRDİ AÇI SLEW-RATE LIMITER (client ⇄ server hedef-açı sözleşmesi) ──────
//
// KÖK NEDEN — GİRDİ AKIŞI ALIASING'İ, "istemci snap'liyor sunucu snap'lemiyor"
// DEĞİL. İki taraf da dönüşü ω_max ile kelepçeler ve sabitler birebir aynıdır
// (TURN_ANGLE_BASE 3.3, scale/speed faktörleri — bkz. Snake.getTurnRateRadPerSec
// ⇄ server SnakeDynamicsSystem). Ayrışan şey KELEPÇE değil, iki simülasyonun
// BESLENDİĞİ HEDEF AÇI DİZİSİDİR:
//
//   1) Yerel tahmin hedef açıyı HER RENDER KARESİNDE tüketir (60–144 Hz).
//   2) Ağ gönderimi 30 Hz'e kısılmıştır (NetworkManager.angleSendIntervalMoving)
//      — yalnızca zamanlayıcının dolduğu ANDAKİ örnek gider, aradakiler ATILIR.
//   3) Sunucu, tick başına kanal başına TEK açı tutar (last-write-wins;
//      Game.java → bufferedAngleInputByChannel.put) ve 60 Hz'de boşaltır.
//
// Hedef açı yavaş değişirken (normal oyun) bu üç eleme kayıpsızdır: ardışık
// örnekler zaten birbirine yakındır. Ama oyuncu fareyi silkelediğinde hedef
// sinyali ~10 Hz'in üstünde enerji taşır; client TAM diziyi, sunucu ise onun
// rastgele fazlı 30 Hz alt-örneğini entegre eder. İKİ FARKLI GİRDİ → İKİ FARKLI
// YÖRÜNGE. Fark süre boyunca birikir ve paket geldiğinde reconciliation onu
// kapatmak zorunda kalır: ekrandaki sert kayma/snap budur.
//
// ÇÖZÜM — hedef açıyı GÖNDERİMDEN ÖNCE bant-sınırlı hale getir. İki kısıt:
//
//   (A) SLEW: |θ_t − θ_{t−1}| ≤ ω_max · dt   → ağa giden sinyal artık yılanın
//       fiziksel dönüş hızından hızlı değişemez. 30 Hz örneklemede ardışık
//       örnekler arası fark en fazla ω_max·33ms ≈ 7° olur (π yerine) — aliasing
//       hatası ~25 kat düşer.
//   (B) LEAD: |θ_t − heading| ≤ ω_max · LEAD_SEC → hedef, ULAŞILABİLİR olanın
//       çok ilerisine kaçamaz. "Baş 0°'ye bakarken hedef 180°" durumu (mevcut
//       kodun 0.83 sn boyunca sürdürdüğü hâl) yapısal olarak imkânsızlaşır.
//
// DÖNÜŞ HIZI YAVAŞLAMAZ: referans (heading) dönüş sırasında zaten ω_max ile
// ilerlediğinden, hedef de ω_max ile ilerler; sadece SABİT bir faz kadar önde
// durur. LEAD_SEC bilerek gönderim aralığından (33 ms) ve bir sunucu tick'inden
// (16.7 ms) büyük seçilir: aksi halde sunucu hedefe erişip bir sonraki pakete
// kadar BEKLER (merdiven duraklaması) ve dönüş gerçekten yavaşlardı.
const STEER_LIMITER = {
    // Hedefin heading'i geçebileceği azami faz (sn cinsinden ω_max çarpanı).
    // 80 ms ≈ 33 ms gönderim aralığı + 16.7 ms sunucu tick + jitter payı.
    // ω_max=3.8 rad/s'de ≈ 0.30 rad (17°) tavan sapma.
    LEAD_SEC: 0.080,

    // ── Ani ters çevirme (flick) tespiti ────────────────────────────────────
    // Bu pencereden kısa sürede, bu eşikten büyük ve ÖNCEKİNİN TERSİ yönde bir
    // ham açı sıçraması "silkeleme" sayılır. Tek bir hızlı ama TUTARLI dönüş
    // (oyuncunun gerçekten istediği manevra) yön değiştirmediği için tetiklemez.
    FLICK_WINDOW_MS: 50,
    FLICK_STEP_RAD: 0.9,        // ~52° — tek karede bu kadar ham sıçrama
    FLICK_GAIN: 0.55,           // her tespit ajitasyonu bu kadar yükseltir
    AGITATION_DECAY_SEC: 0.28,  // τ — silkeleme bitince bu sabitle söner

    // Ajitasyon 0 iken filtre ŞEFFAF olsun diye üst oran yüksek (τ≈25 ms:
    // normal dönüşte hissedilmez), 1 iken ağır sönümlü (τ≈167 ms: salınım
    // ortalamaya oturur ve ters kadranlar arası zıplama biter).
    SMOOTH_RATE_CALM: 40,       // 1/s
    SMOOTH_RATE_AGITATED: 6,    // 1/s
    AGITATION_EPSILON: 0.02,    // bunun altında filtre tamamen atlanır

    // Filtrelenmiş hedef bu kadar değiştiyse paket ÜRETİLMELİDİR: ham girdi
    // sabitlenmiş olsa bile limiter hâlâ ona doğru süzülüyor olabilir ve o
    // hareket sunucuya bildirilmezse iki taraf ayrışır. 0.012 rad ≈ 0.7° =
    // ağ kuantasının (1.44°) yarısı — yani "bir kova değişimi" eşiği.
    WIRE_EPSILON_RAD: 0.012,
};

// ── AOI DEBUG OVERLAY (sunucu görünürlük sınırının görselleştirilmesi) ──────
// Sunucu algoritması: AOICalculationSystem.fillAoiMask — AOI, oyuncunun
// KAFASINA değil, kafanın bulunduğu SEKTÖRE merkezlenmiş 5x5 sektörlük
// bloktur ve sektör GRID'ine hizalıdır: kafa bir sektör çizgisini geçtiği
// anda sınır bir sektör kayar (sürekli kayan bir kutu DEĞİLDİR — despawn
// eşiğini doğrulamak için bunu aynen çizmek gerekir).
// SENKRON SÖZLEŞMESİ: SECTOR_COUNT_* ve AOI_SECTOR_RADIUS sunucudaki
// MapConfig.SECTOR_COUNT_X/Y (30) ve AOICalculationSystem.AOI_SECTOR_RADIUS
// (±2) ile BIREBIR aynı tutulmalıdır. Sektör boyutu = dünya / 30 ≈ 666.67px,
// yani 5x5 blok ≈ 3333px kenarlı bir kare.
// Y-EKSENİ NOTU: sunucu sektör satırını metre uzayında (Y-yukarı) hesaplar,
// client piksel uzayında (Y-aşağı) çizer; grid tam 30 satır olduğundan sınır
// çizgileri çakışır ve "oyuncunun sektörü ± R" bloğu ayna-değişmezidir —
// piksel uzayında çizilen dikdörtgen geometrik olarak birebir doğrudur.
// MENZİL NOTU: bu kutu SEGMENT tabanlı görünürlüğü gösterir (tam konum, ±R).
// Kafa-kafaya menzil bunun İKİ KATIDIR: SectorIndexSystem her kafayı kendi
// AOI maskesinin tüm sektörlerine kaydeder, dolayısıyla iki kafa 2*R sektör
// mesafesine kadar birbirini görür. Kutunun dışındaki bir yılanın hâlâ
// replike ediliyor olması bu yüzden bug değildir.
const AOIDebugConfig = {
    // Başlangıç durumu. O tuşu ile aç/kapa; ayrıca sayfa yüklenmeden önce
    // `window.DEBUG_AOI = true` verilirse overlay açık başlar.
    SHOW_AOI_DEBUG: (typeof window !== 'undefined' && window.DEBUG_AOI === true),
    TOGGLE_KEY: 'keydown-O',
    SECTOR_COUNT_X: 30,        // sunucu: MapConfig.SECTOR_COUNT_X
    SECTOR_COUNT_Y: 30,        // sunucu: MapConfig.SECTOR_COUNT_Y
    // SUNUCU İLE BİREBİR: AOICalculationSystem.AOI_SECTOR_RADIUS.
    // 1 → 3x3 (9 sektör), 2 → 5x5 (25 sektör). Orada değişirse BURASI da
    // değişmelidir; aksi halde overlay gerçek görünürlük alanını yanlış çizer.
    AOI_SECTOR_RADIUS: 2,      // sunucu: fillAoiMask → merkez ± 2 sektör (5x5)
    OUTLINE_COLOR: 0x39ff14,   // neon yeşil
    OUTLINE_ALPHA: 0.9,
    OUTLINE_WIDTH: 2,
    FILL_ALPHA: 0.03,          // gameplay görsellerini örtmeyecek kadar soluk
    CURRENT_SECTOR_ALPHA: 0.35, // oyuncunun mevcut sektörü (ince iç çizgi)
    DASH_LENGTH: 14,
    GAP_LENGTH: 10,
};

// Perde kalktıktan sonraki siyahtan-açılma süresi (ms). Kısa tutulur: amaç
// bir "sahne geçişi" hissi vermek değil, hizalanmış ilk karenin ani belirmesini
// yumuşatmak. Girdi tam da bu süre dolduğunda açılır (bkz. _revealGameplay).
const REVEAL_FADE_MS = 250;

export class Game extends Phaser.Scene {
    constructor() {
        super('Game');
        this.snakes = new Map();
        this.foods = new Map();
        this.eatingFoods = new Map();
        // Pending-consumption katmanı: tahminle yenmiş ama sunucu onayı beklenen
        // yemler. foodId → { predictedAtMs }. Onay (FOOD_REMOVE) gelince silinir;
        // süre aşımında yalnızca kayıt düşer (skor/yem geri alınmaz).
        this.pendingConsumption = new Map();
        this.foodBlitter = null; // Tüm yemler için tek havuzlanmış Blitter (tek draw call)
        this.pendingSegmentMutations = new Map();
        // İlk karşılaşma path tohumları: tohum, yılanı yaratan EntityCollection
        // emit'inden ÖNCE gelebildiği için entityId → seed olarak beklemeye alınır.
        this.pendingPathSeeds = new Map();
        this.myId = null;
        this.networkManager = null;
        this.gameStarted = false;
        this.initialDataFlags = { startInfo: false, entities: false };

        this.pointer = null;
        this.fpsText = null;
        this.grid = null;
        this.minimapGraphics = null;
        this.worldRadius = 0;

        // Client-side score tracking: yenen yemin sunucudan gelen value'suna göre puan
        this.playerScore = 0;
        this.foodsEaten = 0;
        // Otoriter skor akisi basladi mi (bkz. onSelfPosition / onLeaderboardUpdate).
        this._hasAuthoritativeScore = false;

        // AOI debug overlay durumu
        this.aoiDebugGraphics = null;
        this.showAoiDebug = AOIDebugConfig.SHOW_AOI_DEBUG;
        this._aoiDebugLastSector = { cx: -1, cy: -1 }; // sektör değişmedikçe yeniden çizme
    }

    create() {
        // scene.restart() (Play Again) constructor'ı YENİDEN ÇALIŞTIRMAZ —
        // önceki tura ait tüm state burada sıfırlanmalı, yoksa eski (destroy
        // edilmiş) GameObject referansları yeni tura sızar.
        this.snakes = new Map();
        this.foods = new Map();
        this.eatingFoods = new Map();
        this.pendingConsumption = new Map();
        this.pendingSegmentMutations = new Map();
        // İlk karşılaşma path tohumları: tohum, yılanı yaratan EntityCollection
        // emit'inden ÖNCE gelebildiği için entityId → seed olarak beklemeye alınır.
        this.pendingPathSeeds = new Map();
        this.myId = null;
        this.foodBlitter = null;
        this.grid = null;
        this.boundaryGraphics = null;
        this.worldRadius = 0;

        this.playerScore = 0;
        this.foodsEaten = 0;
        // Otoriter skor akisi basladi mi (bkz. onSelfPosition / onLeaderboardUpdate).
        this._hasAuthoritativeScore = false;

        // Input-delay kuyruğu — restart'ta önceki tura ait girdiler sızmasın.
        this._inputDelayQueue = [];
        this._lastDelayedInput = null;
        // Steering deadzone/epsilon guard'inin son TAAHHUT edilen aci degeri (rad).
        // Bu acidan MIN_ROTATION_RADIUS ya da ANGLE_EPSILON altinda kalan girdi
        // ne yerel tahmini ne de agi gunceller. Respawn'da sifirlanmali.
        // Spawn'da sunucunun verdigi baslangic yonuyle TOHUMLANIR (onStartGame).
        this._lastCommittedAngleRad = null;

        // Sunucunun StartInformation'da verdigi baslangic yonu (rad). Girdi
        // katmani, oyuncu gercekten yon verene kadar bu acida kalir.
        this._spawnHeadingRad = null;

        // ── POINTER STEERING ARMING (masaustu) ──────────────────────────────
        // input.activePointer spawn aninda oyuncunun SON fare konumunu tasir —
        // cogu zaman PLAY dugmesinin oldugu yer ya da fare hic canvas'a
        // girmediyse (0, 0). Eski akis ilk update() karesinde o bayat noktaya
        // dogru bir aci hesaplayip HEM yerel tahmine HEM aga gonderiyordu:
        // yilan, sunucunun verdigi spawn yonunu birakip aninda imlecin oldugu
        // yone donuyordu ("spawn'da yanlis yone bakma").
        //
        // Artik pointer yalnizca oyuncu fareyi GERCEKTEN oynattiktan sonra
        // direksiyonu devralir; o ana kadar sunucunun spawn yonu korunur ve
        // aga aci paketi uretilmez.
        this._pointerSteeringArmed = false;

        // ── SLEW-RATE LIMITER DURUMU (bkz. STEER_LIMITER) ───────────────────
        // angle      : ağa ve tahmine giden SON filtrelenmiş hedef açı (rad).
        //              null = henüz tohumlanmadı; ilk kare ham açıya oturur.
        // lastRawRad : ham fare açısının bir önceki kare değeri — flick tespiti
        //              ADIM YÖNÜNÜ karşılaştırdığı için gereklidir.
        // lastRawTime: o ölçümün zaman damgası (ms) — sıçramanın FLICK_WINDOW_MS
        //              içinde olup olmadığı buradan bilinir.
        // lastRawStep: bir önceki ham adım (işaretli) — ardışık adımların
        //              işareti değişiyorsa bu bir ters çevirmedir (salınım),
        //              aynı kalıyorsa oyuncunun tutarlı bir manevrasıdır.
        // agitation  : [0..1] silkeleme şiddeti; sönümleme oranını belirler.
        // (scene.restart() constructor'ı yeniden koşturmaz — sıfırlama BURADA
        // yapılmalı, yoksa önceki turun filtre durumu yeni tura sızar.)
        this._resetSteeringLimiter(null);

        this.gameStarted = false;
        // selfBaseline: oyuncunun İLK otoriter SelfPosition karesi uygulandı mı.
        // Perde (loading veil) YALNIZCA bu da true olduğunda kalkar — aksi halde
        // oyuncu, sunucunun çoktan ilerlettiği duruma yetişen bir yılan görürdü.
        this.initialDataFlags = { startInfo: false, entities: false, selfBaseline: false };

        // ── REVEAL PIPELINE DURUMU ──────────────────────────────────────────
        // Girdi, fade-in TAMAMLANDIĞI anda açılır (bkz. _revealGameplay).
        // O ana kadar tahmin çalışır ama oyuncunun fare/joystick girdisi
        // OKUNMAZ: perde ardında verilen bir yön, perde kalkar kalkmaz
        // beklenmedik bir dönüş olarak görünürdü.
        this._inputEnabled = false;
        this._revealStarted = false;
        this.networkManager = new NetworkManager(this);
        // Restart/kapanışta eski soketi sessizce kapat (yeni tura 'disconnected' sızmasın)
        this.events.once('shutdown', () => this.networkManager?.disconnect());

        // ── Tab Visibility (sekme değişimi) resync ──────────────────────────
        // Sekme gizliyken rAF durur ama sunucu simülasyona devam eder. Geri
        // dönüşte dev delta + yüzlerce piksellik fark, kademeli reconciliation
        // düzeltmeleriyle 'sarsılma/titreme' olarak görünüyordu. Görünür olur
        // olmaz otoriter duruma TEK seferde hizalanıyoruz.
        this._onVisibilityChange = () => {
            if (document.visibilityState === 'visible') this._resyncAfterTabReturn();
        };
        document.addEventListener('visibilitychange', this._onVisibilityChange);
        this.events.once('shutdown', () =>
            document.removeEventListener('visibilitychange', this._onVisibilityChange));

        // Fare GERÇEKTEN oynadığında direksiyonu pointer'a devret (bkz.
        // _pointerSteeringArmed). Referans saklanır ki shutdown'da kaldırılabilsin —
        // inline arrow'lar off() ile sökülemez ve restart'ta üst üste birikir.
        this._onPointerMove = () => { this._pointerSteeringArmed = true; };
        this.input.on('pointermove', this._onPointerMove, this);
        this.events.once('shutdown', () =>
            this.input.off('pointermove', this._onPointerMove, this));

        this.events.on('start_game', this.onStartGame, this);
        this.events.on('self_position', this.onSelfPosition, this);
        this.events.on('entity_collection', this.onEntityCollection, this);


        this.events.on('segment_mutation_collection', this.onSegmentMutationCollection, this);
        this.events.on('path_seed_collection', this.onPathSeedCollection, this);
        this.events.on('food_collection', this.onFoodCollection, this);
        this.events.on('food_mutation_collection', this.onFoodMutationCollection, this);
        this.events.on('remove_entity', this.onRemoveEntity, this);
        this.events.on('disconnected', this.onDisconnected, this);
        this.events.on('death_notification', this.onDeathNotification, this);
        this.events.on('leaderboard_update', this.onLeaderboardUpdate, this);

        // NetworkManager'ın pong başına yaydığı yumuşatılmış (EMA) RTT değeri.
        // Connecting overlay'i açıksa oradaki PING metriği de canlı güncellenir.
        this.currentPingMs = null;
        // Stored reference (arrow) so it can be removed on shutdown — inline
        // arrow'lar off() ile kaldirilamaz ve restart'ta ust uste birikir.
        this._onPingUpdate = (ms) => {
            this.currentPingMs = ms;
            updateConnectingPing(ms);
        };
        this.events.on('ping_update', this._onPingUpdate, this);

        // Restart/kapanışta açık kalan HTML overlay'leri temizle.
        this.events.once('shutdown', () => hideAllGameOverlays());

        // Physics step SONRASI, render ÖNCESİ: segmentler ve gözler head'in gerçek
        // fiziksel pozisyonuyla senkronize edilir. update() içinde physics henüz
        // çalışmadığından oradan çağrılmak 1 frame gecikmeye (esniyor hissi) yol açıyordu.
        this.events.on('postupdate', this._onPostUpdate, this);

        // ── LISTENER TEARDOWN (respawn +2 / cift-islem fix) ──────────────────
        // scene.restart() ayni scene ornegini ve ayni this.events emitter'ini
        // yeniden kullanir; Phaser Systems.shutdown() ozel dinleyicileri
        // KALDIRMAZ. create() her respawn'da yeniden kostugundan, asagidaki
        // .on() kayitlari temizlenmezse her yasamda bir kopya daha birikir:
        // tek 'segment_mutation_collection' paketi iki (sonra uc...) kez islenir
        // -> yem basina +2, hem yerel hem uzak yilanlarda sisme. Her yasamin
        // dinleyicilerini kendi shutdown'inda sokerek TAM BIR set garanti edilir.
        this.events.once('shutdown', () => {
            this.events.off('start_game', this.onStartGame, this);
            this.events.off('self_position', this.onSelfPosition, this);
            this.events.off('entity_collection', this.onEntityCollection, this);
            this.events.off('segment_mutation_collection', this.onSegmentMutationCollection, this);
            this.events.off('path_seed_collection', this.onPathSeedCollection, this);
            this.events.off('food_collection', this.onFoodCollection, this);
            this.events.off('food_mutation_collection', this.onFoodMutationCollection, this);
            this.events.off('remove_entity', this.onRemoveEntity, this);
            this.events.off('disconnected', this.onDisconnected, this);
            this.events.off('death_notification', this.onDeathNotification, this);
            this.events.off('leaderboard_update', this.onLeaderboardUpdate, this);
            this.events.off('ping_update', this._onPingUpdate, this);
            this.events.off('postupdate', this._onPostUpdate, this);
        });

        this.networkManager.connect();

        // ── Responsive camera setup ─────────────────────────────────────────
        // Phaser's Scale.RESIZE mode resizes the canvas/game size to fill the
        // parent element, but it does NOT automatically resize the main camera's
        // viewport — leaving it at the size it was created with. On mobile this
        // produced the "heavily zoomed-in" bug: the camera kept a desktop-sized
        // viewport while the actual screen (and HUD: joystick/boost/minimap) was
        // much smaller, drastically shrinking the player's effective field of view.
        // We keep the camera viewport in sync with the live game size, and derive
        // a base zoom factor from the screen's pixel area so smaller (mobile)
        // screens zoom OUT to preserve a comparable field of view to desktop.
        // Self-heal: if the ScaleManager's snapshot has drifted from the real
        // parent size (e.g. boot raced a keyboard/viewport transition on
        // mobile), force a re-measure. refresh() emits 'resize', which lands
        // in handleResize below and re-syncs camera/grid/controls.
        const ps = this.scale.parentSize;
        if (ps.width && ps.height &&
            (this.scale.width !== ps.width || this.scale.height !== ps.height)) {
            this.scale.refresh();
        }

        this.cameras.main.setSize(this.scale.width, this.scale.height);
        this.baseZoom = this.computeBaseZoom();
        this.cameras.main.setZoom(this.baseZoom).setRoundPixels(false);

        // Kamera harita dışına çıkabildiği için (bkz. onStartGame →
        // removeBounds) zemin rengi ızgara dokusuyla AYNI olmalı. Motorun
        // varsayılan #202020 gri zemini, ızgara karosunun kaplayamadığı
        // alt-piksel kenarlarda gri bir şerit olarak görünürdü.
        this.cameras.main.setBackgroundColor(VOID_BACKGROUND_COLOR);

        // ── DÜNYA KAMERASI PERDE ARDINDA KAPALI ─────────────────────────────
        // Sunucu, oyuncu daha yükleme ekranını izlerken yılanı simüle etmeye
        // başlar ve konum paketleri arka planda akar. Dünya kamerası açık
        // kalsaydı, HTML perdesinin kalktığı kare ile hizalamanın tamamlandığı
        // kare arasında CANLI (henüz hizalanmamış) durum bir an görünebilirdi.
        // Kamera _revealGameplay'de, hizalama BİTTİKTEN sonra açılır.
        // (HUD'u çizen uiCamera etkilenmez; HUD'un kendi gizleme yolu var.)
        this.cameras.main.setVisible(false);

        // ── Zoom-independent UI camera ──────────────────────────────────────
        // Camera zoom scales scrollFactor(0) objects too: with mobile baseZoom
        // ~0.5 the whole HUD (grid background, FPS text, minimap, joystick/
        // boost touch zones) rendered shrunken into a centered rectangle, and
        // — because input hit-testing goes through the same camera transform —
        // touches only registered inside that rectangle. The fix: a second
        // camera at zoom 1 renders (and hit-tests) HUD objects exclusively.
        // The zoomed main camera ignores HUD; the UI camera ignores the world.
        this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
        this.uiCamera.setScroll(0, 0);

        this.scale.on('resize', this.handleResize, this);
        this.events.once('shutdown', () => this.scale.off('resize', this.handleResize, this));

        // ── AOI debug overlay ───────────────────────────────────────────────
        // Dünya uzayında çizilir (registerWorld → ana kamera render eder,
        // UI kamerası yok sayar); zoom/scroll ile birlikte hareket eder.
        this.aoiDebugGraphics = this.registerWorld(
            this.add.graphics().setDepth(4500).setVisible(this.showAoiDebug)
        );
        this.input.keyboard?.on(AOIDebugConfig.TOGGLE_KEY, () => {
            this.showAoiDebug = !this.showAoiDebug;
            this.aoiDebugGraphics?.setVisible(this.showAoiDebug);
            this._aoiDebugLastSector.cx = -1; // yeniden açılışta zorunlu tam çizim
            this._aoiDebugLastSector.cy = -1;
            if (!this.showAoiDebug) this.aoiDebugGraphics?.clear();
            console.log(`[AOI-DEBUG] Overlay ${this.showAoiDebug ? 'AÇIK' : 'KAPALI'}`);
        });

        // ── Mobile controls (Phaser GameObjects — no DOM) ───────────────────
        // Built directly in the scene so it has zero dependency on src/main.js
        // timing/DOM and renders with this.add.circle()/this.add.zone(), as
        // required. window.mobileInput is populated by MobileControls and read
        // by this scene's update() loop below — that contract is unchanged.
        this.mobileControls = null;
        if (this.sys.game.device.input.touch) {
            this.mobileControls = new MobileControls(this);
        }
        this.events.once('shutdown', () => {
            this.mobileControls?.destroy();
            this.mobileControls = null;
        });

        // Legacy FPS text removed — HUD now uses HTML/CSS overlay
        // this.fpsText = this.add.text(4, 4, 'FPS: 0', { ... }).setScrollFactor(0).setDepth(1000);
        this.fpsText = null;

        this.minimapGraphics = this.add.graphics().setScrollFactor(0).setDepth(2000);

        this.registerHUD(this.minimapGraphics);

        // Sunucudan GEÇERLİ bir sıralama paketi işlendi mi? Restart'ta Phaser
        // sahne örneğini yeniden kullandığı için bayrak create() içinde
        // sıfırlanmalı — aksi halde yeni turda eski turun bayrağı taşınır ve
        // onStartGame'deki boş-çerçeve yedeği hiç çalışmaz.
        this.leaderboardReady = false;

        // Bağlantı öncesi yer tutucu liste. null → overlays.js "Connecting…"
        // çizer; ilk gerçek 'leaderboard_update' paketi geldiğinde tamamen
        // değişir. (Eskiden [] geçiliyordu; artık boş dizi GEÇERLİ bir
        // "0 oyuncu" sıralaması anlamına geldiği için yer tutucu ile
        // karışmamalı.)
        updateHUDLeaderboard(null);

        // Bağlantı ekranı artık Phaser içinde çizilmiyor — HTML/CSS overlay
        // (bkz. index.html #connecting-overlay + src/ui/overlays.js).
        showConnectingOverlay(
            window.gameSettings?.serverName,
            window.gameSettings?.menuPingMs ?? null
        );
    }

    // ── Camera routing helpers ──────────────────────────────────────────────
    // Every display object must be claimed by exactly one camera:
    //   HUD (screen-space)  → rendered/hit-tested by uiCamera only
    //   World (game-space)  → rendered by the zoomed main camera only
    registerHUD(...objs) {
        this.cameras.main.ignore(objs);
        return objs;
    }

    registerWorld(obj) {
        if (this.uiCamera && obj) this.uiCamera.ignore(obj);
        return obj;
    }

    // Derives a base camera zoom from the live screen's SMALLER dimension,
    // relative to a 720px desktop-portrait reference. Mobile phones in
    // landscape have a short dimension (height) far below any desktop
    // viewport, and that short dimension is what actually limits FOV — an
    // area-based formula under-corrected for narrow/short mobile screens and
    // still left the camera noticeably over-zoomed. Using min(width,height)
    // zooms out aggressively on phones while leaving desktop/tablet (where the
    // short dimension is already >= the reference) at zoom 1.0, unchanged.
    computeBaseZoom() {
        const REFERENCE_MIN_DIM = 720;
        const MIN_ZOOM = 0.45;
        const MAX_ZOOM = 1.0;

        const width = this.scale.width;
        const height = this.scale.height;
        if (!width || !height) return 1.0;

        const minDim = Math.min(width, height);
        return Phaser.Math.Clamp(minDim / REFERENCE_MIN_DIM, MIN_ZOOM, MAX_ZOOM);
    }

    // Keeps the camera viewport, background grid, minimap and any still-visible
    // loading UI in sync whenever the game/canvas size changes — e.g. mobile
    // orientation changes or the browser address bar showing/hiding (which
    // changes window.innerHeight after the page has already loaded).
    handleResize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;
        if (!width || !height) return;

        this.cameras.main.setSize(width, height);
        this.uiCamera?.setSize(width, height);
        this.baseZoom = this.computeBaseZoom();

        // (grid is world-space now — update() re-fits it to the camera's
        // worldView every frame, so no screen-size sync is needed here.)

        this.mobileControls?.resize(width, height);

        // (Connecting/Game Over ekranları HTML/CSS overlay — CSS kendisi
        // responsive olduğundan burada yeniden konumlandırma gerekmiyor.)
    }

    // (createLoadingUI kaldırıldı — bağlantı ekranı artık HTML/CSS overlay,
    // bkz. index.html #connecting-overlay ve src/ui/overlays.js.)

    onStartGame(startInfo) {
        console.log("onStartGame Alındı:", startInfo);
        const clientId = this.toId(startInfo?.clientId ?? startInfo?.client_id);
        if (clientId === null) {
            console.warn('Geçersiz clientId alındı:', startInfo);
            return;
        }

        this.myId = clientId;
        this.initialDataFlags.startInfo = true;

        // ── GİRDİ / TAHMİN TAMPONLARINI SPAWN ONAYINDA SIFIRLA ──────────────
        // Bu paket "yeni tur başlıyor" demektir. Önceki tura (ya da bağlantı
        // öncesi kareye) ait gecikmeli girdiler kuyrukta kalırsa, spawn'dan
        // hemen sonra eski bir açı uygulanır ve yılan bir anlığına yanlış yöne
        // sapar. Kuyruk + son uygulanan girdi + taahhüt edilen açı burada
        // tamamen düşürülür.
        this._inputDelayQueue = [];
        this._lastDelayedInput = null;
        this._lastCommittedAngleRad = null;
        this._pointerSteeringArmed = false;
        // Slew-rate limiter da bu tura ait DEĞİL: önceki turun filtrelenmiş
        // hedefi ve ajitasyon skoru kalırsa, yeni yılan spawn yönü yerine
        // ölmüş yılanın son bakış açısına doğru süzülmeye başlardı. Aşağıda
        // spawn yönü okunduğunda o açıya TOHUMLANIR.
        this._resetSteeringLimiter(null);

        const startX = Number(startInfo?.x);
        const startY = Number(startInfo?.y);
        const startSegmentCount = Number(startInfo?.segmentCount ?? startInfo?.segment_count);
        const startScale = Number(startInfo?.scale ?? 1.0);
        const worldRadius = Number(startInfo?.worldRadius ?? startInfo?.world_radius);
        const startDirection = Number(startInfo?.startDirection ?? startInfo?.start_direction ?? 0);

        // ── GİRDİ KATMANINI SUNUCUNUN SPAWN YÖNÜNE TOHUMLA ──────────────────
        // Sunucu yılanı rastgele bir yöne bakar halde yaratır (bkz. server
        // Game.createPlayer → start_direction) ve kendi simülasyonunda hem
        // currentAngle hem targetAngle bu yöndedir. Client aynı yönde
        // başlamazsa iki simülasyon daha ilk kareden ayrışır: sunucu düz
        // giderken client döner, aradaki fark reconciliation'a hata olarak
        // yansır ve ilk saniyelerde düzeltme olarak geri boşalır.
        //
        // 0 rad'a ya da uydurma bir vektöre ASLA düşülmez: değer okunamazsa
        // tohumlama yapılmaz ve girdi katmanı yılanın kendi head.rotation'ını
        // (Snake ctor'da yine sunucu açısıyla kurulmuştur) kullanır.
        const spawnHeadingRad = Number.isFinite(startDirection)
            ? Snake.decodeServerAngle(startDirection)
            : null;
        if (Number.isFinite(spawnHeadingRad)) {
            this._spawnHeadingRad = spawnHeadingRad;
            // Deadzone/epsilon guard'ının referansı da spawn yönüdür: oyuncu
            // fareyi oynatana kadar "değişiklik yok" kabul edilir, açı paketi
            // üretilmez ve yerel tahmin sunucuyla aynı yönde kalır.
            this._lastCommittedAngleRad = spawnHeadingRad;
            // Limiter aynı yönle tohumlanır: oyuncu direksiyonu devraldığı ilk
            // karede filtre doğru yerden başlar, sıfırdan süzülmez.
            this._resetSteeringLimiter(spawnHeadingRad);
        }

        if (Number.isFinite(worldRadius)) {
            this.worldRadius = worldRadius;
            const worldSize = worldRadius * 2;

            // ── KAMERA SINIRI YOK (oyuncu HER ZAMAN ekran merkezinde) ────────
            // Eskiden burada setBounds(0, 0, worldSize, worldSize) vardı.
            // Phaser, useBounds açıkken her preRender'da scrollX/scrollY'yi
            // clampX/clampY ile sınırın içine kelepçeler. Sonuç: oyuncu haritanın
            // kenarına veya köşesine yaklaştığında kamera durur, yılan ekranın
            // ortasından ayrılıp kenara doğru kayar — takip "kopmuş" hissi verir.
            //
            // removeBounds() useBounds'u kapatır; kamera artık kafayı harita
            // dışına taşsa bile merkezde tutar. Sınır DIŞINDA kalan alan boş
            // kalmaz: ızgara arka planı her karede kameranın worldView'ine göre
            // yeniden konumlanır (bkz. update() → this.grid) ve kameranın zemin
            // rengi ızgarayla aynı tondur (bkz. create() → VOID_BACKGROUND_COLOR),
            // dolayısıyla siyah boşluk/yırtılma oluşmaz.
            this.cameras.main.removeBounds();

            // Physics world bounds'u görsel sınırın çok ötesinde tut ki arcade
            // body'ler kenarda sıkışmasın (ölüm kontrolü sunucuda yapılıyor).
            // NOT: bu çağrı artık kameradan bağımsızdır — eskiden setBounds'un
            // bazı Phaser sürümlerinde physics.world.setBounds'u tetiklemesine
            // karşı bir önlemdi; kamera sınırı kalktıktan sonra da gerekli,
            // çünkü aksi halde fizik dünyası canvas boyutuna düşer.
            const physicsPadding = worldRadius * 2;
            this.physics.world.setBounds(
                -physicsPadding, -physicsPadding,
                worldSize + physicsPadding * 2,
                worldSize + physicsPadding * 2
            );
            console.log(`Dünya sınırı ayarlandı: ${worldSize}x${worldSize}`);

            if (this.boundaryGraphics) {
                this.boundaryGraphics.destroy();
            }
            this.boundaryGraphics = this.registerWorld(this.add.graphics());
            this.boundaryGraphics.lineStyle(6, 0xff0000, 1.0);
            this.boundaryGraphics.strokeCircle(worldRadius, worldRadius, worldRadius - 3);
            this.boundaryGraphics.setDepth(500);
        }

        const mySnake = this.ensurePlayerSnake(
            clientId,
            Number.isFinite(startX) ? startX : 0,
            Number.isFinite(startY) ? startY : 0,
            Number.isFinite(startSegmentCount) ? startSegmentCount : undefined,
            Number.isFinite(startScale) ? startScale : undefined,
            startDirection
        );

        // Kamerayı spawn konumuna LERP'SİZ oturt. startFollow(…, 0.15, 0.15)
        // yumuşatmalı olduğundan, kamera bir önceki scroll konumundan (restart'ta
        // (0,0)) yeni kafaya doğru gözle görülür şekilde SÜZÜLÜRDÜ. centerOn
        // scroll'u tek adımda yazar; yumuşatma bir sonraki kareden itibaren
        // normal takip için devrede kalır.
        const spawnHead = mySnake?.getHead();
        if (spawnHead) {
            this.cameras.main.centerOn(spawnHead.x, spawnHead.y);
        }

        // ── SIRALAMA: YER TUTUCUYU HANDSHAKE'TE KAPAT ───────────────────────
        // Normal akışta sunucu sıralamayı bu zarfın İÇİNDE gönderir ve
        // 'leaderboard_update' bu noktadan önce işlenmiş olur (bkz.
        // NetWorkManager.handleMessage sırası) → leaderboardReady true'dur ve
        // burada yapılacak bir şey yoktur.
        //
        // Bu dal yalnızca sıralama gelmediğinde çalışır: sıralamayı handshake'e
        // eklemeyen ESKİ bir sunucu. O durumda "Connecting…" yer tutucusu ilk
        // periyodik yayına (5 sn'ye kadar) dek ekranda asılı kalırdı. Handshake
        // tamamlandığına göre bağlantı aşaması bitmiştir; yer tutucu yerine
        // nötr BOŞ ÇERÇEVE çizilir ve ilk gerçek paket onu doldurur.
        if (!this.leaderboardReady) {
            updateHUDLeaderboard({
                entries: [],
                totalPlayers: 0,
                selfRank: 0,
                selfScore: 0,
                selfName: window.gameSettings?.nickname || 'You',
            });
        }

        this.checkInitialDataComplete();
    }

    hideLoader() {
        hideConnectingOverlay();
        showGameHUD();
        updateHUDScore(this.playerScore); // restart sonrası HUD 0'dan başlasın
    }

    onEntityCollection(entityCollection) {
        const entityIds = entityCollection?.entityIds ?? [];
        if (entityIds.length === 0) return;

        this.initialDataFlags.entities = true;
        this.checkInitialDataComplete();

        const xs = entityCollection?.xs ?? [];
        const ys = entityCollection?.ys ?? [];
        const angles = entityCollection?.angles ?? [];
        const scales = entityCollection?.scales ?? [];

        const fullyDataIds = entityCollection?.fullyDataEntityIds ?? [];
        const fullyDataCounts = entityCollection?.fullyDataSegmentCounts ?? [];
        const fullyDataNicknames = entityCollection?.fullyDataNicknames ?? [];

        const fullyDataMap = new Map();
        const fullyDataNicknameMap = new Map();
        for (let i = 0; i < fullyDataIds.length; i++) {
            const fid = Number(fullyDataIds[i]);
            fullyDataMap.set(fid, fullyDataCounts[i]);
            if (fullyDataNicknames && fullyDataNicknames.length > i) {
                fullyDataNicknameMap.set(fid, fullyDataNicknames[i]);
            }
        }

        // GECICI TANI LOGU: sunucunun [FULLY-DATA-TX] loguyla birebir karsilastir.
        // Ayni entity id icin X (TX) != Y (RX) ise bozulma TELDE/serialize'da,
        // esitse mismatch client render/merge tarafinda. Test bitince false yap.
        const DEBUG_LOG_FULLY_DATA_RX = true;
        if (DEBUG_LOG_FULLY_DATA_RX) {
            for (const [fid, cnt] of fullyDataMap) {
                console.log(`[FULLY-DATA-RX] Received FULLY_DATA for entity ${fid} with ${cnt} segments`);
            }
        }

        for (let i = 0; i < entityIds.length; i++) {
            const rawId = entityIds[i];
            const entityId = this.toId(rawId);
            if (entityId === null) continue;

            const lookupId = Number(rawId);

            const initialX = Number(xs[i]);
            const initialY = Number(ys[i]);
            const angle = Number(angles[i]);
            const scale = (scales && scales.length > i) ? Number(scales[i]) : 1.0;

            const entitySegmentCount = fullyDataMap.has(lookupId) ? fullyDataMap.get(lookupId) : undefined;

            if (this.myId !== null && entityId === this.myId) {
                const playerSnake = this.ensurePlayerSnake(
                    entityId,
                    Number.isFinite(initialX) ? initialX : 0,
                    Number.isFinite(initialY) ? initialY : 0,
                    entitySegmentCount,
                    undefined,
                    angle
                );
                this.flushPendingSegmentMutations(entityId, playerSnake);
                continue;
            }

            let snake = this.snakes.get(entityId);

            // ── RESPAWN / YENIDEN-GORUNURLUK OVERWRITE ───────────────────────
            // Sunucu FULLY_DATA'yi (segment sayısı dahil) yalnızca görünürlük
            // GEÇİŞLERİNDE yollar: yeni oyuncu, respawn (entity id geri
            // dönüştürülmüş olabilir!) veya AOI'ye yeniden giriş. Elimizde aynı
            // id için cache'lenmiş bir yılan varsa bu ESKİ YAŞAMIN (ya da bayat
            // görünümün) kalıntısıdır — remove paketi kaçmış/yarışmış olabilir.
            // Önceki gövdeden TEK BİR görsel segment bile miras almamak için
            // objeyi tamamen yok edip sıfırdan, sunucunun bildirdiği taze
            // segment sayısıyla kurarız (merge/append DEĞİL).
            if (snake && fullyDataMap.has(lookupId)) {
                // ── SERT SINIR KURALI (EntityFull = pazarlıksız yeniden kurulum) ──
                // EntityFull/FULLY_DATA bir MERGE işlemi DEĞİLDİR ve hiçbir
                // koşulda merge'e dönüşemez. Bu id için cache'te bir obje varsa
                // (respawn/geri dönüştürülmüş id, AOI yeniden girişi, kaçmış
                // RemoveEntity — sebep fark etmez) önce TAM ve BLOKE EDİCİ
                // nükleer temizlik koşar: kayıt silme + sprite/buffer/animasyon
                // imhası + bekleyen delta kuyruğunun boşaltılması
                // (bkz. _nuclearCleanEntity — kayıt silme imhadan ÖNCE gelir,
                // imha hatası dahi kaydı geri getiremez). Ardından yılan
                // sunucunun mutlak verisiyle SIFIRDAN inşa edilir. Eski
                // yaşamdan tek bir segment sprite'ı, path noktası ya da
                // interpolasyon buffer'ı yeni yaşama taşınamaz.
                this._nuclearCleanEntity(entityId);
                snake = null;
            }

            if (!snake) {
                const remoteNickname = fullyDataNicknameMap.get(lookupId) || '';
                snake = new Snake(
                    this,
                    false,
                    Number.isFinite(initialX) ? initialX : 0,
                    Number.isFinite(initialY) ? initialY : 0,
                    entitySegmentCount,
                    angle,
                    remoteNickname
                );
                this.snakes.set(entityId, snake);
            }

            if (entitySegmentCount !== undefined) {
                snake.syncSegmentCountFromServer(entitySegmentCount);
            }

            if (fullyDataNicknameMap.has(lookupId)) {
                snake.setNickname(fullyDataNicknameMap.get(lookupId));
            }

            snake.updateFromServerState({ x: initialX, y: initialY, angle: angle, scale: scale });
            this.flushPendingSegmentMutations(entityId, snake);

            // SIRA ÖNEMLİ: tohum EN SON uygulanır. Yukarıdaki
            // syncSegmentCountFromServer ve segment mutasyonları path'i yeniden
            // kurabilir/uzatabilir; tohumu sona bırakmak sunucunun gerçek
            // geometrisinin her hâlükârda kazanmasını garanti eder.
            this.flushPendingPathSeed(entityId, snake);
        }
    }

    onSegmentMutationCollection(segmentMutationCollection) {
        const mutations = segmentMutationCollection?.mutations ?? [];
        if (mutations.length === 0) return;

        mutations.forEach((mutation) => {
            const entityId = this.toId(mutation?.entityId ?? mutation?.entity_id);
            if (entityId === null) return;

            // SKOR BURADAN YAZILMAZ (eskiden yazilirdi).
            //
            // Eski kod segment KAYBINI gorup HUD skorundan removed*50 dusuyordu
            // — yani uzunluk sinyalinden skoru TAHMIN ediyordu. Bu tahmin,
            // yem yeme tahminiyle (addPlayerScoreForFood) ayni degiskeni
            // yaristigi icin ikisi kacinilmaz olarak ayrisiyor, 5 sn'de bir
            // gelen otoriter leaderboard degeri farki tek karede kapatinca HUD
            // gorunur sekilde zipliyordu. Skor artik SelfPosition ile HER TICK
            // otoriter geliyor (bkz. onSelfPosition), dolayisiyla buradaki
            // tahmine gerek de yok, yeri de yok.
            const snake = this.snakes.get(entityId);
            if (!snake) {
                this.queuePendingSegmentMutation(entityId, mutation);
                return;
            }

            snake.applySegmentMutationFromServer(mutation);
        });
    }

    onFoodCollection(foodCollection) {
        const incomingFoods = Array.isArray(foodCollection?.foods) ? foodCollection.foods : [];
        const incomingFoodIds = new Set();

        for (const foodData of incomingFoods) {
            const foodId = this.upsertFood(foodData);
            if (foodId !== null) {
                incomingFoodIds.add(foodId);
            }
        }

        for (const [foodId, food] of this.foods) {
            if (incomingFoodIds.has(foodId)) continue;
            food.bob?.destroy();
            this.foods.delete(foodId);
        }
    }

    onFoodMutationCollection(foodMutationCollection) {
        const addedFoods = Array.isArray(foodMutationCollection?.addedFoods)
            ? foodMutationCollection.addedFoods
            : (Array.isArray(foodMutationCollection?.added_foods) ? foodMutationCollection.added_foods : []);
        const removedFoodIds = Array.isArray(foodMutationCollection?.removedFoodIds)
            ? foodMutationCollection.removedFoodIds
            : (Array.isArray(foodMutationCollection?.removed_food_ids) ? foodMutationCollection.removed_food_ids : []);

        if (removedFoodIds.length === 0 && addedFoods.length === 0) return;

        for (const rawFoodId of removedFoodIds) {
            this.removeFood(rawFoodId);
        }

        for (const foodData of addedFoods) {
            this.upsertFood(foodData);
        }
    }

    onSelfPosition(selfPosition) {
        const entityId = this.toId(selfPosition?.entityId ?? selfPosition?.clientId);
        if (entityId === null) return;

        if (this.myId === null) {
            this.myId = entityId;
        }
        if (entityId !== this.myId) return;

        this.initialDataFlags.entities = true;

        // ── OTORITER SKOR (her tick) ────────────────────────────────────────
        // Sunucu skoru artik SelfPosition icinde gonderiyor (total_score).
        // Bu, HUD skorunun TEK yazma kaynagidir.
        //
        // ESKI AKIS UC AYRI YAZAR TASIYORDU ve titremenin sebebi tam olarak
        // buydu:
        //   1) addPlayerScoreForFood(): yem yenince +value (istemci tahmini)
        //   2) segment_mutation: segment kaybinda -50 (uzunluktan SKOR TAHMINI)
        //   3) leaderboard self_score: 5 SANIYEDE BIR otoriter duzeltme
        // (1) ve (2) birbirinden bagimsiz tahminlerdi; aralarindaki her sapma
        // (3) geldiginde tek karede geri alinip HUD'a sicrama olarak yansiyordu.
        // Ozellikle (2) yanlis yondeydi: uzunluk sinyalinden skor cikarmaya
        // calisiyordu, oysa iliski tersidir (skor uzunlugu belirler).
        const authoritativeScore = Number(
            selfPosition?.totalScore ?? selfPosition?.total_score);
        if (Number.isFinite(authoritativeScore) && authoritativeScore >= 0) {
            if (authoritativeScore !== this.playerScore) {
                this.playerScore = authoritativeScore;
                updateHUDScore(this.playerScore);
            }
            this._hasAuthoritativeScore = true;
        }

        const x = Number(selfPosition?.x);
        const y = Number(selfPosition?.y);
        const snake = this.ensurePlayerSnake(
            entityId,
            Number.isFinite(x) ? x : 0,
            Number.isFinite(y) ? y : 0
        );
        this.flushPendingSegmentMutations(entityId, snake);

        // İlk otoriter kare LERP'SİZ uygulanır; true dönerse bu KARE baseline'dı.
        const didTeleport = snake.updateSelfPositionFromServer(selfPosition);
        if (didTeleport) {
            // Kamera da aynı karede ışınlanır. startFollow yumuşatması burada
            // devrede olsaydı, yılan otoriter konuma anında oturup kamera ona
            // ~1 sn boyunca süzülürdü — spawn'daki kayma hissinin görsel yarısı.
            const head = snake.getHead();
            if (head) this.cameras.main.centerOn(head.x, head.y);

            // Baseline anında gecikmeli girdi kuyruğu da düşürülür: spawn ile
            // ilk otoriter kare arasında sıraya girmiş açılar, artık geçersiz
            // olan spawn-öncesi tahmine aitti.
            this._inputDelayQueue = [];
            this._lastDelayedInput = null;

            this.initialDataFlags.selfBaseline = true;
        }

        // SIRA ÖNEMLİ: perde kontrolü konum UYGULANDIKTAN SONRA yapılır.
        // Eskiden bu çağrı metodun başındaydı; perde, oyuncunun otoriter konumu
        // yılana yazılmadan bir kare önce kalkabiliyordu.
        this.checkInitialDataComplete();
    }

    onRemoveEntity(removeEntity) {
        const entityId = this.toId(removeEntity?.entityId ?? removeEntity?.clientId);
        if (entityId === null) return;
        this._nuclearCleanEntity(entityId);
    }

    /**
     * NÜKLEER TEMİZLİK — bir entity id'sine ait TÜM client-side ayak izini yok
     * eder. Hem despawn'da (onRemoveEntity: ölüm broadcast'i + AOI-çıkış paketi)
     * hem de mevcut bir id için yeni EntityFull geldiğinde (respawn/geri
     * dönüştürülmüş id — onEntityCollection) çağrılır. Sıfır miras garantisi:
     *  1. Bekleyen delta mutasyon kuyruğu (pendingSegmentMutations) silinir.
     *  2. Bu yılana uçmakta olan yem animasyonları (eatingFoods) — hedef obje
     *     yok olacağından bob sprite'ları ANINDA imha edilir; aksi halde bir
     *     frame boyunca ölü referansa lerp etmeye çalışırlardı.
     *  3. snake.destroy(): her segment sprite'ı, kafa, gözler, trail particle
     *     emitter'ı, nickname text'i sahneden sökülür VE yılanın tüm iç
     *     buffer'ları (path, interpolasyon/velocity/tahmin geçmişi) sıfırlanır
     *     (bkz. Snake.destroy — hard reset).
     *  4. snakes map'inden id kaldırılır → aynı id için bir sonraki EntityFull
     *     tamamen boş tuvalden inşa edilir.
     */
    _nuclearCleanEntity(entityId) {
        this.pendingSegmentMutations.delete(entityId);
        // DİKKAT: pendingPathSeeds BİLEREK silinmez. Bu temizlik AOI yeniden
        // girişinde/respawn'da, yılan YENİDEN kurulmadan hemen önce koşar ve
        // bekleyen tohum tam da o YENİ gövdeye aittir (aynı zarfta geldi).
        // Burada silmek, özelliğin var olma sebebi olan senaryoyu bozardı.
        // Tohum ya flushPendingPathSeed ile tüketilir ya da queuePendingPathSeed
        // içindeki tavan tarafından düşürülür.

        const snake = this.snakes.get(entityId);
        if (!snake) return;

        // KRİTİK SIRALAMA: kayıt silme ÖNCE, görsel imha SONRA (try/catch).
        // destroy() içindeki herhangi bir hata artık map silmesini engelleyemez;
        // id her koşulda kayıtlardan düşer ve bir sonraki EntityFull temiz
        // "yeni yılan kur" yolundan geçer. (Önceki sıralama, destroy'daki tek
        // bir TypeError'ın yarı-ölü objeyi map'te bırakıp oyuncuları kalıcı
        // görünmez yapmasına neden oluyordu.)
        this.snakes.delete(entityId);

        try {
            this.eatingFoods.forEach((data, foodId) => {
                if (data.targetSnake === snake) {
                    data.sprite?.destroy();
                    this.eatingFoods.delete(foodId);
                }
            });
            snake.destroy();
        } catch (err) {
            console.error(`[NUCLEAR-CLEAN] entity ${entityId} imhasında hata (akış devam ediyor):`, err);
        }
    }

    ensurePlayerSnake(entityId, x, y, segmentCount, scale, angleRaw) {
        const existingSnake = this.snakes.get(entityId);
        const nickname = window.gameSettings?.nickname || '';
        if (existingSnake?.isPlayerControlled && existingSnake.alive) {
            // Yılan, StartInformation'dan ÖNCE işlenen bir pakette (ör. ilk
            // SelfPosition) yaratılmış olabilir; o yolda açı GEÇİLMEZ ve yılan
            // 0 rad ile — sağa bakar halde — kurulur. Buraya bir sunucu yönü
            // geldiyse geriye dönük uygulanır; applyServerHeading yalnızca bir
            // kez etki eder, sonraki çağrılar oyuncunun dönüşünü bozmaz.
            if (angleRaw !== undefined) {
                existingSnake.applyServerHeading(angleRaw);
            }
            if (segmentCount !== undefined) {
                existingSnake.syncSegmentCountFromServer(segmentCount);
            }
            if (scale !== undefined && !Number.isNaN(scale) && scale > 0) {
                existingSnake.scale = scale;
                // scale alanını değiştirmek sprite'ları otomatik boyutlamaz —
                // görsel boyut sunucu hitbox'ıyla anında eşitlensin.
                existingSnake._updateSegmentScaling();
            }
            if (!existingSnake.nickname) {
                existingSnake.setNickname(nickname);
            }
            return existingSnake;
        }

        if (existingSnake) {
            existingSnake.destroy();
            this.snakes.delete(entityId);
        }

        const playerSnake = new Snake(this, true, x, y, segmentCount, angleRaw, nickname);
        // Açı bu yolda GEÇİLDİYSE yılan zaten sunucu yönüyle kurulmuştur; yönü
        // "uygulanmış" işaretle ki sonradan gelen bir StartInformation tekrarı
        // (applyServerHeading) oyuncunun o ana kadarki dönüşünü geri almasın.
        // angleRaw === undefined ise yön HENÜZ bilinmiyor demektir ve bayrak
        // false kalır — StartInformation geldiğinde geriye dönük uygulanır.
        if (angleRaw !== undefined) {
            playerSnake._hasServerHeading = true;
        }
        if (scale !== undefined && !Number.isNaN(scale) && scale > 0) {
            playerSnake.scale = scale;
            playerSnake._updateSegmentScaling(); // görsel boyut = sunucu scale, ilk kareden itibaren
        }
        this.snakes.set(entityId, playerSnake);

        // Kamera kafayı takip eder ve HER ZAMAN ekran merkezine kilitler.
        // followOffset (0, 0) → hedef tam merkezde; removeBounds() (bkz.
        // onStartGame) sayesinde harita kenarında da merkezden kaymaz.
        this.cameras.main.startFollow(playerSnake.getHead(), true, 0.15, 0.15);
        this.cameras.main.setFollowOffset(0, 0);
        // Savunma amaçlı: sahne yeniden başlarken kamera örneği yeniden
        // kullanılırsa önceki turdan kalan sınır burada da düşürülür.
        this.cameras.main.removeBounds();
        this.cameras.main.setRoundPixels(false);
        return playerSnake;
    }



    queuePendingSegmentMutation(entityId, mutation) {
        const pending = this.pendingSegmentMutations.get(entityId) ?? [];
        pending.push(mutation);
        this.pendingSegmentMutations.set(entityId, pending);
    }

    flushPendingSegmentMutations(entityId, snake) {
        const pending = this.pendingSegmentMutations.get(entityId);
        if (!pending || pending.length === 0 || !snake) return;

        pending.forEach((mutation) => {
            snake.applySegmentMutationFromServer(mutation);
        });
        this.pendingSegmentMutations.delete(entityId);
    }

    // ── İLK KARŞILAŞMA PATH TOHUMU ──────────────────────────────────────────
    // Sunucu, bir entity'yi bu istemciye İLK kez gösterdiğinde (veya uzun bir
    // görünürlük boşluğundan sonra yeniden gösterdiğinde) gövde polyline'ını
    // sıkıştırılmış olarak bir KEZ ekler. Böylece istemci gövdeyi tahmin etmek
    // zorunda kalmaz; kıvrımlı yılan ilk karede doğru şekliyle çizilir.
    // Kablo formatı için bkz. newproto/server/upgrade/path-seed.proto.
    onPathSeedCollection(pathSeedCollection) {
        const seeds = pathSeedCollection?.seeds ?? [];
        if (seeds.length === 0) return;

        seeds.forEach((seed) => {
            const entityId = this.toId(seed?.entityId ?? seed?.entity_id);
            if (entityId === null) return;

            const points = this._decodePathSeed(seed);
            // İki AYRIK nokta yoksa yön tanımlı değildir; tohum atlanır ve
            // yılan mevcut warmup'ında kalır (sessiz bozulma yok).
            if (points.length < 2) return;

            const snake = this.snakes.get(entityId);
            if (!snake) {
                // Tohum, yılanı yaratan EntityCollection emit'inden ÖNCE geldi
                // (alan `oneof` dışında olduğu için switch'ten önce işleniyor).
                this.queuePendingPathSeed(entityId, points);
                return;
            }
            snake.seedPathFromServer(points);
        });
    }

    // Delta + kuantalanmış polyline → mutlak dünya noktaları (kafadan geriye):
    //     p[0]   = (origin_x, origin_y)
    //     p[i+1] = p[i] + (dx[i] / quantization, dy[i] / quantization)
    _decodePathSeed(seed) {
        const originX = Number(seed?.originX ?? seed?.origin_x);
        const originY = Number(seed?.originY ?? seed?.origin_y);
        if (!Number.isFinite(originX) || !Number.isFinite(originY)) return [];

        const dxs = seed?.dx ?? [];
        const dys = seed?.dy ?? [];
        // dx/dy eşit uzunlukta OLMALI; değilse kısa olanla sınırlanır —
        // bozuk/yarım paket diziyi taşırmaz.
        const count = Math.min(dxs.length ?? 0, dys.length ?? 0);

        const rawQ = Number(seed?.quantization);
        // 0/eksik/geçersiz → 1 (kuantalama yok). Sıfıra bölme imkânsız.
        const q = Number.isFinite(rawQ) && rawQ > 0 ? rawQ : 1;

        const points = [{ x: originX, y: originY }];
        let x = originX;
        let y = originY;
        for (let i = 0; i < count; i++) {
            const dx = Number(dxs[i]);
            const dy = Number(dys[i]);
            // Bozuk bileşende zinciri KES: sonrası kümülatif olarak yanlış olur.
            if (!Number.isFinite(dx) || !Number.isFinite(dy)) break;
            x += dx / q;
            y += dy / q;
            points.push({ x, y });
        }
        return points;
    }

    queuePendingPathSeed(entityId, points) {
        // Yalnızca EN SON tohum saklanır — aynı entity için yeni tohum gelirse
        // eskisi tanımı gereği bayattır.
        this.pendingPathSeeds.set(entityId, points);

        // Sözleşme gereği tohum, entity'yi ortaya çıkaran EntityCollection ile
        // AYNI zarfta gelir ve hemen tüketilir; yani harita normalde neredeyse
        // boştur. Yine de sunucu sözleşmeyi çiğnerse (tohum gelir, entity
        // gelmez) sınırsız birikmesin: en eski kayıtlar düşürülür.
        const MAX_PENDING = 64;
        while (this.pendingPathSeeds.size > MAX_PENDING) {
            const oldest = this.pendingPathSeeds.keys().next().value;
            this.pendingPathSeeds.delete(oldest);
        }
    }

    flushPendingPathSeed(entityId, snake) {
        const points = this.pendingPathSeeds.get(entityId);
        if (!points || !snake) return;
        snake.seedPathFromServer(points);
        this.pendingPathSeeds.delete(entityId);
    }

    checkInitialDataComplete() {
        if (this.gameStarted) return;
        // selfBaseline KOŞULU KRİTİK: eskiden perde, StartInformation + herhangi
        // bir entity paketi gelir gelmez kalkıyordu. Oyuncunun KENDİ otoriter
        // konumu henüz uygulanmamış olabildiğinden, açılışta yılan spawn
        // noktasında duruyor ve ilk SelfPosition ile sunucunun o ana kadar
        // ilerlettiği yere doğru fırlıyordu — bildirilen "açılışta ileri sarma".
        if (!this.initialDataFlags.startInfo
            || !this.initialDataFlags.entities
            || !this.initialDataFlags.selfBaseline) {
            return;
        }

        this.gameStarted = true;
        if (!this.grid) {
            this.createTiledBackground();
        }
        this._revealGameplay();
    }

    /**
     * PERDE → HİZALA → FADE-IN → GİRDİ sırası.
     *
     * Sıra bilerek bu şekilde: her adım bir öncekinin tamamlandığını varsayar.
     *  1. HİZALA — yılan(lar) ve kamera EN SON otoriter duruma ışınlanır ve
     *     yükleme boyunca birikmiş tüm tampon atılır. Bu adım perde HÂLÂ
     *     kapalıyken yapılır; ışınlanma hiçbir zaman ekranda görünmez.
     *  2. PERDEYİ KALDIR — HTML overlay gider, dünya kamerası açılır. Kamera
     *     fade'in ilk karesinde tamamen siyah olduğundan araya hizalanmamış
     *     tek bir kare bile giremez.
     *  3. FADE-IN — kısa (REVEAL_FADE_MS) siyahtan açılma.
     *  4. GİRDİ — fade BİTTİĞİ anda açılır (Phaser FADE_IN_COMPLETE).
     */
    _revealGameplay() {
        if (this._revealStarted) return;
        this._revealStarted = true;

        // ── 1. HİZALA (perde hâlâ kapalı) ───────────────────────────────────
        const mySnake = this.myId !== null ? this.snakes.get(this.myId) : null;
        const snapped = mySnake?.snapToServerBaseline() ?? null;

        // Uzak yılanlar da yükleme boyunca snapshot biriktirdi; aralarında
        // interpolasyon perde kalkınca "geriye sarma" olarak görünürdü.
        this.snakes.forEach((snake) => {
            if (snake !== mySnake) snake.snapToServerBaseline();
        });

        // Kamera hedefe LERP'SİZ kilitlenir (startFollow yumuşatması bir
        // sonraki kareden itibaren devreye girer).
        const head = mySnake?.getHead();
        const focusX = snapped?.x ?? head?.x;
        const focusY = snapped?.y ?? head?.y;
        if (Number.isFinite(focusX) && Number.isFinite(focusY)) {
            this.cameras.main.centerOn(focusX, focusY);
        }

        // Yükleme sırasında sıraya girmiş gecikmeli girdiler artık geçersiz:
        // hepsi perde ardındaki (atılmış) tahmine aitti.
        this._inputDelayQueue = [];
        this._lastDelayedInput = null;

        // ── 2. PERDEYİ KALDIR ───────────────────────────────────────────────
        this.hideLoader();
        this.cameras.main.setVisible(true);

        // ── 3. FADE-IN ──────────────────────────────────────────────────────
        // fadeIn ilk karede tam siyah başlar → HTML perdesi ile kamera arasında
        // boşluk kalmaz. (Phaser fadeIn'i içeride force=true ile başlatır, yani
        // restart'ta asılı kalmış bir efekt varsa yeniden başlatılır.)
        this.cameras.main.fadeIn(REVEAL_FADE_MS, 0, 0, 0);

        // ── 4. GİRDİYİ FADE BİTİNCE AÇ ──────────────────────────────────────
        // Yedek zamanlayıcı: efekt bir şekilde tamamlanmazsa (sekme arka plana
        // alınır ve kamera efekti güncellenmezse) girdi kalıcı olarak kilitli
        // kalmamalı. İki yoldan hangisi önce gelirse girdiyi açar; _inputEnabled
        // idempotenttir.
        this.cameras.main.once(
            Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE,
            () => { this._inputEnabled = true; });
        this.time.delayedCall(REVEAL_FADE_MS + 250, () => { this._inputEnabled = true; });
    }

    toId(rawId) {
        if (rawId === undefined || rawId === null) return null;
        const value = Number(rawId);
        return Number.isFinite(value) ? value : null;
    }

    toFoodId(rawFoodId) {
        const normalizedId = this.toId(rawFoodId);
        if (normalizedId === null || normalizedId < 0 || !Number.isInteger(normalizedId)) return null;
        return normalizedId;
    }

    // ── Food Rendering ──────────────────────────────────────────
    // Phaser Blitter: binlerce food objesini tek draw call ile çizen performans yapısı.
    // Rule 1: her yem tek, izole bir noktadır — kümeleme/çoklu-bob YOK, her
    // food id'ye tam olarak bir Bob (bir şekil) karşılık gelir.
    // Koordinatlar doğrudan dünya piksel koordinatlarıdır (invScale yok).

    seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    upsertFood(foodData) {
        const foodId = this.toFoodId(foodData?.foodId ?? foodData?.food_id);
        if (foodId === null) return null;

        const x = Number(foodData?.x);
        const y = Number(foodData?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

        // ── 1:1 DÜNYA KOORDİNATI (yuvarlama YOK) ────────────────────────────
        // Sunucudan gelen px koordinatı doğrudan dünya uzayına yazılır. Eskiden
        // burada Math.round vardı: sunucu zaten uint32 ile tam piksele
        // yuvarladığı için client ikinci kez yuvarlıyordu ve alt-piksel çizilen
        // yılan gövdesine göre yem eksen başına ±0.5 px kayıyordu. Sunucu artık
        // float gönderiyor (food.proto: float x/y ← uint32); bu değeri yuvarlamak
        // düzeltmeyi anında geri alırdı. Blitter dünya uzayında (registerWorld)
        // çizildiği için ekstra render/DPI/viewport dönüşümü uygulanmaz — kamera
        // zoom/scroll'u tüm dünya nesnelerine aynı şekilde etki eder.
        const targetX = x;
        const targetY = y;

        // Aynı foodId zaten varsa (yeniden gönderim) dokunma. Yem artık konumunu
        // ASLA değiştirmez (yaslanma/geri-dönüş kaldırıldı) — bob.x/y kalıcı orijindir.
        if (this.foods.has(foodId)) {
            return foodId;
        }

        const value = Number(foodData?.value ?? 0);

        // 16 renk varyantından biri deterministik seçilir (aynı foodId → aynı renk).
        const colorFrame = Math.floor(this.seededRandom(foodId * 7) * FOOD_COLOR_COUNT);
        const bob = this.ensureFoodBlitter().create(targetX, targetY, colorFrame);

        // Şimmer (twinkle) fazı: her yem farklı fazda nabız atsın diye foodId'den
        // deterministik türetilir (senkron olmayan, canlı parıltı).
        const shimmerPhase = this.seededRandom(foodId * 13) * Math.PI * 2;

        // Her yem tek bir Bob. colorFrame, yem yenirken Sprite'a dönüştürmek
        // (Bob'lar setScale desteklemez — bkz. _beginFoodEatingFlight) ve
        // reddedilen tahminde yemi birebir geri getirmek için saklanır.
        this.foods.set(foodId, { bob, value, colorFrame, shimmerPhase });
        return foodId;
    }

    removeFood(rawFoodId) {
        const foodId = this.toFoodId(rawFoodId);
        if (foodId === null) return;

        // FOOD_REMOVE = sunucunun yeme ONAYI. Oyuncu bunu zaten tahmin ettiyse,
        // pending kaydını sonlandır (uçuş animasyonu zaten devam ediyor/bitti).
        if (this.pendingConsumption.has(foodId)) {
            this.pendingConsumption.delete(foodId);
            return;
        }

        // Uzak yılan tarafından yenilen yem (veya sunucu tahminimizden önce bildirdi)
        const food = this.foods.get(foodId);
        if (!food) return;
        this.foods.delete(foodId);

        const bob = food.bob;
        if (!bob) return;

        // Yem konumu kalıcı orijindir (yaslanma yok) — en yakın yılanı buradan bul.
        const checkX = bob.x;
        const checkY = bob.y;

        let closestSnake = null;
        let minDistance  = Infinity;

        this.snakes.forEach(snake => {
            if (!snake.alive || !snake.getHead()?.active) return;
            const head = snake.getHead();
            const dist = Math.hypot(head.x - checkX, head.y - checkY);
            if (dist < minDistance) {
                minDistance  = dist;
                closestSnake = snake;
            }
        });

        // ── GÖRSEL UÇUŞ ile SKOR KREDİSİ AYRI EŞİKLER KULLANIR ──────────────
        // Animasyon geniş bir pencerede çalışabilir (yem, yiyen yılana doğru
        // uçarken hoş görünür). Ama SKOR yalnızca yemi gerçekten BİZİM
        // yediğimize dair sağlam kanıt varsa eklenmelidir.
        //
        // ESKİ HATA: kredi eşiği de 300 * scale idi — büyük yılanda ~1800 px.
        // Yoğun ölüm-düşümü kümesinde (çok botlu test) oyuncu, RAKİPLERİN
        // yediği yemlere sürekli "en yakın yılan" oluyor ve başkasının yemi
        // için puan alıyordu. Kredi artık sunucunun KENDİ ölçütünü kullanır:
        // yem, oyuncunun gerçek yeme yarıçapı içinde miydi (FoodConfig.eatRadiusPx
        // aynası) — sunucunun yemeyi kabul ettiği tek koşul budur.
        if (closestSnake && minDistance < 300 * closestSnake.scale) {
            this._beginFoodEatingFlight(foodId, food, closestSnake);
            const creditRadius = foodEatRadiusPx(closestSnake.scale);
            if (closestSnake.isPlayerControlled && minDistance <= creditRadius) {
                // Tahmin EDİLEMEYEN (ör. ön-yay kapısı nedeniyle arkada kalan)
                // ama sunucunun yediği yemler puanı buradan alır.
                this.addPlayerScoreForFood(food.value);
            }
        } else {
            bob.destroy();
        }
    }

    // Statik yem (Blitter Bob) → yenme animasyonu (Sprite) dönüşümü.
    // NEDEN Sprite: Phaser Blitter Bob'ları setScale DESTEKLEMEZ; yemin küçülerek
    // (scale 1→0) yok olması (Issue #2) için gerçek bir Sprite şart. Bu dönüşüm
    // yalnızca AYNI ANDA yenmekte olan birkaç yem için yapılır — 4000 statik
    // yemin tek-draw-call Blitter avantajı korunur.
    _beginFoodEatingFlight(foodId, food, targetSnake) {
        const bob = food.bob;
        const startX = bob ? bob.x : 0;
        const startY = bob ? bob.y : 0;
        const frameName = bob && bob.frame ? bob.frame.name : 0;
        if (bob) bob.destroy();

        // Tek daire dokusu (frame = renk varyantı). Additive blend Blitter'la aynı
        // canlı parıltıyı korumak için Sprite de ADD moduyla çizilir.
        const sprite = this.registerWorld(
            this.add.sprite(startX, startY, FOOD_GLOW_TEXTURE, frameName)
                .setDepth(0)
                .setBlendMode(Phaser.BlendModes.ADD)
        );

        // Ölçek çöküşü ZAMANA bağlıdır (mesafeye değil): elapsedMs 0'dan
        // FOOD_EAT_SHRINK_MS'e sayar, scale = 1 - elapsed/süre → kafa uzaklaşsa
        // bile yem asla yeniden büyümez, ~100ms içinde garantili yok olur.
        this.eatingFoods.set(foodId, { sprite, targetSnake, elapsedMs: 0 });
    }

    // Yenen yem SAYACI. SKOR BURADAN YAZILMAZ.
    //
    // Skorun tek kaynagi sunucunun her tick gonderdigi SelfPosition.total_score
    // degeridir (bkz. onSelfPosition). Burada tahmin yurutmek, otoriter deger
    // her tick zaten geldigi icin en fazla ~1 RTT'lik bir "erken artis"
    // kazandirirdi; bedeli ise iki yazarin surekli birbirini ezmesi ve gorunur
    // skor titremesiydi. Yenen yem SAYISI (foodsEaten) tamamen kozmetiktir ve
    // skoru etkilemedigi icin tahmini kalabilir.
    addPlayerScoreForFood(value) {
        this.foodsEaten += 1;
    }

    // (_restoreFoodNode KALDIRILDI — zamanlayıcıya dayalı yem dirilmesi, sunucuda
    // artık var olmayan yemi client'ta geri getirip yenemeyen "hayalet yem"
    // üretiyordu. Uzlaştırma artık yalnızca sunucunun otoriter FoodCollection
    // anlık görüntüsü üzerinden yapılır; bkz. update() içindeki süre aşımı notu.)

    clearFoods() {
        if (this.foodBlitter) {
            this.foodBlitter.clear();
            this.foodBlitter.destroy();
            this.foodBlitter = null;
        }
        this.foods.clear();
        this.eatingFoods.clear();
        this.pendingConsumption.clear();
    }

    // Tek havuzlanmış Blitter — TÜM yemler (tek daire dokusu) tek draw call'da
    // çizilir. Additive blend, üst üste gelen glow'ların canlı neon toplamı için.
    ensureFoodBlitter() {
        if (this.foodBlitter) return this.foodBlitter;
        this.foodBlitter = this.registerWorld(
            this.add.blitter(0, 0, FOOD_GLOW_TEXTURE)
                .setDepth(0)
                .setBlendMode(Phaser.BlendModes.ADD)
        );
        return this.foodBlitter;
    }


    // ── SIRALAMA PAKETİ ─────────────────────────────────────────────────────
    // Sunucu bunu 5 sn'de birden sık göndermez ve yalnızca sıralama
    // değiştiğinde ekler (bkz. server LeaderboardSystem) — TEK istisna, aynı
    // alanın handshake zarfına da eklenmesidir (bkz. Game.buildInitialLeaderboard);
    // ilk çağrı normalde oradan gelir. Burada sadece wire formatı UI şekline
    // çevrilir; DOM verimliliği overlays.js tarafında (satır havuzu + fark
    // tabanlı yazma) çözülür.
    onLeaderboardUpdate(leaderboardUpdate) {
        if (!leaderboardUpdate) return;

        this.leaderboardReady = true;

        const rawEntries = Array.isArray(leaderboardUpdate.entries) ? leaderboardUpdate.entries : [];
        const entries = rawEntries.map((entry) => ({
            name: entry?.nickname || 'Unknown',
            score: Number(entry?.score ?? 0),
        }));

        const selfRank = Number(
            leaderboardUpdate.selfRank ?? leaderboardUpdate.self_rank ?? 0);
        const selfScore = Number(
            leaderboardUpdate.selfScore ?? leaderboardUpdate.self_score ?? 0);
        const totalPlayers = Number(
            leaderboardUpdate.totalPlayers ?? leaderboardUpdate.total_players ?? 0);

        // TEK DOĞRULUK KAYNAGI: sunucunun otoriter selfScore'u client
        // tahmini playerScore'u düzeltir. Bu sayede HUD skor podu (#hud-score)
        // ve sıralamadaki kendi satırımız (#hud-your-score) her zaman aynı
        // değeri gösterir. Client tahmini (yem yeme/segment kaybı) paketler
        // arasında anlık güncelleme sağlar; leaderboard paketi geldiğinde
        // birikerek oluşan fark burada sıfırlanır.
        // SKOR BURADAN YAZILMAZ. self_score 5 saniyede bir yayinlanir; skor
        // artik SelfPosition ile HER TICK geliyor, dolayisiyla bu deger daima
        // daha BAYATTIR ve yazmasi HUD'da geriye sicrama uretirdi.
        // Otoriter akis hic baslamadiysa (cok eski sunucu) yedek olarak kullan.
        if (Number.isFinite(selfScore) && !this._hasAuthoritativeScore) {
            this.playerScore = selfScore;
            updateHUDScore(this.playerScore);
        }

        updateHUDLeaderboard({
            entries,
            totalPlayers,
            selfRank,
            selfScore,
            selfName: window.gameSettings?.nickname || 'You',
        });
    }

    onDeathNotification() {
        this.onGameOver();
    }

    onGameOver() {
        if (!this.gameStarted) return;
        console.log(`Oyun Bitti! Skor: ${this.playerScore}`);
        this.gameStarted = false;

        // ── Post-death freeze ────────────────────────────────────────────────
        // Kafa artık fizik body ile değil manuel entegrasyonla hareket ediyor;
        // alive=false hem updateFromInput'u hem görsel katmanı durdurur. Yine
        // de hız vektörünü sıfırlayarak niyeti açıkça belgeliyoruz.
        const mySnake = this.myId !== null ? this.snakes.get(this.myId) : null;
        if (mySnake) {
            mySnake.alive = false;
            if (mySnake.vel) {
                mySnake.vel.x = 0;
                mySnake.vel.y = 0;
            }
        }
        this.cameras.main.stopFollow();

        // ── Game Over: HTML/CSS overlay (unified UI standard) ────────────────
        // Phaser text/graphics paneli kaldırıldı; ekran artık canvas üzerine
        // konumlanan DOM katmanı (index.html #gameover-overlay). Play Again →
        // scene.restart(): shutdown eski soketi sessizce kapatır, create()
        // state'i sıfırlar, yeni bağlantı sunucuda temiz respawn tetikler.
        // Skor client tarafında takip ediliyor (her yem grubu +10).
        hideGameHUD();
        showGameOverOverlay(
            { score: this.playerScore, foodEaten: this.foodsEaten },
            () => this.scene.restart()
        );
    }

    onDisconnected() {
        this.gameStarted = false;

        // Perde HENÜZ kalkmadıysa (reveal öncesi kopma) burada kaldırılmalı:
        // aşağıdaki "bağlantı koptu" yazısı canvas üzerine çizilir ve opak HTML
        // connecting-overlay'in ARKASINDA kalırdı — oyuncu boş bir yükleme
        // ekranına bakakalırdı. Girdiyi de aç ki kilitli kalmasın.
        if (!this._revealStarted) {
            this._revealStarted = true;
            hideConnectingOverlay();
            this.cameras.main.setVisible(true);
            this._inputEnabled = true;
        }

        hideGameHUD();
        this.clearFoods();
        if (this.boundaryGraphics) {
            this.boundaryGraphics.destroy();
            this.boundaryGraphics = null;
        }
        const disconnectText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY,
            `Sunucu bağlantısı koptu!`,
            { fontSize: '24px', color: '#ffdd00', backgroundColor: '#000' }
        ).setOrigin(0.5, 0.5).setScrollFactor(0);
        this.registerHUD(disconnectText);
    }


    // ── AOI DEBUG OVERLAY ÇİZİMİ ─────────────────────────────────────────────
    // Sunucunun gerçek AOI'sini çizer: oyuncunun bulunduğu sektöre merkezli,
    // GRID'e hizalı 5x5 sektör bloğu (dünya kenarlarında sunucu gibi kırpılır).
    // Kalın kesikli dış çizgi + çok soluk iç dolgu = AOI sınırı; ince düz iç
    // kutu = oyuncunun mevcut sektörü (kafa bu kutunun kenarını geçtiği anda
    // AOI bir sektör kayar → uzak yılanların spawn/despawn eşiği).
    // Sektör değişmedikçe yeniden çizilmez (Graphics her frame ucuz kalır).
    _updateAoiDebugOverlay(mySnake) {
        const g = this.aoiDebugGraphics;
        if (!g || !this.worldRadius) return;

        const head = mySnake?.alive ? mySnake.getHead() : null;
        if (!head?.active) {
            g.clear();
            this._aoiDebugLastSector.cx = -1;
            this._aoiDebugLastSector.cy = -1;
            return;
        }

        const worldSize = this.worldRadius * 2;
        const sectorW = worldSize / AOIDebugConfig.SECTOR_COUNT_X;
        const sectorH = worldSize / AOIDebugConfig.SECTOR_COUNT_Y;

        const clampSector = (v, max) => Math.max(0, Math.min(max, v));
        const cx = clampSector(Math.floor(head.x / sectorW), AOIDebugConfig.SECTOR_COUNT_X - 1);
        const cy = clampSector(Math.floor(head.y / sectorH), AOIDebugConfig.SECTOR_COUNT_Y - 1);

        if (cx === this._aoiDebugLastSector.cx && cy === this._aoiDebugLastSector.cy) {
            return; // sektör aynı → AOI dikdörtgeni değişmedi
        }
        this._aoiDebugLastSector.cx = cx;
        this._aoiDebugLastSector.cy = cy;

        // Sunucu fillAoiMask dünya kenarında komşuları atlar → aynı kırpma.
        const r = AOIDebugConfig.AOI_SECTOR_RADIUS;
        const minCx = clampSector(cx - r, AOIDebugConfig.SECTOR_COUNT_X - 1);
        const maxCx = clampSector(cx + r, AOIDebugConfig.SECTOR_COUNT_X - 1);
        const minCy = clampSector(cy - r, AOIDebugConfig.SECTOR_COUNT_Y - 1);
        const maxCy = clampSector(cy + r, AOIDebugConfig.SECTOR_COUNT_Y - 1);

        const x0 = minCx * sectorW;
        const y0 = minCy * sectorH;
        const x1 = (maxCx + 1) * sectorW;
        const y1 = (maxCy + 1) * sectorH;

        g.clear();

        // Çok soluk iç dolgu — gameplay görsellerini örtmez.
        g.fillStyle(AOIDebugConfig.OUTLINE_COLOR, AOIDebugConfig.FILL_ALPHA);
        g.fillRect(x0, y0, x1 - x0, y1 - y0);

        // AKTİF SEKTÖR HÜCRELERİ — sunucunun spatial hash'inin gerçek birimi.
        // GÖRÜNÜRLÜK SEMANTİĞİ (yanlış yorumlamamak için kritik): sunucu bir
        // yılanı sektör deposuna KAFA + HER SEGMENT için kaydeder. Uzak yılan,
        // gövdesinin HERHANGİ bir parçası bu hücrelerden HERHANGİ birine
        // girdiği sürece görünür kalır — kafası dış sınırın çok dışında olsa
        // bile. Yani "kutunun dışında ama hâlâ görünüyor" çoğu zaman bug değil,
        // kuyruğunun bir hücreye taşmasıdır. Despawn (RemoveEntity) yalnızca
        // TÜM gövde tüm aktif hücrelerin dışına çıktığı tick'te gelir.
        g.lineStyle(1, AOIDebugConfig.OUTLINE_COLOR, AOIDebugConfig.CURRENT_SECTOR_ALPHA * 0.6);
        for (let sy = minCy; sy <= maxCy; sy++) {
            for (let sx = minCx; sx <= maxCx; sx++) {
                g.strokeRect(sx * sectorW, sy * sectorH, sectorW, sectorH);
            }
        }

        // Kesikli neon dış sınır — spawn/despawn eşiğinin kendisi.
        g.lineStyle(AOIDebugConfig.OUTLINE_WIDTH, AOIDebugConfig.OUTLINE_COLOR, AOIDebugConfig.OUTLINE_ALPHA);
        this._strokeDashedRect(g, x0, y0, x1, y1);

        // Oyuncunun mevcut sektörü — belirgin iç vurgu. Kafa bu hücreden
        // çıktığı anda AOI bloğu bir sektör kayar (sınır sıçraması).
        g.lineStyle(2, AOIDebugConfig.OUTLINE_COLOR, AOIDebugConfig.CURRENT_SECTOR_ALPHA);
        g.strokeRect(cx * sectorW, cy * sectorH, sectorW, sectorH);
        g.fillStyle(AOIDebugConfig.OUTLINE_COLOR, AOIDebugConfig.FILL_ALPHA * 2);
        g.fillRect(cx * sectorW, cy * sectorH, sectorW, sectorH);
    }

    // Phaser Graphics'te yerleşik kesikli çizgi yok — dört kenarı parça parça çiz.
    _strokeDashedRect(g, x0, y0, x1, y1) {
        this._strokeDashedLine(g, x0, y0, x1, y0); // üst
        this._strokeDashedLine(g, x1, y0, x1, y1); // sağ
        this._strokeDashedLine(g, x1, y1, x0, y1); // alt
        this._strokeDashedLine(g, x0, y1, x0, y0); // sol
    }

    _strokeDashedLine(g, ax, ay, bx, by) {
        const dash = AOIDebugConfig.DASH_LENGTH;
        const gap = AOIDebugConfig.GAP_LENGTH;
        const totalLen = Math.hypot(bx - ax, by - ay);
        if (totalLen <= 0) return;
        const ux = (bx - ax) / totalLen;
        const uy = (by - ay) / totalLen;

        let drawn = 0;
        while (drawn < totalLen) {
            const segLen = Math.min(dash, totalLen - drawn);
            g.beginPath();
            g.moveTo(ax + ux * drawn, ay + uy * drawn);
            g.lineTo(ax + ux * (drawn + segLen), ay + uy * (drawn + segLen));
            g.strokePath();
            drawn += dash + gap;
        }
    }

    // ── GİRDİ AÇI SLEW-RATE LIMITER ──────────────────────────────────────────
    // Tasarım gerekçesi ve kök-neden analizi için dosya başındaki STEER_LIMITER
    // bloğuna bakınız. Buradaki iki metot o sözleşmenin uygulamasıdır.

    /**
     * Limiter durumunu sıfırlar; verilen açı geçerliyse ona TOHUMLAR.
     * Tohumlama, kontrollerin (fade-in bitişi, pointer arming, respawn, sekme
     * dönüşü) devreye girdiği ilk karede filtrenin bayat bir açıdan hedefe
     * doğru "süzülmeye" başlamasını — yani görünür bir açılış sapmasını —
     * engeller: filtre daha ilk karede doğru yerde başlar.
     */
    _resetSteeringLimiter(angleRad = null) {
        const seed = Number.isFinite(angleRad) ? Phaser.Math.Angle.Wrap(angleRad) : null;
        this._steer = {
            angle: seed,
            lastRawRad: seed,
            lastRawTime: 0,
            lastRawStep: 0,
            agitation: 0,
        };
    }

    /**
     * Ham fare/joystick açısını, yılanın FİZİKSEL dönüş kapasitesine (ω_max)
     * uyan bant-sınırlı bir hedef açıya dönüştürür.
     *
     * @param {number} rawAngleRad  Ham girdi açısı (rad).
     * @param {Snake}  snake        Oyuncunun yılanı — ω_max ve referans heading.
     * @param {number} deltaMs      Kare süresi (ms).
     * @param {number} timeMs       Sahne saati (ms) — flick penceresi için.
     * @param {boolean} isBoosting  O karede gönderilecek boost niyeti (ω_max'i
     *                              etkiler: boost hızı → speedTurnFactor).
     * @returns {{angle: number, changed: boolean}} `changed`, filtrelenmiş
     *          hedefin ağa bildirilmesi GEREKTİĞİNİ söyler.
     */
    _applySteeringLimiter(rawAngleRad, snake, deltaMs, timeMs, isBoosting) {
        const cfg = STEER_LIMITER;
        const s = this._steer;

        if (!Number.isFinite(rawAngleRad)) {
            return { angle: Number.isFinite(s.angle) ? s.angle : 0, changed: false };
        }
        const raw = Phaser.Math.Angle.Wrap(rawAngleRad);

        // KELEPÇE REFERANSI — görsel head.rotation DEĞİL, tahminin MANTIKSAL
        // movementAngle'ı. Tahmin, _inputDelayQueue sayesinde girdiyi ~tek-yön
        // gecikme kadar GEÇ uygular; dolayısıyla movementAngle(t), sunucunun t
        // anındaki currentAngle'ının en iyi client tahminidir. Sunucu da kendi
        // kelepçesini tam olarak o değere göre uygular (MovementSystem:
        // diff = target − currentAngle), yani iki taraf aynı referansı paylaşır.
        const heading = Number.isFinite(snake?.movementAngle) ? snake.movementAngle : raw;

        // İlk kare / respawn sonrası: tohumla ve olduğu gibi geç.
        if (!Number.isFinite(s.angle)) {
            s.angle = raw;
            s.lastRawRad = raw;
            s.lastRawTime = timeMs;
            s.lastRawStep = 0;
            s.agitation = 0;
            return { angle: raw, changed: true };
        }

        // dt tavanı simülasyonunkiyle AYNI kaynaktan (MAX_SIM_DT_MS): limiter'ın
        // ve tahminin farklı dt görmesi, tam da kapatmaya çalıştığımız türden
        // bir ayrışma üretirdi.
        const maxDtMs = snake?.config?.MAX_SIM_DT_MS ?? 50;
        const dtSec = Math.min(deltaMs, maxDtMs) / 1000;

        // ── 1) ANİ TERS ÇEVİRME (FLICK) TESPİTİ ─────────────────────────────
        const rawStep = Phaser.Math.Angle.Wrap(raw - s.lastRawRad);
        const dtRawMs = Math.max(1, timeMs - s.lastRawTime);

        // Ajitasyon her karede üstel olarak söner (frame-rate agnostik).
        s.agitation *= Math.exp(-dtRawMs / (cfg.AGITATION_DECAY_SEC * 1000));

        const isFastStep = dtRawMs <= cfg.FLICK_WINDOW_MS
            && Math.abs(rawStep) >= cfg.FLICK_STEP_RAD;
        // TERS YÖN ŞARTI kritik: tutarlı (aynı işaretli) hızlı bir dönüş
        // oyuncunun GERÇEK manevrasıdır ve sönümlenmemelidir. Silkeleme ise
        // kendini işaret değiştiren ardışık büyük adımlarla belli eder.
        // ~180°'lik tek sıçrama, işaret şartı aranmadan da ajitasyon sayılır:
        // salınımın ilk yarısı henüz ters adım üretmemiştir ama zaten
        // ulaşılamaz bir hedeftir.
        const isReversal = rawStep * s.lastRawStep < 0;
        if (isFastStep && (isReversal || Math.abs(rawStep) >= Math.PI * 0.75)) {
            s.agitation = Math.min(1, s.agitation + cfg.FLICK_GAIN);
        }

        s.lastRawRad = raw;
        s.lastRawTime = timeMs;
        if (Math.abs(rawStep) > 1e-4) s.lastRawStep = rawStep;

        // ── 2) ÜSTEL AÇISAL SÖNÜMLEME (yalnızca silkelemede devrede) ────────
        // Ajitasyon 0 iken bu blok ATLANIR: normal dönüşe SIFIR gecikme eklenir.
        // Devredeyken bile dönüş hızını yavaşlatmaz — aşağıdaki LEAD kelepçesi
        // zaten hedefi heading'in hemen önünde tutar, sönümleme yalnızca ileri-
        // geri SALINIMI ortalamaya oturtur (ters kadranlar arası zıplama biter).
        let desired = raw;
        if (s.agitation > cfg.AGITATION_EPSILON) {
            const rate = Phaser.Math.Linear(
                cfg.SMOOTH_RATE_CALM, cfg.SMOOTH_RATE_AGITATED, s.agitation);
            const alpha = 1 - Math.exp(-rate * dtSec);
            desired = Phaser.Math.Angle.Wrap(
                s.angle + Phaser.Math.Angle.Wrap(raw - s.angle) * alpha);
        }

        // ── 3) SLEW (A) + LEAD (B) KELEPÇELERİ ──────────────────────────────
        const omegaMax = typeof snake?.getTurnRateRadPerSec === 'function'
            ? snake.getTurnRateRadPerSec(isBoosting)
            : 0;
        if (!(omegaMax > 0)) {
            // ω_max okunamadı (yılan henüz tam kurulmamış). Uydurma bir limit
            // dayatmaktansa eski davranışa düş — yanlış bir kelepçe, hiç
            // kelepçe olmamasından daha kötü bir ayrışma üretirdi.
            const changedRaw = Math.abs(
                Phaser.Math.Angle.Wrap(desired - s.angle)) > cfg.WIRE_EPSILON_RAD;
            s.angle = desired;
            return { angle: desired, changed: changedRaw };
        }

        // (A) SLEW — kare başına azami değişim ω_max·dt. Ağa giden hedef sinyali
        //     böylece bant-sınırlı olur: 30 Hz gönderimde ardışık örnekler arası
        //     fark ≤ ω_max·33ms (~7°) kalır, π değil. Sunucunun gördüğü alt-örnek
        //     ile client'in entegre ettiği tam dizi arasındaki fark ~25 kat düşer.
        const maxSlew = omegaMax * dtSec;
        let next = Phaser.Math.Angle.Wrap(s.angle + Phaser.Math.Clamp(
            Phaser.Math.Angle.Wrap(desired - s.angle), -maxSlew, maxSlew));

        // (B) LEAD — hedef, heading'i en fazla ω_max·LEAD_SEC kadar geçebilir.
        //     "Baş 0°'ye bakarken hedef 180°" durumu artık oluşamaz. Dönüş
        //     YAVAŞLAMAZ: heading dönüş boyunca ω_max ile ilerlediği için hedef
        //     de ω_max ile ilerler, yalnızca sabit bir faz kadar önde kalır —
        //     ve o faz sunucunun her tick'te tam maxTurn adımı atmasına yeter.
        const maxLead = omegaMax * cfg.LEAD_SEC;
        next = Phaser.Math.Angle.Wrap(heading + Phaser.Math.Clamp(
            Phaser.Math.Angle.Wrap(next - heading), -maxLead, maxLead));

        const changed = Math.abs(
            Phaser.Math.Angle.Wrap(next - s.angle)) > cfg.WIRE_EPSILON_RAD;
        s.angle = next;
        return { angle: next, changed };
    }

    update(time, delta) {
        if (!this.gameStarted) return;

        const mySnake = this.myId !== null ? this.snakes.get(this.myId) : null;

        if (this.showAoiDebug) {
            this._updateAoiDebugOverlay(mySnake);
        }

        if (mySnake && mySnake.alive) {
            const head = mySnake.getHead();

            if (head?.active) {
                let targetAngleRad;
                let isBoosting;
                // Deadzone / epsilon guard bunu false yaparsa: aci ne yerel tahmine
                // ne de aga gonderilir (yalniz boost islenir).
                let sendAngle = true;
                // Slew-rate limiter yalnizca GERCEK bir oyuncu girdisi varken
                // calisir. Girdinin tamamen kilitli oldugu dallarda (fade-in,
                // pointer henuz devralmadi) hicbir paket uretilmez ve yon
                // sunucunun bildigi acida tutulur — orada filtre CALISTIRILMAZ,
                // o acaya TOHUMLANIR (bkz. _resetSteeringLimiter).
                let steerActive = true;

                const mob = window.mobileInput;
                if (!this._inputEnabled) {
                    // ── FADE-IN SÜRÜYOR: GİRDİ KİLİTLİ ────────────────────────
                    // Kontroller tam olarak fade tamamlandığında açılır (bkz.
                    // _revealGameplay). Perde ardında/fade sırasında verilen bir
                    // yön, görüntü açılır açılmaz oyuncunun istemediği ani bir
                    // dönüş olarak görünürdü.
                    //
                    // Tahmin DURMAZ: sunucu bu sırada yılanı hareket ettirmeye
                    // devam ediyor. Sunucunun bildiği hedef açıda (spawn yönü ya
                    // da son taahhüt) düz ilerlenir — iki simülasyon ayrışmaz.
                    // Boost da okunmaz; sunucuya hiçbir girdi paketi gitmez.
                    isBoosting = false;
                    targetAngleRad = this._spawnHeadingRad
                        ?? this._lastCommittedAngleRad
                        ?? head.rotation;
                    sendAngle = false;
                    steerActive = false;
                } else if (mob?.enabled) {
                    // ── Mobile: virtual joystick + boost button ───────────────
                    // Joystick açısı doğrudan ekran koordinatlarında atan2(dy,dx) olarak
                    // hesaplanır; kamera döndürme olmadığından world space ile örtüşür.
                    isBoosting = mob.boostActive;
                    if (mob.joystickActive && mob.joystickMagnitude > 0.1) {
                        targetAngleRad = mob.joystickAngle;
                        this._lastCommittedAngleRad = targetAngleRad;
                    } else {
                        // Parmak yoksa yönü koru VE paket gönderme (eskiden her frame
                        // head.rotation gönderiliyordu — gereksiz trafik).
                        // SPAWN'DA: _lastCommittedAngleRad, onStartGame'de sunucunun
                        // start_direction'ı ile tohumlanmıştır — yani joystick'e
                        // dokunulmadan önce yılan tam da sunucunun simüle ettiği
                        // yönde ilerler. Joystick zaten merkezde (joystickActive
                        // false) olduğundan ek bir "re-center" gerekmez.
                        targetAngleRad = this._lastCommittedAngleRad ?? head.rotation;
                        sendAngle = false;
                    }
                } else if (!this._pointerSteeringArmed) {
                    // ── Masaüstü, spawn: fare HENÜZ oynatılmadı ───────────────
                    // activePointer bayat bir konum taşıyor (PLAY düğmesinin
                    // yeri ya da fare canvas'a hiç girmediyse 0,0). Ondan bir
                    // açı türetmek yılanı spawn yönünden koparırdı. Sunucunun
                    // verdiği yönde düz devam et ve açı paketi ÜRETME —
                    // sunucu zaten aynı hedef açıyla simüle ediyor, iki taraf
                    // ayrışmaz. Boost yine de okunur (tıklama anlamlı bir girdi).
                    isBoosting = this.input.activePointer.isDown;
                    targetAngleRad = this._spawnHeadingRad
                        ?? this._lastCommittedAngleRad
                        ?? head.rotation;
                    sendAngle = false;
                    steerActive = false;
                } else {
                    // ── Desktop: mouse ────────────────────────────────────────
                    this.pointer = this.input.activePointer;
                    isBoosting   = this.pointer.isDown;
                    const worldPoint = this.cameras.main.getWorldPoint(this.pointer.x, this.pointer.y);

                    // ── Steering deadzone + açı epsilon guard ──────────────────
                    // Mouse head merkezine çok yakınken atan2 mikro-harekete aşırı
                    // duyarlı olur (açı aniden ~onlarca derece sıçrar) → her frame
                    // farklı quantize açı → sunucuya paket spam'i + görsel titreme.
                    //  1) MIN_ROTATION_RADIUS içinde: açıyı YENİDEN HESAPLAMA ve
                    //     paket GÖNDERME (yön korunur, yılan düz devam eder).
                    //  2) Dışında bile: açı son TAAHHÜT edilenden ANGLE_EPSILON'dan
                    //     az değiştiyse gönderme (mikro-float dalgalanması susar).
                    // Fark SARILMIŞ (wrap) alınır ki ±π sınırında (ör. +179°→−179°,
                    // gerçekte 2°'lik değişim) yapay dev fark oluşup guard'ı atlamasın.
                    // targetAngleRad hem wire hem yerel tahmine besleneceği için,
                    // bastırıldığında taahhüt edilen açıya sabitlenir → client ve
                    // sunucu aynı açıyı tutar (drift yok).
                    const MIN_ROTATION_RADIUS = 35;   // px
                    const ANGLE_EPSILON = 0.03;       // rad (~1.7°)
                    const distToMouse = Phaser.Math.Distance.Between(head.x, head.y, worldPoint.x, worldPoint.y);

                    if (distToMouse < MIN_ROTATION_RADIUS) {
                        targetAngleRad = this._lastCommittedAngleRad ?? head.rotation;
                        sendAngle = false;
                    } else {
                        const rawAngleRad = Phaser.Math.Angle.Between(head.x, head.y, worldPoint.x, worldPoint.y);
                        const prev = this._lastCommittedAngleRad;
                        if (prev !== null && prev !== undefined
                                && Math.abs(Phaser.Math.Angle.Wrap(rawAngleRad - prev)) <= ANGLE_EPSILON) {
                            targetAngleRad = prev;   // değişim epsilon altında — taahhüdü koru
                            sendAngle = false;
                        } else {
                            targetAngleRad = rawAngleRad;
                            this._lastCommittedAngleRad = rawAngleRad;
                            sendAngle = true;
                        }
                    }
                }

                // ── GİRDİ AÇI SLEW-RATE LIMITER (kuantalamadan ÖNCE) ─────────
                // Buradan çıkan açı, hem TELE hem de YEREL TAHMİNE giden TEK
                // değerdir; ikisi aşağıda aynı kuantalama/gecikme yolundan
                // geçer. Limiter'ın kuantalamadan önce çalışması şarttır:
                // sonrasında uygulansaydı ağa bant-sınırsız (silkelenen) sinyal
                // gitmeye devam eder ve 30 Hz gönderim + sunucunun tick başına
                // last-write-wins tamponu onu yeniden aliasing'e sokardı.
                if (!steerActive) {
                    this._resetSteeringLimiter(targetAngleRad);
                } else {
                    const limited = this._applySteeringLimiter(
                        targetAngleRad, mySnake, delta, time, isBoosting);
                    targetAngleRad = limited.angle;
                    // Ham girdi bastırılmış olsa bile (deadzone / ANGLE_EPSILON
                    // guard) limiter hâlâ hedefe doğru süzülüyor olabilir. O
                    // hareket ağa bildirilmezse sunucu client'in tuttuğu hedefi
                    // ASLA öğrenemez ve iki simülasyon yeniden ayrışır — bu
                    // yüzden gönderim burada zorlanır. (Ters yönde bir zorlama
                    // yok: limiter durduğunda guard'ların sessizliği korunur.)
                    if (limited.changed) sendAngle = true;
                }

                // ── Determinizm: açıyı ÖNCE ağ formatına (0-250) kuantala, sonra
                // hem ağa hem de LOKAL TAHMİNE aynı kuantalanmış değeri ver.
                // Eski akış tahmine ham pointer açısını veriyordu; sunucu ise
                // 1.44°'lik adımları görüyordu → iki simülasyon kalıcı olarak
                // ~0.7°'ye kadar farklı yönlere gidiyor ve düşük ping'de bile
                // sürekli mikro-düzeltme (micro-lag hissi) üretiyordu.
                const wireAngle = NetworkManager.quantizeAngleDeg(Phaser.Math.RadToDeg(targetAngleRad));
                const predictedAngleRad = Phaser.Math.DegToRad(wireAngle * 1.44);

                // Ağa HEMEN gönder — gecikme eklenmez.
                this.networkManager.updateAndSendInput(wireAngle, isBoosting, delta, sendAngle);

                // ── INPUT-DELAY ALIGNMENT ─────────────────────────────────────
                // Lokal tahmine input ~tek-yön gecikme (+18 ms gönderim/tick marjı)
                // kadar GEÇ uygulanır: client ve server dönüşe aynı simülasyon
                // anında başlar, dönüş sırasında sunucu arkı geride kalmaz →
                // reconciliation'ın geri-çekme ihtiyacı (dönüşte yavaşlama hissi)
                // büyük ölçüde hiç oluşmaz.
                if (!this._inputDelayQueue) this._inputDelayQueue = [];
                const oneWayMs = Phaser.Math.Clamp(
                    (Number.isFinite(this.currentPingMs) ? this.currentPingMs : 100) / 2, 20, 120) + 18;
                this._inputDelayQueue.push({ t: time + oneWayMs, angle: predictedAngleRad, boost: isBoosting });
                if (this._inputDelayQueue.length > 240) this._inputDelayQueue.shift();

                let applied = this._lastDelayedInput;
                while (this._inputDelayQueue.length && this._inputDelayQueue[0].t <= time) {
                    applied = this._inputDelayQueue.shift();
                }
                this._lastDelayedInput = applied;
                const applyAngle = applied ? applied.angle : (mySnake.movementAngle ?? head.rotation);
                const applyBoost = applied ? applied.boost : isBoosting;

                // İstemci tarafı tahminleme — sunucunun göreceği açıyla birebir
                // aynı değer, sunucuyla aynı simülasyon anında.
                mySnake.updateFromInput(applyAngle, applyBoost, delta, this.networkManager.nextSequenceId);

                // Dinamik Kamera Zoom: Yılan büyüdükçe kamera uzaklaşır
                // baseZoom: ekran boyutuna göre belirlenen taban zoom (bkz. computeBaseZoom)
                const targetZoom = this.baseZoom / (1.0 + (mySnake.scale - 1.0) * 0.12);
                const currentZoom = this.cameras.main.zoom;
                // Frame-rate-agnostik üstel yumuşatma: eski sabit 0.05/frame,
                // 120Hz'de iki kat hızlı yakınsıyordu. 3.0/s ≈ 0.05 @60fps.
                const zoomLerp = 1 - Math.exp(-3.0 * (delta / 1000));
                this.cameras.main.setZoom(currentZoom + (targetZoom - currentZoom) * zoomLerp);
            }
        }

        this.snakes.forEach(snake => {
            if (snake.alive && snake.getHead()?.active) {
                snake.postUpdate(delta);
            }
        });

        if (this.grid) {
            // World-space background: cover the camera's visible world rect
            // (worldView already accounts for zoom) and pin the repeating
            // texture to world coordinates via tilePosition, so the pattern
            // stays put while the sprite itself moves with the camera.
            const view = this.cameras.main.worldView;
            if (view.width > 0 && view.height > 0) {
                const x = Math.floor(view.x);
                const y = Math.floor(view.y);
                this.grid.setPosition(x, y);
                this.grid.setSize(Math.ceil(view.width) + 2, Math.ceil(view.height) + 2);
                this.grid.tilePositionX = x;
                this.grid.tilePositionY = y;
            }
        }

        // ── GÖREV 1: Birleşik eşikli yeme tahmini (rubber-band'siz) ──────────
        // Yem KONUMU asla değişmez (yaslanma/geri-dönüş kaldırıldı). Çekim
        // (uçuş) YALNIZCA oyuncu kafası birleşik eşiğe — foodEatRadiusPx(scale),
        // sunucu FoodConfig.eatRadiusPx ile BİREBİR — girince tetiklenir. Sunucu
        // da yalnızca bu yarıçapta yer; dolayısıyla client'ın çekip sunucunun
        // yemediği bir ara-bant YOKTUR → geri-zıplama yapısal olarak imkânsız.
        const dt = delta / 1000;
        const nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());

        // mySnake yukarıda (update başında) tanımlı — yeniden bildirme.
        const myHead = (mySnake && mySnake.alive && mySnake.getHead()?.active) ? mySnake.getHead() : null;
        const myEatRadius = myHead ? foodEatRadiusPx(mySnake.scale) : 0;
        const myEatRadiusSq = myEatRadius * myEatRadius;

        // GÖREV 2: şimmer (twinkle) faz açısal hızı — nowMs (ms) tabanlı, tüm
        // yemler için tek kez hesaplanır; döngü içinde yem başına yalnızca bir
        // sin + alpha yazımı kalır (4000 yemde bile <0.1ms, ekstra draw-call yok).
        const shimmerOmega = FOOD_SHIMMER_HZ * Math.PI * 2 / 1000;

        // Tahmin edilen yemleri döngü dışında işlemek için toparla (this.foods'u
        // iterasyon sırasında değiştirmemek için).
        const predictedEats = [];

        for (const [foodId, food] of this.foods) {
            const bob = food.bob;
            if (!bob) continue;

            // GÖREV 2: faz-kaymalı alpha nabzı (senkron olmayan canlı parıltı).
            // (fade-in dalı kaldırıldı — tek üreticisi olan _restoreFoodNode artık yok.)
            bob.alpha = FOOD_SHIMMER_MIN_ALPHA
                + FOOD_SHIMMER_AMP * (0.5 + 0.5 * Math.sin(nowMs * shimmerOmega + food.shimmerPhase));

            // Commit YALNIZCA oyuncu için ve birleşik eşikte (yemin kalıcı orijin
            // konumuna göre — sunucu geometrisiyle senkron). Rakiplerin yemesi
            // client'ta tahmin EDİLMEZ; sunucu FOOD_REMOVE'u ile onaylanır.
            // ÖN YAY KAPISI: kafanın hareket yönüne göre ARKADA kalmış yem
            // tahminle çekilmez (geriye doğru yankılanma görüntüsü yok) — çok
            // yakın merkez bölgesi hariç (kafa üstünden geçen yem her yönde
            // yenir). Sunucu arkadaki yemi yine yerse FOOD_REMOVE onayı
            // removeFood → _beginFoodEatingFlight yolundan animasyonu başlatır.
            if (myHead) {
                const fx = bob.x - myHead.x;
                const fy = bob.y - myHead.y;
                const distSq = fx * fx + fy * fy;
                if (distSq <= myEatRadiusSq) {
                    const coreSq = myEatRadiusSq * 0.16; // r·0.4 içinde yön şartı aranmaz
                    const inFrontArc = fx * Math.cos(myHead.rotation) + fy * Math.sin(myHead.rotation) >= 0;
                    if (inFrontArc || distSq <= coreSq) {
                        predictedEats.push({ foodId, food });
                    }
                }
            }
        }

        // Tahmin edilen yemeleri işle: pending-consumption katmanına al, uçuşu
        // başlat, skoru spekülatif ekle. Sunucu onayı FOOD_REMOVE ile gelir.
        for (const { foodId, food } of predictedEats) {
            if (this.pendingConsumption.has(foodId)) continue; // aynı kare tekrar önlemi
            this.foods.delete(foodId);
            // Kayıt artık YALNIZCA bir "onay bekliyor" işaretidir: sunucu
            // FOOD_REMOVE'u geldiğinde çift sayımı önler ve süre aşımında
            // düşürülür. Yemi diriltmek için orijin/renk saklamaya gerek YOK
            // (dirilme kaldırıldı — bkz. aşağıdaki süre aşımı notu).
            this.pendingConsumption.set(foodId, { predictedAtMs: nowMs });
            this._beginFoodEatingFlight(foodId, food, mySnake);
            this.addPlayerScoreForFood(food.value); // predictedEats her zaman oyuncunun yılanıdır
        }

        // ── BEKLEYEN TAHMİNLERİN SÜRE AŞIMI ─────────────────────────────────
        // Süre dolduğunda kayıt SADECE DÜŞÜRÜLÜR: skor geri alınmaz, yem geri
        // getirilmez.
        //
        // NEDEN (iki hatanın ortak kök nedeni): eski davranış, onay gecikmesini
        // "sunucu reddetti" sanıp skoru geri alıyor ve yemi YENİDEN OLUŞTURUYORDU.
        // Oysa gecikme reddin kanıtı DEĞİL, yalnızca gecikmenin kanıtıdır —
        // sunucu yemi gerçekte yemiştir. Yoğun ölüm-düşümü kümelerinde
        // (çok botlu test) FoodMutationCollection paketleri büyüyüp gönderim
        // kuyruğu şiştiğinde onay 1000 ms'i rahatça aşıyordu ve sonuç:
        //   1. Skor, sunucu puanı verdiği halde geri alınıyordu (skor DÜŞÜYOR).
        //   2. Sunucuda ARTIK VAR OLMAYAN yem client'ta diriliyordu (hayalet).
        // Üstelik kendi kendini besliyordu: dirilen yem this.foods'a geri
        // girdiğinden kafa hâlâ üzerindeyken bir sonraki karede yeniden tahmin
        // ediliyor (+değer), 1000 ms sonra yine geri alınıyor (−değer) ve yine
        // diriltiliyordu → asla yenemeyen, sonsuza dek salınan yem.
        //
        // Sunucu OTORİTERDİR: yanlış bir tahmin varsa doğru durum zaten bir
        // sonraki tam FoodCollection anlık görüntüsüyle uzlaştırılır
        // (onFoodCollection, gelen listede olmayan yemleri siler / eksikleri
        // ekler). Zamanlayıcıya dayalı dirilme bu yolun yerini alamaz.
        if (this.pendingConsumption.size > 0) {
            for (const [foodId, rec] of this.pendingConsumption) {
                if (nowMs - rec.predictedAtMs < FOOD_PREDICTION_TIMEOUT_MS) continue;
                this.pendingConsumption.delete(foodId);
            }
        }

        // Yenen yemin kafa merkezine üstel snap ile uçup zamanla küçülerek yok
        // olması. Hedef her frame CANLI kafa merkezi; üstel lerp mesafenin sabit
        // bir oranını her frame kapattığından yem kafayı asla arkadan takip
        // etmez, orbit/looping yapmaz.
        this.eatingFoods.forEach((data, foodId) => {
            const { sprite, targetSnake } = data;
            if (!sprite || !sprite.active) {
                this.eatingFoods.delete(foodId);
                return;
            }
            if (!targetSnake.alive || !targetSnake.getHead()?.active) {
                // Yiyen yılan öldüyse/aktif değilse yemi hemen temizle.
                sprite.destroy();
                this.eatingFoods.delete(foodId);
                return;
            }

            const head = targetSnake.getHead();

            // Frame-rate-agnostik üstel snap: kalan mesafenin k oranı kapanır.
            const k = 1 - Math.exp(-FOOD_MAGNET_SNAP_RATE * dt);
            sprite.x += (head.x - sprite.x) * k;
            sprite.y += (head.y - sprite.y) * k;

            // Zaman tabanlı ölçek çöküşü: 1 → 0, FOOD_EAT_SHRINK_MS içinde.
            data.elapsedMs += delta;
            const s = 1 - data.elapsedMs / FOOD_EAT_SHRINK_MS;
            const d = Math.hypot(head.x - sprite.x, head.y - sprite.y);

            // Süre doldu VEYA kafa merkezine değdi → ANINDA imha (artık görsel yok).
            if (s <= 0 || d < FOOD_EAT_DESTROY_DIST) {
                sprite.destroy();
                this.eatingFoods.delete(foodId);
                return;
            }

            sprite.setScale(s);
            sprite.setAlpha(0.2 + 0.8 * s); // küçülürken hafif solma
        });

        // Food'lar artık statik renk frame'leri kullanıyor — animasyon döngüsü gerekmiyor.
        // Her Bob oluşturulurken sabit bir renk frame'i atanıyor.

        const fps = this.game.loop.actualFps;
        let coordsText = "";
        let coordX = 0, coordY = 0;
        if (mySnake && mySnake.getHead()) {
            coordX = Math.round(mySnake.getHead().x);
            coordY = Math.round(mySnake.getHead().y);
            coordsText = ` | Koord: ${coordX}, ${coordY}`;
        }
        // Update HTML HUD with real-time stats (replaced legacy fpsText)
        // Skor burada DEĞİL, yem yendiği anda güncellenir (addPlayerScoreForFood).
        // THROTTLE (10Hz): 120Hz+ ekranda her frame DOM yazmak layout/paint
        // baskısıyla frame süresi jitter'ı üretiyordu — görsel akıcılığı bozan
        // tam da bu tür düzensiz uzun frame'lerdir. Sayaç için 100ms yeterli.
        if (this.gameStarted) {
            this._hudStatsAccumMs = (this._hudStatsAccumMs ?? 0) + delta;
            if (this._hudStatsAccumMs >= 100) {
                this._hudStatsAccumMs = 0;
                updateHUDStats(Math.round(fps), this.currentPingMs, coordX, coordY);
            }
        }

        if (this.minimapGraphics) {
            this.drawMinimap(mySnake);
        }
    }

    // Responsive minimap footprint — single source of truth, also consumed by
    // MobileControls to keep the boost button clear of the minimap corner.
    // Mobile (short dimension < 720px): ~24% of the short dimension, 88–120px.
    // Desktop: the original 160px.
    minimapMetrics() {
        const w = this.cameras.main.width;
        const h = this.cameras.main.height;
        const minDim = Math.min(w, h);
        if (minDim < 720) {
            return {
                size: Math.round(Phaser.Math.Clamp(minDim * 0.24, 88, 120)),
                padding: 14
            };
        }
        return { size: 160, padding: 24 };
    }

    drawMinimap(mySnake) {
        const { size, padding } = this.minimapMetrics();
        const cx = this.cameras.main.width - size / 2 - padding;
        const cy = this.cameras.main.height - size / 2 - padding;

        const g = this.minimapGraphics;
        g.clear();

        // Minimap border and background (matching reference design colors)
        g.fillStyle(0x150136, 1); // surface-container-lowest
        g.fillCircle(cx, cy, size / 2);
        g.lineStyle(4, 0x322053, 1); // surface-container-high
        g.strokeCircle(cx, cy, size / 2);

        if (!this.worldRadius) return;
        
        // Calculate scale from world to minimap
        const mapScale = (size / 2) / this.worldRadius;

        // Draw foods as tiny dots
        g.fillStyle(0xc2caad, 0.5); // on-surface-variant
        for (const food of this.foods.values()) {
            const bob = food.bob;
            if (!bob) continue;

            const wx = bob.x - this.worldRadius;
            const wy = bob.y - this.worldRadius;

            const mx = cx + wx * mapScale;
            const my = cy + wy * mapScale;

            // Distances check to keep them inside the minimap circle
            const distSq = wx * wx + wy * wy;
            if (distSq <= this.worldRadius * this.worldRadius) {
                g.fillRect(mx, my, 1.5, 1.5);
            }
        }

        // Draw player as a prominent dot
        if (mySnake && mySnake.alive && mySnake.getHead()) {
            const head = mySnake.getHead();
            const wx = head.x - this.worldRadius;
            const wy = head.y - this.worldRadius;

            const mx = cx + wx * mapScale;
            const my = cy + wy * mapScale;

            const distSq = wx * wx + wy * wy;
            if (distSq <= this.worldRadius * this.worldRadius) {
                g.fillStyle(0xb7f700, 1.0); // primary-container
                g.fillCircle(mx, my, 3);
            }
        }
    }

    createTiledBackground() {
        // WORLD-space background (not HUD): it must render on the zoomed main
        // camera so food/snakes (depth >= 0) draw on top of it. On the UI
        // camera the opaque checker would be composited AFTER the world camera
        // and cover every world object. Each frame, update() stretches it over
        // the camera's visible world rectangle and offsets the texture so the
        // pattern stays fixed in world space (cells scale naturally with zoom).
        this.grid = this.registerWorld(
            this.add.tileSprite(0, 0, 32, 32, 'grid32')
                .setOrigin(0, 0)
                .setDepth(-1)
        );
    }

    // Sekme tekrar görünür olduğunda çağrılır (Page Visibility API).
    // Gizli geçen sürede sunucu simülasyona devam etti; birikmiş farkı
    // kademeli düzeltmelerle kapatmak yerine tüm yılanları otoriter duruma
    // TEK seferde hizala ve bayat animasyon state'ini temizle.
    _resyncAfterTabReturn() {
        if (!this.gameStarted) return;

        this.snakes.forEach(snake => snake.hardResync());

        // Sekme gizliyken rAF durmuştur: limiter'ın son ham örneği ve zaman
        // damgası dakikalarca eski olabilir. Bu bayat durumla devam etmek,
        // dönüşte tek karelik dev bir "flick" tespiti (gereksiz sönümleme) ya
        // da hardResync'in yeni heading'ine göre anlamsız bir lead kelepçesi
        // üretirdi. Otoriter heading'e yeniden tohumla.
        const resyncSnake = this.myId !== null ? this.snakes.get(this.myId) : null;
        this._resetSteeringLimiter(
            Number.isFinite(resyncSnake?.movementAngle) ? resyncSnake.movementAngle : null);

        // Yarım kalmış yeme animasyonları bayat koordinatlarda titreşir — bitir.
        this.eatingFoods.forEach(({ sprite }) => sprite?.destroy());
        this.eatingFoods.clear();
        // Bekleyen tahminler bayat: sekme dönüşünde onay/timeout mantığı anlamsız,
        // sunucu otoriter durumu hardResync ile zaten hizalandı — kayıtları temizle.
        this.pendingConsumption.clear();

        // Kamerayı yeni kafa konumuna anında taşı (lerp'le sürüklenmesin).
        const mySnake = this.myId !== null ? this.snakes.get(this.myId) : null;
        const head = mySnake?.getHead();
        if (head?.active) {
            this.cameras.main.centerOn(head.x, head.y);
        }
    }

    // Physics step tamamlandıktan sonra, render öncesi çağrılır.
    // Segmentleri ve gözleri head'in gerçek fiziksel pozisyonuyla senkronize eder.
    _onPostUpdate() {
        if (!this.gameStarted) return;
        this.snakes.forEach(snake => {
            if (snake.alive && snake.getHead()?.active) {
                snake.postPhysicsUpdate();
            }
        });
    }
}
