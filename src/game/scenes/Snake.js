import Phaser from 'phaser';

const SnakeConfig = {
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
    constructor(scene, isPlayerControlled, x, y, initialSegmentCount = SnakeConfig.INITIAL_SEGMENT_COUNT, initialAngleRaw = 0, nickname = '') {
        this.scene = scene;
        this.config = SnakeConfig;
        this.isPlayerControlled = isPlayerControlled;
        this.alive = true;
        this.sct = this._normalizeSegmentCount(initialSegmentCount);
        this.scale = 0.5;
        this.speed = 0;
        this.turnSpeed = 0;
        this.isBoosting = false;
        this.nickname = nickname;
        this.lastReconciledSequenceId = 0;
        
        const initialAngle = this._decodeServerAngle(initialAngleRaw);
        // Hareket yönü (radyan) — steering'in TEK otoriter durumu. Her frame
        // updateFromInput'ta velocity vektöründen atan2(velocity.y, velocity.x)
        // ile yeniden türetilir ve head.rotation her zaman buna eşitlenir:
        // görsel açı ≡ gerçek hareket yönü (mouse'a değil, velocity'ye bakar).
        this.velocityHeading = initialAngle;
        this.networkTarget = { x: x, y: y, angle: initialAngle };
        this.selfServerTarget = { x: x, y: y, angle: initialAngle };
        this.selfServerTargetHeading = initialAngle;
        this.hasServerState = false;
        this.hasSelfServerState = false;

        // Time-aligned reconciliation state (player-controlled only)
        this._predHistory = [];               // ring of {t, x, y} (performance.now)
        this._smoothedError = { x: 0, y: 0 }; // EMA of time-aligned prediction error
        this._correcting = false;             // hysteresis latch
        this.segments = [];
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

    _createSegmentSprite(index, x, y) {
        // registerWorld: world-space objects render via the zoomed main camera
        // only — the zoom-1 UI camera must ignore them (see Game.js).
        return this.scene.registerWorld(
            this.scene.add.sprite(x, y, 'snake_body48')
                .setOrigin(0.5)
                .setTint(this._getSegmentColor(index))
        );
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
            const segment = this._createSegmentSprite(segmentIndex, spawnPos.x, spawnPos.y);
            segment.setScale(this.scale); // Scale new segments immediately
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
            segment?.destroy();
        }

        this.sct = this.segments.length;
        this._refreshSegmentDepths();
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
        // Travel-bound rotation için önceki frame'in nihai pozisyonu
        // (bkz. postPhysicsUpdate — head.rotation'ın tek yazarı).
        this._prevHeadPos = { x, y };
        this.head = this.scene.registerWorld(this.scene.add.sprite(x, y, 'snake_head48')
            .setOrigin(0.5));
        this.head.rotation = angle;
        if (this.isPlayerControlled) {
            this.scene.physics.world.enable(this.head);
            this.head.body.setSize(40, 40).setOffset(-20, -20);
            this.head.body.setCollideWorldBounds(false); // Ölüm kontrolü sunucu tarafında — fizik sınırı snake'i bloke etmemeli
        }
        for (let i = 0; i < this.sct; i++) {
            const seg = this._createSegmentSprite(i, x, y);
            this.segments.push(seg);
        }
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
        this.alive = false;
        if (this.isPlayerControlled && this.head?.body) {
            this.head.body.velocity.set(0, 0);
        }
        this.head?.destroy();
        this.segments.forEach(seg => seg?.destroy());
        this.trail?.destroy();
        this.eyeL?.destroy();
        this.eyeR?.destroy();
        this.pupilL?.destroy();
        this.pupilR?.destroy();
        this.nicknameText?.destroy();
        this.serverDebugMarker?.destroy();
        this.serverDebugDot?.destroy();
        this.segments = [];
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
        if (!this.alive || !this.isPlayerControlled || !this.head?.body) return;

        const canBoost = this.sct > this.config.BOOST_MIN_SEGMENTS;
        const effectiveBoosting = isBoosting && canBoost;
        this.setBoost(effectiveBoosting);

        const baseSpeed = this.calculateBaseSpeed();
        const boostSpeed = this.calculateBoostSpeed();
        this.speed = effectiveBoosting ? boostSpeed : baseSpeed;

        const turn = this.config.TURN_ANGLE_BASE * this.calculateScaleTurnFactor() * this.calculateSpeedTurnFactor();
        this.turnSpeed = turn;

        // ── VELOCITY-BOUND HEAD ROTATION ────────────────────────────────────
        // Mouse hedefi SPRITE'ı değil, VELOCITY VEKTÖRÜNÜ döndürür; head.rotation
        // aşağıda velocity'den (atan2) türetilir. Sprite'ın baktığı yön böylece
        // gerçek hareket yolunun önüne geçemez — "yana kayma/drift" görüntüsü
        // yapısal olarak imkânsızlaşır. Turn-rate matematiği değişmedi, yani
        // sunucu simülasyonuyla (MovementSystem) üretilen açı dizisi birebir aynı.
        //
        // 1) Steering: velocity yönünü hedefe doğru hız-sınırlı döndür.
        //    (Angle.Wrap kısa yayı seçer; targetAngleRad radyan cinsinden.)
        const diff = Phaser.Math.Angle.Wrap(targetAngleRad - this.velocityHeading);
        const maxTurn = this.turnSpeed * (delta / 1000);
        const steeredHeading = this.velocityHeading + Phaser.Math.Clamp(diff, -maxTurn, maxTurn);

        // 2) ÖNCE FİZİK: velocity vektörünü güncelle.
        this.scene.physics.velocityFromRotation(steeredHeading, this.speed, this.head.body.velocity);

        // 3) Heading state velocity vektöründen türetilir. atan2 çıktısı
        //    (-π, π] aralığında olduğundan ayrıca normalize gerekmez.
        //
        //    DİKKAT: head.rotation BURADA YAZILMAZ. Görsel açının TEK yazarı
        //    postPhysicsUpdate()'tir: fizik adımı VE reconciliation düzeltmesi
        //    uygulandıktan sonraki GERÇEK frame yer değiştirmesinden
        //    (movement delta) atan2 ile türetilir. Velocity tek başına yeterli
        //    değildir çünkü reconciliation her frame pozisyona küçük düzeltme
        //    vektörleri ekler — gerçek ekran-üstü hareket yönü velocity +
        //    düzeltme bileşkesidir. Rotation'ı o bileşkeye bağlamak, kafanın
        //    gitmediği bir yöne bakmasını yapısal olarak imkânsız kılar.
        const vel = this.head.body.velocity;
        this.velocityHeading = vel.lengthSq() > 1e-12
            ? Math.atan2(vel.y, vel.x)
            : Phaser.Math.Angle.Wrap(steeredHeading); // speed=0 guard (spawn frame'i)
    }

    // Reconcile / interpolate — update() içinde çağrılır (physics step öncesi)
    postUpdate(delta = 16.67) {
        if (!this.alive || !this.head?.active) return;
        if (this.isPlayerControlled) {
            this._reconcilePlayerWithServer(delta);
        } else {
            this._interpolateRemoteSnake(delta);
        }
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
            // ── TRAVEL-BOUND HEAD ROTATION (görsel açının TEK yazarı) ────────
            // Bu noktada frame'in NİHAİ pozisyonu bellidir: input → steering →
            // reconciliation düzeltmesi → physics step hepsi uygulandı. Görsel
            // açı, kafanın bu frame'de GERÇEKTEN katettiği yer değiştirme
            // vektöründen türetilir: atan2(dy, dx). Velocity yerine gerçek
            // movement delta kullanılır çünkü reconciliation pozisyona velocity
            // dışı düzeltmeler ekler — bakış yönü ile seyahat yolu tanım gereği
            // paraleldir, ayrışamaz. Pozisyonla AYNI adımda/fazda güncellendiği
            // için frame-rate'ten bağımsızdır (delta ölçeklemesi gerekmez).
            const stepX = this.head.x - this._prevHeadPos.x;
            const stepY = this.head.y - this._prevHeadPos.y;
            const stepLenSq = stepX * stepX + stepY * stepY;

            // Guard'lar: (a) dejenere adım (< 0.1 px — duruş/ilk frame) ve
            // (b) teleport/hard-snap (beklenen adımın çok üstü) durumlarında
            // ölçüm anlamsızdır → steering heading'ine (velocity yönü) düş.
            const dtSec = (this._delta || 16.67) / 1000;
            const expectedStep =
                ((this.speed || 225) + this.config.RECONCILIATION_MAX_CORRECTION_SPEED) * dtSec;
            const maxStep = Math.max(24, expectedStep * 3);

            if (stepLenSq >= 0.01 && stepLenSq <= maxStep * maxStep) {
                this.head.rotation = Math.atan2(stepY, stepX);
            } else {
                this.head.rotation = this.velocityHeading;
            }
            this._prevHeadPos.x = this.head.x;
            this._prevHeadPos.y = this.head.y;

            const k = this._frameAdjustedFactor(this.config.PATH_SMOOTHING_FACTOR, this._delta || 16.67);
            this._pathFollower.x += (this.head.x - this._pathFollower.x) * k;
            this._pathFollower.y += (this.head.y - this._pathFollower.y) * k;

            // Record the final post-physics position into the prediction
            // history ring — server packets are compared against this
            // (time-aligned) instead of against the current position.
            const now = performance.now();
            this._predHistory.push({ t: now, x: this.head.x, y: this.head.y });
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
        const rawDx = this.selfServerTarget.x - this.head.x;
        const rawDy = this.selfServerTarget.y - this.head.y;
        if (Math.hypot(rawDx, rawDy) > this.config.RECON_HARD_SNAP_DISTANCE) {
            this.head.setPosition(this.selfServerTarget.x, this.selfServerTarget.y);
            this.head.body?.updateFromGameObject();
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

        this.head.setPosition(this.head.x + ux * step, this.head.y + uy * step);
        this.head.body?.updateFromGameObject();

        // Consume the applied portion of the error…
        this._smoothedError.x -= ux * step;
        this._smoothedError.y -= uy * step;

        // …and shift the prediction history by the same amount. Server packets
        // still in flight were computed against the UNCORRECTED trajectory; if
        // the history isn't shifted, those packets re-report the error we just
        // fixed and the head over-corrects (classic reconciliation
        // rubber-banding). Shifting keeps future error measurements
        // self-consistent with the correction already applied.
        for (let i = 0; i < this._predHistory.length; i++) {
            this._predHistory[i].x += ux * step;
            this._predHistory[i].y += uy * step;
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
            if (!this.isPlayerControlled && Number.isFinite(target.angle)) {
                this.head.rotation = target.angle;
            }
            this.head.body?.updateFromGameObject();
        }

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
        if (this._prevHeadPos) {
            // Hard reset sonrası ilk frame'de bayat pozisyondan dev/bozuk bir
            // movement delta ölçülmesin.
            this._prevHeadPos.x = x;
            this._prevHeadPos.y = y;
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

        this.hasServerState = true;
    }

    _updateSegmentScaling() {
        if (this.head) this.head.setScale(this.scale);
        this.segments.forEach(seg => {
            if (seg && seg.active) seg.setScale(this.scale);
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
