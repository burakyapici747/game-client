import StartGame from './game/main';

// ─── Mobile input state (read by Game.js every frame) ───────────────────────
window.mobileInput = {
    enabled:           false,
    joystickActive:    false,
    joystickAngle:     0,      // radians, atan2(dy, dx) in screen space
    joystickMagnitude: 0,      // 0 – 1
    boostActive:       false,
};

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

        // In-game joystick/boost controls are now rendered inside the Phaser
        // scene itself (see src/game/ui/MobileControls.js), which detects touch
        // support via this.sys.game.device.input.touch and builds itself with
        // this.add.circle()/this.add.zone() — no DOM activation needed here.
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
            dispatchMobileControlsSettings();
        });
    });

    // ── Scale slider ──────────────────────────────────────────────────────────
    scaleSlider.addEventListener('input', () => {
        scaleDisplay.textContent = scaleSlider.value + '%';
        localStorage.setItem('mc_scale', scaleSlider.value);
        dispatchMobileControlsSettings();
    });

    // ── Opacity slider ────────────────────────────────────────────────────────
    opacitySlider.addEventListener('input', () => {
        const val = parseInt(opacitySlider.value, 10);
        opacityDisplay.textContent = val + '%';
        localStorage.setItem('mc_opacity', val);
        document.documentElement.style.setProperty('--mc-opacity', val / 100);
        dispatchMobileControlsSettings();
    });
}

// In-game joystick/boost controls (src/game/ui/MobileControls.js) read their
// side/scale/opacity from localStorage once at construction time. This event
// lets them pick up settings-panel changes live, mid-game, without a reload —
// matching the old DOM overlay's behaviour where opacity updated immediately
// via a CSS variable.
function dispatchMobileControlsSettings() {
    window.dispatchEvent(new CustomEvent('mobilecontrols:settings', {
        detail: {
            side: localStorage.getItem('mc_joystickSide') || 'left',
            scale: parseFloat(localStorage.getItem('mc_scale') || '100') / 100,
            opacity: parseFloat(localStorage.getItem('mc_opacity') || '70') / 100,
        }
    }));
}