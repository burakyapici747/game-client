// ─────────────────────────────────────────────────────────────────────────────
// YEREL OYUNCU İLERLEMESİ — profil panelinin "Stats" bölümünün kaynağı
//
// ── NEDEN YEREL ─────────────────────────────────────────────────────────────
// Proxy API'de oyuncu istatistiği/seviye/başarım uçları HENÜZ YOK (bkz.
// /api/me: yalnızca kimlik, envanter, cüzdan). Panelin bu bölümünü uydurma
// sayılarla doldurmak yerine GERÇEK ama YEREL veriyi gösteriyoruz: bu
// tarayıcıda oynanan oyunlardan toplanan skor toplamı ve en iyi skor.
//
// Sayılar cihaza bağlıdır ve hesapla SENKRON DEĞİLDİR — panel bunu açıkça
// yazar. Backend bu uçları açtığında burası tek dosyada değiştirilecek:
// okuma arayüzü (`readStats`) aynı kalır, kaynağı değişir.
//
// ── SEVİYE NEDEN KAREKÖK ────────────────────────────────────────────────────
// Doğrusal bir eşik (her 1000 puan bir seviye) ilk saatte tatmin edici, ertesi
// gün anlamsızdır: seviye sayısı skorla birlikte sınırsız büyür. Karekök eğrisi
// erken seviyeleri hızlı, sonrakileri giderek yavaş verir — ilerleme hissi
// korunur, sayı kontrolden çıkmaz.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'snake_local_stats';

/** Seviye eğrisinin sertliği: küçük değer = daha hızlı seviye. */
const LEVEL_DIVISOR = 250;

const EMPTY = { gamesPlayed: 0, bestScore: 0, totalScore: 0, foodEaten: 0 };

function read() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...EMPTY };
        const parsed = JSON.parse(raw);
        return {
            gamesPlayed: toCount(parsed?.gamesPlayed),
            bestScore: toCount(parsed?.bestScore),
            totalScore: toCount(parsed?.totalScore),
            foodEaten: toCount(parsed?.foodEaten),
        };
    } catch (_) {
        // Bozuk/erişilemez depo ilerlemeyi kaybettirir ama paneli KIRMAZ.
        return { ...EMPTY };
    }
}

function toCount(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Toplam skordan seviye (1'den başlar) ve bir sonraki seviyeye ilerleme. */
export function levelFromTotal(totalScore) {
    const total = toCount(totalScore);
    const level = Math.floor(Math.sqrt(total / LEVEL_DIVISOR)) + 1;
    const currentFloor = LEVEL_DIVISOR * (level - 1) ** 2;
    const nextFloor = LEVEL_DIVISOR * level ** 2;
    const span = Math.max(1, nextFloor - currentFloor);
    return {
        level,
        progress: Math.min(1, Math.max(0, (total - currentFloor) / span)),
        toNext: Math.max(0, nextFloor - total),
    };
}

/** Panelin okuduğu şekil. */
export function readStats() {
    const stats = read();
    return { ...stats, ...levelFromTotal(stats.totalScore) };
}

/**
 * Bir oyun bitti — ilerlemeyi işler.
 *
 * <p>Tek çağrı noktası: {@code overlays.showGameOverOverlay}. Orada olması
 * bilinçli — oyunun bittiğini kesin olarak bilen tek yer orasıdır ve skor
 * zaten elindedir.
 */
export function recordGame({ score = 0, foodEaten = 0 } = {}) {
    const stats = read();
    const next = {
        gamesPlayed: stats.gamesPlayed + 1,
        bestScore: Math.max(stats.bestScore, toCount(score)),
        totalScore: stats.totalScore + toCount(score),
        foodEaten: stats.foodEaten + toCount(foodEaten),
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (_) { /* private mode: ilerleme kaydedilmez, oyun etkilenmez */ }
    return next;
}
