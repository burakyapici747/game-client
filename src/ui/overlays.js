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

// ── Game Over overlay ────────────────────────────────────────────────────────

export function showGameOverOverlay(score, onPlayAgain) {
    const scoreEl = $('gameover-score');
    if (scoreEl) scoreEl.textContent = String(score ?? 0);

    const btn = $('gameover-play-again');
    if (btn) {
        btn.onclick = () => {
            hideGameOverOverlay();
            onPlayAgain?.();
        };
    }
    $('gameover-overlay')?.classList.remove('hidden');
}

export function hideGameOverOverlay() {
    $('gameover-overlay')?.classList.add('hidden');
}

// Sahne kapanırken (restart/cancel) hangi overlay açıksa temizle.
export function hideAllGameOverlays() {
    hideConnectingOverlay();
    hideGameOverOverlay();
}
