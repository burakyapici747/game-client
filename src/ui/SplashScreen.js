// ─────────────────────────────────────────────────────────────────────────────
// SPLASH SCREEN — sayfanın İLK görüntüsü; varlıklar yüklenirken ana menüyü örter.
//
// Markup index.html'de (#splash-screen) ve VARSAYILAN OLARAK GÖRÜNÜRDÜR: JS
// yüklenmeden önce bile ekranda logo + boş çubuk vardır, menü hiç sızmaz.
// Bu modül yalnızca ilerlemeyi/metni günceller ve bitişte fade-out yapar.
//
// İlerleme çubuğu GERİ GİTMEZ ve yumuşak ilerler: hedef yüzde rAF ile
// izlenir (easing), CSS'te ayrıca width geçişi vardır. Yüzde metni de aynı
// yumuşatılmış değerden türetilir; iki gösterge hiç ayrışmaz.
// ─────────────────────────────────────────────────────────────────────────────

const FADE_MS = 550;

const $ = (id) => document.getElementById(id);

let targetPct = 0;
let shownPct = 0;
let raf = null;
let hidden = false;

function renderPct(pct) {
    const fill = $('splash-progress-fill');
    const bar = $('splash-progress');
    const label = $('splash-percent');
    const rounded = Math.round(pct);
    if (fill) fill.style.width = `${pct}%`;
    if (bar) bar.setAttribute('aria-valuenow', String(rounded));
    if (label) label.textContent = `${rounded}%`;
}

function tick() {
    // easeOut: kalan farkın bir kısmı her karede kapanır; hedefe 0.4 altında oturur.
    const diff = targetPct - shownPct;
    shownPct = Math.abs(diff) < 0.4 ? targetPct : shownPct + diff * 0.18;
    renderPct(shownPct);
    raf = shownPct < targetPct ? requestAnimationFrame(tick) : null;
}

/** 0..1 arası ilerleme; asla geri gitmez. */
export function setSplashProgress(fraction) {
    const pct = Math.min(100, Math.max(0, (Number(fraction) || 0) * 100));
    if (pct <= targetPct) return;
    targetPct = pct;
    if (raf === null) raf = requestAnimationFrame(tick);
}

/** Üst satır ("Loading skins…") ve alt satır (dosya adı). */
export function setSplashStatus(text, detail = '') {
    const status = $('splash-status');
    const file = $('splash-file');
    if (status && text) status.textContent = text;
    if (file) file.textContent = detail;
}

export function isSplashVisible() {
    return !hidden && !!$('splash-screen');
}

/**
 * Çubuğu 100'e tamamlar, fade-out oynatır ve elemanı DOM'dan kaldırır.
 * Kaldırmak önemli: opak bir katman görünmez de olsa GPU'da kompozitlenir.
 */
export function hideSplashScreen() {
    const el = $('splash-screen');
    if (!el || hidden) return Promise.resolve();
    hidden = true;
    targetPct = 100;
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    shownPct = 100;
    renderPct(100);
    setSplashStatus('Preparing game engine…', '');

    return new Promise((resolve) => {
        // Bir kare bekle ki %100 çizilsin, sonra fade başlasın.
        requestAnimationFrame(() => {
            el.classList.add('is-leaving');
            const finish = () => {
                el.remove();
                document.body.classList.remove('splash-active');
                resolve();
            };
            el.addEventListener('transitionend', finish, { once: true });
            // transitionend gelmezse (reduced-motion, gizli sekme) yine de kapat.
            setTimeout(finish, FADE_MS + 100);
        });
    });
}
