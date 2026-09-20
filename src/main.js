import StartGame from './game/main';
import { hideAllGameOverlays, showConnectingOverlay, onConnectingCancel, onGameOverBackToMenu, initLeaderboardToggle,
         hideAuthOverlay, clearAuthError, getGoogleButtonSlot, getInlineGoogleButtonSlot,
         initAuthOverlayClose, initServiceBanner, applyHudTelemetrySettings,
         isHudStatEnabled, onHudExit } from './ui/overlays.js';
import { initGoogleAuth, isSignedIn, renderSignInButton } from './auth/GoogleAuth.js';
import { initSessionBridge, establishSession, startGuestSession, endSession,
         getAuthMode, getSessionProfile, restoreSession, defaultGuestNickname,
         setPlayNickname, onSessionChange } from './auth/SessionManager.js';
import { initLoginTabs, setActiveTab, showSocialError, clearSocialError } from './ui/LoginTabs.js';
import { initSidePanel, hideSidePanel, showSidePanelIfSignedIn } from './ui/SidePanel.js';
import { serverProbe, latencyTier } from './network/ServerProbe.js';
import { fallbackServerEntry } from './network/endpoint.js';

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

    // 401/503 kancaları ve banner düğmeleri, HERHANGİ bir API çağrısından ÖNCE
    // kurulmalı: aksi halde ilk oturum isteğinin hatası dinleyicisiz kalır ve
    // kullanıcı sessizce boş bir ekrana bakar.
    initServiceBanner();
    initAuthOverlayClose();
    initSessionBridge();

    // ── OTURUMU GERİ GETİR, YOKSA MİSAFİR OL ────────────────────────────────
    // Sayfanın İLK ağ çağrısı budur ve Google SDK'sını BEKLEMEZ: çerez varsa
    // kimlik sunucudan gelir, yoksa ziyaretçi anında misafir olarak oynayabilir.
    // Beklemek, menünün "kim olduğu belirsiz" bir ara durumda çizilmesi demekti.
    //
    // await KASITLI: altındaki tüm menü kurulumu (takma ad kutusu, yan panel)
    // oturumun BİLİNDİĞİ bir durumda çizilsin. Çağrı başarısız olsa bile
    // misafir kipine düşülür — oyun hiçbir koşulda açılamaz hale gelmez.
    restoreSession()
        .then((restored) => {
            if (!restored.ok) startGuestSession(defaultGuestNickname());
        })
        .catch(() => startGuestSession(defaultGuestNickname()));

    // Giriş sekmeleri (GUEST | SOCIAL LOGIN) ve giriş sonrası sol panel.
    // İkisi de SessionManager.onSessionChange'e abone olur; abone olurken
    // mevcut durumu da aldıkları için sıralama önemli değildir.
    initLoginTabs();
    initSidePanel({ onSignOut: handleSignOut });

    // ARTIK KAPI DEĞİL: Google SDK arka planda hazırlanır, buton SOCIAL LOGIN
    // sekmesine çizilir. Menü ve sunucu ölçümleri hiçbir şey beklemez —
    // misafir oyuncu doğrudan PLAY'e basabilir.
    bootstrapGoogleAuth(nicknameInput);

    let selectedServer = null;   // config'ten gelen sunucu objesi {id, name, ip, port, wsUrl}
    // Kullanici listeden elle secim yaptiysa otomatik (en dusuk ping) secim
    // ARTIK onun uzerine yazmaz — aksi halde kullanicinin tercihi arka plandaki
    // bir olcum turuyla sessizce degisirdi.
    let serverChosenManually = false;
    // Seçili sunucunun CANLI ölçüm aboneliğini bırakan fonksiyon. Tek seferlik
    // ölçüm 15 sn sonra bayatlar ve kimse tazelemez; gösterge canlı kalsın
    // diye seçili sunucu ayrıca izlenir (bkz. ServerProbe.watch).
    let stopWatchingSelectedServer = null;
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
    watchSelectedServer(); // ve seçili sunucu için canlı nabız

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
                // Canlı nabız YENİ seçime taşınır: eskisinin soketi kapanır,
                // yenisi patlama fazıyla hızlı bir değer üretir.
                watchSelectedServer();
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
            if (!id) continue;
            paintServerRow(id, serverProbe.getResult(id));
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
                watchSelectedServer();
            }
        }

        updateServerIndicator();
    }

    /** Tek bir sunucu kartını ölçüm sonucuna göre boyar. */
    function paintServerRow(serverId, result) {
        const item = serverList.querySelector(`.server-item[data-server-id="${serverId}"]`);
        if (!item) return;
        const pingEl = item.querySelector('.server-ping');
        const statusEl = item.querySelector('.server-status');
        if (!pingEl || !statusEl) return;

        if (result?.online && result.rttMs != null) {
            pingEl.textContent = formatPing(result);
            statusEl.textContent = 'Online';
            statusEl.classList.add('active');
        } else {
            pingEl.textContent = '--';
            statusEl.textContent = 'Offline';
            statusEl.classList.remove('active');
        }
        item.dataset.tier = latencyTier(result?.online ? result.rttMs : null);
    }

    /**
     * Ölçüm sonucunu metne çevirir.
     *
     * <p>`estimated` sonuç, sunucu hiç pong döndürmediğinde el sıkışması
     * süresinden TÜRETİLMİŞTİR ve yapısal olarak şişkindir. Kesin ölçümle
     * aynı biçimde gösterilseydi kullanıcıya olmayan bir kesinlik vaat
     * ederdi; tilde işareti bunu görünür kılar.
     */
    function formatPing(result) {
        return result.estimated ? `~${result.rttMs}ms` : `${result.rttMs}ms`;
    }

    /**
     * SEÇİLİ SUNUCUYU CANLI İZLE.
     *
     * <p>Abonelik TEKİLDİR: yeni izleme başlatılmadan önce eskisi bırakılır,
     * aksi halde her seçim değişikliği ardında bir nabız (ve bir soket)
     * bırakırdı. Bırakma fonksiyonu son izleyici gittiğinde oturumu da
     * kapatır (bkz. ServerProbe.watch).
     */
    function watchSelectedServer() {
        stopWatchingSelectedServer?.();
        stopWatchingSelectedServer = null;
        if (!selectedServer) return;

        const watchedId = selectedServer.id;
        stopWatchingSelectedServer = serverProbe.watch(selectedServer, (result) => {
            // Seçim bu arada değiştiyse geriden gelen sonucu UYGULAMA.
            if (selectedServer?.id !== watchedId) return;
            paintServerRow(watchedId, result);
            updateServerIndicator();
        });
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

        // ÖLÇÜLMEDİ ile ÇEVRİMDIŞI AYRI DURUMLARDIR. ServerProbe bir sonucu
        // ancak yayınlanabilir bir değer oluştuğunda (en az iki geçerli örnek
        // ortalandığında) ya da sunucu ulaşılamaz olduğunda yazar; dolayısıyla
        // "sonuç yok" = "hâlâ ölçüyoruz" demektir ve göstergede nabız atan
        // "…" ile temsil edilir (bkz. .server-indicator[data-tier="measuring"]).
        const result = serverProbe.getResult(selectedServer.id);
        if (result?.online && result.rttMs != null) {
            indicatorPing.textContent = formatPing(result);
            serverIndicator.dataset.tier = latencyTier(result.rttMs);
        } else if (result && !measuring) {
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
    const rangeSliders = [masterVolumeSlider, sfxVolumeSlider, controlSizeSlider, opacitySlider];

    // The filled part of each slider track is painted by CSS from --fill.
    // It's computed against min/max: Control Size (50–150) and Opacity
    // (10–100) don't start at 0, so the raw value isn't a track percentage.
    const syncRangeFill = (slider) => {
        const min = Number(slider.min) || 0;
        const max = Number(slider.max) || 100;
        const pct = ((Number(slider.value) - min) / (max - min)) * 100;
        slider.style.setProperty('--fill', `${pct}%`);
    };

    // Load persisted settings
    const loadSettings = () => {
        // VARSAYILAN ACIK: anahtar hic yazilmamissa iki sayac da gorunur.
        // Eski kod "=== 'true'" ile okuyordu, yani yazilmamis anahtar KAPALI
        // demekti — anahtarlar HUD'a hic baglanmadigi icin bu fark gorunmuyordu.
        // Simdi bagli olduklarina gore varsayilan, bugunku goruntuyu korumali.
        showFpsToggle.checked = isHudStatEnabled('fps');
        showPingToggle.checked = isHudStatEnabled('ping');
        masterVolumeSlider.value = localStorage.getItem('master_volume') || '85';
        masterVolumeDisplay.textContent = masterVolumeSlider.value + '%';
        sfxVolumeSlider.value = localStorage.getItem('sfx_volume') || '60';
        sfxVolumeDisplay.textContent = sfxVolumeSlider.value + '%';
        controlSizeSlider.value = localStorage.getItem('mc_scale') || '110';
        controlSizeDisplay.textContent = controlSizeSlider.value + '%';
        opacitySlider.value = localStorage.getItem('mc_opacity') || '75';
        opacityDisplay.textContent = opacitySlider.value + '%';
        rangeSliders.forEach(syncRangeFill);

        const joystickSide = localStorage.getItem('mc_joystickSide') || 'left';
        joystickBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.side === joystickSide);
        });
    };

    loadSettings();
    // HUD gorunurlugu ILK karede dogru olsun: oyun sonradan baslasa da
    // showGameHUD tekrar uygular, ama menuye donuldugunde acik kalan HUD
    // parcalari icin burasi da gerekir.
    applyHudTelemetrySettings();
    // Apply opacity CSS variable immediately so controls are correct from first frame
    document.documentElement.style.setProperty('--mc-opacity', (localStorage.getItem('mc_opacity') || '75') / 100);

    rangeSliders.forEach(slider => slider.addEventListener('input', () => syncRangeFill(slider)));

    // Save settings on change
    // KALICILIK + ANINDA UYGULAMA. Eskiden yalnizca ilk satir vardi: deger
    // saklaniyor ama hicbir yerde okunmuyordu.
    showFpsToggle.addEventListener('change', () => {
        localStorage.setItem('show_fps', showFpsToggle.checked);
        applyHudTelemetrySettings();
    });

    showPingToggle.addEventListener('change', () => {
        localStorage.setItem('show_ping', showPingToggle.checked);
        applyHudTelemetrySettings();
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
        applyHudTelemetrySettings();
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
        // ÖLÇÜM KİLİDİNİ AÇ: startGameLogic oyun soketi tek kalsın diye
        // kilitlemişti. Açılmazsa menüye dönen oyuncu ölü bir göstergeye
        // bakar — değerler bayatlar, hiçbir ölçüm başlamaz.
        serverProbe.unlock();
        refreshServerPings(true);
        watchSelectedServer();
        // Panel oyun boyunca gizliydi (canvas'ı kapatmasın diye); menüye
        // dönüldüğünde oturum hâlâ duruyorsa geri gelir.
        showSidePanelIfSignedIn();
    };
    onConnectingCancel(teardownGameToMenu);

    // Oyun içi çıkış AYNI teardown'ı kullanır: bağlantıyı kapatma, Phaser'ı
    // yıkma ve menüye dönme sırası tek yerde tanımlı kalmalı — ikinci bir
    // kopya, zamanla iki farklı "çıkış" davranışına ayrışırdı.
    onHudExit(teardownGameToMenu);

    // ── Game Over "BACK TO MENU": aynı teardown akışı ─────────────────────────
    onGameOverBackToMenu(teardownGameToMenu);

    // ── Nickname persistence ──────────────────────────────────────────────────
    const savedNickname = localStorage.getItem('snake_nickname');
    if (savedNickname) nicknameInput.value = savedNickname;

    // ── TAKMA AD ÇİFT YÖNLÜ SENKRON ─────────────────────────────────────────
    // Kutu ve panel başlığı AYNI değeri gösterir; tek yazma noktası
    // SessionManager'dır. Böylece "hangisi doğru" sorusu hiç doğmaz.
    //
    //   yazarken  : input -> setPlayNickname -> oturum yayını -> panel başlığı
    //   oturumda  : onSessionChange -> input (yalnızca DEĞERİ farklıysa)
    //
    // DÖNGÜ YOK: `input.value`'ya programatik atama `input` olayı üretmez ve
    // değer aynıysa zaten hiçbir şey yazılmaz.
    nicknameInput.addEventListener('input', () => {
        setPlayNickname(nicknameInput.value);
    });

    onSessionChange(({ profile }) => {
        const name = profile?.nickname;
        if (!name) return;
        // Kullanıcı O AN yazıyorsa kutusuna dokunma: imleci kaydırmak ve
        // yazdığını değiştirmek en sinir bozucu hatadır.
        if (document.activeElement === nicknameInput) return;
        if (nicknameInput.value !== name) nicknameInput.value = name;
    });

    // ── Play ──────────────────────────────────────────────────────────────────
    playBtn.addEventListener('click', startGameLogic);
    nicknameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startGameLogic();
    });

    function startGameLogic() {
        if (gameStarted) return;
        gameStarted = true; // set immediately: boot below is deferred, block double-taps

        // Takma ad kaynagi sirasi: kutuya yazilan > oturum profili (Google adi
        // ya da onceki misafir adi) > uretilen ad. Kullanicinin GUEST panelinde
        // yazdigi ad her zaman kazanir.
        let nickname = nicknameInput.value.trim();
        if (!nickname) nickname = getSessionProfile()?.nickname?.trim() ?? '';
        if (!nickname) nickname = 'Player' + Math.floor(Math.random() * 10000);
        localStorage.setItem('snake_nickname', nickname);

        // MISAFIR GIRISI: Google oturumu yoksa PLAY yerel oturumu kurar. Bu,
        // GUEST sekmesinin sozunu tutar (sosyal saglayici olmadan hizli giris)
        // ve yan panelin kime ait oldugunu bilmesini saglar.
        if (getAuthMode() !== 'google') startGuestSession(nickname);

        // Panel oyun sirasinda canvas'i ve mobil kontrolleri kapatmasin.
        hideSidePanel();

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
        // Önce ABONELİK bırakılır, sonra kilit: lock() zaten tüm oturumları
        // kapatır, ama izleyici kaydı kalsaydı menüye dönüşte (unlock) ölü bir
        // callback yeniden canlanırdı.
        stopWatchingSelectedServer?.();
        stopWatchingSelectedServer = null;
        serverProbe.lock();

        // Bağlanma ekranı PLAY anında açılır: Phaser boot + Preloader (2048'lik
        // zemin dahil) Game.create'ten ÖNCE çalışır. Eskiden ekran Game.create'te
        // açıldığı için bu süre boyunca menü gizli, canvas boş kalıyordu.
        showConnectingOverlay(window.gameSettings.serverName, window.gameSettings.menuPingMs);

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

            // Resize/DPR tracking (ResizeObserver, visualViewport, window
            // resize, orientationchange, devicePixelRatio changes) is owned
            // by StartGame → render/Viewport.js and torn down on game destroy.
        }, 150));

        // In-game joystick/boost controls are now rendered inside the Phaser
        // scene itself (see src/game/ui/MobileControls.js), which detects touch
        // support via this.sys.game.device.input.touch and builds itself with
        // this.add.circle()/this.add.zone() — no DOM activation needed here.
    }

    initLeaderboardToggle();
});

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE SIGN-IN — SEKME İÇİ AKIŞ (artık açılış kapısı DEĞİL)
//
// Eskiden burada tam ekran bir auth overlay'i açılıyordu ve kimlik doğrulanana
// kadar menü kullanılamıyordu. GUEST sekmesi bu kapıyla çelişir: misafir,
// tanım gereği, hiçbir sosyal sağlayıcıya uğramadan oynayabilmelidir.
//
// Yeni akış: SDK arka planda hazırlanır, resmî buton SOCIAL LOGIN sekmesine
// çizilir. Overlay yalnızca 401 sonrası yeniden giriş istemi olarak açılır
// (bkz. SessionManager.initSessionBridge) ve artık kapatılabilir.
//
// Auth mantığının tamamı src/auth/GoogleAuth.js'te; burada yalnızca butonun
// nereye çizileceği ve giriş sonrası menü davranışı bağlanır.
// ─────────────────────────────────────────────────────────────────────────────
async function bootstrapGoogleAuth(nicknameInput) {
    try {
        await initGoogleAuth({
            // Buton giriş kartındaki sekmeye çizilir.
            buttonContainer: getInlineGoogleButtonSlot(),
            // One Tap: geri dönen kullanıcı için sessiz giriş. Zaten geçerli
            // bir token varsa istemi açmanın anlamı yok.
            autoPrompt: !isSignedIn(),
            onSignIn: ({ profile }) => {
                clearAuthError();
                clearSocialError();
                hideAuthOverlay();          // 401 istemi açıksa kapansın
                setActiveTab('social', false);

                // Nickname'i Google adıyla ön-doldur; kullanıcı değiştirebilir.
                if (nicknameInput && !nicknameInput.value && profile?.name) {
                    nicknameInput.value = profile.name.slice(0, 16);
                }

                // ── PROXY OTURUMU ───────────────────────────────────────────
                // ID Token'ı Java proxy'ye taşır; proxy onu LootLocker'ın native
                // /game/session/google ucuna verir ve oyuncuyu eşler. Başarıda
                // SessionManager 'google' kipine geçer ve yan panel (cüzdan,
                // envanter, skinler) kendiliğinden dolar.
                //
                // BİLEREK await EDİLMEZ: menü ve sunucu ölçümleri beklemez,
                // oyuncu oturum kurulurken PLAY'e basabilir. establishSession
                // throw etmez, 401/503 kullanıcı bildirimini global kancalar
                // yapar (bkz. SessionManager.initSessionBridge) — bu yüzden
                // burada yakalanmamış bir promise reddi oluşamaz.
                establishSession().then((result) => {
                    if (!result.ok) {
                        console.warn('[auth] proxy oturumu kurulamadı:', result.reason);
                    }
                });
            },
        });

        // 401 sonrası açılan overlay'de de çalışan bir buton bulunsun. Google
        // SDK'sı aynı client_id için birden fazla kaba buton çizebilir; iki
        // yuva birbirinden bağımsızdır.
        renderSignInButton(getGoogleButtonSlot());
    } catch (err) {
        // SDK bloklanmış/çevrimdışı. Oyun ENGELLENMEZ: misafir girişi hâlâ
        // çalışıyor, hata yalnızca sosyal panelde bir satır olarak görünür.
        console.error('[auth] Google Sign-In başlatılamadı:', err);
        showSocialError(err.message);
    }
}

/**
 * Yan paneldeki "Sign out" eyleminin hedefi.
 *
 * <p>Oturumu düşürmek main.js'in işidir: panel kimliği sahiplenmez, yalnızca
 * gösterir. endSession hem yerel Google state'ini temizler hem de kip
 * değişikliğini yayınlar — sekmeler GUEST'e döner, panel gizlenir.
 */
function handleSignOut() {
    endSession();
    clearAuthError();
    clearSocialError();
    hideAuthOverlay();

    // ── ÇIKIŞ, OTURUMSUZLUK DEĞİL MİSAFİRLİKTİR ─────────────────────────────
    // endSession kipi null'a çeker ve yan panel tamamen GİZLENİR. Girişsiz
    // ziyaretçinin varsayılan olarak misafir sayıldığı bir akışta bu tutarsız:
    // oyuncu çıkış yapar yapmaz paneli, takma adını ve mağazayı kaybederdi.
    // Girişsiz her durumun TEK bir karşılığı var: misafir.
    startGuestSession(defaultGuestNickname());
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
            ping: {
                heartbeatIntervalMs: 2500,
                calibration: { discardSamples: 1, minSamples: 3, intervalMs: 500 },
                // Menü ölçüm profili; ServerProbe kendi varsayılanlarını da
                // taşır, burası yalnızca config.json ile aynı yüzeyi gösterir.
                menuProbe: {
                    burstSamples: 4, burstIntervalMs: 150,
                    pulseIntervalMs: 2500, pulseDurationMs: 30000,
                    discardSamples: 1, minSamples: 2,
                },
            },
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