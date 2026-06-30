import StartGame from './game/main';

// ─── Mobile input state (read by Game.js every frame) ───────────────────────
window.mobileInput = {
    enabled:           false,
    joystickActive:    false,
    joystickAngle:     0,      // radians, atan2(dy, dx) in screen space
    joystickMagnitude: 0,      // 0 – 1
    boostActive:       false,
};

// Touch devices: pointer media query is more reliable than user-agent sniffing
function isTouchDevice() {
    return window.matchMedia('(pointer: coarse)').matches;
}

document.addEventListener('DOMContentLoaded', () => {
    const uiLayer        = document.getElementById('ui-layer');
    const playBtn        = document.getElementById('play-btn');
    const serversBtn     = document.getElementById('servers-btn');
    const serversModal   = document.getElementById('servers-modal');
    const closeServersBtn = document.getElementById('close-servers-btn');
    const serverItems    = document.querySelectorAll('.server-item');
    const nicknameInput  = document.getElementById('nickname-input');

    let selectedServer = 'ws://localhost:8080';
    let gameStarted    = false;

    // ── Nickname persistence ──────────────────────────────────────────────────
    const savedNickname = localStorage.getItem('snake_nickname');
    if (savedNickname) nicknameInput.value = savedNickname;

    // ── Servers modal ─────────────────────────────────────────────────────────
    serversBtn.addEventListener('click', () => serversModal.classList.remove('hidden'));
    closeServersBtn.addEventListener('click', () => serversModal.classList.add('hidden'));
    serversModal.addEventListener('click', (e) => {
        if (e.target === serversModal || e.target.classList.contains('modal-backdrop'))
            serversModal.classList.add('hidden');
    });
    serverItems.forEach(item => {
        item.addEventListener('click', () => {
            serverItems.forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedServer = item.dataset.server;
            setTimeout(() => serversModal.classList.add('hidden'), 300);
        });
    });

    // ── Settings panel (always active — gear button in top-right) ────────────
    initSettingsPanel();

    // ── Play ──────────────────────────────────────────────────────────────────
    playBtn.addEventListener('click', startGameLogic);
    nicknameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startGameLogic();
    });

    function startGameLogic() {
        if (gameStarted) return;

        let nickname = nicknameInput.value.trim();
        if (!nickname) nickname = 'Player' + Math.floor(Math.random() * 10000);
        localStorage.setItem('snake_nickname', nickname);

        window.gameSettings = { nickname, serverUrl: selectedServer };

        uiLayer.classList.add('hidden');
        StartGame('game-container');
        gameStarted = true;

        // Activate in-game mobile controls on touch devices
        if (isTouchDevice()) {
            initMobileOverlay();
        }
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PANEL (gear button — always active, all devices)
// ─────────────────────────────────────────────────────────────────────────────
function initSettingsPanel() {
    const settingsBtn    = document.getElementById('settings-btn');
    const panel          = document.getElementById('settings-panel');
    const sideBtns       = document.querySelectorAll('.mc-side-btn');
    const scaleSlider    = document.getElementById('mc-scale-slider');
    const scaleDisplay   = document.getElementById('mc-scale-display');
    const opacitySlider  = document.getElementById('mc-opacity-slider');
    const opacityDisplay = document.getElementById('mc-opacity-display');

    // ── Load persisted settings ───────────────────────────────────────────────
    const savedSide    = localStorage.getItem('mc_joystickSide') || 'left';
    const savedScale   = parseInt(localStorage.getItem('mc_scale')   || '100', 10);
    const savedOpacity = parseInt(localStorage.getItem('mc_opacity') || '70',  10);

    sideBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.side === savedSide));
    scaleSlider.value        = savedScale;
    scaleDisplay.textContent = savedScale + '%';
    opacitySlider.value        = savedOpacity;
    opacityDisplay.textContent = savedOpacity + '%';

    // Apply opacity CSS variable immediately so controls are correct from first frame
    document.documentElement.style.setProperty('--mc-opacity', savedOpacity / 100);

    // ── Toggle panel open/closed ──────────────────────────────────────────────
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('open');
    });

    // Close when clicking anywhere outside the panel
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && e.target !== settingsBtn) {
            panel.classList.remove('open');
        }
    });

    // ── Side picker ───────────────────────────────────────────────────────────
    sideBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sideBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            localStorage.setItem('mc_joystickSide', btn.dataset.side);
        });
    });

    // ── Scale slider ──────────────────────────────────────────────────────────
    scaleSlider.addEventListener('input', () => {
        scaleDisplay.textContent = scaleSlider.value + '%';
        localStorage.setItem('mc_scale', scaleSlider.value);
    });

    // ── Opacity slider ────────────────────────────────────────────────────────
    opacitySlider.addEventListener('input', () => {
        const val = parseInt(opacitySlider.value, 10);
        opacityDisplay.textContent = val + '%';
        localStorage.setItem('mc_opacity', val);
        document.documentElement.style.setProperty('--mc-opacity', val / 100);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// IN-GAME MOBILE OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
function initMobileOverlay() {
    const overlay     = document.getElementById('mobile-overlay');
    const joystickZone = document.getElementById('joystick-zone');
    const boostZone    = document.getElementById('boost-zone');
    const joystickOuter = document.getElementById('joystick-outer');
    const boostBtn     = document.getElementById('boost-btn');

    // Apply saved layout
    const joystickSide = localStorage.getItem('mc_joystickSide') || 'left';
    const scaleVal     = parseFloat(localStorage.getItem('mc_scale') || '100') / 100;

    if (joystickSide === 'left') {
        joystickZone.className = 'mc-zone mc-left';
        boostZone.className    = 'mc-zone mc-right';
    } else {
        joystickZone.className = 'mc-zone mc-right';
        boostZone.className    = 'mc-zone mc-left';
    }

    // Scale both controls; origin anchored to their outer bottom corner
    joystickOuter.style.transform       = `scale(${scaleVal})`;
    joystickOuter.style.transformOrigin = 'bottom center';
    boostBtn.style.transform            = `scale(${scaleVal})`;
    boostBtn.style.transformOrigin      = 'bottom center';

    overlay.classList.remove('hidden');
    window.mobileInput.enabled = true;

    setupJoystick(joystickOuter, scaleVal);
    setupBoostButton(boostBtn);
}

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUAL JOYSTICK
// ─────────────────────────────────────────────────────────────────────────────
function setupJoystick(outer, scale) {
    const knob = document.getElementById('joystick-knob');

    // Radius from center to knob edge in BASE px (outer=140, knob=52 → margin=44)
    const BASE_RADIUS = (140 - 52) / 2; // 44 px

    let activeTouchId = null;
    let centerX = 0;
    let centerY = 0;

    // touchstart anywhere inside the outer circle starts the joystick
    outer.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (activeTouchId !== null) return; // already tracking one finger
        const t = e.changedTouches[0];
        activeTouchId = t.identifier;
        outer.classList.add('active');
        // getBoundingClientRect returns visual (scaled) coordinates
        const rect = outer.getBoundingClientRect();
        centerX = rect.left + rect.width  / 2;
        centerY = rect.top  + rect.height / 2;
        applyJoystick(t.clientX, t.clientY);
    }, { passive: false });

    // Global touchmove so the finger can drift outside the circle
    document.addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === activeTouchId) {
                e.preventDefault();
                applyJoystick(t.clientX, t.clientY);
                break;
            }
        }
    }, { passive: false });

    function releaseJoystick(e) {
        for (const t of e.changedTouches) {
            if (t.identifier === activeTouchId) {
                activeTouchId = null;
                outer.classList.remove('active');
                // Return knob to center
                knob.style.transform = 'translate(-50%, -50%)';
                window.mobileInput.joystickActive    = false;
                window.mobileInput.joystickMagnitude = 0;
                break;
            }
        }
    }
    document.addEventListener('touchend',    releaseJoystick);
    document.addEventListener('touchcancel', releaseJoystick);

    function applyJoystick(cx, cy) {
        const dx   = cx - centerX;
        const dy   = cy - centerY;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);

        // Max screen-pixel offset: BASE_RADIUS * scale (because outer is scaled)
        const maxScreenPx  = BASE_RADIUS * scale;
        const clampedDist  = Math.min(dist, maxScreenPx);

        // Convert back to CSS-base-px for the knob transform (divide by scale)
        const kx = Math.cos(angle) * clampedDist / scale;
        const ky = Math.sin(angle) * clampedDist / scale;
        knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;

        // Dead-band: ignore tiny jitter at rest
        const DEAD_PX = 8;
        window.mobileInput.joystickActive    = dist > DEAD_PX;
        window.mobileInput.joystickAngle     = angle;
        window.mobileInput.joystickMagnitude = Math.min(dist / maxScreenPx, 1);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOST BUTTON
// ─────────────────────────────────────────────────────────────────────────────
function setupBoostButton(btn) {
    let activeTouchId = null;

    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (activeTouchId !== null) return;
        activeTouchId = e.changedTouches[0].identifier;
        window.mobileInput.boostActive = true;
        btn.classList.add('active');
    }, { passive: false });

    function releaseBoost(e) {
        for (const t of e.changedTouches) {
            if (t.identifier === activeTouchId) {
                activeTouchId = null;
                window.mobileInput.boostActive = false;
                btn.classList.remove('active');
                break;
            }
        }
    }
    btn.addEventListener('touchend',    releaseBoost);
    btn.addEventListener('touchcancel', releaseBoost);
}