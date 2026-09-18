import Phaser from 'phaser';

/**
 * SNAKE SKIN — sprite tabanli yilan dokularinin TEK sahiplik noktasi.
 *
 * Yilanin cizim mantigi (path ornekleme, decimation, culling, havuzlama)
 * Snake.js'te kalir; burasi yalnizca "hangi doku, hangi olcekte, hangi
 * yonelimde" sorusunu cevaplar. Boylece sanat varliklari degistiginde tek
 * dosyaya dokunulur.
 *
 * ── COZULEN UC PROBLEM ──────────────────────────────────────────────────────
 *
 * 1) YONELIM. Kaynak PNG'ler yukari bakar (govde pullari yukari, kuyrugun genis
 *    ucu yukarida). Phaser'da rotation=0 SAGA (+x) bakmaktir ve kod tabaninin
 *    her yeri {@code head.rotation}'i bir YON VEKTORU olarak okur
 *    (_updateEyes, _enforceNeckJoint, Game.js girdi katmani...). Her cizim
 *    yerine +90° eklemek bu okuyucularin hepsini bozardi.
 *
 *    COZUM: donusu YUKLEME ANINDA dokuya pisiriyoruz. Kaynak goruntu bir kez
 *    90° dondurulup canvas dokusuna yazilir; sonrasinda rotation semantigi
 *    standart Phaser'dir ve HICBIR cagri yerinde ofset matematigi gerekmez.
 *    Kare basina maliyet: sifir.
 *
 * 2) BOYUT SOZLESMESI. Kaynak PNG'ler 639x623 / 289x295 / 393x722 — yani ne
 *    kare ne de 48 px. Sunucu hitbox'i ise gorunen yaricapin TAM 24*scale px
 *    olmasini sart kosar (bkz. SnakeGeometryConfig). Dokuyu ham haliyle
 *    setScale(this.scale) ile cizmek kafayi ~13 kat buyutur ve gorsel temas ile
 *    olum anini tamamen ayristirirdi.
 *
 *    COZUM: doku basina bir NORMALIZASYON CARPANI. Sprite'in ENI (carpisma
 *    kesiti) her zaman 48*scale px'e oturur. Uzunluk ekseni serbest birakilir —
 *    kuyrugun 393x722 orani bu sayede korunur ve kuyruk dogal olarak uzun kalir
 *    (kareye sikistirilmis bir kuyruk yerine).
 *
 * 3) MIPMAP / POWER-OF-TWO. Kaynak PNG'ler POT degildir; WebGL1 (ve Phaser
 *    3.90, WebGLRenderer.canvasToTexture) mip zincirini YALNIZCA POT dokular
 *    icin uretir. Mobilde kamera ~0.45 zoom'dadir ve 639 px'lik kafa ekranda
 *    ~20-65 piksele iner: mipmap'siz LINEAR ornekleme 30x kucultmede her
 *    ekran pikseli icin yalnizca 2x2 texel okur → pullar hareket ederken
 *    kivilcimlanir/moire uretir.
 *
 *    COZUM: dokular sabit POT tuvallere (bkz. POT_CANVAS) en-boy orani
 *    korunarak sigdirilip ORTALANIR. Tuval POT oldugu icin Phaser game
 *    config'teki mipmapFilter'i (LINEAR_MIPMAP_LINEAR) uygular ve refresh()
 *    sirasinda gl.generateMipmap cagirir. setFilter() CAGRILMAZ — o cagri min
 *    filter'i duz LINEAR'a indirip mip zincirini devre disi birakirdi.
 *
 * 4) GERI DUSUS. Bir PNG yuklenemezse (404, bozuk dosya) oyun kirmizi kutu
 *    cizmek yerine eski uretilmis daire dokularina duser ve konsola tek satir
 *    uyari birakir. Gorsel bozulur ama oynanis ve carpisma senkronu bozulmaz.
 */

/**
 * DOKU BASINA YONELIM DUZELTMESI (radyan, dokuya PISIRILIR).
 *
 * <p>Temel donus +90°'dir: sanat YUKARI bakar, Phaser'da rotation=0 SAGA bakar.
 *
 * <p>KAFA ICIN EK 180°: sanat seti kendi icinde TUTARLI DEGIL. Govde pullari ve
 * kuyrugun genis ucu yukari bakiyor, ama 1x1.png onden gorunen bir
 * ejderha yuzudur ve ILERI yonu BURUN'dur — burun ise goruntunun ALTINDA.
 * Yani kafanin ileri yonu asagi, govde/kuyrugunki yukari. Bu yuzden kafa
 * 90+180=270° dondurulur; aksi halde yilan tam ters yone bakar.
 *
 * <p>NEDEN CIZIM ANINDA DEGIL DE DOKUDA: {@code head.rotation} kod tabaninda
 * bir YON VEKTORU olarak okunur — _enforceNeckJoint boyun segmentini
 * {@code cos(head.rotation)} ile yerlestirir, _positionSegmentsByPath onu
 * yedek teget olarak kullanir, Game.js girdi katmani da ondan aci turetir.
 * Oraya +PI eklemek boynu kafanin ONUNE tasir ve girdi yedeklerini bozardi.
 * Dokuda dondurmek gorseli duzeltir, mantigi hic ellemez ve kare basina
 * maliyeti sifirdir.
 */
const BAKE_ROTATION = {
    head: Math.PI / 2 + Math.PI,   // 270° — burun asagi baktigi icin ek 180°
    body: Math.PI / 2,             // 90°
    tail: Math.PI / 2,             // 90°
};

// ── KARAKTER (SKIN) KAYITLARI ─────────────────────────────────────────────────
//
// Her karakter uc parcadan olusur: kafa, govde, kuyruk. Tum setler AYNI sanat
// yonelim kuralini izler (character-1 ile dogrulandi, bkz. BAKE_ROTATION):
// kafanin burnu, govdenin ve kuyrugun sapi goruntunun ALTINDADIR.
//
// Yalnizca varsayilan karakter Preloader'da yuklenir; digerleri ilk
// kullanildiklarinda (ensureSkin) tembel yuklenir — acilis maliyeti degismez.
export const DEFAULT_SKIN_ID = 9;

/** Kayitli karakter sayisi (public/assets/snake/character-1..N). */
const SKIN_COUNT = 9;

/**
 * Kaynak dosyalar public/assets/snake/ altinda; Vite bunlari aynen kopyalar.
 *
 * <p>Adlandirma TUM karakterlerde ayni: `character-N/Nx1..3.png` →
 * 1 = kafa, 2 = govde, 3 = kuyruk. Istisna/ozel durum YOKTUR.
 */
const SKINS = (() => {
    const out = {};
    for (let id = 1; id <= SKIN_COUNT; id++) {
        out[id] = {
            head: `assets/snake/character-${id}/${id}x1.png`,
            body: `assets/snake/character-${id}/${id}x2.png`,
            tail: `assets/snake/character-${id}/${id}x3.png`,
        };
    }
    return out;
})();

/** Kayitli karakter id'leri (artan). */
export const SKIN_IDS = Object.keys(SKINS).map(Number).sort((a, b) => a - b);

/**
 * MANTIKSAL parca kimlikleri. Sprite uzerinde {@code _texKey} olarak saklanir;
 * gercek doku anahtari karakter id'si ile birlikte {@link textureKey} ile cozulur.
 */
export const SnakeTexture = {
    HEAD: 'head',
    BODY: 'body',
    TAIL: 'tail',
};

/** PNG yuklenemezse kullanilan eski uretilmis daireler. */
const FALLBACK = {
    [SnakeTexture.HEAD]: 'snake_head48',
    [SnakeTexture.BODY]: 'snake_body48',
    [SnakeTexture.TAIL]: 'snake_body48',
};

/**
 * PARCA BASINA POT TUVAL BOYUTU (dondurme SONRASI yonelimde: genislik = ileri
 * eksen, yukseklik = carpisma kesiti).
 *
 * <p>Varliklar ozgun oranlarinda oldugu icin tuval, en-boy orani korunarak
 * SIGDIRILIR (fit) ve ORTALANIR. Boyut secimi — en buyuk ekran kesiti:
 * kesit = 48 · scale · cssZoom · D; kamera yilan buyudukce uzaklastigindan
 * (Game.js: base / (1 + 0.12·(s-1))) masaustu Retina'da en kotu durum ~404 px.
 *   - kafa  512² : kesit 512'ye kadar.
 *   - govde 512x256: ileri eksen 512, kesit 256. Kare 256 tuvalde UZUN
 *                  govdeler (ornegin character-7: 404x560) kesitte ~185
 *                  texel'e dusup detay kaybederdi.
 *   - kuyruk 512².
 *
 * <p>Her iki boyut da POT oldugu icin mip zinciri uretilir (kare olmasi sart
 * degil).
 */
const POT_CANVAS = {
    head: { width: 512, height: 512 },
    body: { width: 512, height: 256 },
    tail: { width: 512, height: 512 },
};

/**
 * Carpisma kesiti (px, scale=1). SnakeGeometryConfig.HEAD_RADIUS_PX * 2 = 48.
 * Bu deger sunucu ile SOZLESMEDIR; degistirilecekse iki tarafta birlikte.
 */
const TARGET_DIAMETER_PX = 48;

/**
 * Opak sinir kutusu olcumunde "bos" sayilan alfa esigi (0..255). Kenar
 * yumusatmasinin yari saydam hale piksellerini kesite katmaz.
 */
const OPAQUE_ALPHA_THRESHOLD = 16;

/** Olcum tuvalinin en uzun kenari (px). Kutu hassasiyeti ~%0.5 — yeterli. */
const MEASURE_MAX_DIM = 256;

/**
 * Daire dokusu geri dususunde (sprite'lar yuklenemedi) ya da henuz olculmemis
 * karakterde kullanilan olculer: 48 px'lik simetrik daireler.
 */
const FALLBACK_EXTENT = Object.freeze({ front: 24, back: 24, halfWidth: 24 });
const FALLBACK_METRICS = Object.freeze({
    head: FALLBACK_EXTENT,
    body: FALLBACK_EXTENT,
    tail: FALLBACK_EXTENT,
});

/** gercek doku anahtari -> normalizasyon carpani (setScale ile CARPILIR). */
const normByTexture = new Map();

/** karakter id -> parca olculeri (scale=1 dunya px'i). */
const metricsBySkin = new Map();

/** karakter id -> devam eden tembel yukleme sozu. */
const pendingLoads = new Map();

/** Varsayilan karakterin sprite dokulari hazir mi (degilse daireye dusulur). */
let spritesReady = false;

function sourceKey(skinId, part) {
    return `snake_${part}_src_${skinId}`;
}

function bakedKey(skinId, part) {
    return `snake_${part}_rt_${skinId}`;
}

function normalizeSkinId(skinId) {
    const id = Number(skinId);
    return Number.isInteger(id) && SKINS[id] ? id : DEFAULT_SKIN_ID;
}

/**
 * Phaser Scene.preload() icinden cagrilir.
 *
 * <p>Yalnizca varsayilan karakterin HAM dosyalarini kuyruga alir; dondurme/
 * normalizasyon dosyalar indikten sonra {@link build} icinde yapilir.
 */
export function preload(scene) {
    queueSkinFiles(scene, DEFAULT_SKIN_ID);
}

function queueSkinFiles(scene, skinId) {
    const def = SKINS[skinId];
    for (const part of Object.values(SnakeTexture)) {
        const key = sourceKey(skinId, part);
        if (!scene.textures.exists(key)) scene.load.image(key, def[part]);
    }
}

/**
 * Phaser Scene.create() icinden cagrilir — varsayilan karakteri dondurulmus,
 * olcegi normalize edilmis dokulara donusturur ve parca olculerini cikarir.
 */
export function build(scene) {
    spritesReady = bakeSkin(scene, DEFAULT_SKIN_ID);
    return spritesReady;
}

function bakeSkin(scene, skinId) {
    const parts = Object.values(SnakeTexture);
    const missing = parts
        .filter(part => !scene.textures.exists(sourceKey(skinId, part)))
        .map(part => SKINS[skinId][part]);

    if (missing.length > 0) {
        console.warn(`[SnakeSkin] karakter ${skinId} dokulari yuklenemedi`
            + (skinId === DEFAULT_SKIN_ID ? ', daire dokularina geri dusuluyor:' : ':'),
            missing.join(', '));
        return false;
    }

    const metrics = {};
    for (const part of parts) {
        metrics[part] = bakeRotated(scene, skinId, part);
    }
    // BILEREK setFilter(LINEAR) YOK: POT tuval + config.mipmapFilter zaten
    // min=LINEAR_MIPMAP_LINEAR / mag=LINEAR kurar (bkz. modul basi, madde 3).
    metricsBySkin.set(skinId, Object.freeze(metrics));
    return true;
}

/**
 * Karakteri gerekiyorsa yukler ve pisirir.
 *
 * @returns {Promise<boolean>} karakter kullanima hazirsa true. Yukleme/pisirme
 *          basarisizsa false — cagiran mevcut karakterde kalmalidir.
 */
export function ensureSkin(scene, skinId) {
    const id = normalizeSkinId(skinId);
    if (metricsBySkin.has(id)) return Promise.resolve(true);
    if (pendingLoads.has(id)) return pendingLoads.get(id);
    if (!scene?.load || !scene?.textures) return Promise.resolve(false);

    const promise = new Promise((resolve) => {
        const finish = () => {
            let ok = false;
            try {
                ok = bakeSkin(scene, id);
            } catch (err) {
                console.warn(`[SnakeSkin] karakter ${id} pisirilemedi:`, err);
            }
            pendingLoads.delete(id);
            resolve(ok);
        };
        queueSkinFiles(scene, id);
        if (!scene.load.list || scene.load.list.size === 0) {
            // Tum kaynaklar zaten dokuda (onceden yuklenmis) — kuyruk bos.
            finish();
            return;
        }
        scene.load.once(Phaser.Loader.Events.COMPLETE, finish);
        if (!scene.load.isLoading()) scene.load.start();
    });
    pendingLoads.set(id, promise);
    return promise;
}

/** Karakter pisirilmis ve kullanima hazir mi. */
export function isSkinReady(skinId) {
    return metricsBySkin.has(normalizeSkinId(skinId));
}

/**
 * PARCA OLCULERI (scale=1 dunya px'i; govde tupu 48 px'e normalize).
 *
 * <p>Her parca icin sprite MERKEZINDEN (origin 0.5) olculur:
 * <pre>
 *   front     — kafaya dogru (ileri) opak kenara mesafe
 *   back      — kuyruga dogru (geri) opak kenara mesafe
 *   halfWidth — cekirdek kesitinin yarisi (olcek geregi her zaman 24)
 * </pre>
 * Olcum, doku pisirilirken BIR KEZ yapilir ve karakterle birlikte saklanir.
 * Karakter hazir degilse (ya da daire geri dususunde) 48 px'lik daire olculeri
 * doner.
 */
export function getSkinMetrics(skinId) {
    if (!spritesReady) return FALLBACK_METRICS;
    return metricsBySkin.get(normalizeSkinId(skinId))
        ?? metricsBySkin.get(DEFAULT_SKIN_ID)
        ?? FALLBACK_METRICS;
}

/**
 * Kaynak dokuyu dondurup POT bir canvas dokusuna OLCEKLEYEREK ve ORTALAYARAK
 * yazar, normalizasyon carpanini ve parca olculerini hesaplar.
 *
 * <p>DONUS YONU: canvas'ta y ASAGI oldugu icin pozitif aci SAAT YONUDUR.
 * rotate(+PI/2) altinda goruntunun UST kenari (0,-h/2) noktasi (h/2, 0)'a,
 * yani SAGA taşinir. Sanatin "ileri"si (yukari) boylece Phaser'in rotation=0
 * yonuyle (saga) ortusur.
 *
 * <p>YONELIM → OLCU EKSENI: govde/kuyruk sprite'larinin rotation'i KUYRUGA
 * dogru bakar (bkz. Snake._positionSegmentsByPath), kafaninki hareket yonune;
 * kafa ise ek 180° ile pisirilir. Uc parcada da sonuc aynidir: goruntunun
 * ALT kenari kafaya (ileri), UST kenari kuyruga (geri) bakar.
 *
 * <p>OLCEK — VARLIK BASINA DINAMIK: varliklar ozgun oranlarinda kalir, bu
 * yuzden olcek her parca icin AYRI olculur. Referans, parcanin OPAK
 * GENISLIGIDIR (saydam dolgu haric); sanat setleri surekli ve kesintisiz
 * govde silueti kullandigi icin bu dogrudan govde tupunun genisligidir —
 * karaktere ozel istisna YOKTUR:
 * <pre>
 *   fit          = min(PW / rotW, PH / rotH)      // POT tuvale sigdirma
 *   cekirdek     = opakGenislik                   // saydam dolgu HARIC
 *   norm         = 48 / (cekirdek · fit)          // setScale carpani
 * </pre>
 * Boylece govde tupu HER karakterde 48 · scale px'e oturur (sunucu hitbox'i),
 * dekoratif uzantilar ise kendi ozgun oranlarinda disari tasar.
 *
 * <p>Goruntu tuvalde ORTALANDIGI icin sprite origin'i (0.5, 0.5) hala goruntu
 * merkezine denk gelir.
 *
 * @returns {{front:number, back:number, halfWidth:number}} parca olculeri
 *          (scale=1 dunya px'i, sprite merkezine gore).
 */
function bakeRotated(scene, skinId, part) {
    const source = scene.textures.get(sourceKey(skinId, part)).getSourceImage();
    const rotation = BAKE_ROTATION[part];
    const w = source.width;
    const h = source.height;

    // 90°'nin TEK katlarinda en/boy yer degistirir; 180°'de degismez.
    const quarterTurns = Math.round(rotation / (Math.PI / 2)) & 3;
    const swaps = quarterTurns === 1 || quarterTurns === 3;
    const rotW = swaps ? h : w;
    const rotH = swaps ? w : h;

    const pot = POT_CANVAS[part];
    const fit = Math.min(pot.width / rotW, pot.height / rotH);
    const drawW = w * fit;   // dondurme ONCESI eksenlerde cizim boyutu
    const drawH = h * fit;

    const key = bakedKey(skinId, part);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const canvasTexture = scene.textures.createCanvas(key, pot.width, pot.height);
    const ctx = canvasTexture.getContext();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(pot.width / 2, pot.height / 2);
    ctx.rotate(rotation);
    ctx.drawImage(source, -drawW / 2, -drawH / 2, drawW, drawH);
    // refresh → canvasToTexture: POT → min filter = config.mipmapFilter ve
    // WebGLTextureWrapper.update icinde gl.generateMipmap.
    canvasTexture.refresh();

    // Opak kutu KAYNAK goruntu eksenlerinde (dondurme oncesi) olculur ve
    // parca olculeri buradan turer — olcum parca basina TEK SEFER, pisirme
    // aninda yapilir; sonuc dokuyla birlikte saklanir (bkz. metricsBySkin).
    const box = measureOpaqueBox(source);
    const coreW = Math.max(1, box.right - box.left);
    const sourceToWorld = TARGET_DIAMETER_PX / coreW;
    normByTexture.set(key, TARGET_DIAMETER_PX / (coreW * fit));

    return Object.freeze({
        front: (box.bottom - h / 2) * sourceToWorld,
        back: (h / 2 - box.top) * sourceToWorld,
        // Kesit yarisi: cekirdek her zaman 48 px'e normalize edildigi icin 24.
        halfWidth: TARGET_DIAMETER_PX / 2,
    });
}

/**
 * Goruntunun opak sinir kutusunu (kaynak px) dondurur. Olcum, en uzun kenari
 * MEASURE_MAX_DIM olan kucultulmus bir tuvalde yapilir (parca basina tek
 * seferlik, yukleme aninda). Piksel okunamazsa (or. CORS) tum cerceve kabul
 * edilir.
 */
function measureOpaqueBox(source) {
    const w = source.width;
    const h = source.height;
    const full = { left: 0, top: 0, right: w, bottom: h };
    try {
        const k = Math.min(1, MEASURE_MAX_DIM / Math.max(w, h));
        const mw = Math.max(1, Math.round(w * k));
        const mh = Math.max(1, Math.round(h * k));
        const canvas = document.createElement('canvas');
        canvas.width = mw;
        canvas.height = mh;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(source, 0, 0, mw, mh);
        const data = ctx.getImageData(0, 0, mw, mh).data;

        let left = mw, right = -1, top = mh, bottom = -1;
        for (let y = 0; y < mh; y++) {
            const row = y * mw;
            for (let x = 0; x < mw; x++) {
                if (data[(row + x) * 4 + 3] > OPAQUE_ALPHA_THRESHOLD) {
                    if (x < left) left = x;
                    if (x > right) right = x;
                    if (y < top) top = y;
                    if (y > bottom) bottom = y;
                }
            }
        }
        // Gecici tuvalin arka tamponu hemen birakilir (GC'yi beklemeden).
        canvas.width = 0;
        canvas.height = 0;

        if (right < 0) return full;   // tamamen saydam — cerceveye dus
        return {
            left: left / k,
            right: (right + 1) / k,
            top: top / k,
            bottom: (bottom + 1) / k,
        };
    } catch (err) {
        return full;
    }
}

/** Varsayilan karakterin sprite dokulari kullanilabilir mi. */
export function isReady() {
    return spritesReady;
}

/**
 * Parca + karakter icin gercek doku anahtari. Karakter henuz hazir degilse
 * varsayilan karaktere, o da yoksa daire dokusuna duser.
 */
export function textureKey(part, skinId = DEFAULT_SKIN_ID) {
    if (!spritesReady) return FALLBACK[part] ?? 'snake_body48';
    const id = normalizeSkinId(skinId);
    return bakedKey(metricsBySkin.has(id) ? id : DEFAULT_SKIN_ID, part);
}

/**
 * Bir sprite'a dokuyu VE ona ait normalizasyon carpanini birlikte uygular.
 *
 * <p>IKISI AYRILAMAZ: doku degisince carpan da degismelidir. Carpani sprite
 * uzerinde {@code _texNorm} olarak saklamak, sonraki her {@code setScale}
 * cagrisinin (buyume animasyonu, sunucu scale guncellemesi, solma) dogru
 * olcegi kendiliginden korumasini saglar.
 *
 * @param {Phaser.GameObjects.Sprite} sprite
 * @param {string} part SnakeTexture.* degerlerinden biri.
 * @param {number} [skinId] karakter id'si (varsayilan: DEFAULT_SKIN_ID).
 */
export function applyTexture(sprite, part, skinId = DEFAULT_SKIN_ID) {
    if (!sprite) return;
    const key = textureKey(part, skinId);
    if (sprite.texture?.key !== key) {
        sprite.setTexture(key);
    }
    sprite._texKey = part;
    sprite._texNorm = spritesReady ? (normByTexture.get(key) ?? 1) : 1;
}

/**
 * SPRITE GORUNUMUNU SIFIRLAR — dokunun %100 ozgun rengi icin.
 *
 * <p>NEDEN GEREKLI: Phaser'da {@code setTint} bir BOYAMA degil, CARPMADIR
 * (sonuc = doku_rgb x tint_rgb). Gercek renkli PNG'lerde renkli bir tint
 * sanati karartir. Bu fonksiyon tint/blend/alpha'yi notr degerlere ceker,
 * boylece sprite havuzdan gelse de yeni yaratilsa da ayni temiz durumda
 * baslar.
 */
export function resetAppearance(sprite) {
    if (!sprite) return;
    // clearTint(), tint'i 0xffffff'e alir — carpim etkisiz eleman olur.
    sprite.clearTint();
    // Havuzdan gelen bir sprite ADD/MULTIPLY ile birakilmis olabilir.
    sprite.setBlendMode(Phaser.BlendModes.NORMAL);
    sprite.setAlpha(1);
}

/**
 * Normalizasyon carpanini hesaba katan olcek yazimi.
 *
 * <p>TUM setScale cagrilari bundan gecmelidir; ham {@code setScale(scale)}
 * sprite'i kaynak PNG boyutunda cizer ve sunucu hitbox sozlesmesini kirar.
 *
 * @param {number} worldScale  yilanin sunucudan gelen olcegi.
 * @param {number} animScale   buyume/solma carpani (0..1).
 */
export function setSpriteScale(sprite, worldScale, animScale = 1) {
    if (!sprite) return;
    sprite.setScale(worldScale * (sprite._texNorm ?? 1) * animScale);
}
