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

    // Oyun sonu ekrani da AYNI biçimlendiriciyi kullanır — oyuncunun HUD'da
    // "12,450" görüp ölünce "12450" görmesi tutarsızlığını kapatır.
    const scoreEl = $('gameover-score');
    if (scoreEl) scoreEl.textContent = formatScore(score);

    const foodEl = $('gameover-food-eaten');
    if (foodEl) foodEl.textContent = formatScore(foodEaten);

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
let leaderboardExpanded = localStorage.getItem('lb_expanded') === 'true';
let lastLeaderboardData = null;

function getLeaderboardDisplayCount() {
    return leaderboardExpanded ? LEADERBOARD_EXPANDED_COUNT : LEADERBOARD_COLLAPSED_COUNT;
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

    // 1. sıra tacı ile diğer sıraların numarası AYNI span'i kullanır — yapı
    // değişmez, yalnızca sınıf/metin değişir (düğüm ekleme/çıkarma yok).
    const wantRankClass = isTop1 ? 'rank-crown' : 'rank-number';
    const wantRankText = isTop1 ? '👑' : (pinned ? `#${rank}` : String(rank));
    if (rankEl.className !== wantRankClass) rankEl.className = wantRankClass;
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
    // rank-you: hem Top-5 içi vurgu hem de alttaki sabit satırın ayraç stili.
    if (isSelf) wantRowClass += ' rank-you';
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
