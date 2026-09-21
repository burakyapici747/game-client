// ─────────────────────────────────────────────────────────────────────────────
// YEM GÖRSEL KİMLİĞİ — CANLI MAVİ ÇEKİRDEK + BİYOLÜMİNESAN HALE
//
// Yem üç katmanlı tek bir nesnedir: canlı mavi (#0691D6) bir gövde, gövdeden
// belirgin biçimde açık bir kenar ışığı ve gövdenin ardında nabız atan hale.
//
// ── NEDEN İKİ KATMAN (ve iki Blitter) ───────────────────────────────────────
// Eski çizim TEK Blitter + ADD (toplamalı) harmanıydı. ADD altında gövde rengi
// KORUNAMAZ: açık su zeminine (~rgb 207,234,242) #0691D6 eklemek yeşil ve mavi
// kanallarını 255'e doyurur ve sonuç soluk bir camgöbeğidir — istenen renk
// DEĞİL. Gövdenin TAM OLARAK #0691D6 çizilebilmesi NORMAL harman gerektirir.
// Katmanlar bu yüzden ayrıldı:
//
//   1. HALE  → altta, gövdenin kenarından dışarı yayılan camgöbeği ışık
//   2. GÖVDE → üstte, #0691D6 kütle + açık kenar ışığı
//
// İki Blitter = iki draw call. Yem sayısından BAĞIMSIZDIR: 40 yem de 4000 yem
// de toplam iki çizimdir (Blitter'ın tüm amacı budur).
//
// ── NEDEN HALE DE NORMAL HARMAN (ADD DEĞİL) ─────────────────────────────────
// Bu oyunun zemini AÇIK mavi sudur (~rgb 200,230,240). ADD altında camgöbeği
// eklemek yeşil ve mavi kanallarını ANINDA 255'e doyurur: sonuç camgöbeği bir
// hale değil, BEYAZ bir sis olur — renk bilgisi kaybolur (canlı oyunda
// doğrulandı). Açık zeminde "parlama" ancak DOYGUNLUK farkıyla okunur, parlaklık
// farkıyla değil; NORMAL harman camgöbeğinin tonunu korur. Bedeli, üst üste
// binen halelerin toplanmamasıdır — açık zeminde zaten beyaza patlayacakları
// için bu bir kayıp değil, kazançtır.
//
// ── NEDEN ÖLÇEK DEĞİL ALFA NABZI ────────────────────────────────────────────
// Phaser Blitter Bob'ları setScale DESTEKLEMEZ (bkz. Game._beginFoodEatingFlight
// yorumları; yem yenirken bu yüzden Sprite'a dönüştürülür). Nabzı ölçekle
// yapmak ya yem başına Sprite (binlerce GameObject) ya da her karede frame
// takası gerektirirdi. Alfa nabzı aynı "canlı" hissi tek bir sayı yazımıyla
// verir ve Blitter'ın tek-draw-call avantajını korur.
// ─────────────────────────────────────────────────────────────────────────────

export const CORE_TEXTURE_KEY = 'food_core';
export const HALO_TEXTURE_KEY = 'food_halo';

/**
 * Renk varyantı sayısı. Hepsi AYNI koyu lacivert ailesindendir; varyant yalnızca
 * tonu birkaç adım kaydırır — yüzlerce yem yan yana geldiğinde tek tip bir
 * "damga tekrarı" görünmesin diye. Her iki doku da AYNI frame sayısına sahiptir,
 * böylece tek bir `variant` indeksi ikisini birden adresler.
 */
export const FOOD_VARIANT_COUNT = 8;

const CORE_SIZE = 20;   // eski 'food_glow' ile aynı ayak izi — yem büyüklüğü hissi değişmez
const HALO_SIZE = 50;   // gövdenin ~2.3 katı: hale dışarı taşar, gövdeyi yutmaz

// ── PALET ───────────────────────────────────────────────────────────────────
/**
 * ÇEKİRDEK RENGİ — TEK ve DEĞİŞMEZ.
 *
 * <p>Gövde tüm varyantlarda AYNI tondadır ve merkezden kenar ışığına kadar
 * DÜZDÜR: yem türü ne olursa olsun (normal pellet ya da ölen yılanın düşürdüğü
 * yem — ikisi de aynı upsertFood yolundan geçer) ekranda tek bir çekirdek rengi
 * okunur. Gövdeye ton farkı verilseydi "istenen renk" yem başına değişirdi.</p>
 */
const CORE_COLOR = '#0691D6';

// Kenar ışığı — gövdeden belirgin biçimde AÇIK olmak ZORUNDADIR. Eski doygun
// camgöbeği tonları (#00a6ff) koyu lacivert gövdede parlak duruyordu; #0691D6
// üstünde parlaklıkları neredeyse eşittir ve kenar tamamen kaybolur. Bu yüzden
// beyaza doğru açıldı: kontrast artık gövdeyle hale arasında da sınır çiziyor.
const RIM = ['#7fe4ff', '#c4f4ff'];

// Hale — doygun camgöbeği. Varyant yalnızca burada ve kenar ışığında oynar,
// böylece yüzlerce yem yan yana geldiğinde tek tip damga tekrarı olmaz.
const GLOW = ['#00a6ff', '#00d2ff'];

// ── NABIZ ───────────────────────────────────────────────────────────────────
// Yalnızca HALE nabız atar. Gövde sabit opaklıktadır: koyu gövdeyi soldurmak,
// yemin "kaybolup geri gelmesi" gibi görünürdü — istenen şey ise nesnenin
// etrafındaki ışığın canlı olması.
const PULSE_HZ = 1.15;
const PULSE_MIN_ALPHA = 0.45;
const PULSE_AMP = 0.55;          // 0.45 → 1.00

// Nabız açısal hızı (rad/ms). Modül yüklenirken bir kez hesaplanır.
const PULSE_OMEGA = PULSE_HZ * Math.PI * 2 / 1000;

// Derinlikler: hale gövdenin ALTINDA, ikisi de yılanların (>= 1) ve
// baloncukların (0.5) altında kalır (bkz. Snake._refreshSegmentDepths,
// render/SnakeBubbles.js).
const HALO_DEPTH = 0;
const CORE_DEPTH = 0.05;

/**
 * Her iki spritesheet'i üretir. Preloader.create() içinden BİR KEZ çağrılır.
 *
 * <p>Var olan anahtar üzerine yazılmaz: sahne yeniden başlatıldığında (Play
 * Again) dokular zaten bellektedir ve Phaser aynı anahtarla ikinci bir canvas
 * dokusunu reddeder.</p>
 */
export function buildTextures(scene) {
    if (!scene.textures.exists(CORE_TEXTURE_KEY)) buildCoreTexture(scene);
    if (!scene.textures.exists(HALO_TEXTURE_KEY)) buildHaloTexture(scene);
}

// Canlı mavi gövde + açık kenar ışığı (NORMAL harmanla çizilir).
function buildCoreTexture(scene) {
    const core = hexToRgb(CORE_COLOR);

    paintSpritesheet(scene, CORE_TEXTURE_KEY, CORE_SIZE, (ctx, cx, cy, r, t) => {
        const rim = lerpHex(RIM[0], RIM[1], t);

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        // DÜZ gövde: merkez ve kenar aynı renktir, böylece ekranda okunan ton
        // TAM OLARAK #0691D6'dır (merkeze parlaklık eklemek onu açardı).
        grad.addColorStop(0.00, rgba(core, 1));
        // Düz gövde buraya kadar; sonrası kenar ışığıdır. Halka KALIN tutulur:
        // 26 px'lik dokuda 1 px'lik bir kenar, kamera uzaklaştığında (zoom < 1)
        // alt-piksele düşer ve tamamen kaybolur.
        grad.addColorStop(0.70, rgba(core, 1));
        grad.addColorStop(0.84, rgba(rim, 1));
        // Kenarın dışa doğru yumuşak sönümü — keskin kesim aliasing yapar.
        grad.addColorStop(1.00, rgba(rim, 0));
        return grad;
    });
}

// Camgöbeği hale (ADD harmanla çizilir).
function buildHaloTexture(scene) {
    // Halenin en parlak olduğu yarıçap = gövdenin kenarı. Böylece ışık nesnenin
    // KENARINDAN yayılır; merkeze doğru zaten opak gövdenin altında kalır.
    const coreEdge = (CORE_SIZE / 2) / (HALO_SIZE / 2);

    paintSpritesheet(scene, HALO_TEXTURE_KEY, HALO_SIZE, (ctx, cx, cy, r, t) => {
        const glow = lerpHex(GLOW[0], GLOW[1], t);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0.00, rgba(glow, 0.55));
        grad.addColorStop(coreEdge, rgba(glow, 0.80));   // kenarda tepe
        grad.addColorStop(0.60, rgba(glow, 0.26));
        grad.addColorStop(1.00, rgba(glow, 0));
        return grad;
    });
}

/**
 * `FOOD_VARIANT_COUNT` kare yan yana dizilmiş bir canvas dokusu üretir ve her
 * kareyi spritesheet frame'i olarak kaydeder (Blitter Bob'ları frame indeksiyle
 * renk seçer).
 *
 * @param {(ctx, cx, cy, r, t) => CanvasGradient} makeGradient t = varyant oranı (0..1)
 */
function paintSpritesheet(scene, key, size, makeGradient) {
    const tex = scene.textures.createCanvas(key, size * FOOD_VARIANT_COUNT, size);
    const ctx = tex.getContext();
    const radius = size / 2 - 0.5;   // yarım piksel pay: kenar kırpılmasın

    for (let i = 0; i < FOOD_VARIANT_COUNT; i++) {
        const offsetX = i * size;
        const t = FOOD_VARIANT_COUNT === 1 ? 0 : i / (FOOD_VARIANT_COUNT - 1);
        ctx.fillStyle = makeGradient(ctx, offsetX + size / 2, size / 2, radius, t);
        ctx.fillRect(offsetX, 0, size, size);
        tex.add(i, 0, offsetX, 0, size, size);
    }

    tex.refresh();
}

/**
 * İki katmanlı yem çizicisi.
 *
 * <p>Sahne başına BİR örnek. Blitter'lar ilk yemde tembel kurulur (bağlantı
 * kurulmadan önce boş bir Blitter sahnede durmasın).</p>
 */
export class FoodRenderer {
    constructor(scene) {
        this.scene = scene;
        this.haloBlitter = null;
        this.coreBlitter = null;
    }

    /**
     * Bir yem için iki Bob üretir ve {halo, core} düğümünü döner.
     *
     * <p>Bob'lar dokunun SOL ÜST köşesinden konumlanır (Blitter'ın kuralı), bu
     * yüzden her katman kendi yarı boyutu kadar geri ötelenir: iki katmanın
     * merkezleri ve yemin mantıksal koordinatı böylece ÇAKIŞIR. Öteleme
     * atlanırsa hale gövdeye göre sağ-aşağı kayar.</p>
     */
    createNode(x, y, variant) {
        this._ensure();
        return {
            halo: this.haloBlitter.create(x - HALO_SIZE / 2, y - HALO_SIZE / 2, variant),
            core: this.coreBlitter.create(x - CORE_SIZE / 2, y - CORE_SIZE / 2, variant),
        };
    }

    /** Düğümü söker. İki kez çağrılması güvenlidir (idempotent). */
    destroyNode(node) {
        if (!node) return;
        node.halo?.destroy();
        node.core?.destroy();
        node.halo = null;
        node.core = null;
    }

    /**
     * Halenin nabzını bu kareye ilerletir.
     *
     * <p>YALNIZCA görüş alanındaki yemler için çağrılır (bkz. Game.update):
     * ekran dışındaki yem son alfasını korur ve tekrar göründüğü ilk karede
     * zaten güncellenir — görsel bir artefakt oluşmaz.</p>
     *
     * <p>Faz yem başına sabittir (foodId'den türetilir): yemler senkron değil,
     * dağınık nabız atar.</p>
     */
    pulse(node, phase, nowMs) {
        const halo = node?.halo;
        if (!halo) return;
        halo.alpha = PULSE_MIN_ALPHA
            + PULSE_AMP * (0.5 + 0.5 * Math.sin(nowMs * PULSE_OMEGA + phase));
    }

    /**
     * Yenen yemin UÇUŞ düğümü: Bob'lar ölçeklenemediği için (bkz. dosya başlığı)
     * iki gerçek Sprite. Yalnızca aynı anda yenen birkaç yem için yaratılır;
     * duran binlerce yemin Blitter avantajı bozulmaz.
     */
    createFlightNode(x, y, variant) {
        const world = (obj) => this.scene.registerWorld(obj);
        return {
            halo: world(this.scene.add.sprite(x, y, HALO_TEXTURE_KEY, variant)
                .setDepth(HALO_DEPTH)),
            core: world(this.scene.add.sprite(x, y, CORE_TEXTURE_KEY, variant)
                .setDepth(CORE_DEPTH)),
        };
    }

    /** Uçuş düğümünün iki katmanını birlikte taşır/küçültür/soldurur. */
    setFlightTransform(node, x, y, scale, alpha) {
        node.halo.setPosition(x, y).setScale(scale).setAlpha(alpha);
        node.core.setPosition(x, y).setScale(scale).setAlpha(alpha);
    }

    destroyFlightNode(node) {
        if (!node) return;
        node.halo?.destroy();
        node.core?.destroy();
    }

    /** Tüm yemleri siler (bağlantı koptu / sahne yeniden kuruldu). */
    clear() {
        this.haloBlitter?.clear();
        this.haloBlitter?.destroy();
        this.coreBlitter?.clear();
        this.coreBlitter?.destroy();
        this.haloBlitter = null;
        this.coreBlitter = null;
    }

    destroy() {
        this.clear();
        this.scene = null;
    }

    _ensure() {
        if (this.coreBlitter) return;
        const scene = this.scene;
        // ÇİZİM SIRASI: hale altta, gövde üstte. Ters sırada yarı saydam hale
        // koyu gövdenin üstüne binip onu soldururdu.
        this.haloBlitter = scene.registerWorld(
            scene.add.blitter(0, 0, HALO_TEXTURE_KEY)
                .setDepth(HALO_DEPTH));
        this.coreBlitter = scene.registerWorld(
            scene.add.blitter(0, 0, CORE_TEXTURE_KEY)
                .setDepth(CORE_DEPTH));
    }
}

// ── renk yardımcıları ───────────────────────────────────────────────────────

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function lerpHex(fromHex, toHex, t) {
    const a = hexToRgb(fromHex);
    const b = hexToRgb(toHex);
    return {
        r: Math.round(a.r + (b.r - a.r) * t),
        g: Math.round(a.g + (b.g - a.g) * t),
        b: Math.round(a.b + (b.b - a.b) * t),
    };
}

const rgba = (c, alpha) => `rgba(${c.r},${c.g},${c.b},${alpha})`;
