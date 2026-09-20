// ─────────────────────────────────────────────────────────────────────────────
// HTML/CSS OVERLAY MANAGER — unified UI standard
//
// Ara ekranlar (Connecting, Game Over) Phaser canvas'ı İÇİNDE çizilmez;
// canvas'ın üzerine konumlanan native HTML/CSS katmanları olarak render
// edilir. DOM elemanları index.html'de, stiller public/style.css'te tanımlı.
// Bu modül hem menü katmanı (src/main.js) hem de oyun sahnesi (Game.js)
// tarafından import edilen tek ortak kontrol noktasıdır.
// ─────────────────────────────────────────────────────────────────────────────

import { recordGame } from './PlayerStats.js';

const $ = (id) => document.getElementById(id);

// ── Google Sign-In gate ──────────────────────────────────────────────────────
// Auth mantığı src/auth/GoogleAuth.js'te; burada yalnızca DOM görünürlüğü
// yönetilir — overlay show/hide'ın tek sahibi bu modül olsun diye.

export function showAuthOverlay() {
    $('auth-overlay')?.classList.remove('hidden');
}

export function hideAuthOverlay() {
    $('auth-overlay')?.classList.add('hidden');
}

// SDK yüklenemediğinde kullanıcı boş bir kutuya bakmasın.
export function showAuthError(message) {
    const el = $('auth-error');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
}

export function getGoogleButtonSlot() {
    return $('google-signin-button');
}

/**
 * Giris kartindaki SOCIAL LOGIN sekmesinin Google buton yuvasi.
 *
 * <p>Overlay yuvasindan AYRI bir dugumdur: ayni id iki yerde olamaz ve Google
 * SDK'si her iki kaba da bagimsiz birer buton cizebilir. Boylece acilista
 * kartta, 401 sonrasi da overlay'de calisan bir buton bulunur.
 */
export function getInlineGoogleButtonSlot() {
    return $('google-signin-button-inline');
}

/**
 * Auth overlay'inin kapatma dugmesini baglar. Uygulama basinda BIR KEZ.
 *
 * <p>Overlay artik acilis KAPISI degil, 401 sonrasi yeniden giris istemidir:
 * misafir oyuncu onu kapatip oynamaya devam edebilmelidir. Kapanista hata
 * satiri da temizlenir, aksi halde overlay bir sonraki acilista eski mesajla
 * gelirdi.
 */
export function initAuthOverlayClose() {
    $('auth-close-btn')?.addEventListener('click', () => {
        clearAuthError();
        hideAuthOverlay();
    });
}

/** Auth hata satırını temizler (yeniden giriş denemesinden önce). */
export function clearAuthError() {
    const el = $('auth-error');
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
}

// ── Servis durumu banner'ı ───────────────────────────────────────────────────
// Proxy 503 döndürdüğünde (LootLocker Google Sign-In kapalı/arızalı) gösterilir.
// Auth overlay'inin ÜSTÜNDE durur: 503 çoğunlukla tam da giriş anında oluşur ve
// kullanıcının "buton çalışmıyor" sanmaması gerekir. Oyunu ENGELLEMEZ —
// kapatılabilir, oynanış sürer, yalnızca hesaba bağlı özellikler beklemededir.

let bannerRetryHandler = null;

export function showServiceBanner(message, { onRetry } = {}) {
    const banner = $('service-banner');
    const text = $('service-banner-text');
    if (!banner || !text) return;

    text.textContent = message;
    bannerRetryHandler = typeof onRetry === 'function' ? onRetry : null;

    const retryBtn = $('service-banner-retry');
    if (retryBtn) retryBtn.classList.toggle('hidden', !bannerRetryHandler);

    banner.classList.remove('hidden');
}

export function hideServiceBanner() {
    $('service-banner')?.classList.add('hidden');
}

/** Banner düğmelerini bağlar — uygulama başlarken bir kez çağrılır. */
export function initServiceBanner() {
    $('service-banner-retry')?.addEventListener('click', () => {
        // Handler'ı kopyala: hideServiceBanner sırasında sıfırlanabilir.
        const handler = bannerRetryHandler;
        handler?.();
    });
    $('service-banner-close')?.addEventListener('click', hideServiceBanner);
}

// ── Connecting overlay ───────────────────────────────────────────────────────
// PLAY'e basıldığı anda açılır (src/main.js) ve oyun görünene kadar kalır.
// İlerleme çubuğu SAHTE DEĞİLDİR — her aşama gerçek bir olaya bağlıdır:
//
//   assets      Preloader yükleme oranı 0..1        (Preloader 'progress')  →  0–40%
//   connecting  soket açılıyor 0 → açıldı 1          (Game.create / 'socket_open') → 45–55%
//   joining     ilk veri bayrakları 0..3 / 3         (Game.checkInitialDataComplete) → 60–95%
//   (gizle)     dünya görünür                        (hideConnectingOverlay)  → 100%
//
// Çubuk ve başlık yalnızca İLERİ gider: geç gelen bir önceki aşama çağrısı
// (ör. respawn'da sahnenin yeniden kurulması) göstergeyi geri sardırmaz.
const CONNECTING_STAGES = Object.freeze({
    assets:     { order: 0, title: 'Loading game assets…',  from: 0,  to: 40 },
    connecting: { order: 1, title: 'Connecting to server…', from: 45, to: 55 },
    joining:    { order: 2, title: 'Joining world…',        from: 60, to: 95 },
});

let connectingStage = null;
let connectingProgress = 0;

function renderConnectingProgress(pct) {
    const fill = $('conn-progress-fill');
    if (fill) fill.style.width = `${pct}%`;
    $('conn-progress')?.setAttribute('aria-valuenow', String(Math.round(pct)));
}

function setConnectingTitle(text) {
    const el = $('conn-title');
    if (!el || el.textContent === text) return;
    el.textContent = text;
    // Yumuşak geçiş: yalnızca opacity/transform (layout yok), Web Animations
    // API ile — sınıf ekle/çıkar + reflow hilesine gerek kalmaz.
    el.animate?.(
        [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
        { duration: 250, easing: 'ease-out' },
    );
}

/**
 * @param {'assets'|'connecting'|'joining'} stage
 * @param {number} [fraction=0] Aşama içindeki ilerleme, 0..1.
 */
export function setConnectingStage(stage, fraction = 0) {
    const def = CONNECTING_STAGES[stage];
    if (!def) return;

    const current = connectingStage ? CONNECTING_STAGES[connectingStage].order : -1;
    if (def.order < current) return;
    if (def.order > current) {
        connectingStage = stage;
        setConnectingTitle(def.title);
    }

    const f = Math.min(1, Math.max(0, Number(fraction) || 0));
    const pct = def.from + (def.to - def.from) * f;
    if (pct > connectingProgress) {
        connectingProgress = pct;
        renderConnectingProgress(pct);
    }
}

export function showConnectingOverlay(serverName, initialPingMs = null) {
    const nameEl = $('conn-server-name');
    if (nameEl) nameEl.textContent = serverName || 'Unknown';
    updateConnectingPing(initialPingMs);

    // İKİ çağıran var: PLAY anında main.js, ardından Game.create. Ekran zaten
    // açıksa ilerleme SIFIRLANMAZ — yalnızca kapalıyken yeni tur başlar.
    const overlay = $('connecting-overlay');
    if (overlay?.classList.contains('hidden')) {
        // YENİ TUR: önceki turun sıralaması düşürülür. Aksi halde bu turun ilk
        // sıralama paketi gelmeden ölen oyuncuya ESKİ turun sırası gösterilirdi
        // (bkz. showGameOverOverlay → lastLeaderboardData).
        lastLeaderboardData = null;
        connectingStage = null;
        connectingProgress = 0;
        renderConnectingProgress(0);
        setConnectingStage('assets', 0);
        overlay.classList.remove('hidden');
    }
}

// Bağlantı ekranındaki PING metriği: önce menüden ölçülen değerle başlar,
// oyun-içi heartbeat kalibre olur olmaz canlı değerle güncellenir.
export function updateConnectingPing(ms) {
    const pingEl = $('conn-ping-value');
    if (!pingEl) return;
    pingEl.textContent = (ms === null || ms === undefined) ? '--' : `${ms}ms`;
}

export function hideConnectingOverlay() {
    const overlay = $('connecting-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    // Son kare dolu çubuk: overlay 0.3 sn'lik fade ile kaybolurken %100 görünür.
    connectingProgress = 100;
    renderConnectingProgress(100);
    overlay.classList.add('hidden');
}

// Cancel butonu: bağlantı iptal akışının sahibi (soketi kapatıp menüye dönen
// taraf) src/main.js olduğundan, handler dışarıdan bağlanır.
export function onConnectingCancel(handler) {
    const btn = $('conn-cancel-btn');
    if (btn) btn.onclick = handler; // onclick ataması — tekrar bağlamada listener birikmez
}

// ── Game Over overlay (reference: game_over_ui/game_over.html) ─────────────

const COUNT_UP_MS = 600;
const prefersReducedMotion = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** Çalışan sayaçlar — yeni bir ölüm ekranı öncekini iptal eder. */
const countUpFrames = new Map();

/**
 * Değeri 0'dan hedefe sayar. Metin HER ZAMAN formatScore'dan geçer, yani
 * sayarken de bitişte de HUD ile aynı biçimi (binlik ayraç) kullanır.
 *
 * <p>Animasyon azaltma tercihinde (ya da hedef 0 iken) anında yazılır.
 */
function countUp(el, target, format = formatScore) {
    if (!el) return;

    const running = countUpFrames.get(el);
    if (running) cancelAnimationFrame(running);

    const end = Math.max(0, Math.trunc(Number(target) || 0));
    if (end === 0 || prefersReducedMotion()) {
        el.textContent = format(end);
        countUpFrames.delete(el);
        return;
    }

    const started = performance.now();
    const step = (now) => {
        // easeOutCubic: hızlı başlar, hedefte yumuşak durur.
        const t = Math.min(1, (now - started) / COUNT_UP_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = format(Math.round(end * eased));
        if (t < 1) {
            countUpFrames.set(el, requestAnimationFrame(step));
        } else {
            countUpFrames.delete(el);
        }
    };
    el.textContent = format(0);
    countUpFrames.set(el, requestAnimationFrame(step));
}

/**
 * stats: { score, foodEaten } — client tarafında takip edilir (Game.js).
 *
 * <p>SIRA (rank) için sunucudan ayrıca bir şey beklenmez: istemci sıralama
 * paketlerini zaten işliyor ve sonuncusu lastLeaderboardData'da duruyor
 * (bkz. updateHUDLeaderboard). Sıralama ~5 sn'de bir yayınlandığı için değer
 * ölüm anında o kadar bayat olabilir; oyuncu hiç sıralanmadıysa 0 gelir ve
 * uydurma bir sayı yerine "—" gösterilir.
 */
export function showGameOverOverlay(stats, onPlayAgain) {
    const { score = 0, foodEaten = 0 } = stats ?? {};

    // Yerel ilerleme BURADA islenir: oyunun bittigini kesin bilen ve skoru
    // elinde tutan tek nokta burasi (bkz. PlayerStats).
    recordGame({ score, foodEaten });

    countUp($('gameover-score'), score);
    countUp($('gameover-food-eaten'), foodEaten);

    const rankEl = $('gameover-rank');
    if (rankEl) {
        const rank = Number(lastLeaderboardData?.selfRank) || 0;
        if (rank > 0) {
            countUp(rankEl, rank, (v) => `#${formatScore(v)}`);
        } else {
            rankEl.textContent = '—';
        }
    }

    const btn = $('gameover-play-again');
    if (btn) {
        btn.onclick = () => {
            hideGameOverOverlay();
            onPlayAgain?.();
        };
    }
    $('gameover-overlay')?.classList.remove('hidden');
}

// BACK TO MENU: oyunu yıkıp menüye dönen taraf src/main.js olduğundan
// (bkz. onConnectingCancel ile aynı teardown), handler dışarıdan bağlanır.
export function onGameOverBackToMenu(handler) {
    const btn = $('gameover-back-menu');
    if (btn) {
        btn.onclick = () => {
            hideGameOverOverlay();
            handler?.();
        };
    }
}

export function hideGameOverOverlay() {
    $('gameover-overlay')?.classList.add('hidden');
}

// Sahne kapanırken (restart/cancel) hangi overlay açıksa temizle.
export function hideAllGameOverlays() {
    hideConnectingOverlay();
    hideGameOverOverlay();
    hideGameHUD();
}

// ── Game HUD ────────────────────────────────────────────────────────

/**
 * ── TELEMETRI GORUNURLUGU (Settings > Show FPS / Show Ping) ─────────────────
 *
 * <p>ESKIDEN: iki anahtar yalnizca localStorage'a yaziyordu ve HUD'u okuyan
 * KIMSE YOKTU — FPS ve ping her kosulda gorunuyordu. Anahtar goruntude hicbir
 * sey degistirmedigi icin "ayar bozuk" gorunuyordu; oysa ayar hic baglanmamisti.
 *
 * <h3>VARSAYILAN ACIK</h3>
 * Anahtar HIC yazilmamissa deger {@code true}'dur. Bunun nedeni geriye
 * uyumluluk: bugune kadar herkeste iki sayac da gorunuyordu, varsayilani
 * kapali yapmak tum mevcut oyunculardan sessizce HUD parcasi silerdi.
 * index.html'deki {@code checked} nitelikleri de bu varsayilani yansitir,
 * boylece JS calismadan once de anahtarlar dogru konumda cizilir.
 *
 * <h3>OLCUM DURMAZ, YALNIZCA GOSTERIM DURUR</h3>
 * Ping kapatildiginda ping DONGUSU calismaya devam eder. RTT tahmini yalnizca
 * HUD'u beslemez; yilanin yerel tahmini ve adaptif interpolasyon buffer'i da
 * ayni olcumu okur (bkz. NetworkManager.pingEmaMs / EntityInterpolator).
 * Olcumu durdurmak, bir HUD tercihini GAMEPLAY davranisina baglamak olurdu.
 */
const HUD_STAT_STORAGE_KEYS = { fps: 'show_fps', ping: 'show_ping' };

// Sicak yol onbellegi: updateHUDStats 10 Hz kosar, her tikte localStorage
// okumak gereksiz senkron I/O olurdu. applyHudTelemetrySettings tazeler.
let hudStatVisibility = { fps: true, ping: true };

/** Ayarin ETKIN degeri; anahtar yoksa varsayilan ACIK. */
export function isHudStatEnabled(statName) {
    const raw = localStorage.getItem(HUD_STAT_STORAGE_KEYS[statName]);
    return raw === null ? true : raw === 'true';
}

/**
 * Ayarlari DOM'a uygular. Ayar degistiginde, HUD gosterildiginde ve sayfa
 * acilisinda cagrilir — yani gorunurluk tek bir yerden turer.
 */
export function applyHudTelemetrySettings() {
    hudStatVisibility = { fps: isHudStatEnabled('fps'), ping: isHudStatEnabled('ping') };

    $('hud-stat-fps')?.classList.toggle('hidden', !hudStatVisibility.fps);
    $('hud-stat-ping')?.classList.toggle('hidden', !hudStatVisibility.ping);
    // Iki satir da kapaliysa BOS pil kalmasin.
    $('hud-stats-panel')?.classList.toggle('hidden', !hudStatVisibility.fps && !hudStatVisibility.ping);
}

/**
 * MINI HARITA OLCULERINI CSS'E YAYINLAR.
 *
 * <p>Mini harita Phaser canvas'ina cizilir, koordinat rozeti ise DOM'dur.
 * Rozetin haritaya hizali kalmasinin tek yolu, haritanin olculerini tek
 * kaynaktan (Game.minimapMetrics) alip CSS'e aktarmaktir; boylece iki ayri
 * yerde iki farkli "24px padding" sabiti tutulmaz.
 *
 * <p>Yalnizca metrikler DEGISTIGINDE cagrilir (olusum + resize), her karede
 * degil: CSS degiskeni yazmak stil yeniden hesaplamasi tetikler.
 */
export function publishMinimapMetrics(sizePx, paddingPx) {
    const hud = $('game-hud');
    if (!hud) return;
    hud.style.setProperty('--minimap-size', `${sizePx}px`);
    hud.style.setProperty('--minimap-pad', `${paddingPx}px`);
}

export function showGameHUD() {
    // Oyun her basladiginda ayarlar YENIDEN uygulanir: oyuncu menude anahtari
    // degistirmis olabilir ve HUD o sirada gizliydi.
    applyHudTelemetrySettings();
    $('game-hud')?.classList.remove('hidden');
}

export function hideGameHUD() {
    $('game-hud')?.classList.add('hidden');
}

// Yalnizca DEGISEN metni yazar. Ayni degeri yeniden atamak da bir DOM
// mutasyonudur: metin ayni kalsa bile stil/layout gecersizlesir ve repaint
// tetiklenir. FPS/ping cogu 100 ms'lik tikte degismez.
function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
}

export function updateHUDStats(fps, ping, coordX, coordY) {
    // Gizli sayaca yazmak GORUNMEZ ama BEDAVA degil: her yazim bir DOM
    // mutasyonudur. Kapali anahtar, yazimi da kapatir.
    if (hudStatVisibility.fps) {
        setText($('hud-fps'), String(fps ?? 0));
    }
    if (hudStatVisibility.ping) {
        setText($('hud-ping'), (ping === null || ping === undefined) ? '--ms' : `${ping}ms`);
    }

    const x = Math.round(coordX ?? 0);
    const y = Math.round(coordY ?? 0);
    setText($('hud-coord'), `${x}, ${y}`);
}

// ── SKOR BİÇİMLENDİRME — TEK KAYNAK ─────────────────────────────────────────
// Tüm skor gösterimleri (HUD skor podu, Top-5 satırları, sabitlenmiş kendi
// satırın) BU fonksiyondan geçer.
//
// NEDEN TEK NOKTA: #hud-your-score elemanına İKİ ayrı yol yazıyordu —
// sıralama paketi geldiğinde binlik ayraçlı ("12,450"), her yem yendiğinde
// updateHUDScore ham String() ile ("12450"). Aynı hücre iki biçim arasında
// gidip geliyordu; kullanıcının gördüğü tutarsızlık tam olarak buydu.
//
// Intl.NumberFormat örneği bir kez kurulur (her çağrıda yeniden kurmak
// pahalıdır) ve sabit 'en-US' yerelini kullanır: yerele göre değişen ayraç
// (12,450 ↔ 12.450) oyuncular arasında farklı görünüm üretirdi.
const SCORE_FORMATTER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatScore(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    // Negatifi gösterme (skor asla negatif olmamalı; savunma amaçlı).
    return SCORE_FORMATTER.format(Math.max(0, Math.trunc(n)));
}

export function updateHUDScore(score) {
    const text = formatScore(score);

    const scoreEl = $('hud-score');
    if (scoreEl && scoreEl.textContent !== text) scoreEl.textContent = text;

    // Sıralamadaki kendi satırının skoru — sıralama paketleri arasında canlı
    // tutulur ve artık sıralama satırlarıyla AYNI biçimi kullanır.
    const yourScoreEl = $('hud-your-score');
    if (yourScoreEl && yourScoreEl.textContent !== text) yourScoreEl.textContent = text;
}

// ── SIRALAMA (LEADERBOARD) HUD ───────────────────────────────────────────────
const LEADERBOARD_COLLAPSED_COUNT = 3;
const LEADERBOARD_EXPANDED_COUNT = 5;

/**
 * TELEFONDA BIR SATIR DAHA AZ.
 *
 * <p>Siralama kartı dikey alanın üst sağ köşesini kaplar; küçük ekranda her
 * satır, oyuncunun kendi yılanını göremediği bir şerit demektir. Katlanmış
 * hâlde 2 satır "kim önde" sorusunu yine cevaplar; daha fazlasını isteyen
 * oyuncu genişletme düğmesini kullanır (tercih localStorage'da kalıcıdır).
 */
const LEADERBOARD_COLLAPSED_COUNT_MOBILE = 2;

/** Eşik, style.css'teki HUD mobil kırılma noktasıyla AYNI olmalıdır. */
function isCompactViewport() {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(max-width: 768px), (max-height: 500px)').matches;
}
let leaderboardExpanded = localStorage.getItem('lb_expanded') === 'true';
let lastLeaderboardData = null;

function getLeaderboardDisplayCount() {
    if (leaderboardExpanded) return LEADERBOARD_EXPANDED_COUNT;
    return isCompactViewport() ? LEADERBOARD_COLLAPSED_COUNT_MOBILE : LEADERBOARD_COLLAPSED_COUNT;
}

// (formatLeaderboardScore KALDIRILDI — skor biçimlendirmesi artık tek kaynaktan,
// yukarıdaki formatScore'dan gelir. İki ayrı biçimlendirici, aynı hücrenin
// yazana göre "12,450" ya da "12450" görünmesine yol açıyordu.)

// Havuzdan üretilmiş satırları işaretler. Havuz DIŞINDAN gelen (placeholder,
// eski innerHTML şablonu, elle eklenmiş) düğümler bu işareti taşımaz ve asla
// yeniden kullanılmaz — bkz. isPooledLeaderboardRow.
const LEADERBOARD_ROW_FLAG = '1';

function createPooledLeaderboardRow() {
    const row = document.createElement('div');
    row.className = 'leaderboard-entry';
    row.dataset.lbRow = LEADERBOARD_ROW_FLAG;

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '4px';

    const rankEl = document.createElement('span');
    rankEl.className = 'rank-number';

    const nameEl = document.createElement('span');
    nameEl.className = 'player-name';

    left.appendChild(rankEl);
    left.appendChild(nameEl);

    const scoreEl = document.createElement('span');
    scoreEl.className = 'player-score';

    row.appendChild(left);
    row.appendChild(scoreEl);
    return row;
}

// Düğümün paintLeaderboardRow'un beklediği yapıya BİREBİR sahip olduğunu
// doğrular. Yalnızca işaret bitine güvenmek yetmez; yapı da denetlenir ki
// ileride şablon değişirse sessizce bozulmak yerine satır yeniden kurulsun.
function isPooledLeaderboardRow(row) {
    if (!row || row.nodeType !== 1 || row.dataset?.lbRow !== LEADERBOARD_ROW_FLAG) {
        return false;
    }
    const left = row.firstElementChild;
    const scoreEl = row.lastElementChild;
    return !!left && !!scoreEl && left !== scoreEl
        && !!left.firstElementChild && !!left.lastElementChild;
}

// Satır havuzu: satırlar YENİDEN KULLANILIR. innerHTML ile her pakette tüm
// listeyi yıkıp kurmak her seferinde tam bir parse + layout + paint zinciri
// tetiklerdi. Burada DOM yapısı satır oluşturulurken BİR kez kurulur;
// güncellemede yalnızca gerçekten değişen textContent/className yazılır.
//
// KRİTİK: index'teki düğüm havuz satırı DEĞİLSE yeniden kurulur. Eskiden
// "varsa kullan" deniyordu ve boş-durum şablonundan kalan düğümler veri
// satırı sanılıp paintLeaderboardRow'da null dereference'a yol açıyordu.
function ensureLeaderboardRow(listEl, index) {
    const existing = listEl.children[index];
    if (isPooledLeaderboardRow(existing)) return existing;

    const row = createPooledLeaderboardRow();
    if (existing) {
        listEl.replaceChild(row, existing);
    } else {
        listEl.appendChild(row);
    }
    return row;
}

function paintLeaderboardRow(row, { rank, name, score, isTop1, isSelf, pinned }) {
    // ELEMENT erişimcileri (firstChild/lastChild DEĞİL): innerHTML ile kurulan
    // şablonlarda etiketler arasındaki satır sonu/girinti birer TEXT düğümü
    // oluşturur. row.firstChild o boşluk metnini döndürür ve metin düğümünün
    // firstChild'ı null olduğundan `null.className` okumaya çalışılırdı — bu,
    // ilk sıralama paketinde patlayan TypeError'ın ta kendisiydi.
    // firstElementChild/lastElementChild metin düğümlerini atlar.
    const left = row.firstElementChild;
    const rankEl = left.firstElementChild;
    const nameEl = left.lastElementChild;
    const scoreEl = row.lastElementChild;

    // 1. sıra kupası ile diğer sıraların numarası AYNI span'i kullanır — yapı
    // değişmez, yalnızca sınıf/metin değişir (düğüm ekleme/çıkarma yok).
    // Kupa victory_cup.png'dir ve .rank-crown'un CSS arka planı olarak çizilir;
    // span metinsiz kalır, sıra bilgisi title'da taşınır.
    const wantRankClass = isTop1 ? 'rank-crown' : 'rank-number';
    const wantRankText = isTop1 ? '' : `#${rank}`;
    if (rankEl.className !== wantRankClass) {
        rankEl.className = wantRankClass;
        rankEl.title = isTop1 ? '#1' : '';
    }
    if (rankEl.textContent !== wantRankText) rankEl.textContent = wantRankText;

    const wantName = name || 'Unknown';
    if (nameEl.textContent !== wantName) nameEl.textContent = wantName;

    const wantScore = formatScore(score);
    if (scoreEl.textContent !== wantScore) scoreEl.textContent = wantScore;

    // Oyuncunun kendi satırı (Top-5 içinde vurgulu ya da altta sabitlenmiş)
    // canlı skor hedefidir: sıralama 5 sn'de bir gelir ama skor her yemde
    // değişir. id'yi buraya taşıyarak updateHUDScore aradaki boşlukta satırı
    // gerçek zamanlı güncel tutar (aksi halde skor 5 sn'ye kadar bayat kalırdı).
    const wantId = isSelf ? 'hud-your-score' : '';
    if (scoreEl.id !== wantId) scoreEl.id = wantId;

    let wantRowClass = 'leaderboard-entry';
    if (isTop1) wantRowClass += ' rank-1';
    // rank-you: oyuncunun kendi satırı (yeşil ad) — Top-N içinde ya da altta.
    // rank-pinned: yalnızca Top-N DIŞINDAYKEN alta sabitlenen satır; üstündeki
    // ayraç çizgisi bundandır (Top-N içindeki kendi satırında ayraç olmaz).
    if (isSelf) wantRowClass += ' rank-you';
    if (pinned) wantRowClass += ' rank-pinned';
    if (row.className !== wantRowClass) row.className = wantRowClass;
}

function setLeaderboardPlayerCount(totalPlayers) {
    const playersEl = $('hud-players');
    if (!playersEl) return;
    const totalText = String(Number(totalPlayers) || 0);
    if (playersEl.textContent !== totalText) playersEl.textContent = totalText;
}

/**
 * @param {object|null} data
 *   entries      : [{ name, score }] — sunucudan gelen sıralı Top-N
 *   totalPlayers : haritadaki aktif oyuncu sayısı
 *   selfRank     : 1-tabanlı kendi sıran (0 = sıralanmamış/ölü)
 *   selfScore    : kendi skorun
 *   selfName     : kendi takma adın
 * data null ise (bağlantı öncesi) ya da entries boşsa nötr bir boş-durum
 * satırı gösterilir — UYDURMA oyuncu adı/skoru ASLA gösterilmez.
 */
export function updateHUDLeaderboard(data) {
    if (data !== null && data !== undefined) lastLeaderboardData = data;

    const listEl = $('hud-leaderboard-list');
    if (!listEl) return;

    const entries = Array.isArray(data?.entries) ? data.entries : null;

    if (!entries) {
        renderLeaderboardEmptyState(listEl, 'Connecting…');
        setLeaderboardPlayerCount(0);
        syncToggleIcon(0);
        return;
    }

    if (entries.length === 0) {
        renderLeaderboardEmptyState(listEl, 'Waiting for players…');
        setLeaderboardPlayerCount(data.totalPlayers);
        syncToggleIcon(0);
        return;
    }

    const displayCount = getLeaderboardDisplayCount();
    const selfRank = Number(data.selfRank) || 0;
    const selfInTop = selfRank >= 1 && selfRank <= displayCount;
    const showPinnedSelf = selfRank > displayCount;

    const visibleCount = Math.min(entries.length, displayCount);
    const totalRows = visibleCount + (showPinnedSelf ? 1 : 0);

    for (let i = 0; i < visibleCount; i++) {
        paintLeaderboardRow(ensureLeaderboardRow(listEl, i), {
            rank: i + 1,
            name: entries[i]?.name,
            score: entries[i]?.score,
            isTop1: i === 0,
            isSelf: selfInTop && (i + 1) === selfRank,
            pinned: false,
        });
    }

    if (showPinnedSelf) {
        paintLeaderboardRow(ensureLeaderboardRow(listEl, visibleCount), {
            rank: selfRank,
            name: data.selfName || 'You',
            score: data.selfScore,
            isTop1: false,
            isSelf: true,
            pinned: true,
        });
    }

    while (listEl.children.length > totalRows) {
        listEl.removeChild(listEl.lastElementChild);
    }

    for (let i = listEl.childNodes.length - 1; i >= 0; i--) {
        const node = listEl.childNodes[i];
        if (node.nodeType !== 1) listEl.removeChild(node);
    }

    setLeaderboardPlayerCount(data.totalPlayers);
    syncToggleIcon(entries.length);
}

// ── BOŞ DURUM ───────────────────────────────────────────────────────────────
// Eskiden burada UYDURMA bir sıralama vardı ("SnakeKing99 — 45k", "You — #8").
// İki sorun üretiyordu:
//   1. Oyuncuya gerçekmiş gibi görünen sahte veri gösteriyordu.
//   2. innerHTML ile kurulduğu için etiketler arasında METİN düğümleri
//      bırakıyordu; satır havuzu bu düğümleri veri satırı sanıp
//      paintLeaderboardRow içinde null dereference'a düşüyordu (ilk sıralama
//      paketinde atılan TypeError). Artık tek, nötr bir mesaj satırı çizilir
//      ve havuz onu ASLA yeniden kullanmaz (dataset işareti yok →
//      isPooledLeaderboardRow false → satır yeniden kurulur).
function renderLeaderboardEmptyState(listEl, message) {
    const existing = listEl.firstElementChild;
    const alreadyEmptyState = listEl.children.length === 1
        && existing?.classList.contains('leaderboard-empty');

    if (alreadyEmptyState) {
        // Aynı durumdayız: yalnızca metin değiştiyse yaz (gereksiz reflow yok).
        if (existing.textContent !== message) existing.textContent = message;
        return;
    }

    const emptyEl = document.createElement('div');
    emptyEl.className = 'leaderboard-empty';
    emptyEl.textContent = message;
    // replaceChildren: veri satırları dahil TÜM içeriği tek işlemde değiştirir.
    listEl.replaceChildren(emptyEl);
}

// ── SIRALAMA TOGGLE (Top 3 ↔ Top 5) ─────────────────────────────────────────

function syncToggleIcon(entryCount) {
    const btn = $('hud-leaderboard-toggle');
    if (!btn) return;
    // 3 veya daha az entry varsa genişletmenin anlamı yok — gizle.
    btn.style.display = entryCount > LEADERBOARD_COLLAPSED_COUNT ? '' : 'none';
    const icon = btn.querySelector('.leaderboard-toggle-icon');
    if (icon) icon.textContent = leaderboardExpanded ? 'expand_less' : 'expand_more';
    btn.title = leaderboardExpanded ? 'Show less' : 'Show more';
}

/**
 * OYUN ICI "MENUYE DON" DUGMESI.
 *
 * <p>IKI ADIMLI: ilk tıklama düğmeyi "Confirm?" yapar ve 3 saniye bekler,
 * ikincisi çıkar. Modal AÇMAMA kararı bilinçli — oyun devam ederken ekranı
 * kaplayan bir diyalog, oyuncuyu tam da karar veremeyeceği anda kör eder.
 * Zaman aşımı, yanlışlıkla basıp dokunmayı bırakan oyuncuyu kendiliğinden
 * güvenli duruma döndürür.
 *
 * @param {function} handler Çıkış onaylandığında çağrılır (teardown çağıranın işi).
 */
export function onHudExit(handler) {
    const btn = $('hud-exit');
    const label = $('hud-exit-label');
    if (!btn || typeof handler !== 'function') return;

    let armed = false;
    let disarmTimer = null;

    const disarm = () => {
        armed = false;
        btn.classList.remove('is-armed');
        if (label) label.textContent = 'Menu';
        if (disarmTimer) { clearTimeout(disarmTimer); disarmTimer = null; }
    };

    btn.addEventListener('click', () => {
        if (!armed) {
            armed = true;
            btn.classList.add('is-armed');
            if (label) label.textContent = 'Confirm?';
            disarmTimer = setTimeout(disarm, 3000);
            return;
        }
        disarm();
        handler();
    });

    // Sahne kapanırken düğme "Confirm?" durumunda kalmasın.
    return disarm;
}

export function initLeaderboardToggle() {
    const btn = $('hud-leaderboard-toggle');
    if (!btn) return;
    syncToggleIcon(0);

    btn.addEventListener('click', () => {
        leaderboardExpanded = !leaderboardExpanded;
        localStorage.setItem('lb_expanded', leaderboardExpanded ? 'true' : 'false');
        if (lastLeaderboardData) updateHUDLeaderboard(lastLeaderboardData);
    });
}

// Minimap is now managed entirely by Phaser JS (Game.js drawMinimap function)
