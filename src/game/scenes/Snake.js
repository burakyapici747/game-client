import Phaser from 'phaser';

const SnakeConfig = {
    PHYS_CONST: 60,
    BASE_SPEED_FACTOR: 3.75,
    SPEED_REDUCTION_PER_SCALE: 0.5 / 106,
    BOOST_SPEED_FACTOR: 12,
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
    constructor(scene, isPlayerControlled, x, y, initialSegmentCount = SnakeConfig.INITIAL_SEGMENT_COUNT) {
        this.scene = scene;
        this.config = SnakeConfig;
        this.isPlayerControlled = isPlayerControlled;
        this.sct = this._normalizeSegmentCount(initialSegmentCount);
        this.scale = 0.5;
        this.speed = 0;
        this.turnSpeed = 0;
        this.isBoosting = false;
        this.networkTarget = { x: x, y: y, angle: 0 };
        this.selfServerTarget = { x: x, y: y };
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
        this.create(x, y);
    }

    calculateScale() { return Math.min(6, 1 + (this.sct - 2) / 106); }
    calculateBaseSpeed() {
        const PHYS = this.config.PHYS_CONST;
        const baseSpeedNoScale = (this.config.BASE_SPEED_FACTOR * PHYS) / 40;
        const reduction = ((this.config.SPEED_REDUCTION_PER_SCALE * PHYS) / 40) * (this.scale - 1);
        return (baseSpeedNoScale - reduction) * 40;
    }
    calculateBoostSpeed() { return this.config.BOOST_SPEED_FACTOR * this.config.PHYS_CONST; }
    calculateScaleTurnFactor() { return 0.13 + 0.87 * Math.pow((7.5 - this.scale) / 6, 2); }
    calculateSpeedTurnFactor() { return Math.min(1, this.speed / this.config.TURN_SPEED_INFLUENCE); }
    getSegmentSpacing() {
        const base = this.config.SEGMENT_SPACING_BASE;
        const lenF = Phaser.Math.Clamp((this.sct - 30) / 200, 0, 1);
        const scF = Phaser.Math.Clamp((this.calculateScale() - 1) / 5, 0, 1);
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

    _resolveSegmentSpawnPosition(spawnData) {
        const x = Number(spawnData?.x);
        const y = Number(spawnData?.y);
        if (Number.isFinite(x) && Number.isFinite(y)) {
            return { x, y };
        }

        const tail = this.segments[this.segments.length - 1];
        if (tail?.active) {
            return { x: tail.x, y: tail.y };
        }

        return { x: this.head.x, y: this.head.y };
    }

    addSegmentsFromServer(addedSegments) {
        if (!Array.isArray(addedSegments) || addedSegments.length === 0) return;

        addedSegments.forEach((spawnData) => {
            const spawnPos = this._resolveSegmentSpawnPosition(spawnData);
            const segmentIndex = this.segments.length;
            const segment = this._createSegmentSprite(segmentIndex, spawnPos.x, spawnPos.y);
            const segmentScale = Number(spawnData?.scale);
            if (Number.isFinite(segmentScale) && segmentScale > 0) {
                segment.setScale(segmentScale);
            }
            this.segments.push(segment);
        });

        this.sct = this.segments.length;
        this._refreshSegmentDepths();
        this._initPathWarmup(this.head.x, this.head.y);
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
        this._initPathWarmup(this.head.x, this.head.y);
    }

    applySegmentMutationFromServer(mutation) {
        const mutationType = mutation?.mutationType ?? mutation?.mutation_type;
        const normalizedType = typeof mutationType === 'string'
            ? mutationType
            : Number(mutationType);

        if (normalizedType === 'SEGMENT_ADD' || normalizedType === 0) {
            const addedSegments = mutation?.addedSegments ?? mutation?.added_segments;
            this.addSegmentsFromServer(addedSegments);
            return;
        }

        if (normalizedType === 'SEGMENT_REMOVE' || normalizedType === 1) {
            const removedSegmentCount =
                mutation?.removedSegmentCount ?? mutation?.removed_segment_count;
            this.removeSegmentsFromServer(removedSegmentCount);
        }
    }

    create(x, y) {
        this.head = this.scene.add.sprite(x, y, 'snake_head48')
            .setOrigin(0.5);
        if (this.isPlayerControlled) {
            this.scene.physics.world.enable(this.head);
            this.head.body.setSize(40, 40).setOffset(-20, -20);
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
    }

    destroy() {
        this.head.destroy();
        this.segments.forEach(seg => seg.destroy());
        this.trail.destroy();
        this.eyeL.destroy();
        this.eyeR.destroy();
        this.pupilL.destroy();
        this.pupilR.destroy();
        this.segments = [];
    }

    updateFromInput(targetAngle, isBoosting, delta) {
        if (!this.isPlayerControlled || !this.head.body) return;
        this.setBoost(isBoosting);
        this.scale = this.calculateScale();
        const baseSpeed = this.calculateBaseSpeed();
        const boostSpeed = this.calculateBoostSpeed();
        this.speed = this.isBoosting ? boostSpeed : baseSpeed;
        const turn = this.config.TURN_ANGLE_BASE * this.calculateScaleTurnFactor() * this.calculateSpeedTurnFactor();
        this.turnSpeed = turn;
        const targetRad = Phaser.Math.DegToRad(targetAngle);
        const diff = Phaser.Math.Angle.Wrap(targetRad - this.head.rotation);
        const maxTurn = this.turnSpeed * (delta / 1000);
        this.head.rotation += Phaser.Math.Clamp(diff, -maxTurn, maxTurn);
        this.scene.physics.velocityFromRotation(this.head.rotation, this.speed, this.head.body.velocity);
    }

    postUpdate(delta = 16.67) {
        if (this.isPlayerControlled) {
            this._reconcilePlayerWithServer(delta);
        } else {
            this._interpolateRemoteSnake(delta);
        }

        this._sampleHeadToPath();
        this._positionSegmentsByPath();
        
        const worldPoint = this.scene.cameras.main.getWorldPoint(this.scene.input.activePointer.x, this.scene.input.activePointer.y);
        this._updateEyes(worldPoint.x, worldPoint.y);
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
        const distance = Math.hypot(dx, dy);

        if (distance > this.config.RECONCILIATION_SNAP_DISTANCE) {
            this.head.setPosition(this.selfServerTarget.x, this.selfServerTarget.y);
            this.head.body?.updateFromGameObject();
        } else if (distance > this.config.RECONCILIATION_DEADZONE) {
            const posFactor = this._frameAdjustedFactor(this.config.RECONCILIATION_POSITION_FACTOR, delta);
            const desiredStep = distance * posFactor;
            const maxStep = this.config.RECONCILIATION_MAX_CORRECTION_SPEED * (delta / 1000);
            const step = Math.min(desiredStep, maxStep);
            const nx = this.head.x + (dx / distance) * step;
            const ny = this.head.y + (dy / distance) * step;

            this.head.setPosition(nx, ny);
            this.head.body?.updateFromGameObject();
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
        const lx = this.head.x + (l.x * cos - l.y * sin);
        const ly = this.head.y + (l.x * sin + l.y * cos);
        const rx = this.head.x + (r.x * cos - r.y * sin);
        const ry = this.head.y + (r.x * sin + r.y * cos);
        this.eyeL.setPosition(Math.round(lx), Math.round(ly));
        this.eyeR.setPosition(Math.round(rx), Math.round(ry));
        const maxR = this._pupilMax;
        const px = Phaser.Math.Clamp(dir.x * maxR, -maxR, maxR);
        const py = Phaser.Math.Clamp(dir.y * maxR, -maxR, maxR);
        this.pupilL.setPosition(Math.round(lx + px), Math.round(ly + py));
        this.pupilR.setPosition(Math.round(rx + px), Math.round(ry + py));
    }

    _initPathWarmup(x, y) {
        this.path = [new Phaser.Math.Vector2(x, y)];
        this.pathSegLens = [];
        this.totalPathLen = 0;
        const spacing = this.getSegmentSpacing();
        const needLen = (this.segments.length + 1) * spacing + 400;
        const dir = new Phaser.Math.Vector2(-1, 0);
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

        if (Number.isFinite(x)) {
            this.networkTarget.x = x;
        }
        if (Number.isFinite(y)) {
            this.networkTarget.y = y;
        }
        if (Number.isFinite(rawAngle)) {
            this.networkTarget.angle = this._decodeServerAngle(rawAngle);
        }

        this.hasServerState = true;
    }

    updateSelfPositionFromServer(entityData) {
        const x = Number(entityData?.x);
        const y = Number(entityData?.y);

        if (Number.isFinite(x)) {
            this.selfServerTarget.x = x;
        }
        if (Number.isFinite(y)) {
            this.selfServerTarget.y = y;
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
