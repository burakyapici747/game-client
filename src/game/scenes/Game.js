import Phaser from 'phaser';
import { Snake } from './Snake';
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
// pending katmanında tutulur. Sunucu bu süre içinde onaylamazsa (nadir sınır
// durumu: kafa tahmini otoriteden birkaç px sapmış) tahmin REDDEDİLMİŞ sayılır:
// spekülatif skor geri alınır ve yem orijinal konumunda yumuşakça geri getirilir
// (sert ışınlama YOK). Süre, en kötü RTT + sunucu tick'ini rahatça aşar.
const FOOD_PREDICTION_TIMEOUT_MS = 1000;
const FOOD_RESTORE_FADE_MS = 200; // reddedilen yemin geri gelirken fade-in süresi

// SUNUCU AYNASI — game-server ScoreConfig.SCORE_PER_SEGMENT. Boost/shrink ile
// bir segment kaybında HUD skoru bu kadar düşürülür (GÖREV 2.4, gerçek-zamanlı).
const CLIENT_SCORE_PER_SEGMENT = 50;

// ── AOI DEBUG OVERLAY (sunucu görünürlük sınırının görselleştirilmesi) ──────
// Sunucu algoritması: AOICalculationSystem.fill3x3AOI — AOI, oyuncunun
// KAFASINA değil, kafanın bulunduğu SEKTÖRE merkezlenmiş 3x3 sektörlük
// bloktur ve sektör GRID'ine hizalıdır: kafa bir sektör çizgisini geçtiği
// anda sınır bir sektör kayar (sürekli kayan bir kutu DEĞİLDİR — despawn
// eşiğini doğrulamak için bunu aynen çizmek gerekir).
// SENKRON SÖZLEŞMESİ: SECTOR_COUNT_* ve AOI_SECTOR_RADIUS sunucudaki
// MapConfig.SECTOR_COUNT_X/Y (30) ve fill3x3AOI (±1) ile BIREBIR aynı
// tutulmalıdır. Sektör boyutu = dünya boyutu / 30 ≈ 666.67px.
// Y-EKSENİ NOTU: sunucu sektör satırını metre uzayında (Y-yukarı) hesaplar,
// client piksel uzayında (Y-aşağı) çizer; grid tam 30 satır olduğundan sınır
// çizgileri çakışır ve "oyuncunun sektörü ± 1" bloğu ayna-değişmezidir —
// piksel uzayında çizilen dikdörtgen geometrik olarak birebir doğrudur.
const AOIDebugConfig = {
    SHOW_AOI_DEBUG: false,     // başlangıç durumu (O tuşu ile aç/kapa)
    TOGGLE_KEY: 'keydown-O',
    SECTOR_COUNT_X: 30,        // sunucu: MapConfig.SECTOR_COUNT_X
    SECTOR_COUNT_Y: 30,        // sunucu: MapConfig.SECTOR_COUNT_Y
    AOI_SECTOR_RADIUS: 1,      // sunucu: fill3x3AOI → merkez ± 1 sektör
    OUTLINE_COLOR: 0x39ff14,   // neon yeşil
    OUTLINE_ALPHA: 0.9,
    OUTLINE_WIDTH: 2,
    FILL_ALPHA: 0.03,          // gameplay görsellerini örtmeyecek kadar soluk
    CURRENT_SECTOR_ALPHA: 0.35, // oyuncunun mevcut sektörü (ince iç çizgi)
    DASH_LENGTH: 14,
    GAP_LENGTH: 10,
};

export class Game extends Phaser.Scene {
    constructor() {
        super('Game');
        this.snakes = new Map();
        this.foods = new Map();
        this.eatingFoods = new Map();
        // Pending-consumption katmanı: tahminle yenmiş ama sunucu onayı beklenen
        // yemler. foodId → { value, origX, origY, colorFrame, predictedAtMs }.
        // Onay (FOOD_REMOVE) gelince silinir; timeout'ta reddedilip geri getirilir.
        this.pendingConsumption = new Map();
        this.foodBlitter = null; // Tüm yemler için tek havuzlanmış Blitter (tek draw call)
        this.pendingSegmentMutations = new Map();
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
        this.myId = null;
        this.foodBlitter = null;
        this.grid = null;
        this.boundaryGraphics = null;
        this.worldRadius = 0;

        this.playerScore = 0;
        this.foodsEaten = 0;

        // Input-delay kuyruğu — restart'ta önceki tura ait girdiler sızmasın.
        this._inputDelayQueue = [];
        this._lastDelayedInput = null;
        // Steering deadzone/epsilon guard'inin son TAAHHUT edilen aci degeri (rad).
        // Bu acidan MIN_ROTATION_RADIUS ya da ANGLE_EPSILON altinda kalan girdi
        // ne yerel tahmini ne de agi gunceller. Respawn'da sifirlanmali.
        this._lastCommittedAngleRad = null;

        this.gameStarted = false;
        this.initialDataFlags = { startInfo: false, entities: false };
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

        this.events.on('start_game', this.onStartGame, this);
        this.events.on('self_position', this.onSelfPosition, this);
        this.events.on('entity_collection', this.onEntityCollection, this);


        this.events.on('segment_mutation_collection', this.onSegmentMutationCollection, this);
        this.events.on('food_collection', this.onFoodCollection, this);
        this.events.on('food_mutation_collection', this.onFoodMutationCollection, this);
        this.events.on('remove_entity', this.onRemoveEntity, this);
        this.events.on('disconnected', this.onDisconnected, this);
        this.events.on('death_notification', this.onDeathNotification, this);

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
            this.events.off('food_collection', this.onFoodCollection, this);
            this.events.off('food_mutation_collection', this.onFoodMutationCollection, this);
            this.events.off('remove_entity', this.onRemoveEntity, this);
            this.events.off('disconnected', this.onDisconnected, this);
            this.events.off('death_notification', this.onDeathNotification, this);
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

        // Initialize default leaderboard
        updateHUDLeaderboard([]);

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

        const startX = Number(startInfo?.x);
        const startY = Number(startInfo?.y);
        const startSegmentCount = Number(startInfo?.segmentCount ?? startInfo?.segment_count);
        const startScale = Number(startInfo?.scale ?? 1.0);
        const worldRadius = Number(startInfo?.worldRadius ?? startInfo?.world_radius);
        const startDirection = Number(startInfo?.startDirection ?? startInfo?.start_direction ?? 0);

        if (Number.isFinite(worldRadius)) {
            this.worldRadius = worldRadius;
            const worldSize = worldRadius * 2;
            this.cameras.main.setBounds(0, 0, worldSize, worldSize);
            // Physics world bounds'u kamera sınırından çok büyük tut:
            // cameras.main.setBounds() bazı Phaser sürümlerinde physics.world.setBounds()'ı
            // tetikler ve snake head body sınırda sıkışır. Bunu önlemek için fizik sınırını
            // görsel sınırın çok ötesine alıyoruz — ölüm kontrolü sunucu tarafından yapılıyor.
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

        this.ensurePlayerSnake(
            clientId,
            Number.isFinite(startX) ? startX : 0,
            Number.isFinite(startY) ? startY : 0,
            Number.isFinite(startSegmentCount) ? startSegmentCount : undefined,
            Number.isFinite(startScale) ? startScale : undefined,
            startDirection
        );
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
        }
    }

    onSegmentMutationCollection(segmentMutationCollection) {
        const mutations = segmentMutationCollection?.mutations ?? [];
        if (mutations.length === 0) return;

        mutations.forEach((mutation) => {
            const entityId = this.toId(mutation?.entityId ?? mutation?.entity_id);
            if (entityId === null) return;

            // GÖREV 2.4: Oyuncunun KENDİ yılanı segment KAYBEDERSE (boost/shrink →
            // sunucu drainOneSegment), HUD skorunu gerçek-zamanlı düşür. Sunucu
            // ScoreConfig.SCORE_PER_SEGMENT aynası. Segment EKLEME'de skor DEĞİŞMEZ
            // (puan yem yenirken addPlayerScoreForFood ile eklenir; çift sayım olmaz).
            if (entityId === this.myId) {
                const removed = this._parseRemovedSegmentCount(mutation);
                if (removed > 0) {
                    this.playerScore = Math.max(0, this.playerScore - removed * CLIENT_SCORE_PER_SEGMENT);
                    updateHUDScore(this.playerScore);
                }
            }

            const snake = this.snakes.get(entityId);
            if (!snake) {
                this.queuePendingSegmentMutation(entityId, mutation);
                return;
            }

            snake.applySegmentMutationFromServer(mutation);
        });
    }

    // Bir segment mutasyonundan çıkarılan segment sayısını çözer (SEGMENT_REMOVE
    // değilse 0). Tip kodlaması Snake.applySegmentMutationFromServer ile aynıdır:
    // SEGMENT_REMOVE = 'SEGMENT_REMOVE' veya sayısal 1.
    _parseRemovedSegmentCount(mutation) {
        const type = mutation?.mutationType ?? mutation?.mutation_type;
        const isRemove = type === 'SEGMENT_REMOVE' || type === 1;
        if (!isRemove) return 0;
        const count = Number(mutation?.removedSegmentCount ?? mutation?.removed_segment_count ?? 0);
        return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
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
        this.checkInitialDataComplete();

        const x = Number(selfPosition?.x);
        const y = Number(selfPosition?.y);
        const snake = this.ensurePlayerSnake(
            entityId,
            Number.isFinite(x) ? x : 0,
            Number.isFinite(y) ? y : 0
        );
        this.flushPendingSegmentMutations(entityId, snake);
        snake.updateSelfPositionFromServer(selfPosition);
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
        if (scale !== undefined && !Number.isNaN(scale) && scale > 0) {
            playerSnake.scale = scale;
            playerSnake._updateSegmentScaling(); // görsel boyut = sunucu scale, ilk kareden itibaren
        }
        this.snakes.set(entityId, playerSnake);
        this.cameras.main.startFollow(playerSnake.getHead(), true, 0.15, 0.15);
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

    checkInitialDataComplete() {
        if (!this.gameStarted && this.initialDataFlags.startInfo && this.initialDataFlags.entities) {
            this.gameStarted = true;
            if (!this.grid) {
                this.createTiledBackground();
            }
            this.hideLoader();
        }
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

        const targetX = Math.round(x);
        const targetY = Math.round(y);

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

        // 300 px: 45 px yeme yarıçapı + ~200 ms gecikme × 225 px/s ≈ 90 px + güvenlik payı
        if (closestSnake && minDistance < 300 * closestSnake.scale) {
            this._beginFoodEatingFlight(foodId, food, closestSnake);
            // Tahmin edilemeden sunucu onayıyla gelen oyuncu yemesi de puan kazandırır
            if (closestSnake.isPlayerControlled) this.addPlayerScoreForFood(food.value);
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

    // Yenen yemin sunucudan gelen value'suna göre puan; HUD anında güncellenir.
    addPlayerScoreForFood(value) {
        this.playerScore += Number.isFinite(value) ? value : 0;
        this.foodsEaten += 1;
        updateHUDScore(this.playerScore);
    }

    // Reddedilen tahmin (sunucu onaylamadı) sonrası yemi orijinal konumunda
    // yumuşak fade-in ile GERİ getirir (sert ışınlama yok). rec: pending kaydı.
    _restoreFoodNode(foodId, rec) {
        if (this.foods.has(foodId)) return; // zaten mevcutsa (yarış) dokunma
        const bob = this.ensureFoodBlitter().create(Math.round(rec.origX), Math.round(rec.origY), rec.colorFrame);
        bob.alpha = 0;
        this.foods.set(foodId, {
            bob,
            value: rec.value,
            colorFrame: rec.colorFrame,
            shimmerPhase: this.seededRandom(foodId * 13) * Math.PI * 2,
            fadeInMsLeft: FOOD_RESTORE_FADE_MS,
        });
    }

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
        console.log("Bağlantı koptu!");
        this.gameStarted = false;
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
    // GRID'e hizalı 3x3 sektör bloğu (dünya kenarlarında sunucu gibi kırpılır).
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

        // Sunucu fill3x3AOI dünya kenarında komşuları atlar → aynı kırpma.
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

                const mob = window.mobileInput;
                if (mob?.enabled) {
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
                        targetAngleRad = this._lastCommittedAngleRad ?? head.rotation;
                        sendAngle = false;
                    }
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
            let alpha = FOOD_SHIMMER_MIN_ALPHA
                + FOOD_SHIMMER_AMP * (0.5 + 0.5 * Math.sin(nowMs * shimmerOmega + food.shimmerPhase));
            // Geri getirilen (reddedilmiş tahmin) yemin yumuşak fade-in çarpanı.
            if (food.fadeInMsLeft !== undefined) {
                food.fadeInMsLeft -= delta;
                if (food.fadeInMsLeft <= 0) food.fadeInMsLeft = undefined;
                else alpha *= (1 - food.fadeInMsLeft / FOOD_RESTORE_FADE_MS);
            }
            bob.alpha = alpha;

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
            // Reddedilme (timeout) durumunda birebir geri getirebilmek için yemin
            // orijin/renk verisini sakla (bob uçuşta yok edilecek).
            this.pendingConsumption.set(foodId, {
                value: food.value,
                origX: food.bob.x,
                origY: food.bob.y,
                colorFrame: food.colorFrame,
                predictedAtMs: nowMs,
            });
            this._beginFoodEatingFlight(foodId, food, mySnake);
            this.addPlayerScoreForFood(food.value); // predictedEats her zaman oyuncunun yılanıdır
        }

        // Bekleyen tahminlerin timeout denetimi: sunucu FOOD_PREDICTION_TIMEOUT_MS
        // içinde onaylamadıysa tahmin REDDEDİLMİŞ say → skoru geri al, yemi
        // orijinal konumunda yumuşak fade-in ile geri getir (sert ışınlama yok).
        if (this.pendingConsumption.size > 0) {
            for (const [foodId, rec] of this.pendingConsumption) {
                if (nowMs - rec.predictedAtMs < FOOD_PREDICTION_TIMEOUT_MS) continue;
                this.playerScore = Math.max(0, this.playerScore - (Number.isFinite(rec.value) ? rec.value : 0));
                this.foodsEaten = Math.max(0, this.foodsEaten - 1);
                updateHUDScore(this.playerScore);
                this._restoreFoodNode(foodId, rec);
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
