// ─────────────────────────────────────────────────────────────────────────────
// HTML/CSS OVERLAY MANAGER — unified UI standard
//
// Ara ekranlar (Connecting, Game Over) Phaser canvas'ı İÇİNDE çizilmez;
// canvas'ın üzerine konumlanan native HTML/CSS katmanları olarak render
// edilir. DOM elemanları index.html'de, stiller public/style.css'te tanımlı.
// Bu modül hem menü katmanı (src/main.js) hem de oyun sahnesi (Game.js)
// tarafından import edilen tek ortak kontrol noktasıdır.
// ─────────────────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

// ── Connecting overlay ───────────────────────────────────────────────────────

export function showConnectingOverlay(serverName, initialPingMs = null) {
    const nameEl = $('conn-server-name');
    if (nameEl) nameEl.textContent = serverName || 'Unknown';
    updateConnectingPing(initialPingMs);
    $('connecting-overlay')?.classList.remove('hidden');
}

// Bağlantı ekranındaki PING metriği: önce menüden ölçülen değerle başlar,
// oyun-içi heartbeat kalibre olur olmaz canlı değerle güncellenir.
export function updateConnectingPing(ms) {
    const pingEl = $('conn-ping-value');
    if (!pingEl) return;
    pingEl.textContent = (ms === null || ms === undefined) ? '--' : `${ms}ms`;
}

export function hideConnectingOverlay() {
    $('connecting-overlay')?.classList.add('hidden');
}

// Cancel butonu: bağlantı iptal akışının sahibi (soketi kapatıp menüye dönen
// taraf) src/main.js olduğundan, handler dışarıdan bağlanır.
export function onConnectingCancel(handler) {
    const btn = $('conn-cancel-btn');
    if (btn) btn.onclick = handler; // onclick ataması — tekrar bağlamada listener birikmez
}

// ── Game Over overlay (reference: game_over.html) ───────────────────────────

// stats: { score, foodEaten } — client tarafında takip edilir (Game.js).
export function showGameOverOverlay(stats, onPlayAgain) {
    const { score = 0, foodEaten = 0 } = stats ?? {};

    const scoreEl = $('gameover-score');
    if (scoreEl) scoreEl.textContent = String(score);

    const foodEl = $('gameover-food-eaten');
    if (foodEl) foodEl.textContent = String(foodEaten);

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

export function showGameHUD() {
    $('game-hud')?.classList.remove('hidden');
}

export function hideGameHUD() {
    $('game-hud')?.classList.add('hidden');
}

export function updateHUDStats(fps, ping, coordX, coordY) {
    const fpsEl = $('hud-fps');
    if (fpsEl) fpsEl.textContent = String(fps ?? 0);

    const pingEl = $('hud-ping');
    if (pingEl) pingEl.textContent = (ping === null || ping === undefined) ? '--ms' : `${ping}ms`;

    const coordEl = $('hud-coord');
    if (coordEl) {
        const x = Math.round(coordX ?? 0);
        const y = Math.round(coordY ?? 0);
        coordEl.textContent = `${x}, ${y}`;
    }
}

export function updateHUDScore(score) {
    const scoreEl = $('hud-score');
    if (scoreEl) scoreEl.textContent = String(score ?? 0);

    const yourScoreEl = $('hud-your-score');
    if (yourScoreEl) yourScoreEl.textContent = String(score ?? 0);
}

// ── SIRALAMA (LEADERBOARD) HUD ───────────────────────────────────────────────
// Ekranda gösterilen sıra sayısı. Sunucu Top-10 yollar (kenar durum payı);
// burada yalnızca ilk 5 çizilir.
const LEADERBOARD_DISPLAY_COUNT = 5;

// Skoru binlik ayraçlı gösterir: 1450 → "1,450".
function formatLeaderboardScore(score) {
    const n = Number(score);
    return Number.isFinite(n) ? n.toLocaleString('en-US') : '0';
}

// Satır havuzu: satırlar YENİDEN KULLANILIR. innerHTML ile her pakette tüm
// listeyi yıkıp kurmak (eski davranış) her seferinde tam bir parse + layout +
// paint zinciri tetikliyordu. Burada DOM yapısı satır oluşturulurken BİR kez
// kurulur; güncellemede yalnızca gerçekten değişen textContent/className
// yazılır (değişmeyene hiç dokunulmaz → gereksiz reflow yok).
function ensureLeaderboardRow(listEl, index) {
    let row = listEl.children[index];
    if (row) return row;

    row = document.createElement('div');
    row.className = 'leaderboard-entry';

    const left = document.createElement('div');
    // Mockup ile aynı iç düzen (public/style.css bu yapıyı bekliyor).
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '8px';

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
    listEl.appendChild(row);
    return row;
}

function paintLeaderboardRow(row, { rank, name, score, isTop1, isSelf, pinned }) {
    const rankEl = row.firstChild.firstChild;
    const nameEl = row.firstChild.lastChild;
    const scoreEl = row.lastChild;

    // 1. sıra tacı ile diğer sıraların numarası AYNI span'i kullanır — yapı
    // değişmez, yalnızca sınıf/metin değişir (düğüm ekleme/çıkarma yok).
    const wantRankClass = isTop1 ? 'rank-crown' : 'rank-number';
    const wantRankText = isTop1 ? '👑' : (pinned ? `#${rank}` : String(rank));
    if (rankEl.className !== wantRankClass) rankEl.className = wantRankClass;
    if (rankEl.textContent !== wantRankText) rankEl.textContent = wantRankText;

    const wantName = name || 'Unknown';
    if (nameEl.textContent !== wantName) nameEl.textContent = wantName;

    const wantScore = formatLeaderboardScore(score);
    if (scoreEl.textContent !== wantScore) scoreEl.textContent = wantScore;

    // Oyuncunun kendi satırı (Top-5 içinde vurgulu ya da altta sabitlenmiş)
    // canlı skor hedefidir: sıralama 5 sn'de bir gelir ama skor her yemde
    // değişir. id'yi buraya taşıyarak updateHUDScore aradaki boşlukta satırı
    // gerçek zamanlı güncel tutar (aksi halde skor 5 sn'ye kadar bayat kalırdı).
    const wantId = isSelf ? 'hud-your-score' : '';
    if (scoreEl.id !== wantId) scoreEl.id = wantId;

    let wantRowClass = 'leaderboard-entry';
    if (isTop1) wantRowClass += ' rank-1';
    // rank-you: hem Top-5 içi vurgu hem de alttaki sabit satırın ayraç stili.
    if (isSelf) wantRowClass += ' rank-you';
    if (row.className !== wantRowClass) row.className = wantRowClass;
}

/**
 * @param {object|null} data
 *   entries      : [{ name, score }] — sunucudan gelen sıralı Top-N
 *   totalPlayers : haritadaki aktif oyuncu sayısı
 *   selfRank     : 1-tabanlı kendi sıran (0 = sıralanmamış/ölü)
 *   selfScore    : kendi skorun
 *   selfName     : kendi takma adın
 * data null/eksikse bağlantı öncesi yer tutucu liste gösterilir.
 */
export function updateHUDLeaderboard(data) {
    const listEl = $('hud-leaderboard-list');
    if (!listEl) return;

    const entries = Array.isArray(data?.entries) ? data.entries : null;
    if (!entries) {
        initializeDefaultLeaderboard();
        return;
    }

    const selfRank = Number(data.selfRank) || 0;
    // Top-5 İÇİNDE mi? İçindeyse satırı vurgulanır; DIŞINDAYSA en alta
    // sabitlenmiş "#12 You" satırı eklenir. selfRank=0 (ölü/sıralanmamış)
    // durumunda hiçbir ek satır çizilmez.
    const selfInTop = selfRank >= 1 && selfRank <= LEADERBOARD_DISPLAY_COUNT;
    const showPinnedSelf = selfRank > LEADERBOARD_DISPLAY_COUNT;

    const visibleCount = Math.min(entries.length, LEADERBOARD_DISPLAY_COUNT);
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

    // Fazla satırları kaldır (oyuncu sayısı azaldığında).
    while (listEl.children.length > totalRows) {
        listEl.removeChild(listEl.lastChild);
    }

    const playersEl = $('hud-players');
    if (playersEl) {
        const totalText = String(Number(data.totalPlayers) || 0);
        if (playersEl.textContent !== totalText) playersEl.textContent = totalText;
    }
}

function initializeDefaultLeaderboard() {
    const listEl = $('hud-leaderboard-list');
    if (!listEl) return;

    listEl.innerHTML = `
        <div class="leaderboard-entry rank-1">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span class="rank-crown">👑</span>
                <span class="player-name">SnakeKing99</span>
            </div>
            <span class="player-score">45k</span>
        </div>
        <div class="leaderboard-entry">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span class="rank-number">2</span>
                <span class="player-name">ViperPro</span>
            </div>
            <span class="player-score">38k</span>
        </div>
        <div class="leaderboard-entry">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span class="rank-number">3</span>
                <span class="player-name">NoodleDanger</span>
            </div>
            <span class="player-score">31k</span>
        </div>
        <div class="leaderboard-entry rank-you">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span class="rank-number">8</span>
                <span class="player-name">You</span>
            </div>
            <span class="player-score" id="hud-your-score">0</span>
        </div>
    `;
}

// Minimap is now managed entirely by Phaser JS (Game.js drawMinimap function)
