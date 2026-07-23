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

        // Time-aligned reconciliation state (player-controlled only)
        this._predHistory = [];               // ring of {t, x, y} (performance.now)
        this._smoothedError = { x: 0, y: 0 }; // EMA of time-aligned prediction error
        this._correcting = false;             // hysteresis latch
        this.segments = [];
        // Çıkış animasyonundaki (çökmekte olan) segmentler — this.segments'ten
        // ÇIKARILMIŞ ama henüz görsel olarak yok olmamış ghost'lar: { sprite, t }.
        this._despawningSegments = [];
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

    _createSegmentSprite(index, x, y, animateIn = false) {
        // registerWorld: world-space objects render via the zoomed main camera
        // only — the zoom-1 UI camera must ignore them (see Game.js).
        const seg = this.scene.registerWorld(
            this.scene.add.sprite(x, y, 'snake_body48')
                .setOrigin(0.5)
                .setTint(this._getSegmentColor(index))
        );
        // _animScale: this.scale ile ÇARPILAN büyüme/çöküş çarpanı (0..1).
        // animateIn=true → 0'dan başlar, _updateSegmentLifecycle ile 1'e büyür.
        seg._animScale = animateIn ? 0 : 1;
        seg._growing = animateIn;
        if (animateIn) {
            seg.setScale(0);
            seg.setAlpha(0);
        }
        return seg;
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
        for (let i = 0; i < this.segments.length; i++) {
            this.segments[i].setDepth(this.sct - i);
            this.segments[i].setTint(this._getSegmentColor(i));
        }
    }

    syncSegmentCountFromServer(segmentCount) {
        const targetCount = this._normalizeSegmentCount(segmentCount);
        if (targetCount === this.sct) return;

        if (targetCount > this.segments.length) {
            for (let i = this.segments.length; i < targetCount; i++) {
                const seg = this._createSegmentSprite(i, this.head.x, this.head.y);
                this.segments.push(seg);
            }
        } else {
            while (this.segments.length > targetCount) {
                const seg = this.segments.pop();
                seg?.destroy();
            }
        }

        this.sct = this.segments.length;
        this._refreshSegmentDepths();
        this._initPathWarmup(this.head.x, this.head.y);
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

        const spacing = this.getSegmentSpacing();
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
        const requiredLength = (this.segments.length + 2) * spacing + 600;

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

        for (let i = 0; i < normalizedAddCount; i++) {
            const spawnPos = this._resolveSegmentSpawnPositionBehindTail();
            const segmentIndex = this.segments.length;
            // animateIn: yeni segment 0 ölçek/opaklıktan başlayıp yumuşakça büyür
            // (Issue #3 — ani "pop" yerine üstel yaklaşım). Ölçek artık
            // _updateSegmentLifecycle tarafından this.scale ile sürülür.
            const segment = this._createSegmentSprite(segmentIndex, spawnPos.x, spawnPos.y, true);
            this.segments.push(segment);
        }

        this.sct = this.segments.length;
        this._refreshSegmentDepths();
        this._ensurePathCapacityForCurrentLength();
    }

    removeSegmentsFromServer(removedSegmentCount) {
        const normalizedRemoveCount = Math.floor(Number(removedSegmentCount));
        if (!Number.isFinite(normalizedRemoveCount) || normalizedRemoveCount <= 0) return;

        const removeCount = Math.min(normalizedRemoveCount, this.segments.length);
        for (let i = 0; i < removeCount; i++) {
            const segment = this.segments.pop();
            this._beginSegmentDespawn(segment); // ani yok etme yerine yerinde çöküş (Issue #3)
        }

        this.sct = this.segments.length;
        this._refreshSegmentDepths();
    }

    // Segmenti this.segments'ten çıkarıp yerinde 1→0 çöküşe alır (anında değil).
    // this.segments'ten çıkarıldığı için gövde path'ini artık takip etmez —
    // en son konumunda küçülüp solar, tamamlanınca _updateSegmentLifecycle
    // sprite'ı yok eder.
    _beginSegmentDespawn(seg) {
        if (!seg) return;
        if (!seg.active) { seg.destroy?.(); return; }
        seg._growing = false;
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
                    d.sprite?.destroy();
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
        for (let i = 0; i < this.sct; i++) {
            const seg = this._createSegmentSprite(i, x, y);
            this.segments.push(seg);
        }
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
        this._pathFollower = null;

        // 3) İnterpolasyon / tahmin buffer'ları — eski yaşamın yörünge verisi
        // yeni yaşama sızamaz. TÜM alanlar null-guard'lı: burada korumasız
        // `this._remoteVel.x = 0` (revert edilmiş ileri-projeksiyon özelliğine
        // ait, constructor'da artık TANIMSIZ bir alan) TypeError fırlatıyordu.
        // destroy() yarıda kalınca yılan snakes map'inden silinemiyor ve
        // ayrılan oyuncular yeniden karşılaşmada KALICI görünmez kalıyordu
        // (console: "Cannot set properties of undefined (setting 'x')" —
        // hem RemoveEntity hem EntityFull yolunda).
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
        this.hasServerState = false;
        this.hasSelfServerState = false;
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
        const worldPoint = this.scene.cameras.main.getWorldPoint(this.scene.input.activePointer.x, this.scene.input.activePointer.y);
        this._updateEyes(worldPoint.x, worldPoint.y);
        if (this.nicknameText) {
            this.nicknameText.setPosition(this.head.x, this.head.y - 35 * this.scale);
        }
    }

    _frameAdjustedFactor(baseFactor, delta) {
        // Exponential decay: frame-rate independent smooth lerp.
        // At 60 FPS (delta=16.67ms) this equals baseFactor; at other rates it scales correctly.
        return 1 - Math.pow(1 - baseFactor, delta / (1000 / 60));
    }

    _interpolateRemoteSnake(delta) {
        if (!this.hasServerState) return;

        // ── Snapshot-buffer interpolation (birincil yol) ────────────────
        // Render, sunucu zamanının ~interpDelay kadar GERİSİNDE oynatılır:
        // renderTime her zaman iki gerçek snapshot arasına düşer → uzak yılan
        // ekstrapolasyonsuz, paket-varış ritminden bağımsız, her Hz'de sabit
        // hızda akar. Delay ölçülen paket aralığına adaptiftir (×FACTOR):
        // tek geciken paket bile buffer'ı kurutamaz.
        const buf = this._snapshots;
        if (buf.length >= 2) {
            let interpDelay = this.config.INTERP_DELAY_MIN_MS;
            if (Number.isFinite(this._packetIntervalEmaMs)) {
                interpDelay = Phaser.Math.Clamp(
                    this._packetIntervalEmaMs * this.config.INTERP_DELAY_INTERVAL_FACTOR,
                    this.config.INTERP_DELAY_MIN_MS,
                    this.config.INTERP_DELAY_MAX_MS
                );
            }
            const renderTime = performance.now() - interpDelay;

            if (renderTime <= buf[buf.length - 1].t) {
                for (let i = buf.length - 2; i >= 0; i--) {
                    if (buf[i].t <= renderTime) {
                        const a = buf[i];
                        const b = buf[i + 1];
                        const span = b.t - a.t;
                        const f = span > 0 ? Phaser.Math.Clamp((renderTime - a.t) / span, 0, 1) : 1;
                        this.head.x = Phaser.Math.Linear(a.x, b.x, f);
                        this.head.y = Phaser.Math.Linear(a.y, b.y, f);
                        this.head.rotation = a.angle
                            + Phaser.Math.Angle.Wrap(b.angle - a.angle) * f;
                        return;
                    }
                }
                // renderTime buffer başlangıcından eski (yeni spawn/AOI girişi):
                // aşağıdaki üstel takip en eski hedefe yaklaştırır.
            }
            // renderTime en yeni snapshot'tan ileri = buffer açlığı (paket
            // gecikti). Ekstrapolasyon YOK — fallback üstel takip devralır.
        }

        // ── Fallback: frame-rate-agnostik üstel takip ───────────────────
        // (buffer henüz dolmadı ya da açlıkta) — eski davranış, dt-normalize.
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

    _initPathWarmup(x, y) {
        // Hard resets (spawn, tab-return resync, segment-count sync) rebuild
        // the path from scratch — snap the follower too, so it doesn't drag
        // stale offset into the fresh path.
        if (this._pathFollower) {
            this._pathFollower.x = x;
            this._pathFollower.y = y;
        }
        this.path = [new Phaser.Math.Vector2(x, y)];
        this.pathSegLens = [];
        this.totalPathLen = 0;
        const spacing = this.getSegmentSpacing();
        const needLen = (this.segments.length + 1) * spacing + 400;
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
            const maxNeeded = (this.segments.length + 2) * spacing + 600;
            while (this.totalPathLen > maxNeeded && this.path.length > 2) {
                const rem = this.pathSegLens.pop();
                if (rem !== undefined) this.totalPathLen -= rem;
                this.path.pop();
            }
        }
    }

    _positionSegmentsByPath() {
        if (this.path.length < 2) return;
        const spacing = this.getSegmentSpacing();
        for (let i = 0; i < this.segments.length; i++) {
            const d = (i + 1) * spacing;
            const p = this._pointAndAngleAtDistance(d);
            const seg = this.segments[i];
            if (seg && seg.active) {
                seg.setPosition(p.x, p.y);
                seg.rotation = p.angle;
            }
        }
    }

    _pointAndAngleAtDistance(distanceFromHead) {
        if (!this.head.active) {
            return { x: 0, y: 0, angle: 0 };
        }
        if (distanceFromHead <= 0 || this.path.length === 0) {
            const a = this.path[0] ?? new Phaser.Math.Vector2(this.head.x, this.head.y);
            return { x: a.x, y: a.y, angle: this.head.rotation };
        }
        let d = distanceFromHead;
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
        this.segments.forEach(seg => {
            // Büyüme animasyonundaki segmentin ölçeği _animScale ile çarpılır —
            // aksi halde sunucu scale güncellemesi büyüme "pop"unu geri getirirdi.
            if (seg && seg.active) seg.setScale(this.scale * (seg._animScale ?? 1));
        });
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
    }

    _decodeServerAngle(rawAngle) {
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

    getHead() { return this.head; }
}
