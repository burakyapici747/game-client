import StartGame from './game/main';
import { hideAllGameOverlays, onConnectingCancel, onGameOverBackToMenu, initLeaderboardToggle,
         showAuthOverlay, hideAuthOverlay, showAuthError, getGoogleButtonSlot } from './ui/overlays.js';
import { initGoogleAuth, isSignedIn } from './auth/GoogleAuth.js';
import { serverProbe, latencyTier } from './network/ServerProbe.js';
import { fallbackServerEntry } from './network/endpoint.js';
import { initFullscreenToggle } from './ui/fullscreen.js';

// ─── Mobile input state (read by Game.js every frame) ───────────────────────
window.mobileInput = {
    enabled:           false,
    joystickActive:    false,
    joystickAngle:     0,      // radians, atan2(dy, dx) in screen space
    joystickMagnitude: 0,      // 0 – 1
    boostActive:       false,
};

// Menü ping'leri artık ServerProbe (src/network/ServerProbe.js) içinde tutulur;
// Connecting ekranı ilk göstergeyi window.gameSettings.menuPingMs üzerinden alır.

document.addEventListener('DOMContentLoaded', async () => {
    const uiLayer          = document.getElementById('ui-layer');
    const playBtn          = document.getElementById('play-btn');
    const serversBtn       = document.getElementById('servers-btn');
    const serversModal     = document.getElementById('servers-modal');
    const closeServersBtn  = document.getElementById('close-servers-btn');
    const confirmServerBtn = document.getElementById('confirm-server-btn');
    const serverList       = document.getElementById('server-list');
    const nicknameInput    = document.getElementById('nickname-input');
    const serverIndicator  = document.getElementById('selected-server-indicator');
    const indicatorName    = document.getElementById('selected-server-name');
    const indicatorPing    = document.getElementById('selected-server-ping');

    // Giriş kapısı: overlay açılır ama menü/config yüklemesi ARKADA devam eder,
    // böylece kullanıcı giriş yaparken sunucu ölçümleri çoktan bitmiş olur.
    bootstrapGoogleAuth(nicknameInput);

    let selectedServer = null;   // config'ten gelen sunucu objesi {id, name, ip, port, wsUrl}
    // Kullanici listeden elle secim yaptiysa otomatik (en dusuk ping) secim
    // ARTIK onun uzerine yazmaz — aksi halde kullanicinin tercihi arka plandaki
    // bir olcum turuyla sessizce degisirdi.
    let serverChosenManually = false;
    let gameStarted    = false;
    let gameInstance   = null;
    let teardownFns    = [];     // boot sırasında takılan observer/listener temizleyicileri

    // ── Config-driven server list ─────────────────────────────────────────────
    // Sunucu metadata'sı (id/name/ip/port/wsUrl) artık koda gömülü değil;
    // public/config.json'dan yüklenir ve DOM'a dinamik enjekte edilir.
    const config = await loadClientConfig();
    window.gameConfig = config;
    // Baslangic secimi config varsayilani; ilk olcum turu bitince EN DUSUK
    // PING'li sunucuyla degistirilir (bkz. refreshServerPings).
    selectedServer = config.servers.find(s => s.id === config.defaultServerId) || config.servers[0];
    renderServerList(config.servers);
    updateServerIndicator();
    refreshServerPings(); // sayfa açılır açılmaz arka planda ilk ölçüm

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
                serverChosenManually = true;
                // Gosterge elle secimi ANINDA yansitir (olculmus ping ile birlikte).
                updateServerIndicator();
            });
            serverList.appendChild(li);
        }
    }

    /**
     * Sunucu gecikmelerini tazeler ve UI'yi gunceller.
     *
     * Soket acilip acilmayacagina ServerProbe karar verir: TTL icindeki degerler
     * onbellekten servis edilir, ayni sunucu icin ucusta olan bir olcum varsa
     * ona katilir. Yani bu fonksiyonu tekrar tekrar cagirmak (orn. her modal
     * acilisi) YENI baglanti URETMEZ.
     *
     * @param {boolean} force TTL'i yok say (kullanicinin acik tazeleme istegi).
     */
    async function refreshServerPings(force = false) {
        const items = [...serverList.querySelectorAll('.server-item')];

        // Yalnizca GERCEKTEN olculecek kartlara "…" bas; onbellekten gelecekler
        // zaten dolu, onlari bosaltmak goz kirpma efekti yaratirdi.
        for (const item of items) {
            const id = item.dataset.serverId;
            if (!id) continue;
            if (force || !serverProbe.isFresh(id)) {
                const pingEl = item.querySelector('.server-ping');
                if (pingEl) pingEl.textContent = '…';
            }
        }
        if (!selectedServer || force || !serverProbe.isFresh(selectedServer.id)) {
            updateServerIndicator({ measuring: true });
        }

        await serverProbe.probeAll(config.servers, { force });

        for (const item of items) {
            const id = item.dataset.serverId;
            const pingEl = item.querySelector('.server-ping');
            const statusEl = item.querySelector('.server-status');
            if (!id || !pingEl || !statusEl) continue;

            const result = serverProbe.getResult(id);
            if (result?.online) {
                pingEl.textContent = `${result.rttMs}ms`;
                statusEl.textContent = 'Online';
                statusEl.classList.add('active');
            } else {
                pingEl.textContent = '--';
                statusEl.textContent = 'Offline';
                statusEl.classList.remove('active');
            }
            item.dataset.tier = latencyTier(result?.online ? result.rttMs : null);
        }

        // ── OTOMATIK SECIM: en dusuk gecikmeli cevrimici sunucu ───────────────
        // Kullanici listeden elle secim yaptiysa dokunulmaz.
        if (!serverChosenManually) {
            const best = serverProbe.pickLowestLatency(config.servers);
            if (best && best.id !== selectedServer?.id) {
                selectedServer = best;
                serverList.querySelectorAll('.server-item').forEach((i) => {
                    i.classList.toggle('selected', i.dataset.serverId === best.id);
                });
            }
        }

        updateServerIndicator();
    }

    /**
     * Nickname ekranindaki "hangi sunucudasin" gostergesini gunceller.
     * Hem otomatik secimde hem elle secimde cagrilir.
     */
    function updateServerIndicator({ measuring = false } = {}) {
        if (!serverIndicator || !indicatorName || !indicatorPing) return;

        if (!selectedServer) {
            indicatorName.textContent = 'Selecting…';
            indicatorPing.textContent = '';
            serverIndicator.dataset.tier = 'offline';
            return;
        }

        indicatorName.textContent = selectedServer.name;

        const result = serverProbe.getResult(selectedServer.id);
        if (measuring && !result) {
            indicatorPing.textContent = '…';
            serverIndicator.dataset.tier = 'measuring';
        } else if (result?.online) {
            indicatorPing.textContent = `${result.rttMs}ms`;
            serverIndicator.dataset.tier = latencyTier(result.rttMs);
        } else if (result) {
            indicatorPing.textContent = 'Offline';
            serverIndicator.dataset.tier = 'offline';
        } else {
            indicatorPing.textContent = '…';
            serverIndicator.dataset.tier = 'measuring';
        }
    }

    // ── Servers modal aç/kapa (referans: login ekranındaki Servers butonu) ───
    const closeServersModal = () => serversModal.classList.add('hidden');
    serversBtn.addEventListener('click', () => {
        serversModal.classList.remove('hidden');
        // KRITIK: burada YENI soket acilmaz. refreshServerPings TTL icindeki
        // sonuclari onbellekten servis eder; yalnizca degerler bayatladiysa
        // olcum yapilir. Eski kod her acilista sunucu basina bir WebSocket
        // aciyordu ve her el sikismasi sunucuda ~138 KB'lik FoodCollection
        // gonderimi tetikliyordu (bkz. ServerProbe.js bas yorumu).
        refreshServerPings();
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
    const teardownGameToMenu = () => {
        hideAllGameOverlays();
        teardownFns.forEach(fn => fn());
        teardownFns = [];
        // destroy(true): sahne shutdown'ı tetiklenir → NetworkManager.disconnect()
        // soketi sessizce kapatır; canvas DOM'dan kaldırılır.
        gameInstance?.destroy(true);
        gameInstance = null;
        gameStarted = false;
        uiLayer.classList.remove('hidden');
    };
    onConnectingCancel(teardownGameToMenu);

    // ── Game Over "BACK TO MENU": aynı teardown akışı ─────────────────────────
    onGameOverBackToMenu(teardownGameToMenu);

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
            menuPingMs: serverProbe.getResult(selectedServer?.id)?.rttMs ?? null,
        };

        // TEK AKTIF BAGLANTI GARANTISI: oyun soketi acilmadan hemen once tum
        // olcum soketleri kapatilir ve yeni olcum acilmasi kilitlenir. Boylece
        // NetworkManager.connect() calistiginda oturumda baska WebSocket kalmaz.
        serverProbe.lock();

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

    initFullscreenToggle();
    initLeaderboardToggle();
});

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE SIGN-IN GATE
// Auth mantığının tamamı src/auth/GoogleAuth.js'te; burada yalnızca overlay
// yaşam döngüsü ve giriş sonrası menü davranışı bağlanır.
// ─────────────────────────────────────────────────────────────────────────────
async function bootstrapGoogleAuth(nicknameInput) {
    if (isSignedIn()) return;          // aynı sekmede token hâlâ geçerli

    showAuthOverlay();

    try {
        await initGoogleAuth({
            buttonContainer: getGoogleButtonSlot(),
            autoPrompt: true,          // One Tap: geri dönen kullanıcı için sessiz giriş
            onSignIn: ({ profile }) => {
                hideAuthOverlay();

                // Nickname'i Google adıyla ön-doldur; kullanıcı değiştirebilir.
                if (nicknameInput && !nicknameInput.value && profile?.name) {
                    nicknameInput.value = profile.name.slice(0, 16);
                }

                // ── SONRAKİ ADIM ────────────────────────────────────────────
                // LootLocker oturumu burada başlatılacak:
                //   startLootLockerSession(window.googleIdToken)
                // Token ~1 saat geçerli; oturumu hemen açıp LootLocker'ın kendi
                // session token'ıyla devam etmek doğru olan.
            },
        });
    } catch (err) {
        // SDK bloklanmış/çevrimdışı: kullanıcı boş kutuya bakmasın.
        console.error('[auth] Google Sign-In başlatılamadı:', err);
        showAuthError(err.message);
    }
}

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
        // Adres ve şema src/network/endpoint.js'te çözülür: HTTPS sayfada aynı
        // origin, dev sunucusunda .env, native kabukta doğrudan üretim.
        const fallback = fallbackServerEntry();
        return {
            servers: [fallback],
            defaultServerId: fallback.id,
            ping: { heartbeatIntervalMs: 2500, calibration: { discardSamples: 1, minSamples: 3, intervalMs: 500 } },
        };
    }
}

// (Ölçüm mantığı src/network/ServerProbe.js'e taşındı — tek sahiplik noktası,
//  onbellek + TTL, soket çoğaltma koruması ve toplu kapatma orada.)

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