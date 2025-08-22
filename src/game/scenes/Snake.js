import { Scene } from 'phaser';
import { Chain } from './Chain.js';

export class Snake {
    constructor(scene, x, y) {
        this.scene = scene;

        const PHYSICS_SCALE = 60;
        this.nsp1 = 3.75 * PHYSICS_SCALE;
        this.nsp2 = 0.5 * PHYSICS_SCALE / 106;
        this.nsp3 = 12 * PHYSICS_SCALE;
        this.mamu = 3.3;
        this.spangdv = 4.8;

        this.sct = 64;
        this.scale = 0.5;
        this.baseSpeed = 0;
        this.boostSpeed = this.nsp3;
        this.speed = 0;
        this.turnSpeed = 0;
        this.isBoosting = false;

        this.segments = [];
        this.baseSnakeRadius = 15;
        this.snakeRadius = this.baseSnakeRadius;
        this.colors = this.generateColors();

        this.spine = new Chain(new Phaser.Math.Vector2(x, y), this.sct, this.baseSnakeRadius / 2);
        this.snakeHead = null;
        this.graphics = null;
        this.path = [];
        this.pathMaxLength = this.sct * 5;
        this._prevRadius = this.snakeRadius;

        this.create();
    }

    generateColors() {
        const colors = [];
        const pattern = [
            0xFF3333, 0xFF8D33, 0xFFD433, 0x9CFF33, 0x33FF57,
            0x33FFB8, 0x33D4FF, 0x338DFF, 0x3333FF, 0x9C33FF,
            0xFF33F5, 0xFF338D, 0xFFFF00, 0x00FF00, 0x00FFFF,
            0xFFFFFF, 0xFF7F50, 0xDA70D6, 0x4169E1, 0xFF6347
        ];
        for (let i = 0; i < this.sct; i++) {
            colors.push(pattern[i % pattern.length]);
        }
        return colors;
    }

    calculateScale() {
        return Math.min(6, 1 + (this.sct - 2) / 106);
    }

    calculateBaseSpeed() {
        const baseSpeedNoScale = this.nsp1 / 40;
        const reduction = (this.nsp2 / 40) * (this.scale - 1);
        return (baseSpeedNoScale - reduction) * 40;
    }

    calculateScaleTurnFactor() {
        return 0.13 + 0.87 * Math.pow((7.5 - this.scale) / 6, 2);
    }

    calculateSpeedTurnFactor() {
        return Math.min(1, this.speed / this.spangdv);
    }

    setBoost(isBoosting) {
        this.isBoosting = isBoosting;
    }

    grow(amount = 1) {
        for (let i = 0; i < amount; i++) {
            const lastJoint = this.spine.joints[this.spine.joints.length - 1];
            this.spine.joints.push(new Phaser.Math.Vector2(lastJoint.x, lastJoint.y));
            this.spine.angles.push(0);

            this.colors.push(this.colors[this.sct % this.colors.length]);
            const newSegment = this.scene.add.circle(lastJoint.x, lastJoint.y, this.snakeRadius, this.colors[this.sct]);
            newSegment.setDepth(0);
            this.segments.push(newSegment);
        }
        this.sct = this.spine.joints.length;
    }

    create() {
        const snakeHeadJoint = this.spine.joints[0];
        this.snakeHead = this.scene.add.circle(snakeHeadJoint.x, snakeHeadJoint.y, this.snakeRadius, 0xffffff);
        this.snakeHead.setDepth(this.sct + 1);

        this.scene.physics.world.enable(this.snakeHead);
        this.snakeHead.body.setCircle(this.snakeRadius);
        this.snakeHead.body.setCollideWorldBounds(true);

        for (let i = 1; i < this.spine.joints.length; i++) {
            const joint = this.spine.joints[i];
            const segment = this.scene.add.circle(joint.x, joint.y, this.snakeRadius, this.colors[i - 1]);
            segment.setDepth(this.sct - i);
            this.segments.push(segment);
        }
    }

    update(pointerX, pointerY, camera, delta) {
        this.scale = this.calculateScale();
        this.baseSpeed = this.calculateBaseSpeed();
        this.speed = this.isBoosting ? this.boostSpeed : this.baseSpeed;

        const scaleTurnFactor = this.calculateScaleTurnFactor();
        const speedTurnFactor = this.calculateSpeedTurnFactor();

        this.turnSpeed = this.mamu * scaleTurnFactor * speedTurnFactor;
        this.snakeRadius = this.baseSnakeRadius * (1 + this.scale / 4);

        const snakeScreenX = this.snakeHead.x - camera.scrollX;
        const snakeScreenY = this.snakeHead.y - camera.scrollY;
        const worldPoint = camera.getWorldPoint(pointerX, pointerY);
        const targetAngle = Phaser.Math.Angle.Between(
            this.snakeHead.x, this.snakeHead.y, worldPoint.x, worldPoint.y
        );

        const turnDifference = Phaser.Math.Angle.Wrap(targetAngle - this.snakeHead.rotation);
        const maxTurnThisFrame = this.turnSpeed * (delta / 1000);
        const clampedTurn = Phaser.Math.Clamp(turnDifference, -maxTurnThisFrame, maxTurnThisFrame);
        this.snakeHead.rotation += clampedTurn;

        this.scene.physics.velocityFromRotation(
            this.snakeHead.rotation,
            this.speed,
            this.snakeHead.body.velocity
        );

        this.spine.joints[0].setTo(this.snakeHead.x, this.snakeHead.y);
        this.spine.resolve();

        if (this.snakeRadius !== this._prevRadius) {
            this.snakeHead.setRadius(this.snakeRadius);
            this.snakeHead.body.setCircle(this.snakeRadius);
            this._prevRadius = this.snakeRadius;
        }

        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            const joint = this.spine.joints[i + 1];
            segment.setPosition(joint.x, joint.y);
            segment.setRadius(this.snakeRadius);
        }

        this.graphics.clear();
        //this.spine.debugDraw();

        this.path.unshift(new Phaser.Math.Vector2(this.snakeHead.x, this.snakeHead.y));

        while (this.path.length > this.pathMaxLength) {
            this.path.pop();
        }
    }

    updateSegments() {
        let lastPosition = new Phaser.Math.Vector2(this.snakeHead.x, this.snakeHead.y);

        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            const targetDist = (i + 1) * 5;

            let pointFound = false;
            for (let j = 0; j < this.path.length - 1; j++) {
                const p1 = this.path[j];
                const p2 = this.path[j + 1];

                const distToP1 = lastPosition.distance(p1);
                const segmentDist = p1.distance(p2);

                if (distToP1 + segmentDist >= targetDist) {
                    const dir = p2.clone().subtract(p1).normalize();
                    const requiredDist = targetDist - distToP1;
                    const newPos = p1.clone().add(dir.scale(requiredDist));
                    segment.setPosition(newPos.x, newPos.y);
                    pointFound = true;
                    break;
                }
            }

            if (!pointFound) {
                const prevSegment = i === 0 ? this.snakeHead : this.segments[i - 1];
                segment.setPosition(prevSegment.x, prevSegment.y);
            }
        }
    }

    getHead() {
        return this.snakeHead;
    }

    setDebugGraphics(graphics) {
        this.graphics = graphics;
    }
}
