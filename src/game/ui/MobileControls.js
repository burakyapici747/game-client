import Phaser from 'phaser';

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE CONTROLS — pure Phaser 3 Game Objects (Arc/Circle + Zone), no DOM.
//
// Replaces the old HTML/CSS joystick+boost overlay. Everything here is drawn
// with this.add.circle()/this.add.zone() on the scene's display list, uses
// Phaser's native pointer input (this.input, Pointer.id), and is screen-locked
// via setScrollFactor(0) so it behaves like a HUD regardless of camera zoom
// or world scroll.
//
// Contract with Game.js: writes the exact same window.mobileInput fields the
// scene's update() loop already reads (enabled, joystickActive, joystickAngle,
// joystickMagnitude, boostActive) — so Game.js's steering code needs no changes.
// ─────────────────────────────────────────────────────────────────────────────

const JOYSTICK_OUTER_RADIUS = 70;
const JOYSTICK_KNOB_RADIUS  = 26;
const BOOST_RADIUS          = 55;
const MOVE_ZONE_RATIO       = 0.55; // movement capture zone takes 55% of screen width
const IDLE_ALPHA            = 0.12; // "nearly invisible" resting state
const DEAD_ZONE_PX          = 8;
const HUD_DEPTH             = 1000000; // always above world/game-over panels

export class MobileControls {
    constructor(scene) {
        this.scene = scene;

        // Persisted user preferences (set via the settings panel in the main menu).
        this.side          = localStorage.getItem('mc_joystickSide') || 'left';
        this.controlScale  = parseFloat(localStorage.getItem('mc_scale')   || '100') / 100;
        this.controlOpacity = parseFloat(localStorage.getItem('mc_opacity') || '70') / 100;

        this.joystickPointer = null; // Phaser.Input.Pointer currently driving the joystick
        this.boostPointer    = null; // Phaser.Input.Pointer currently holding boost
        this.joystickOrigin  = { x: 0, y: 0 };

        // Multi-touch: joystick + boost must work simultaneously.
        scene.input.addPointer(2);

        this._buildGameObjects();

        // HUD objects (including the interactive touch zones) must render and
        // hit-test through the zoom-1 UI camera. Under the zoomed main camera
        // (baseZoom < 1 on mobile) the zones shrank into a centered rectangle
        // and touches outside it never reached the joystick/boost handlers.
        scene.registerHUD?.(
            this.moveZone, this.boostZone,
            this.joystickOuter, this.joystickKnob,
            this.boostButton, this.boostLabel
        );

        this._layout(scene.scale.width, scene.scale.height);
        this._bindInput();
        this._bindSettingsLive();

        window.mobileInput.enabled = true;
    }

    // ── Construction ─────────────────────────────────────────────────────────
    _buildGameObjects() {
        const scene = this.scene;

        this.moveZone = scene.add.zone(0, 0, 10, 10)
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(HUD_DEPTH)
            .setInteractive();

        this.boostZone = scene.add.zone(0, 0, 10, 10)
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(HUD_DEPTH)
            .setInteractive();

        // Joystick — plain circles, no textures/atlases needed.
        this.joystickOuter = scene.add.circle(0, 0, JOYSTICK_OUTER_RADIUS, 0xffffff, 0.07)
            .setStrokeStyle(2, 0xffffff, 0.25)
            .setScrollFactor(0)
            .setDepth(HUD_DEPTH + 1)
            .setScale(this.controlScale)
            .setAlpha(IDLE_ALPHA)
            .setVisible(false);

        this.joystickKnob = scene.add.circle(0, 0, JOYSTICK_KNOB_RADIUS, 0xffffff, 0.35)
            .setStrokeStyle(2, 0xffffff, 0.45)
            .setScrollFactor(0)
            .setDepth(HUD_DEPTH + 2)
            .setScale(this.controlScale)
            .setAlpha(IDLE_ALPHA)
            .setVisible(false);

        // Boost — fixed-position circle + label in its home corner.
        this.boostButton = scene.add.circle(0, 0, BOOST_RADIUS, 0xff4444, 0.18)
            .setStrokeStyle(2, 0xff8080, 0.4)
            .setScrollFactor(0)
            .setDepth(HUD_DEPTH + 1)
            .setScale(this.controlScale)
            .setAlpha(IDLE_ALPHA);

        this.boostLabel = scene.add.text(0, 0, 'BOOST', {
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#ffd6d6'
        }).setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(HUD_DEPTH + 2)
          .setAlpha(IDLE_ALPHA);
    }

    // ── Layout (called on build + every real resize) ─────────────────────────
    _layout(width, height) {
        const moveWidth  = width * MOVE_ZONE_RATIO;
        const boostWidth = width - moveWidth;
        const margin     = 90 * this.controlScale;

        // Keep the boost button clear of the minimap, which lives in the
        // bottom-RIGHT corner (Game.js drawMinimap). When boost is also on the
        // right (side === 'left'), shift it left past the minimap's footprint.
        const mm = this.scene.minimapMetrics?.();
        const minimapReserve = mm ? mm.size + mm.padding * 2 : 0;

        if (this.side === 'left') {
            this.moveZone.setPosition(0, 0).setSize(moveWidth, height);
            this.boostZone.setPosition(moveWidth, 0).setSize(boostWidth, height);
            this.boostHomeX = width - margin - minimapReserve;
        } else {
            this.boostZone.setPosition(0, 0).setSize(boostWidth, height);
            this.moveZone.setPosition(boostWidth, 0).setSize(moveWidth, height);
            this.boostHomeX = margin; // bottom-left: no minimap conflict
        }
        this.boostHomeY = height - margin;
        this.boostButton.setPosition(this.boostHomeX, this.boostHomeY);
        this.boostLabel.setPosition(this.boostHomeX, this.boostHomeY);

        // If a joystick is mid-touch during a resize, re-clamp its ORIGIN
        // on-screen but keep tracking the finger's real position. (The old
        // code re-spawned the joystick at its origin, which snapped the knob
        // to center and zeroed the input — the source of the violent jitter
        // whenever mobile viewport-height changes fired resize events.)
        if (this.joystickPointer) {
            const r = JOYSTICK_OUTER_RADIUS * this.controlScale + 16;
            this.joystickOrigin.x = Phaser.Math.Clamp(this.joystickOrigin.x, r, width - r);
            this.joystickOrigin.y = Phaser.Math.Clamp(this.joystickOrigin.y, r, height - r);
            this.joystickOuter.setPosition(this.joystickOrigin.x, this.joystickOrigin.y);
            this._updateJoystick(this.joystickPointer.x, this.joystickPointer.y);
        }
    }

    resize(width, height) {
        // Mobile browsers fire spurious resize events (address-bar show/hide,
        // rendering jank re-measures) with unchanged dimensions — ignore them
        // so the controls are fully isolated from that noise.
        if (width === this._lastW && height === this._lastH) return;
        this._lastW = width;
        this._lastH = height;
        this._layout(width, height);
    }

    // ── Input wiring ─────────────────────────────────────────────────────────
    _bindInput() {
        const scene = this.scene;

        this.moveZone.on('pointerdown', (pointer) => {
            if (this.joystickPointer !== null) return; // already tracking a finger
            this.joystickPointer = pointer;
            this._spawnJoystick(pointer.x, pointer.y);
        });

        this.boostZone.on('pointerdown', (pointer) => {
            if (this.boostPointer !== null) return;
            this.boostPointer = pointer;
            this._setBoostActive(true);
        });

        // Bound once so they can be removed cleanly in destroy().
        this._onPointerMove = (pointer) => {
            if (pointer === this.joystickPointer) {
                this._updateJoystick(pointer.x, pointer.y);
            }
        };
        this._onPointerUp = (pointer) => {
            if (pointer === this.joystickPointer) {
                this.joystickPointer = null;
                this._hideJoystick();
            }
            if (pointer === this.boostPointer) {
                this.boostPointer = null;
                this._setBoostActive(false);
            }
        };

        scene.input.on('pointermove', this._onPointerMove);
        scene.input.on('pointerup', this._onPointerUp);
        scene.input.on('pointerupoutside', this._onPointerUp);

        // Render smoothing: the knob eases toward its target each frame
        // instead of teleporting on every pointer event. This decouples the
        // VISUAL from event-rate/frame-rate jitter; the input values written
        // to window.mobileInput stay raw so steering remains responsive.
        this._knobTarget = { x: 0, y: 0 };
        this._onPreUpdate = () => {
            if (!this.joystickKnob.visible) return;
            const k = 0.45; // smoothing factor (1 = instant, lower = smoother)
            this.joystickKnob.x += (this._knobTarget.x - this.joystickKnob.x) * k;
            this.joystickKnob.y += (this._knobTarget.y - this.joystickKnob.y) * k;
        };
        scene.events.on('preupdate', this._onPreUpdate);
    }

    // Live-apply settings-panel changes (side / scale / opacity) without requiring
    // a page reload — mirrors the old DOM overlay's behaviour where the CSS
    // variable for opacity updated immediately.
    _bindSettingsLive() {
        this._onSettingsChanged = (e) => {
            const { side, scale, opacity } = e.detail || {};
            if (side === 'left' || side === 'right') this.side = side;
            if (Number.isFinite(scale)) {
                this.controlScale = scale;
                [this.joystickOuter, this.joystickKnob, this.boostButton].forEach(o => o.setScale(this.controlScale));
            }
            if (Number.isFinite(opacity)) this.controlOpacity = opacity;
            this._layout(this.scene.scale.width, this.scene.scale.height);
        };
        window.addEventListener('mobilecontrols:settings', this._onSettingsChanged);
    }

    // ── Joystick behaviour ───────────────────────────────────────────────────
    _spawnJoystick(x, y) {
        const radius = JOYSTICK_OUTER_RADIUS * this.controlScale;
        const margin = 16;
        const clampedX = Phaser.Math.Clamp(x, radius + margin, this.scene.scale.width  - radius - margin);
        const clampedY = Phaser.Math.Clamp(y, radius + margin, this.scene.scale.height - radius - margin);

        this.joystickOrigin.x = clampedX;
        this.joystickOrigin.y = clampedY;

        this.joystickOuter.setPosition(clampedX, clampedY).setVisible(true);
        this.joystickKnob.setPosition(clampedX, clampedY).setVisible(true);
        this.scene.tweens.add({
            targets: [this.joystickOuter, this.joystickKnob],
            alpha: this.controlOpacity,
            duration: 100
        });

        this._updateJoystick(x, y);
    }

    _updateJoystick(x, y) {
        const dx = x - this.joystickOrigin.x;
        const dy = y - this.joystickOrigin.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);

        const maxPx = (JOYSTICK_OUTER_RADIUS - JOYSTICK_KNOB_RADIUS * 0.5) * this.controlScale;
        const clampedDist = Math.min(dist, maxPx);
        // Write the TARGET only — the preupdate lerp moves the knob smoothly.
        this._knobTarget.x = this.joystickOrigin.x + Math.cos(angle) * clampedDist;
        this._knobTarget.y = this.joystickOrigin.y + Math.sin(angle) * clampedDist;

        window.mobileInput.joystickActive    = dist > DEAD_ZONE_PX;
        window.mobileInput.joystickAngle     = angle;
        window.mobileInput.joystickMagnitude = Math.min(dist / maxPx, 1);
    }

    _hideJoystick() {
        this.scene.tweens.add({
            targets: [this.joystickOuter, this.joystickKnob],
            alpha: IDLE_ALPHA,
            duration: 150,
            onComplete: () => {
                this.joystickOuter.setVisible(false);
                this.joystickKnob.setVisible(false);
            }
        });
        window.mobileInput.joystickActive    = false;
        window.mobileInput.joystickMagnitude = 0;
    }

    // ── Boost behaviour ──────────────────────────────────────────────────────
    _setBoostActive(active) {
        window.mobileInput.boostActive = active;
        this.scene.tweens.add({
            targets: [this.boostButton, this.boostLabel],
            alpha: active ? this.controlOpacity : IDLE_ALPHA,
            duration: 100
        });
        this.boostButton.setScale(this.controlScale * (active ? 0.9 : 1));
    }

    // ── Cleanup ──────────────────────────────────────────────────────────────
    destroy() {
        this.scene.input.off('pointermove', this._onPointerMove);
        this.scene.input.off('pointerup', this._onPointerUp);
        this.scene.input.off('pointerupoutside', this._onPointerUp);
        this.scene.events.off('preupdate', this._onPreUpdate);
        window.removeEventListener('mobilecontrols:settings', this._onSettingsChanged);

        [this.moveZone, this.boostZone, this.joystickOuter, this.joystickKnob, this.boostButton, this.boostLabel]
            .forEach(obj => obj && obj.destroy());

        window.mobileInput.enabled           = false;
        window.mobileInput.joystickActive    = false;
        window.mobileInput.joystickMagnitude = 0;
        window.mobileInput.boostActive       = false;
    }
}
