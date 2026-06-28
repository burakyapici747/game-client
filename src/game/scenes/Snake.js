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
    RECONCILIATION_POSITION_FACTOR: 0.18,
    RECONCILIATION_DEADZONE: 2.5,
    RECONCILIATION_SNAP_DISTANCE: 140,
    RECONCILIATION_MAX_CORRECTION_SPEED: 480,
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
        this.networkTarget = { x: x, y: y, angle: initialAngle };
        this.selfServerTarget = { x: x, y: y, angle: initialAngle };
        this.hasServerState = false;
        this.hasSelfServerState = false;
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
        return this.scene.add.sprite(x, y, 'snake_body48')
            .setOrigin(0.5)
            .setTint(this._getSegmentColor(index));
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
        this.head = this.scene.add.sprite(x, y, 'snake_head48')
            .setOrigin(0.5);
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
        this.eyeL = this.scene.add.image(x, y, 'eye10').setOrigin(0.5).setDepth(this.head.depth + 2);
        this.eyeR = this.scene.add.image(x, y, 'eye10').setOrigin(0.5).setDepth(this.head.depth + 2);
        this.pupilL = this.scene.add.image(x, y, 'pupil4').setOrigin(0.5).setDepth(this.head.depth + 3);
        this.pupilR = this.scene.add.image(x, y, 'pupil4').setOrigin(0.5).setDepth(this.head.depth + 3);
        this._eyeLocalL = new Phaser.Math.Vector2(+15, -6);
        this._eyeLocalR = new Phaser.Math.Vector2(+15, +6);
        this._pupilMax = 3;
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
        this.segments = [];
    }

    setNickname(nickname) {
        if (!nickname) return;
        this.nickname = nickname;
        if (this.nicknameText) {
            this.nicknameText.setText(nickname);
        } else {
            this.nicknameText = this.scene.add.text(this.head.x, this.head.y - 35 * this.scale, nickname, {
                fontFamily: 'Outfit, Inter, Arial, sans-serif',
                fontSize: '14px',
                fontStyle: 'bold',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(2000);
        }
    }

    updateFromInput(targetAngle, isBoosting, delta, sequenceId = 0) {
        if (!this.alive || !this.isPlayerControlled || !this.head?.body) return;

        const canBoost = this.sct > this.config.BOOST_MIN_SEGMENTS;
        const effectiveBoosting = isBoosting && canBoost;
        this.setBoost(effectiveBoosting);

        const baseSpeed = this.calculateBaseSpeed();
        const boostSpeed = this.calculateBoostSpeed();
        this.speed = effectiveBoosting ? boostSpeed : baseSpeed;

        const turn = this.config.TURN_ANGLE_BASE * this.calculateScaleTurnFactor() * this.calculateSpeedTurnFactor();
        this.turnSpeed = turn;

        const targetRad = Phaser.Math.DegToRad(targetAngle);
        const diff = Phaser.Math.Angle.Wrap(targetRad - this.head.rotation);
        const maxTurn = this.turnSpeed * (delta / 1000);
        this.head.rotation += Phaser.Math.Clamp(diff, -maxTurn, maxTurn);

        this.scene.physics.velocityFromRotation(this.head.rotation, this.speed, this.head.body.velocity);
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
        this._sampleHeadToPath();
        this._positionSegmentsByPath();
        const worldPoint = this.scene.cameras.main.getWorldPoint(this.scene.input.activePointer.x, this.scene.input.activePointer.y);
        this._updateEyes(worldPoint.x, worldPoint.y);
        if (this.nicknameText) {
            this.nicknameText.setPosition(this.head.x, this.head.y - 35 * this.scale);
        }
    }

    _frameAdjustedFactor(baseFactor, delta) {
        const frameScale = delta / (1000 / 60);
        return Phaser.Math.Clamp(baseFactor * frameScale, 0, 1);
    }

    _interpolateRemoteSnake(delta) {
        if (!this.hasServerState) return;

        const interpFactor = this._frameAdjustedFactor(this.config.REMOTE_INTERPOLATION_FACTOR, delta);
        this.head.x = Phaser.Math.Linear(this.head.x, this.networkTarget.x, interpFactor);
        this.head.y = Phaser.Math.Linear(this.head.y, this.networkTarget.y, interpFactor);

        const wrappedAngle = Phaser.Math.Angle.Wrap(this.networkTarget.angle - this.head.rotation);
        this.head.rotation += wrappedAngle * interpFactor;
    }

    _reconcilePlayerWithServer(delta) {
        if (!this.hasSelfServerState) return;

        const dx = this.selfServerTarget.x - this.head.x;
        const dy = this.selfServerTarget.y - this.head.y;
        const absDistance = Math.hypot(dx, dy);

        // Sunucu 10 FPS çalışırken ping ile birlikte mesafe 200-300 pikseli aşabilir.
        // O yüzden sadece ÇOK saçma bir farkta (örn. ölüm, yeniden doğma vb.) 800 veriyoruz.
        if (absDistance > 800) {
            this.head.setPosition(this.selfServerTarget.x, this.selfServerTarget.y);
            this.head.body?.updateFromGameObject();
            return;
        }

        // Vector from Client to Server
        const cos = Math.cos(this.head.rotation);
        const sin = Math.sin(this.head.rotation);

        const longitudinal = dx * cos + dy * sin;
        const lateral = dx * -sin + dy * cos;

        let corrX = 0;
        let corrY = 0;
        let hasCorrection = false;

        if (Math.abs(lateral) > this.config.RECONCILIATION_DEADZONE) {
            corrX += lateral * -sin;
            corrY += lateral * cos;
            hasCorrection = true;
        }

        const maxExpectedLag = (this.speed || 300) * 0.9;
        if (longitudinal > 0 || longitudinal < -maxExpectedLag) {
            corrX += longitudinal * cos;
            corrY += longitudinal * sin;
            hasCorrection = true;
        }

        if (hasCorrection) {
            const corrDist = Math.hypot(corrX, corrY);
            if (corrDist > 0.1) {
                const posFactor = this._frameAdjustedFactor(this.config.RECONCILIATION_POSITION_FACTOR, delta);
                const desiredStep = corrDist * posFactor * 0.55;
                const maxStep = this.config.RECONCILIATION_MAX_CORRECTION_SPEED * (delta / 1000);
                const step = Math.min(desiredStep, maxStep);

                const nx = this.head.x + (corrX / corrDist) * step;
                const ny = this.head.y + (corrY / corrDist) * step;

                this.head.setPosition(nx, ny);
                this.head.body?.updateFromGameObject();
            }
        }
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
        
        this.eyeL.setPosition(Math.round(lx), Math.round(ly)).setScale(curScale);
        this.eyeR.setPosition(Math.round(rx), Math.round(ry)).setScale(curScale);
        
        const maxR = this._pupilMax * curScale;
        const px = Phaser.Math.Clamp(dir.x * maxR, -maxR, maxR);
        const py = Phaser.Math.Clamp(dir.y * maxR, -maxR, maxR);
        
        this.pupilL.setPosition(Math.round(lx + px), Math.round(ly + py)).setScale(curScale);
        this.pupilR.setPosition(Math.round(rx + px), Math.round(ry + py)).setScale(curScale);
    }

    _initPathWarmup(x, y) {
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
        const hp = new Phaser.Math.Vector2(this.head.x, this.head.y);
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
                seg.setPosition(Math.round(p.x), Math.round(p.y));
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

            if (Number.isFinite(serverSeqId) && serverSeqId > 0) {
                this.lastReconciledSequenceId = serverSeqId;
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
