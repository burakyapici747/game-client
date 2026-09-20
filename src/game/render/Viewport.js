import Phaser from 'phaser';

/**
 * VIEWPORT — high-DPI backing buffer + single source of truth for screen size.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * Phaser 3.90 has NO device-pixel-ratio support: `render.resolution` was
 * removed from the Game Config long ago and is silently ignored. Under
 * `Scale.RESIZE` the canvas backing buffer equals the parent's CSS size, so on
 * a DPR-3 phone every rendered pixel was stretched 3x3 by the browser
 * compositor — the root cause of blurry snakes/nicknames on mobile.
 *
 * ── THE TRANSFORM ───────────────────────────────────────────────────────────
 *
 *   density   D   = min(devicePixelRatio, MAX_RENDER_DENSITY)
 *   CSS size      = cssW × cssH                (parent element, layout px)
 *   buffer size   = round(cssW·D) × round(cssH·D)   (canvas.width/height)
 *   canvas style  = cssW × cssH                (so the browser maps buffer
 *                                               texels ~1:1 onto device px)
 *
 * Phaser game size == buffer size, so camera viewports and pointer.x/y are in
 * BUFFER pixels (the ScaleManager's displayScale converts DOM → buffer using
 * the canvas' bounding rect, so input stays exact). Consumers therefore:
 *
 *   - World camera:  zoom = baseZoom(CSS) · D  → world units per CSS px are
 *                    unchanged, i.e. the FOV is identical at every density.
 *   - UI camera:     zoom = D, origin (0,0)    → HUD code keeps working in
 *                    CSS px; see {@link cssWidth}/{@link cssHeight}.
 *
 * ── WHY THE CAP ─────────────────────────────────────────────────────────────
 *
 * Fill cost and framebuffer memory scale with D². DPR 3 → 9x the fragments of
 * DPR 1 (2.25x of DPR 2) for a difference barely visible at phone viewing
 * distance. Capping at 2 keeps low/mid-range mobile GPUs within budget.
 *
 * ── RESIZE TRANSACTION ──────────────────────────────────────────────────────
 *
 * ResizeObserver, visualViewport.resize, window.resize and orientationchange
 * (plus DPR changes, e.g. dragging the window to another monitor) all just
 * call {@link requestSync}. Syncs are coalesced into ONE rAF step that
 * measures the parent once and applies buffer size + style + bounds + a single
 * RESIZE event atomically. `Scale.NONE` means Phaser itself never resizes the
 * canvas, so there is exactly one writer.
 */

/** Upper bound for render density (see "WHY THE CAP"). */
export const MAX_RENDER_DENSITY = 2;

/** Per-game viewport state. WeakMap → no leaks across game restarts. */
const stateByGame = new WeakMap();

/** Current target density for this device/monitor. */
export function computeRenderDensity() {
    return Math.min(window.devicePixelRatio || 1, MAX_RENDER_DENSITY);
}

/** Parent's layout size in CSS px (never 0, Phaser cannot build a 0x0 GL buffer). */
function measureParent(parent) {
    return {
        width: Math.max(1, Math.round(parent.clientWidth)),
        height: Math.max(1, Math.round(parent.clientHeight)),
    };
}

/**
 * Game Config fragment for the boot size. The first frame must already be
 * high-DPI, otherwise Phaser would boot at a default 1024x768 and the first
 * sync would reallocate the context's drawing buffer immediately.
 *
 * @param {HTMLElement} parent
 */
export function bootScaleConfig(parent) {
    const density = computeRenderDensity();
    const css = measureParent(parent);
    return {
        density,
        scale: {
            mode: Phaser.Scale.NONE,
            width: Math.round(css.width * density),
            height: Math.round(css.height * density),
            // Informational for Phaser's displaySize; the exact CSS style is
            // written by applySync below (zoom-derived style can be off by a
            // sub-pixel because the buffer size is rounded).
            zoom: 1 / density,
        },
    };
}

/** Render density currently applied to the game (1 before attach). */
export function renderDensity(game) {
    return stateByGame.get(game)?.density ?? 1;
}

/** Game width in CSS px — what HUD layout should use. */
export function cssWidth(game) {
    return stateByGame.get(game)?.cssWidth ?? game.scale.width;
}

/** Game height in CSS px — what HUD layout should use. */
export function cssHeight(game) {
    return stateByGame.get(game)?.cssHeight ?? game.scale.height;
}

/**
 * Applies the measured size immediately. Idempotent: returns false (and emits
 * nothing) when neither the CSS size nor the density changed.
 */
function applySync(game, state) {
    const scale = game.scale;
    const canvas = game.canvas;
    if (!canvas || !scale) return false;

    const density = computeRenderDensity();
    const css = measureParent(state.parent);

    if (state.applied
        && css.width === state.cssWidth && css.height === state.cssHeight
        && density === state.density) {
        return false;
    }
    state.applied = true;

    // Publish the new state BEFORE resize(): resize() synchronously emits
    // Scale RESIZE, and listeners (Game.handleResize) read density/CSS size.
    state.density = density;
    state.cssWidth = css.width;
    state.cssHeight = css.height;

    const bufferW = Math.round(css.width * density);
    const bufferH = Math.round(css.height * density);

    // zoom is assigned directly (not setZoom) — setZoom() calls refresh() and
    // would emit an extra RESIZE with the stale buffer size.
    scale.zoom = 1 / density;
    scale.resize(bufferW, bufferH); // canvas.width/height + one RESIZE event

    // Exact CSS size. resize() derives the style from bufferW·zoom, which is
    // off by < 1/D px after rounding and would leave a hairline gap. It also
    // SKIPS writing the style when D === 1, leaving a stale value behind after
    // moving from a Retina to a DPR-1 monitor.
    canvas.style.width = css.width + 'px';
    canvas.style.height = css.height + 'px';

    // Re-derive DOM→buffer input mapping from the final style (no event).
    scale.updateBounds();
    scale.displayScale.set(bufferW / scale.canvasBounds.width, bufferH / scale.canvasBounds.height);

    return true;
}

/**
 * Schedules a coalesced sync. Any number of calls in the same frame produce a
 * single measurement and at most one RESIZE event.
 */
export function requestSync(game) {
    const state = stateByGame.get(game);
    if (!state || state.rafId) return;
    state.rafId = requestAnimationFrame(() => {
        state.rafId = 0;
        applySync(game, state);
    });
}

/** Synchronous sync — for callers that need correct sizes this very frame. */
export function syncNow(game) {
    const state = stateByGame.get(game);
    if (!state) return false;
    if (state.rafId) {
        cancelAnimationFrame(state.rafId);
        state.rafId = 0;
    }
    return applySync(game, state);
}

/**
 * Binds every size/density signal to the coalesced sync.
 *
 * @param {Phaser.Game} game
 * @param {HTMLElement} parent  element whose CSS box the canvas must fill.
 * @param {number} bootDensity  density used in bootScaleConfig.
 * @returns {() => void} teardown
 */
export function attachViewport(game, parent, bootDensity) {
    const bootCss = measureParent(parent);
    const state = {
        parent,
        // Seeded with the boot values so getters are valid immediately.
        density: bootDensity,
        cssWidth: bootCss.width,
        cssHeight: bootCss.height,
        // false → the first sync always applies (writes the exact CSS style
        // and input mapping even if the size did not change since boot).
        applied: false,
        rafId: 0,
    };
    stateByGame.set(game, state);

    const request = () => requestSync(game);

    const observer = new ResizeObserver(request);
    observer.observe(parent);
    window.addEventListener('resize', request);
    window.addEventListener('orientationchange', request);
    window.visualViewport?.addEventListener('resize', request);

    // DPR changes (monitor switch, browser zoom) fire no resize on the parent.
    // A matchMedia query is bound to ONE ratio, so re-arm after every change.
    let dprQuery = null;
    const onDprChange = () => {
        request();
        armDprQuery();
    };
    const armDprQuery = () => {
        dprQuery?.removeEventListener('change', onDprChange);
        dprQuery = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`) ?? null;
        dprQuery?.addEventListener('change', onDprChange);
    };
    armDprQuery();

    // Boot races (e.g. keyboard dismissal still animating): settle once ready.
    game.events.once('ready', () => syncNow(game));

    return () => {
        if (state.rafId) cancelAnimationFrame(state.rafId);
        observer.disconnect();
        window.removeEventListener('resize', request);
        window.removeEventListener('orientationchange', request);
        window.visualViewport?.removeEventListener('resize', request);
        dprQuery?.removeEventListener('change', onDprChange);
        stateByGame.delete(game);
    };
}
