const SVG_ENTER =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="15 3 21 3 21 9"></polyline>' +
    '<polyline points="9 21 3 21 3 15"></polyline>' +
    '<line x1="21" y1="3" x2="14" y2="10"></line>' +
    '<line x1="3" y1="21" x2="10" y2="14"></line>' +
    '</svg>';

const SVG_EXIT =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="4 14 10 14 10 20"></polyline>' +
    '<polyline points="20 10 14 10 14 4"></polyline>' +
    '<line x1="14" y1="10" x2="21" y2="3"></line>' +
    '<line x1="3" y1="21" x2="10" y2="14"></line>' +
    '</svg>';

function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function isMobile() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

async function lockLandscape() {
    try {
        await screen.orientation?.lock?.('landscape');
    } catch (_) { /* not supported or denied */ }
}

function unlockOrientation() {
    try {
        screen.orientation?.unlock?.();
    } catch (_) { /* not supported */ }
}

export function initFullscreenToggle() {
    const el = document.documentElement;

    const canFullscreen = !!(
        el.requestFullscreen ||
        el.webkitRequestFullscreen
    );
    if (!canFullscreen) return;

    const btn = document.getElementById('fullscreen-btn');
    if (!btn) return;

    function syncIcon() {
        btn.innerHTML = isFullscreen() ? SVG_EXIT : SVG_ENTER;
        btn.title = isFullscreen() ? 'Exit Fullscreen' : 'Enter Fullscreen';
    }
    syncIcon();

    btn.addEventListener('click', async () => {
        if (isFullscreen()) {
            if (document.exitFullscreen) {
                await document.exitFullscreen().catch(() => {});
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
            unlockOrientation();
        } else {
            const requestFn = el.requestFullscreen || el.webkitRequestFullscreen;
            await requestFn.call(el).catch(() => {});
            if (isMobile()) await lockLandscape();
        }
    });

    document.addEventListener('fullscreenchange', syncIcon);
    document.addEventListener('webkitfullscreenchange', syncIcon);
}
