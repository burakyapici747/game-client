// xmlns is REQUIRED for innerHTML-injected SVGs in Safari — without it the
// parser treats the markup as unknown HTML, child elements get no SVG
// namespace, and stroke/fill attributes silently do nothing (invisible icon).
// Explicit stroke/fill on every child (not just the root) avoids Safari's
// spotty currentColor inheritance inside injected SVG fragments.
const ICON_STROKE = '#ebddff';

const SVG_ENTER =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" ' +
    'fill="none" stroke="' + ICON_STROKE + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'style="display:block">' +
    '<polyline points="15 3 21 3 21 9" stroke="' + ICON_STROKE + '"></polyline>' +
    '<polyline points="9 21 3 21 3 15" stroke="' + ICON_STROKE + '"></polyline>' +
    '<line x1="21" y1="3" x2="14" y2="10" stroke="' + ICON_STROKE + '"></line>' +
    '<line x1="3" y1="21" x2="10" y2="14" stroke="' + ICON_STROKE + '"></line>' +
    '</svg>';

const SVG_EXIT =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" ' +
    'fill="none" stroke="' + ICON_STROKE + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'style="display:block">' +
    '<polyline points="4 14 10 14 10 20" stroke="' + ICON_STROKE + '"></polyline>' +
    '<polyline points="20 10 14 10 14 4" stroke="' + ICON_STROKE + '"></polyline>' +
    '<line x1="14" y1="10" x2="21" y2="3" stroke="' + ICON_STROKE + '"></line>' +
    '<line x1="3" y1="21" x2="10" y2="14" stroke="' + ICON_STROKE + '"></line>' +
    '</svg>';

// ── Cross-browser Fullscreen API abstraction ────────────────────────────────

function getFullscreenElement() {
    return document.fullscreenElement
        || document.webkitFullscreenElement
        || document.mozFullScreenElement
        || document.msFullscreenElement
        || null;
}

function isFullscreen() {
    return !!getFullscreenElement();
}

function requestFullscreen(el) {
    const fn = el.requestFullscreen
        || el.webkitRequestFullscreen
        || el.mozRequestFullScreen
        || el.msRequestFullscreen;
    if (!fn) return Promise.reject(new Error('not supported'));
    try {
        const result = fn.call(el);
        return (result && typeof result.then === 'function')
            ? result
            : Promise.resolve();
    } catch (e) {
        return Promise.reject(e);
    }
}

function exitFullscreen() {
    const fn = document.exitFullscreen
        || document.webkitExitFullscreen
        || document.mozCancelFullScreen
        || document.msExitFullscreen;
    if (!fn) return Promise.resolve();
    try {
        const result = fn.call(document);
        return (result && typeof result.then === 'function')
            ? result
            : Promise.resolve();
    } catch (e) {
        return Promise.reject(e);
    }
}

function canRequestFullscreen() {
    const el = document.documentElement;
    return !!(
        el.requestFullscreen ||
        el.webkitRequestFullscreen ||
        el.mozRequestFullScreen ||
        el.msRequestFullscreen
    );
}

// ── Orientation lock (best-effort, never throws to caller) ──────────────────

function lockLandscape() {
    try {
        const orient = screen.orientation || screen.mozOrientation || screen.msOrientation;
        if (orient && typeof orient.lock === 'function') {
            orient.lock('landscape').catch(() => {});
        }
    } catch (_) { /* unsupported */ }
}

function unlockOrientation() {
    try {
        const orient = screen.orientation || screen.mozOrientation || screen.msOrientation;
        if (orient && typeof orient.unlock === 'function') {
            orient.unlock();
        }
    } catch (_) { /* unsupported */ }
}

function isMobile() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// iOS Safari detection: iPhone Safari does not support the Fullscreen API on
// standard DOM elements (only <video> and standalone PWA mode).
function isIOSSafari() {
    const ua = navigator.userAgent;
    return /iP(hone|od)/.test(ua) && /WebKit/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
}

// ── CSS pseudo-fullscreen fallback (iOS Safari) ─────────────────────────────
const PSEUDO_FS_CLASS = 'pseudo-fullscreen';

function isPseudoFullscreen() {
    return document.documentElement.classList.contains(PSEUDO_FS_CLASS);
}

function enterPseudoFullscreen() {
    document.documentElement.classList.add(PSEUDO_FS_CLASS);
}

function exitPseudoFullscreen() {
    document.documentElement.classList.remove(PSEUDO_FS_CLASS);
}

// ── Public init ─────────────────────────────────────────────────────────────

export function initFullscreenToggle() {
    const btn = document.getElementById('fullscreen-btn');
    if (!btn) return;

    const iosMode = isIOSSafari();
    const nativeSupport = canRequestFullscreen();

    if (!nativeSupport && !iosMode) return;

    function syncIcon() {
        const active = nativeSupport ? isFullscreen() : isPseudoFullscreen();
        btn.innerHTML = active ? SVG_EXIT : SVG_ENTER;
        btn.title = active ? 'Exit Fullscreen' : 'Enter Fullscreen';
    }
    syncIcon();

    btn.addEventListener('click', async () => {
        if (iosMode && !nativeSupport) {
            if (isPseudoFullscreen()) {
                exitPseudoFullscreen();
                unlockOrientation();
            } else {
                enterPseudoFullscreen();
                if (isMobile()) lockLandscape();
            }
            syncIcon();
            return;
        }

        if (isFullscreen()) {
            await exitFullscreen().catch(() => {});
            unlockOrientation();
        } else {
            await requestFullscreen(document.documentElement).catch(() => {});
            if (isMobile()) lockLandscape();
        }
    });

    document.addEventListener('fullscreenchange', syncIcon);
    document.addEventListener('webkitfullscreenchange', syncIcon);
    document.addEventListener('mozfullscreenchange', syncIcon);
    document.addEventListener('MSFullscreenChange', syncIcon);
}
