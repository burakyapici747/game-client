import Phaser from 'phaser';

// ─────────────────────────────────────────────────────────────────────────────
// YILAN BALONCUKLARI / İZ DALGASI — SAHNE BAŞINA TEK EMITTER
//
// Baloncuklar suyu yaran yerlerden çıkar ve HIZA göre şekil değiştirir:
//   1) YANAKLAR — kafanın sol/sağ kenarı.
//        normal hız : seyrek, soluk, dar açıyla geriye süzülen baloncuklar
//        boost      : sık, hızlı, DIŞA savrulan keskin bir V izi (pruva dalgası)
//      Aradaki her şey `wake` (0..1) ile sürekli harmanlanır; iki ayrı "kip" yok.
//   2) GÖVDE DIŞ KENARI — yalnızca gövdenin KIVRILDIĞI yerde, virajın dış
//      tarafında ve ara sıra.
//
// NEDEN TEK EMITTER
//   Emitter bir GameObject'tir: her biri kendi preUpdate'ini, parçacık
//   havuzunu ve çizim çağrısını taşır. Ekranda 30 yılan = 30 emitter yerine
//   TEK emitter, TEK havuz ve TEK batch vardır. Yılanlar yalnızca birkaç sayı
//   tutar (bkz. createState); sahnede yılana ait hiçbir nesne yaratılmaz, bu
//   yüzden yılan ölünce yok edilecek bir şey de yoktur.
//
// NASIL ÇALIŞIR
//   Emitter (0,0)'da DURUR ve kendi kendine yayım YAPMAZ (emitting: false).
//   Her doğum `emitParticleAt(x, y, n)` ile dünya koordinatında verilir;
//   parçacık doğduğu noktada kalır, yılan yanından geçip gider. Yön / hız /
//   ölçek / opaklık / fren her doğumdan hemen önce emitter op'larına yazılır —
//   op'lar yalnızca DOĞUM anında okunup parçacığa kopyalandığı için havadaki
//   baloncuklar etkilenmez.
//
// HIZ NEREDEN GELİR
//   Kafanın iki tik arasındaki yer değiştirmesinden ÖLÇÜLÜR (px/s) ve yılanın
//   kendi taban hızına (calculateBaseSpeed) bölünür. `isBoosting` bayrağına
//   güvenilmez: uzak yılanlarda yerel simülasyon yoktur, ama ekranda görünen
//   hız herkes için aynı şekilde ölçülebilir → oyuncu ve rakipler TEK yol.
// ─────────────────────────────────────────────────────────────────────────────

export const BUBBLE_TEXTURE_KEY = 'bubble_particle';
const BUBBLE_TEXTURE_PATH = 'assets/particle/16x16_buble.png';

// Yem blitter'ı 0'da, gövde sprite'ları >= 1'de (bkz. Snake._refreshSegmentDepths).
// Arası: baloncuk gövdenin ALTINDAN, kenarından taşarak çıkar.
const BUBBLE_DEPTH = 0.5;

const LIFESPAN_MS = { min: 300, max: 600 };

// ── YANAK PROFİLLERİ: [normal hız, tam boost] ───────────────────────────────
// Her değer wake=0 → wake=1 arasında doğrusal harmanlanır (bkz. mix).
//
// Açı, HAREKET YÖNÜNE göre ölçülür ve her yanak için kendi tarafına aynalanır:
// 180° = tam geri, 90° = tam yana. Normalde baloncuklar gövde boyunca geriye
// süzülür (160°); boost'ta 120°–135° bandına açılıp dışa fırlar → keskin V.
const CHEEK_ANGLE_DEG = [160, 127.5];
const CHEEK_SPREAD_DEG = [12, 7.5];
const CHEEK_SPEED_MIN = [12, 70];
const CHEEK_SPEED_MAX = [32, 130];
// Türbülans: boost'ta baloncuk daha büyük doğar ve daha çok genleşir.
const CHEEK_SCALE_START = [0.5, 0.6];
const CHEEK_SCALE_END = [1.1, 1.3];
// Normal hızda "ince" kalsın: daha soluk. Boost'ta tam 0.9.
const CHEEK_ALPHA = [0.65, 0.9];
const CHEEK_QUANTITY = [1, 3];            // yanak başına, tik başına
const INTERVAL_MS = [60, 40];             // yılan başına doğum aralığı

// ── SU DİRENCİ ──────────────────────────────────────────────────────────────
// Phaser parçacıklarında sürtünme yoktur; fırlatma yönünün TERSİNE sabit ivme
// aynı işi görür. İvme, en YAVAŞ parçacığın hızını tam en UZUN ömürde sıfıra
// indirecek kadardır → hiçbir baloncuk geri dönüp yılana doğru akmaz, hızlılar
// ise belirgin biçimde yavaşlayarak söner.
const DRAG_STOP_SEC = LIFESPAN_MS.max / 1000;

// wake'in 0'dan ayrıldığı hız oranı. 1.0 değil: ölçüm gürültüsü (interpolasyon,
// görsel yumuşatma) normal hızda izi titretmesin.
const WAKE_RATIO_START = 1.08;
// Ölçülen oranın üstel yumuşatması (tik başına). Boost'a basınca V bir anda
// değil ~3 tikte (≈150 ms) açılır; bırakınca aynı yumuşaklıkla kapanır.
const RATIO_SMOOTHING = 0.4;

// Yanak noktası kafa merkezinin biraz GERİSİNDE ve yarı genişliğin biraz
// İÇİNDE: baloncuk sprite'ın altından doğup kenardan taşar, boşlukta belirmez.
const CHEEK_SIDE_RATIO = 0.82;
const CHEEK_BACK_RATIO = 0.25;

// ── GÖVDE KIVRIMLARI ────────────────────────────────────────────────────────
const BODY_SIDE_RATIO = 0.85;
const BODY_OUTWARD_DEG = 50;
const BODY_SPREAD_DEG = 14;
const BODY_SPEED_MIN = 12;
const BODY_SPEED_MAX = 32;
const BODY_SCALE_START = 0.38;
const BODY_SCALE_END = 0.82;
const BODY_ALPHA = 0.55;
// Tik başına en fazla bu kadar segment yoklanır (dönen imleç). 300 segmentlik
// yılanda tüm gövdeyi her tik taramak yerine O(1) iş.
const BODY_PROBES_PER_TICK = 3;
// Kıvrım, i ± STRIDE segmentlerinin yön farkıyla ölçülür. Bitişik komşular
// (±1) YETMEZ: büyük yılanda segmentler sık dizilir ve gözle bariz bir yayda
// bile komşu farkı eşiğin altında kalır. ±2 ≈ 1.5–2 gövde genişliği yay
// uzunluğudur — gözün "kıvrım" olarak gördüğü ölçek.
const CURVE_STRIDE = 2;
// Bu farkın (rad) altı "düz" sayılır → baloncuk yok.
const CURVE_MIN_RAD = 0.16;
// Bu kıvrımda olasılık 1'e ulaşır. Hafif virajda seyrek, keskin dönüşte sık.
const CURVE_FULL_RAD = 0.80;

// Bu hızın (px/s) altı "duruyor" sayılır. Eşik, uzak yılan interpolasyonunun
// alt-piksel titreşiminin üstündedir.
const MIN_HEAD_SPEED = 12;
// Tek tikte bundan uzun sıçrama hareket DEĞİL ışınlanmadır (respawn, resync).
const TELEPORT_PX = 400;
// Kamera dikdörtgenine eklenen pay: kenarın hemen dışında doğan baloncuk
// ömrü boyunca içeri süzülebilir.
const VIEW_PADDING_PX = 48;
// Tüm sahne için tavan. Sekme arka plandan dev bir delta ile dönse de,
// ekran boost eden yılanlarla dolsa da parçacık sayısı sınırlı kalır.
const MAX_ALIVE = 900;

const HALF_PI = Math.PI / 2;

const mix = (pair, t) => pair[0] + (pair[1] - pair[0]) * t;

export function preload(scene) {
    scene.load.image(BUBBLE_TEXTURE_KEY, BUBBLE_TEXTURE_PATH);
}

/**
 * Yılanın taşıdığı TÜM durum. Yalnızca sayılar: sahne nesnesi yok, yılana geri
 * referans yok → yılan öldüğünde bu nesneyi bırakmak temizliğin tamamıdır.
 */
export function createState() {
    return { elapsed: 0, lastX: NaN, lastY: NaN, cursor: CURVE_STRIDE, ratio: 1, wake: 0 };
}

export class SnakeBubbles {
    /**
     * Doku yüklenememişse emitter kurulmaz ve tüm çağrılar no-op olur:
     * efekt KOZMETİKTİR, yokluğu oyunu etkilememeli (bkz. Preloader 'loaderror').
     */
    constructor(scene) {
        this.scene = scene;
        this.emitter = null;
        if (!scene.textures.exists(BUBBLE_TEXTURE_KEY)) return;

        // Buradaki sayısal değerler yalnızca op TÜRLERİNİ belirler (min/max →
        // rastgele aralık, start/end → ömür boyu geçiş); gerçek değerler her
        // doğumda _emit tarafından yazılır.
        this.emitter = scene.add.particles(0, 0, BUBBLE_TEXTURE_KEY, {
            lifespan: LIFESPAN_MS,
            speed: { min: 0, max: 0 },
            angle: { min: 0, max: 0 },
            scale: { start: 1, end: 1 },
            alpha: { start: 1, end: 0 },
            maxAliveParticles: MAX_ALIVE,
            emitting: false,
        });
        // Phaser ivmeyi yalnızca config'te sıfırdan farklı bir değer görürse
        // parçacığa uygular; biz değeri doğum başına yazdığımız için bayrağı
        // elle açıyoruz.
        this.emitter.acceleration = true;
        this.emitter.setDepth(BUBBLE_DEPTH);
    }

    /**
     * Bir yılan için bu karenin baloncuklarını üretir. Kare başına BİR KEZ,
     * kafa ve segmentler o karenin son konumuna oturduktan SONRA çağrılır.
     *
     * Okunan yüzey: snake.head {x, y, rotation}, snake.segments[] {x, y,
     * rotation, visible, active}, snake.scale, snake.visibleSegmentCount,
     * snake.calculateBaseSpeed() / calculateBoostSpeed() (px/s) ve
     * snake.bubbleHalfWidths() → {head, body} (dünya px).
     */
    emitForSnake(snake, state, dtMs) {
        const emitter = this.emitter;
        const head = snake.head;
        if (!emitter || !state || !head) return;

        // ── 1) KISMA — en ucuz kontrol en başta ─────────────────────────────
        // Aralık bir önceki tikin wake'ine bakar: hızlanan yılan daha sık üretir.
        state.elapsed += dtMs;
        if (state.elapsed < mix(INTERVAL_MS, state.wake)) return;
        const tickSec = state.elapsed / 1000;
        state.elapsed = 0;

        // ── 2) HIZ ÖLÇÜMÜ ───────────────────────────────────────────────────
        // Görüş alanı kontrolünden ÖNCE: ekran dışındaki yılanın da son konumu
        // taze kalmalı, yoksa ekrana girdiği ilk tikte aradaki tüm yol tek
        // adımlık "hız" olarak okunurdu. Maliyeti bir hypot'tur.
        const dist = Math.hypot(head.x - state.lastX, head.y - state.lastY);
        state.lastX = head.x;
        state.lastY = head.y;

        // ── 3) GÖRÜŞ ALANI — kalan her şey yalnızca görünen yılan için ──────
        const view = this.scene.cameras.main.worldView;
        const headInView =
            head.x >= view.x - VIEW_PADDING_PX && head.x <= view.right + VIEW_PADDING_PX &&
            head.y >= view.y - VIEW_PADDING_PX && head.y <= view.bottom + VIEW_PADDING_PX;
        // Uzun yılanın kafası dışarıdayken gövdesi görünür olabilir; segment
        // görünürlüğünü Snake zaten hesaplıyor (culling).
        const bodyInView = snake.visibleSegmentCount > 0;
        if (!headInView && !bodyInView) {
            state.wake = 0;
            return;
        }

        // İlk tikte dist NaN'dır → karşılaştırmalar false → yayım yok.
        const speed = dist / tickSec;
        if (!(dist < TELEPORT_PX) || !(speed >= MIN_HEAD_SPEED)) {
            state.ratio = 1;
            state.wake = 0;
            return;
        }

        // ── 4) HIZ ORANI → WAKE ─────────────────────────────────────────────
        const baseSpeed = snake.calculateBaseSpeed();
        const boostRatio = snake.calculateBoostSpeed() / baseSpeed;
        state.ratio += (speed / baseSpeed - state.ratio) * RATIO_SMOOTHING;
        const linear = Phaser.Math.Clamp(
            (state.ratio - WAKE_RATIO_START) / (boostRatio - WAKE_RATIO_START), 0, 1);
        // Smoothstep: V'nin açılışı ve kapanışı uçlarda yumuşar.
        const wake = linear * linear * (3 - 2 * linear);
        state.wake = wake;

        // Karekök: 6× ölçekli yılanda baloncuk ~2.4× olur — orantılı büyütmek
        // dev yılanın yanında top gibi baloncuklar üretirdi.
        const sizeFactor = Math.sqrt(snake.scale);
        const widths = snake.bubbleHalfWidths();

        if (headInView) this._emitCheeks(head, widths.head, sizeFactor, wake);
        if (bodyInView) this._emitBodyCurves(snake.segments, state, widths.body, sizeFactor);
    }

    // ── YANAKLAR ────────────────────────────────────────────────────────────
    // Yan nokta = kafa + dik birim vektör × yarı genişlik. Dik yön, hareket
    // açısına ±90° eklenerek bulunur: side = +1 / −1.
    _emitCheeks(head, halfWidth, sizeFactor, wake) {
        const heading = head.rotation;
        const back = halfWidth * CHEEK_BACK_RATIO;
        const baseX = head.x - Math.cos(heading) * back;
        const baseY = head.y - Math.sin(heading) * back;
        const reach = halfWidth * CHEEK_SIDE_RATIO;

        const offHeading = Phaser.Math.DegToRad(mix(CHEEK_ANGLE_DEG, wake));
        const spreadDeg = mix(CHEEK_SPREAD_DEG, wake);
        const speedMin = mix(CHEEK_SPEED_MIN, wake) * sizeFactor;
        const speedMax = mix(CHEEK_SPEED_MAX, wake) * sizeFactor;
        const scaleStart = mix(CHEEK_SCALE_START, wake) * sizeFactor;
        const scaleEnd = mix(CHEEK_SCALE_END, wake) * sizeFactor;
        const alpha = mix(CHEEK_ALPHA, wake);
        const quantity = Math.round(mix(CHEEK_QUANTITY, wake));

        for (let side = -1; side <= 1; side += 2) {
            const perp = heading + side * HALF_PI;
            this._emit(
                baseX + Math.cos(perp) * reach,
                baseY + Math.sin(perp) * reach,
                // Hareket yönünden, o yanağın tarafına doğru ölçülen açı.
                heading + side * offHeading,
                spreadDeg, speedMin, speedMax, scaleStart, scaleEnd, alpha, quantity);
        }
    }

    // ── GÖVDE KIVRIMLARI ────────────────────────────────────────────────────
    // Segment rotasyonu "kafadan kuyruğa" bakan teğettir (bkz.
    // Snake._positionSegmentsByPath). i ± STRIDE segmentlerinin rotasyon farkı
    // yerel kıvrımı verir; işareti virajın hangi yana döndüğünü söyler. y AŞAĞI
    // olduğundan pozitif fark saat yönüdür: eğrilik merkezi teğetin +90°
    // tarafındadır, DIŞ kenar −90° tarafında.
    _emitBodyCurves(segments, state, halfWidth, sizeFactor) {
        const first = CURVE_STRIDE;                  // i ± STRIDE gerekli
        const last = segments.length - 1 - CURVE_STRIDE;
        if (last < first) return;
        const outward = Phaser.Math.DegToRad(BODY_OUTWARD_DEG);
        const reach = halfWidth * BODY_SIDE_RATIO;

        for (let n = 0; n < BODY_PROBES_PER_TICK; n++) {
            // Dönen imleç + rastgele adım: aynı segmentler hep aynı fazda
            // yoklanmasın (aksi halde baloncuklar gövdede sabit noktalardan çıkar).
            state.cursor += 1 + ((Math.random() * 5) | 0);
            if (state.cursor > last) state.cursor = first + (state.cursor % (last - first + 1));
            const i = state.cursor;

            const seg = segments[i];
            const prev = segments[i - CURVE_STRIDE];
            const next = segments[i + CURVE_STRIDE];
            // Görünmeyen segmentin transformu bayattır (culling yazmayı atlar).
            if (!seg?.visible || !seg.active || !prev?.visible || !next?.visible) continue;

            const bend = Phaser.Math.Angle.Wrap(next.rotation - prev.rotation);
            const amount = Math.abs(bend);
            if (amount < CURVE_MIN_RAD) continue;
            const chance = (amount - CURVE_MIN_RAD) / (CURVE_FULL_RAD - CURVE_MIN_RAD);
            if (Math.random() > chance) continue;

            const side = bend > 0 ? -1 : 1;
            const normal = seg.rotation + side * HALF_PI;
            this._emit(
                seg.x + Math.cos(normal) * reach,
                seg.y + Math.sin(normal) * reach,
                // Teğet zaten GERİ bakar; dış kenara doğru eğilerek savrulur.
                seg.rotation + side * outward,
                BODY_SPREAD_DEG,
                BODY_SPEED_MIN * sizeFactor, BODY_SPEED_MAX * sizeFactor,
                BODY_SCALE_START * sizeFactor, BODY_SCALE_END * sizeFactor,
                BODY_ALPHA, 1);
        }
    }

    // Tek doğum noktası. Pozisyonel argümanlar bilinçli: sıcak yolda (yılan ×
    // tik) parametre nesnesi tahsis etmemek için.
    _emit(x, y, angleRad, spreadDeg, speedMin, speedMax, scaleStart, scaleEnd, alphaStart, quantity) {
        const ops = this.emitter.ops;
        const deg = Phaser.Math.RadToDeg(angleRad);
        ops.angle.start = deg - spreadDeg;
        ops.angle.end = deg + spreadDeg;
        ops.speedX.start = speedMin;
        ops.speedX.end = speedMax;
        ops.scaleX.start = scaleStart;
        ops.scaleX.end = scaleEnd;
        ops.alpha.start = alphaStart;
        // Su direnci: fırlatma yönünün tersine fren (bkz. DRAG_STOP_SEC).
        const drag = speedMin / DRAG_STOP_SEC;
        ops.accelerationX.current = -Math.cos(angleRad) * drag;
        ops.accelerationY.current = -Math.sin(angleRad) * drag;
        this.emitter.emitParticleAt(x, y, quantity);
    }

    destroy() {
        this.emitter?.destroy();
        this.emitter = null;
        this.scene = null;
    }
}
