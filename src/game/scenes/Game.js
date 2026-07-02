import Phaser from 'phaser';
import { Snake } from './Snake';
import { NetworkManager } from './../../network/NetWorkManager';
import { MobileControls } from './../ui/MobileControls';

const FOOD_COLOR_COUNT = 16; // Preloader'daki renk varyant sayısı

export class Game extends Phaser.Scene {
    constructor() {
        super('Game');
        this.snakes = new Map();
        this.foods = new Map();
        this.eatingFoods = new Map();
        this.predictedEatenFoodIds = new Set(); // Client-side eat prediction: foods eaten before server confirms
        this.foodBlitter = null;       // Normal food (scale=1), 16px glow dot
        this.foodBlitterLarge = null;   // Large food (scale>1), 24px glow dot
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
    }

    create() {
        this.gameStarted = false;
        this.initialDataFlags = { startInfo: false, entities: false };
        this.networkManager = new NetworkManager(this);

        this.events.on('start_game', this.onStartGame, this);
        this.events.on('self_position', this.onSelfPosition, this);
        this.events.on('entity_collection', this.onEntityCollection, this);


        this.events.on('segment_mutation_collection', this.onSegmentMutationCollection, this);
        this.events.on('food_collection', this.onFoodCollection, this);
        this.events.on('food_mutation_collection', this.onFoodMutationCollection, this);
        this.events.on('remove_entity', this.onRemoveEntity, this);
        this.events.on('disconnected', this.onDisconnected, this);
        this.events.on('death_notification', this.onDeathNotification, this);

        // Physics step SONRASI, render ÖNCESİ: segmentler ve gözler head'in gerçek
        // fiziksel pozisyonuyla senkronize edilir. update() içinde physics henüz
        // çalışmadığından oradan çağrılmak 1 frame gecikmeye (esniyor hissi) yol açıyordu.
        this.events.on('postupdate', this._onPostUpdate, this);

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

        this.fpsText = this.add.text(4, 4, 'FPS: 0', {
            fontSize: '12px', fontFamily: 'monospace', color: '#ffffff',
            backgroundColor: '#00000088', padding: { left: 4, right: 4, top: 2, bottom: 2 }
        }).setScrollFactor(0).setDepth(1000);

        this.minimapGraphics = this.add.graphics().setScrollFactor(0).setDepth(2000);

        this.registerHUD(this.fpsText, this.minimapGraphics);

        this.createLoadingUI();
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

        if (this.grid) {
            this.grid.setSize(width, height);
        }

        this.mobileControls?.resize(width, height);

        if (this.loadingContainer) {
            const cx = width / 2;
            const cy = height / 2;
            const [bg, text, spinner] = this.loadingContainer.list;
            if (bg) { bg.setPosition(cx, cy); bg.setSize(width, height); }
            if (text) text.setPosition(cx, cy - 30);
            if (spinner) { spinner.x = cx; spinner.y = cy + 30; }
        }
    }

    createLoadingUI() {
        const cx = this.cameras.main.width / 2;
        const cy = this.cameras.main.height / 2;

        this.loadingContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(9999);
        this.registerHUD(this.loadingContainer);

        // Arkaplan
        const bg = this.add.rectangle(cx, cy, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.85);
        this.loadingContainer.add(bg);

        // Yazi
        const text = this.add.text(cx, cy - 30, 'Waiting For Server...', {
            fontSize: '24px',
            fontFamily: 'Inter, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.loadingContainer.add(text);

        // Yukleniyor animasyonu
        const spinner = this.add.graphics();
        spinner.x = cx;
        spinner.y = cy + 30;
        this.loadingContainer.add(spinner);

        let angle = 0;
        this.tweens.add({
            targets: { value: 360 },
            value: 360,
            duration: 1000,
            repeat: -1,
            onUpdate: (tween) => {
                angle = Phaser.Math.DegToRad(tween.getValue());
                spinner.clear();
                spinner.lineStyle(4, 0x00ff00, 1);
                spinner.beginPath();
                spinner.arc(0, 0, 20, angle, angle + Math.PI * 1.5, false);
                spinner.strokePath();
            }
        });
    }

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
        if (!this.loadingContainer) {
            return;
        }

        this.loadingContainer.setAlpha(0);
        this.loadingContainer.destroy();
        this.loadingContainer = null;
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

        for (const [foodId, foodBobs] of this.foods) {
            if (incomingFoodIds.has(foodId)) continue;
            // foodBobs is an array of Blitter.Bob — iterate and destroy each one individually
            const bobsArray = Array.isArray(foodBobs) ? foodBobs : [foodBobs];
            bobsArray.forEach(bob => bob.destroy());
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
        this.pendingSegmentMutations.delete(entityId);

        const snake = this.snakes.get(entityId);
        if (!snake) return;

        snake.destroy();
        this.snakes.delete(entityId);
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
        if (scale !== undefined && !Number.isNaN(scale) && scale > 0) playerSnake.scale = scale;
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
    // Her food Bob'u oluşturulurken rastgele bir renk frame'i atanır.
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

        const existingFood = this.foods.get(foodId);
        if (existingFood) {
            const bobsArray = Array.isArray(existingFood) ? existingFood : [existingFood];
            bobsArray.forEach(bob => {
                if (bob && bob.originalX === undefined) {
                    bob.originalX = bob.x;
                    bob.originalY = bob.y;
                }
            });
            return foodId;
        }

        const scaleValue = Number(foodData?.scale ?? 1);
        const isLarge = scaleValue > 1;

        // Normal food: 16px glow dot, Large food: 24px glow dot
        const targetBlitter = isLarge ? this.ensureFoodBlitterLarge() : this.ensureFoodBlitter();

        const bobs = [];
        // Deterministik kümeleme: her yiyecek ID'sine göre 2-4 arası nokta oluştur
        // (Sunucu tarafında food sayısı 20.000'e çıktığı için max boyutu hafif optimize ediyoruz)
        const clusterSize = 2 + Math.floor(this.seededRandom(foodId) * 3);

        const baseColor = Math.floor(this.seededRandom(foodId * 7) * FOOD_COLOR_COUNT);
        
        // 1. Ana yem parçasını tam merkeze koy.
        const centerBob = targetBlitter.create(targetX, targetY, baseColor);
        centerBob.originalX = targetX;
        centerBob.originalY = targetY;
        bobs.push(centerBob);

        // 2. Diğer parçaları etrafına, daha düzenli ve organik bir dağılımla (spiral/yıldız) yay.
        for (let i = 1; i < clusterSize; i++) {
            // Açıyı i'ye göre asimetrik ama dengeli dağıtıp ufak bir rastgelelik ekleyelim
            const baseAngle = (i / clusterSize) * Math.PI * 2;
            const angleOffset = (this.seededRandom(foodId + i * 100) - 0.5) * Math.PI * 0.5;
            const finalAngle = baseAngle + angleOffset;
            
            // Merkeze olan uzaklığı düzenli bir şekilde artırarak rastgele yığılmaları (kümelenme) engelle
            const distance = 12 + (i * 6) + (this.seededRandom(foodId + i * 200) * 8);

            const offsetX = Math.cos(finalAngle) * distance;
            const offsetY = Math.sin(finalAngle) * distance;
            
            // Daha organik bir görüntü için %80 oranında ana renkle aynı yap, %20 ihtimalle farklı bir renk
            let colorFrame = baseColor;
            if (this.seededRandom(foodId + i * 300) > 0.8) {
                colorFrame = Math.floor(this.seededRandom(foodId + i * 400) * FOOD_COLOR_COUNT);
            }

            const bob = targetBlitter.create(targetX + offsetX, targetY + offsetY, colorFrame);
            bob.originalX = targetX + offsetX;
            bob.originalY = targetY + offsetY;
            bobs.push(bob);
        }

        this.foods.set(foodId, bobs);
        return foodId;
    }

    removeFood(rawFoodId) {
        const foodId = this.toFoodId(rawFoodId);
        if (foodId === null) return;

        // Oyuncu kendi yılanıyla bu yemi zaten tahmin ederek yedi; sunucu sadece onaylıyor.
        // eatingFoods animasyonu zaten devam ediyor — seti temizleyip çık.
        if (this.predictedEatenFoodIds.has(foodId)) {
            this.predictedEatenFoodIds.delete(foodId);
            return;
        }

        // Uzak yılan tarafından yenilen yem (veya sunucu tahminimizden önce bildirdi)
        const bobs = this.foods.get(foodId);
        if (!bobs) return;

        const bobsArray = Array.isArray(bobs) ? bobs : [bobs];
        this.foods.delete(foodId);

        const centerBob = bobsArray[0];
        if (!centerBob) {
            bobsArray.forEach(bob => bob.destroy());
            return;
        }

        // Mıknatıs efekti bob konumunu zaten yılan kafasına doğru çekmiş olabilir.
        // originalX/Y yerine güncel bob.x/y kullanmak çok daha isabetli bir mesafe verir.
        const checkX = centerBob.x;
        const checkY = centerBob.y;

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
            this.eatingFoods.set(foodId, { bobs: bobsArray, targetSnake: closestSnake });
        } else {
            bobsArray.forEach(bob => bob.destroy());
        }
    }

    clearFoods() {
        if (this.foodBlitter) {
            this.foodBlitter.clear();
            this.foodBlitter.destroy();
        }
        if (this.foodBlitterLarge) {
            this.foodBlitterLarge.clear();
            this.foodBlitterLarge.destroy();
        }
        this.foodBlitter = null;
        this.foodBlitterLarge = null;
        this.foods.clear();
        this.eatingFoods.clear();
        this.predictedEatenFoodIds.clear();
    }

    ensureFoodBlitter() {
        if (this.foodBlitter) return this.foodBlitter;
        this.foodBlitter = this.registerWorld(this.add.blitter(0, 0, 'food_dot').setDepth(0));
        return this.foodBlitter;
    }

    ensureFoodBlitterLarge() {
        if (this.foodBlitterLarge) return this.foodBlitterLarge;
        this.foodBlitterLarge = this.registerWorld(this.add.blitter(0, 0, 'food_dot_large').setDepth(0));
        return this.foodBlitterLarge;
    }


    onDeathNotification(data) {
        const score = data?.score ?? 0;
        this.onGameOver({ score: score, killedBy: 'Çarpışma' });
    }

    onGameOver(gameOverInfo) {
        if (!this.gameStarted) return;
        console.log(`Oyun Bitti! Skor: ${gameOverInfo.score}`);
        this.gameStarted = false;
        
        const cx = this.cameras.main.width / 2;
        const cy = this.cameras.main.height / 2;

        // Karartma efekti
        const overlay = this.add.rectangle(cx, cy, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.7)
            .setOrigin(0.5).setScrollFactor(0).setDepth(10000);

        // Modern Game Over Paneli
        const panel = this.add.graphics().setScrollFactor(0).setDepth(10001);
        panel.fillStyle(0x1a1a1a, 0.95);
        panel.fillRoundedRect(cx - 200, cy - 150, 400, 300, 20);
        panel.lineStyle(2, 0x00ff00, 1);
        panel.strokeRoundedRect(cx - 200, cy - 150, 400, 300, 20);

        const titleText = this.add.text(cx, cy - 100, 'GAME OVER', {
            fontSize: '48px', fontFamily: 'Outfit, sans-serif', color: '#ff3333', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10002);

        const scoreLabel = this.add.text(cx, cy - 10, `Final Score`, {
            fontSize: '18px', fontFamily: 'Inter, sans-serif', color: '#aaaaaa'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10002);

        const scoreText = this.add.text(cx, cy + 30, `${gameOverInfo.score}`, {
            fontSize: '64px', fontFamily: 'Outfit, sans-serif', color: '#00ff00', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10002);

        const retryText = this.add.text(cx, cy + 110, 'Press F5 to Play Again', {
            fontSize: '16px', fontFamily: 'Inter, sans-serif', color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10002);

        this.registerHUD(overlay, panel, titleText, scoreLabel, scoreText, retryText);
    }

    onDisconnected() {
        console.log("Bağlantı koptu!");
        this.gameStarted = false;
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


    update(time, delta) {
        if (!this.gameStarted) return;

        const mySnake = this.myId !== null ? this.snakes.get(this.myId) : null;

        if (mySnake && mySnake.alive) {
            const head = mySnake.getHead();

            if (head?.active) {
                let targetAngleRad;
                let isBoosting;

                const mob = window.mobileInput;
                if (mob?.enabled) {
                    // ── Mobile: virtual joystick + boost button ───────────────
                    // Joystick açısı doğrudan ekran koordinatlarında atan2(dy,dx) olarak
                    // hesaplanır; kamera döndürme olmadığından world space ile örtüşür.
                    isBoosting = mob.boostActive;
                    if (mob.joystickActive && mob.joystickMagnitude > 0.1) {
                        targetAngleRad = mob.joystickAngle;
                    } else {
                        targetAngleRad = head.rotation; // parmak yoksa yönü koru
                    }
                } else {
                    // ── Desktop: mouse ────────────────────────────────────────
                    this.pointer = this.input.activePointer;
                    isBoosting   = this.pointer.isDown;
                    const worldPoint = this.cameras.main.getWorldPoint(this.pointer.x, this.pointer.y);

                    // Dead zone: mouse head'e çok yakınsa sayısal kararsızlık oluşur.
                    const STEER_DEAD_ZONE_PX = 35;
                    const distToMouse = Phaser.Math.Distance.Between(head.x, head.y, worldPoint.x, worldPoint.y);
                    const rawAngleRad = Phaser.Math.Angle.Between(head.x, head.y, worldPoint.x, worldPoint.y);
                    targetAngleRad    = distToMouse > STEER_DEAD_ZONE_PX ? rawAngleRad : head.rotation;
                }

                // Ağ gönderimi hâlâ derece tabanlı 0-250 sıkıştırmasını kullanıyor.
                this.networkManager.updateAndSendInput(Phaser.Math.RadToDeg(targetAngleRad), isBoosting, delta);

                // İstemci tarafı tahminleme.
                mySnake.updateFromInput(targetAngleRad, isBoosting, delta, this.networkManager.nextSequenceId);

                // Dinamik Kamera Zoom: Yılan büyüdükçe kamera uzaklaşır
                // baseZoom: ekran boyutuna göre belirlenen taban zoom (bkz. computeBaseZoom)
                const targetZoom = this.baseZoom / (1.0 + (mySnake.scale - 1.0) * 0.12);
                const currentZoom = this.cameras.main.zoom;
                const zoomLerp = 0.05;
                this.cameras.main.setZoom(currentZoom + (targetZoom - currentZoom) * zoomLerp);
            }
        }

        this.snakes.forEach(snake => {
            if (snake.alive && snake.getHead()?.active) {
                snake.postUpdate(delta);
            }
        });

        if (this.grid) {
            // The background tileSprite uses setScrollFactor(0) (screen-locked) so it
            // must be scaled/shifted manually to track the camera. Without matching
            // the camera's zoom here, the grid's on-screen cell size stays constant
            // while every other world object scales with zoom — on desktop the base
            // zoom stays close to 1 so this was barely visible, but on mobile (where
            // baseZoom can dip to ~0.5) the mismatch became obvious: the checker
            // pattern looked like it was "breaking apart" from the rest of the scene.
            const zoom = this.cameras.main.zoom;
            this.grid.setTileScale(zoom, zoom);
            // Rounding to whole pixels avoids sub-pixel sampling of the repeating
            // grid texture, which otherwise shows up as shimmering/broken seams
            // on high-devicePixelRatio mobile screens (NEAREST-filtered texture).
            this.grid.tilePositionX = Math.round(this.cameras.main.scrollX);
            this.grid.tilePositionY = Math.round(this.cameras.main.scrollY);
        }

        // İstemci tarafı görsel mıknatıs çekim efekti + anında yeme tahmini (Client-side food magnet + eat prediction)
        // Sunucu ile aynı yeme yarıçapı (45 * scale px) kullanılır. Oyuncunun yılanı bu mesafede bir yeme
        // girince yemi hemen eatingFoods'a taşırız; sunucu onayı (~100ms sonra) gelince sadece seti temizleriz.
        const dt = delta / 1000;
        const PULL_SPEED_FACTOR = 12.0;
        const EAT_RADIUS_FACTOR = 45.0; // Sunucunun FoodCollisionResolveSystem'deki değeriyle birebir eşleşir

        // Tahmin edilen yemleri döngü dışında işlemek için toparla
        const predictedEats = [];

        for (const [foodId, bobs] of this.foods) {
            const bobsArray = Array.isArray(bobs) ? bobs : [bobs];
            const centerBob = bobsArray[0];
            if (!centerBob) continue;

            const origX = centerBob.originalX !== undefined ? centerBob.originalX : centerBob.x;
            const origY = centerBob.originalY !== undefined ? centerBob.originalY : centerBob.y;

            let playerEatSnake = null;   // Oyuncu yılanı yeme yarıçapındaysa
            let remoteSnake   = null;    // Uzak yılan için mıknatıs çekimi
            let remoteDist    = Infinity;

            for (const snake of this.snakes.values()) {
                if (!snake.alive || !snake.getHead()?.active) continue;
                const head = snake.getHead();
                const eatRadius = EAT_RADIUS_FACTOR * snake.scale;

                const dx = head.x - origX;
                const dy = head.y - origY;
                const distSq = dx * dx + dy * dy;
                if (distSq > eatRadius * eatRadius) continue;

                if (snake.isPlayerControlled) {
                    // Oyuncunun yılanı yeme menzilinde → hemen tahminle ye
                    playerEatSnake = snake;
                    break; // Oyuncu önceliği
                }

                const dist = Math.sqrt(distSq);
                if (dist < remoteDist) {
                    remoteDist  = dist;
                    remoteSnake = snake;
                }
            }

            if (playerEatSnake) {
                // Sunucu onayı beklenmeden anında animasyona geç
                predictedEats.push({ foodId, bobsArray, targetSnake: playerEatSnake });
                continue;
            }

            if (remoteSnake) {
                // Uzak yılan: sunucu onayı gelene kadar görsel mıknatıs çekimi uygula
                const head = remoteSnake.getHead();
                bobsArray.forEach(bob => {
                    bob.x += (head.x - bob.x) * PULL_SPEED_FACTOR * dt;
                    bob.y += (head.y - bob.y) * PULL_SPEED_FACTOR * dt;
                });
            } else {
                // Menzil dışında: orijinal konuma geri dön
                bobsArray.forEach(bob => {
                    const oX = bob.originalX !== undefined ? bob.originalX : bob.x;
                    const oY = bob.originalY !== undefined ? bob.originalY : bob.y;
                    const dx = oX - bob.x;
                    const dy = oY - bob.y;
                    if (Math.hypot(dx, dy) > 0.1) {
                        bob.x += dx * PULL_SPEED_FACTOR * dt;
                        bob.y += dy * PULL_SPEED_FACTOR * dt;
                    } else {
                        bob.x = oX;
                        bob.y = oY;
                    }
                });
            }
        }

        // Tahmin edilen yemeleri ana döngüden sonra işle (bu.foods'u güvenle değiştirebiliriz)
        for (const { foodId, bobsArray, targetSnake } of predictedEats) {
            if (this.predictedEatenFoodIds.has(foodId)) continue; // Aynı kare içinde tekrar tahmin önlemi
            this.predictedEatenFoodIds.add(foodId);
            this.foods.delete(foodId);
            this.eatingFoods.set(foodId, { bobs: bobsArray, targetSnake });
        }

        // Yenen yemlerin yılan kafasına uçarak yok olması animasyonu (Deferred food eat/magnet animation)
        this.eatingFoods.forEach((data, foodId) => {
            const { bobs, targetSnake } = data;
            if (!targetSnake.alive || !targetSnake.getHead()?.active) {
                // Yiyen yılan öldüyse veya aktif değilse yemleri hemen temizle
                bobs.forEach(bob => bob.destroy());
                this.eatingFoods.delete(foodId);
                return;
            }

            const head = targetSnake.getHead();
            let allReached = true;
            const EATING_PULL_SPEED = 18.0; // Uçuş hızı daha canlı ve hızlı olsun

            bobs.forEach(bob => {
                const dx = head.x - bob.x;
                const dy = head.y - bob.y;
                const dist = Math.hypot(dx, dy);

                if (dist > 8.0) {
                    bob.x += dx * EATING_PULL_SPEED * dt;
                    bob.y += dy * EATING_PULL_SPEED * dt;
                    allReached = false;
                } else {
                    bob.destroy();
                    bob.isDestroyed = true;
                }
            });

            // Yok edilen bob'ları listeden çıkar
            data.bobs = bobs.filter(bob => !bob.isDestroyed);

            if (allReached || data.bobs.length === 0) {
                this.eatingFoods.delete(foodId);
            }
        });

        // Food'lar artık statik renk frame'leri kullanıyor — animasyon döngüsü gerekmiyor.
        // Her Bob oluşturulurken sabit bir renk frame'i atanıyor.

        const fps = this.game.loop.actualFps;
        let coordsText = "";
        if (mySnake && mySnake.getHead()) {
           coordsText = ` | Koord: ${Math.round(mySnake.getHead().x)}, ${Math.round(mySnake.getHead().y)}`;
        }
        this.fpsText.setText(`FPS: ${Math.round(fps)} | Yılanlar: ${this.snakes.size} | Yiyecekler: ${this.foods.size}${coordsText}`);
        
        if (this.minimapGraphics) {
            this.drawMinimap(mySnake);
        }
    }

    drawMinimap(mySnake) {
        const size = 150;
        const padding = 20;
        const cx = this.cameras.main.width - size / 2 - padding;
        const cy = this.cameras.main.height - size / 2 - padding;

        const g = this.minimapGraphics;
        g.clear();

        // Minimap border and background
        g.fillStyle(0x0a0a14, 0.7);
        g.fillCircle(cx, cy, size / 2);
        g.lineStyle(3, 0x00ffcc, 0.5);
        g.strokeCircle(cx, cy, size / 2);

        if (!this.worldRadius) return;
        
        // Calculate scale from world to minimap
        const mapScale = (size / 2) / this.worldRadius;

        // Draw foods as tiny dots
        g.fillStyle(0x00ffcc, 0.4); 
        for (const bobs of this.foods.values()) {
            const bob = Array.isArray(bobs) ? bobs[0] : bobs;
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
                g.fillStyle(0xff00cc, 1.0);
                g.fillCircle(mx, my, 3);
            }
        }
    }

    createTiledBackground() {
        // Screen-locked background: rendered by the zoom-1 UI camera so it
        // always spans the full screen. World tracking is faked in update()
        // via tileScale (= main camera zoom) and tilePosition (= scroll).
        this.grid = this.add.tileSprite(0, 0, this.cameras.main.width, this.cameras.main.height, 'grid32')
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(-1);
        this.registerHUD(this.grid);
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
