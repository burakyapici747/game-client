/**
 * RTT ÖRNEKLEYİCİ — ölçüm İSTATİSTİĞİNİN tek sahibi.
 *
 * <p>Burada soket YOKTUR: sınıf yalnızca "ham RTT örneklerini ekranda
 * gösterilebilir tek bir sayıya nasıl çeviririz" sorusunu cevaplar. Ölçümün
 * NASIL alındığı (menüde geçici prob soketi, oyun içinde kalıcı bağlantı)
 * çağıranın işidir. İki çağıran da aynı sınıfı kullanır; aksi halde menüde
 * gördüğünüz ping ile oyunda gördüğünüz ping FARKLI algoritmalardan çıkar ve
 * oyuncu, sunucu değişmediği hâlde "ping fırladı" sanır.
 *
 * ── ÜÇ AYRI SORUN, ÜÇ AYRI ÖNLEM ──────────────────────────────────────────
 *
 * 1) İLK ÖRNEK YALAN SÖYLER. Bağlantı yolu soğuktur: TCP slow-start, TLS
 *    oturum kurulumu, WebSocket upgrade artçıları, sunucu tarafında JIT
 *    ısınması. Ölçülen ilk RTT gerçek gecikmenin 2–4 katı görünebilir
 *    (~200ms görünüp ~60ms'e oturması tipiktir). Bu yüzden ilk
 *    `discardSamples` örnek İSTATİSTİĞE HİÇ GİRMEZ — atılır, ağırlığı
 *    azaltılmaz. Yanlış bir sayıyı azaltılmış ağırlıkla da olsa ortalamaya
 *    katmak, doğru değere yakınsamayı yavaşlatmaktan başka işe yaramaz.
 *
 * 2) TEK ÖRNEK KARARSIZDIR. Tek bir pakete denk gelen bir zamanlayıcı
 *    gecikmesi ya da Nagle/ACK gecikmesi ekrandaki sayıyı iki katına
 *    çıkarabilir. Bu yüzden ilk gösterilebilir değer, patlama (burst)
 *    fazındaki örneklerin BUDANMIŞ ORTALAMASIDIR: en büyük ve en küçük örnek
 *    atılır, kalanların ortalaması alınır. Üç örnekten sonra bile tek bir
 *    spike sayıyı bozamaz.
 *
 * 3) SÜREKLİ ÖLÇÜM UI'YI ZIPLATIR. Kararlı değere geçtikten sonra her örnek
 *    doğrudan basılsaydı sayı sürekli titrerdi. Üstel hareketli ortalama
 *    (EMA) bunu yumuşatır:
 *
 *        yeni = önceki * (1 - alfa) + örnek * alfa
 *
 *    alfa = 0.35: gerçek bir rota değişimine birkaç örnekte yakınsar, tekil
 *    spike'ı ise ~1/3 oranında içeri alır.
 *
 * ── JITTER ────────────────────────────────────────────────────────────────
 * Sapmanın kendi hareketli ortalaması (RFC 3550 ruhunda) ayrıca tutulur.
 * Oyun içi interpolasyon buffer'ının derinliğini belirleyen şey ORTALAMA
 * gecikme değil, gecikmenin OYNAKLIĞIDIR (bkz. EntityInterpolator).
 */
export class PingSampler {

    /**
     * @param {object} [options]
     * @param {number} [options.discardSamples=1] Isınma artefaktı sayılıp ATILACAK ilk örnek adedi.
     * @param {number} [options.minSamples=2]     Değer yayınlanmadan önce gereken GEÇERLİ örnek adedi.
     * @param {number} [options.windowSize=5]     Budanmış ortalamanın penceresi.
     * @param {number} [options.alpha=0.35]       EMA ağırlığı (0..1).
     */
    constructor({ discardSamples = 1, minSamples = 2, windowSize = 5, alpha = 0.35 } = {}) {
        this.discardSamples = Math.max(0, discardSamples);
        // En az 2: tek örnekle "ölçüldü" demek, 1. maddedeki yalanı ekrana
        // basmakla aynı şeydir.
        this.minSamples = Math.max(2, minSamples);
        this.windowSize = Math.max(this.minSamples, windowSize);
        this.alpha = Math.min(1, Math.max(0.05, alpha));
        this.reset();
    }

    reset() {
        this.seenCount = 0;        // atılanlar DAHİL, gelen ham örnek sayısı
        this.acceptedCount = 0;    // istatistiğe giren örnek sayısı
        this.window = [];
        this.smoothedMs = null;
        this.jitterMs = 0;
    }

    /** Gösterilebilir bir değer oluştu mu? (UI fallback'i bunun tersidir.) */
    get ready() {
        return this.smoothedMs !== null;
    }

    /** Ekrana basılacak yuvarlanmış değer; henüz hazır değilse null. */
    get value() {
        return this.smoothedMs === null ? null : Math.round(this.smoothedMs);
    }

    /** Yumuşatılmamış ham değer (hesap zincirleri için). */
    get rawValue() {
        return this.smoothedMs;
    }

    /**
     * Yeni bir ham RTT örneği işler.
     *
     * @param {number} rttMs
     * @returns {boolean} bu örnekten SONRA yayınlanabilir bir değer var mı
     */
    addSample(rttMs) {
        if (!Number.isFinite(rttMs) || rttMs < 0) return this.ready;

        this.seenCount++;
        // (1) Isınma örneği: istatistiğe HİÇ girmez.
        if (this.seenCount <= this.discardSamples) return this.ready;

        this.acceptedCount++;
        this.window.push(rttMs);
        if (this.window.length > this.windowSize) this.window.shift();

        // Jitter, EMA GÜNCELLENMEDEN ÖNCE ölçülür: sapma, örneğin O ANKİ
        // beklentiden ne kadar saptığıdır. Sonra ölçülseydi ölçtüğü şey
        // kendi güncellemesinin artığı olurdu.
        if (this.smoothedMs !== null) {
            const deviation = Math.abs(rttMs - this.smoothedMs);
            this.jitterMs += (deviation - this.jitterMs) / 8;
        }

        // ── İKİ AŞAMALI YUMUŞATMA ───────────────────────────────────────
        // EMA'ya giren şey HAM ÖRNEK DEĞİL, pencerenin budanmış ortalamasıdır.
        // Tek başına EMA kullanılsaydı 300ms'lik tek bir spike göstergeyi
        // alfa oranında (yaklaşık üçte bir) yukarı çeker ve birkaç örnek
        // boyunca orada tutardı — oysa o spike ağ hakkında hiçbir şey
        // söylemiyor. Budama onu pencereden TAMAMEN atar; EMA ise budanmış
        // değerin kendi adım değişimlerini yumuşatır.
        //
        // BEDELİ: gerçek ve kalıcı bir rota değişimi (örn. 60ms -> 200ms)
        // pencerenin çoğunluğu değişene kadar tam yansımaz. Bir gecikme
        // göstergesi için doğru takas budur: yanlış alarm yok, birkaç örnek
        // gecikme var. Ani değişimi gösteren ayrı bir sinyal olarak jitter
        // zaten tutuluyor.
        const estimate = trimmedMean(this.window);

        if (this.smoothedMs === null) {
            // İLK DEĞER: EMA'yı tek bir örnekle tohumlamak, o örneğin hatasını
            // uzun süre taşımak demektir. Patlama fazının budanmış ortalaması
            // ile tohumlanır.
            if (this.acceptedCount >= this.minSamples) {
                this.smoothedMs = estimate;
            }
        } else {
            this.smoothedMs = this.smoothedMs * (1 - this.alpha) + estimate * this.alpha;
        }

        return this.ready;
    }
}

/**
 * En büyük ve en küçüğü ATARAK ortalama alır (3+ örnekte).
 *
 * <p>İki örnekte budama TANIMSIZDIR (geriye hiçbir şey kalmaz), o yüzden
 * düz ortalamaya düşer — patlama fazının ilk değeri bu durumda da tek
 * örnekten iyidir.
 */
function trimmedMean(samples) {
    if (samples.length < 3) {
        return samples.reduce((sum, value) => sum + value, 0) / samples.length;
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    return trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length;
}
