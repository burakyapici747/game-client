import StartGame from './game/main';
import { hideAllGameOverlays, onConnectingCancel } from './ui/overlays.js';

// ─── Mobile input state (read by Game.js every frame) ───────────────────────
window.mobileInput = {
    enabled:           false,
    joystickActive:    false,
    joystickAngle:     0,      // radians, atan2(dy, dx) in screen space
    joystickMagnitude: 0,      // 0 – 1
    boostActive:       false,
};

// En son ölçülen menü ping'leri (serverId -> ms). Connecting ekranı, oyun-içi
// heartbeat kalibre olana kadar bu değeri başlangıç göstergesi olarak kullanır.
const menuPingByServerId = new Map();

document.addEventListener('DOMContentLoaded', async () => {
    const uiLayer          = document.getElementById('ui-layer');
    const playBtn          = document.getElementById('play-btn');
    const serversBtn       = document.getElementById('servers-btn');
    const serversModal     = document.getElementById('servers-modal');
    const closeServersBtn  = document.getElementById('close-servers-btn');
    const confirmServerBtn = document.getElementById('confirm-server-btn');
    const serverList       = document.getElementById('server-list');
    const nicknameInput    = document.getElementById('nickname-input');

    let selectedServer = null;   // config'ten gelen sunucu objesi {id, name, ip, port, wsUrl}
    let gameStarted    = false;
    let gameInstance   = null;
    let teardownFns    = [];     // boot sırasında takılan observer/listener temizleyicileri

    // ── Config-driven server list ─────────────────────────────────────────────
    // Sunucu metadata'sı (id/name/ip/port/wsUrl) artık koda gömülü değil;
    // public/config.json'dan yüklenir ve DOM'a dinamik enjekte edilir.
    const config = await loadClientConfig();
    window.gameConfig = config;
    selectedServer = config.servers.find(s => s.id === config.defaultServerId) || config.servers[0];
    renderServerList(config.servers);
    measureServerPings(); // sayfa açılır açılmaz arka planda ilk ölçüm

    // Sunucu kartları (referans: server_list.html) — globe ikonu + bölge adı +
    // durum alt yazısı solda; latency-tier renkli ping + sinyal ikonu sağda.
    function renderServerList(servers) {
        serverList.innerHTML = '';
        for (const server of servers) {
            const li = document.createElement('li');
            li.className = 'server-item' + (server.id === selectedServer?.id ? ' selected' : '');
            li.dataset.server = server.wsUrl;
            li.dataset.serverId = server.id;
            li.setAttribute('role', 'option');

            const left = document.createElement('div');
            left.className = 'server-card-left';

            const globe = document.createElement('div');
            globe.className = 'server-globe';
            globe.innerHTML =
                '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
                '<circle cx="12" cy="12" r="10"></circle>' +
                '<line x1="2" y1="12" x2="22" y2="12"></line>' +
                '<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>' +
                '</svg>';

            const info = document.createElement('div');
            info.className = 'server-info';
            const region = document.createElement('span');
            region.className = 'server-region';
            region.textContent = server.name;
            const status = document.createElement('span');
            status.className = 'server-status';
            status.textContent = 'Checking…';
            info.append(region, status);
            left.append(globe, info);

            const pingWrap = document.createElement('div');
            pingWrap.className = 'server-ping-wrap';
            const ping = document.createElement('span');
            ping.className = 'server-ping';
            ping.textContent = '--';
            const signal = document.createElement('span');
            signal.innerHTML =
                '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">' +
                '<rect x="3" y="14" width="4" height="7" rx="1"></rect>' +
                '<rect x="10" y="9" width="4" height="12" rx="1"></rect>' +
                '<rect x="17" y="4" width="4" height="17" rx="1"></rect>' +
                '</svg>';
            pingWrap.append(ping, signal);

            li.append(left, pingWrap);
            li.addEventListener('click', () => {
                serverList.querySelectorAll('.server-item').forEach(i => i.classList.remove('selected'));
                li.classList.add('selected');
                selectedServer = server;
            });
            serverList.appendChild(li);
        }
    }

    // ── Servers modal aç/kapa (referans: login ekranındaki Servers butonu) ───
    const closeServersModal = () => serversModal.classList.add('hidden');
    serversBtn.addEventListener('click', () => {
        serversModal.classList.remove('hidden');
        measureServerPings(); // her açılışta ping değerlerini tazele
    });
    closeServersBtn.addEventListener('click', closeServersModal);
    confirmServerBtn.addEventListener('click', closeServersModal);
    serversModal.addEventListener('click', (e) => {
        if (e.target.classList.contains('servers-modal-backdrop')) closeServersModal();
    });

    // ── Settings modal (new comprehensive settings) ────────────────────────────
    const settingsModal = document.getElementById('settings-modal');
    const settingsModalCloseBtn = document.getElementById('settings-modal-close-btn');
    const settingsBtn = document.getElementById('settings-btn');

    const closeSettingsModal = () => settingsModal.classList.add('hidden');

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsModal.classList.remove('hidden');
    });

    settingsModalCloseBtn.addEventListener('click', closeSettingsModal);
    settingsModal.addEventListener('click', (e) => {
        if (e.target.classList.contains('settings-modal-backdrop')) closeSettingsModal();
    });

    // Settings modal controls
    const showFpsToggle = document.getElementById('show-fps-toggle');
    const showPingToggle = document.getElementById('show-ping-toggle');
    const masterVolumeSlider = document.getElementById('master-volume-slider');
    const masterVolumeDisplay = document.getElementById('master-volume-display');
    const sfxVolumeSlider = document.getElementById('sfx-volume-slider');
    const sfxVolumeDisplay = document.getElementById('sfx-volume-display');
    const controlSizeSlider = document.getElementById('control-size-slider');
    const controlSizeDisplay = document.getElementById('control-size-display');
    const opacitySlider = document.getElementById('opacity-slider');
    const opacityDisplay = document.getElementById('opacity-display');
    const joystickBtns = document.querySelectorAll('.settings-group-btn');
    const settingsSaveBtn = document.getElementById('settings-save-btn');
    const settingsResetBtn = document.getElementById('settings-reset-btn');

    // Load persisted settings
    const loadSettings = () => {
        showFpsToggle.checked = localStorage.getItem('show_fps') === 'true';
        showPingToggle.checked = localStorage.getItem('show_ping') === 'true';
        masterVolumeSlider.value = localStorage.getItem('master_volume') || '85';
        masterVolumeDisplay.textContent = masterVolumeSlider.value + '%';
        sfxVolumeSlider.value = localStorage.getItem('sfx_volume') || '60';
        sfxVolumeDisplay.textContent = sfxVolumeSlider.value + '%';
        controlSizeSlider.value = localStorage.getItem('mc_scale') || '110';
        controlSizeDisplay.textContent = controlSizeSlider.value + '%';
        opacitySlider.value = localStorage.getItem('mc_opacity') || '75';
        opacityDisplay.textContent = opacitySlider.value + '%';

        const joystickSide = localStorage.getItem('mc_joystickSide') || 'left';
        joystickBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.side === joystickSide);
        });
    };

    loadSettings();
    // Apply opacity CSS variable immediately so controls are correct from first frame
    document.documentElement.style.setProperty('--mc-opacity', (localStorage.getItem('mc_opacity') || '75') / 100);

    // Save settings on change
    showFpsToggle.addEventListener('change', () => {
        localStorage.setItem('show_fps', showFpsToggle.checked);
    });

    showPingToggle.addEventListener('change', () => {
        localStorage.setItem('show_ping', showPingToggle.checked);
    });

    masterVolumeSlider.addEventListener('input', () => {
        masterVolumeDisplay.textContent = masterVolumeSlider.value + '%';
        localStorage.setItem('master_volume', masterVolumeSlider.value);
    });

    sfxVolumeSlider.addEventListener('input', () => {
        sfxVolumeDisplay.textContent = sfxVolumeSlider.value + '%';
        localStorage.setItem('sfx_volume', sfxVolumeSlider.value);
    });

    controlSizeSlider.addEventListener('input', () => {
        controlSizeDisplay.textContent = controlSizeSlider.value + '%';
        localStorage.setItem('mc_scale', controlSizeSlider.value);
        dispatchMobileControlsSettings();
    });

    opacitySlider.addEventListener('input', () => {
        opacityDisplay.textContent = opacitySlider.value + '%';
        localStorage.setItem('mc_opacity', opacitySlider.value);
        document.documentElement.style.setProperty('--mc-opacity', opacitySlider.value / 100);
        dispatchMobileControlsSettings();
    });

    joystickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            joystickBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            localStorage.setItem('mc_joystickSide', btn.dataset.side);
            dispatchMobileControlsSettings();
        });
    });

    settingsSaveBtn.addEventListener('click', () => {
        closeSettingsModal();
    });

    settingsResetBtn.addEventListener('click', () => {
        localStorage.removeItem('show_fps');
        localStorage.removeItem('show_ping');
        localStorage.removeItem('master_volume');
        localStorage.removeItem('sfx_volume');
        localStorage.removeItem('mc_scale');
        localStorage.removeItem('mc_opacity');
        localStorage.removeItem('mc_joystickSide');
        loadSettings();
        dispatchMobileControlsSettings();
    });

    // ── Connecting overlay Cancel: soketi kapat, Phaser'ı yık, menüye dön ────
    onConnectingCancel(() => {
        hideAllGameOverlays();
        teardownFns.forEach(fn => fn());
        teardownFns = [];
        // destroy(true): sahne shutdown'ı tetiklenir → NetworkManager.disconnect()
        // soketi sessizce kapatır; canvas DOM'dan kaldırılır.
        gameInstance?.destroy(true);
        gameInstance = null;
        gameStarted = false;
        uiLayer.classList.remove('hidden');
    });

    // ── Nickname persistence ──────────────────────────────────────────────────
    const savedNickname = localStorage.getItem('snake_nickname');
    if (savedNickname) nicknameInput.value = savedNickname;

    // ── Play ──────────────────────────────────────────────────────────────────
    playBtn.addEventListener('click', startGameLogic);
    nicknameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startGameLogic();
    });

    function startGameLogic() {
        if (gameStarted) return;
        gameStarted = true; // set immediately: boot below is deferred, block double-taps

        let nickname = nicknameInput.value.trim();
        if (!nickname) nickname = 'Player' + Math.floor(Math.random() * 10000);
        localStorage.setItem('snake_nickname', nickname);

        window.gameSettings = {
            nickname,
            serverUrl: selectedServer?.wsUrl,
            serverName: selectedServer?.name || 'Unknown',
            // Connecting ekranının ilk PING göstergesi (heartbeat kalibre olana dek)
            menuPingMs: menuPingByServerId.get(selectedServer?.id) ?? null,
        };

        // Dismiss the mobile on-screen keyboard BEFORE Phaser boots. Phaser's
        // RESIZE scale mode snapshots the parent's bounds once at boot and only
        // re-checks on window.resize/orientationchange — if it boots while the
        // keyboard has the viewport shrunk, the game is stuck at that small size.
        nicknameInput.blur();
        uiLayer.classList.add('hidden');

        // rAF + short delay lets the keyboard dismissal and layout transitions
        // settle so Phaser measures the real, full-screen parent bounds.
        requestAnimationFrame(() => setTimeout(() => {
            if (!gameStarted) return; // Cancel araya girdiyse boot'u iptal et
            const game = StartGame('game-container');
            gameInstance = game;

            const refresh = () => game.scale.refresh();

            // Re-measure once boot completes, in case bounds shifted mid-boot.
            game.events.once('ready', refresh);

            // Phaser only listens to window.resize + orientationchange. On
            // mobile, keyboard show/hide and browser-chrome (address bar)
            // changes often fire ONLY visualViewport resize — or no event at
            // all except the element itself changing size. ResizeObserver on
            // the parent makes it the single source of truth for game size.
            const observer = new ResizeObserver(refresh);
            observer.observe(document.getElementById('game-container'));
            window.visualViewport?.addEventListener('resize', refresh);
            teardownFns.push(() => {
                observer.disconnect();
                window.visualViewport?.removeEventListener('resize', refresh);
            });
        }, 150));

        // In-game joystick/boost controls are now rendered inside the Phaser
        // scene itself (see src/game/ui/MobileControls.js), which detects touch
        // support via this.sys.game.device.input.touch and builds itself with
        // this.add.circle()/this.add.zone() — no DOM activation needed here.
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT CONFIG LOADER
// public/config.json başarısız olursa (dev ortamı, dosya eksik vb.) env
// tabanlı tek sunuculu bir fallback listesi üretilir — oyun asla config
// yüzünden açılamaz durumda kalmaz.
// ─────────────────────────────────────────────────────────────────────────────
async function loadClientConfig() {
    try {
        const res = await fetch('/config.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error(`config.json HTTP ${res.status}`);
        const cfg = await res.json();
        if (!Array.isArray(cfg.servers) || cfg.servers.length === 0) {
            throw new Error('config.json: servers listesi boş');
        }
        return cfg;
    } catch (err) {
        console.warn('config.json yüklenemedi, fallback kullanılıyor:', err);
        const ip = import.meta.env.VITE_SERVER_URL || 'localhost';
        return {
            servers: [{ id: 'local', name: 'Local Server', ip, port: 8080, wsUrl: `ws://${ip}:8080/ws` }],
            defaultServerId: 'local',
            ping: { heartbeatIntervalMs: 2500, calibration: { discardSamples: 1, minSamples: 3, intervalMs: 500 } },
        };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVER PING MEASUREMENT (pre-login, background)
// Her sunucuya geçici bir WebSocket açıp handshake süresini ölçer. Handshake
// ≈ TCP kurulumu (1 RTT) + WS upgrade (1 RTT) olduğundan süre ikiye bölünerek
// tek yön + dönüş (ping) yaklaşımı elde edilir. Ölçüm bitince soket kapatılır;
// in-flight guard (dataset.pinging) aynı sunucuya paralel ölçümü engeller.
// ─────────────────────────────────────────────────────────────────────────────
function measureServerPings() {
    document.querySelectorAll('.server-item').forEach(item => {
        const rawUrl = item.dataset.server;
        const pingEl = item.querySelector('.server-ping');
        const statusEl = item.querySelector('.server-status');
        if (!rawUrl || !pingEl || !statusEl || item.dataset.pinging === '1') return;

        // Sunucu WS endpoint'i /ws path'inde yaşıyor — normalize et.
        const url = rawUrl.endsWith('/ws') ? rawUrl : rawUrl.replace(/\/+$/, '') + '/ws';

        item.dataset.pinging = '1';
        pingEl.textContent = '…';

        let ws = null;
        let settled = false;
        const t0 = performance.now();

        const finish = (ok) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            item.dataset.pinging = '';
            try { ws?.close(); } catch (_) { /* önemsiz */ }
            if (ok) {
                const rtt = Math.max(1, Math.round((performance.now() - t0) / 2));
                pingEl.textContent = `${rtt}ms`;
                statusEl.textContent = 'Online';
                statusEl.classList.add('active');
                if (item.dataset.serverId) menuPingByServerId.set(item.dataset.serverId, rtt);
                // Latency tier → kart üzerindeki ping/sinyal rengi (bkz. style.css)
                item.dataset.tier = rtt < 60 ? 'good' : rtt < 120 ? 'ok' : rtt < 200 ? 'high' : 'bad';
            } else {
                pingEl.textContent = '--';
                statusEl.textContent = 'Offline';
                statusEl.classList.remove('active');
                item.dataset.tier = 'offline';
            }
        };

        const timeoutId = setTimeout(() => finish(false), 4000);
        try {
            ws = new WebSocket(url);
            ws.onopen = () => finish(true);
            ws.onerror = () => finish(false);
        } catch (_) {
            finish(false);
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PANEL (gear button — always active, all devices)
// ─────────────────────────────────────────────────────────────────────────────
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