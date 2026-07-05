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

export function updateHUDLeaderboard(entries) {
    const listEl = $('hud-leaderboard-list');
    if (!listEl || !Array.isArray(entries)) {
        // Initialize with default mockup data if not provided
        if (!listEl) return;
        initializeDefaultLeaderboard();
        return;
    }

    listEl.innerHTML = '';

    entries.forEach((entry, index) => {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'leaderboard-entry';

        if (index === 0) {
            entryDiv.classList.add('rank-1');
            entryDiv.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="rank-crown">👑</span>
                    <span class="player-name">${entry.name || 'Unknown'}</span>
                </div>
                <span class="player-score">${entry.score || '0'}</span>
            `;
        } else if (entry.isYou) {
            entryDiv.classList.add('rank-you');
            entryDiv.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="rank-number">${index + 1}</span>
                    <span class="player-name">${entry.name || 'You'}</span>
                </div>
                <span class="player-score">${entry.score || '0'}</span>
            `;
        } else {
            entryDiv.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="rank-number">${index + 1}</span>
                    <span class="player-name">${entry.name || 'Unknown'}</span>
                </div>
                <span class="player-score">${entry.score || '0'}</span>
            `;
        }

        listEl.appendChild(entryDiv);
    });
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
