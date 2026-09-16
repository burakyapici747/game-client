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
 * kuyrugun genis ucu yukari bakiyor, ama snake_head.png onden gorunen bir
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

/** Kaynak dosyalar public/assets/snake/ altinda; Vite bunlari aynen kopyalar. */
const SOURCE = {
    head: { key: 'snake_head_src', path: 'assets/snake/snake_head.png' },
    body: { key: 'snake_body_src', path: 'assets/snake/snake_body.png' },
    tail: { key: 'snake_tail_src', path: 'assets/snake/snake_tail.png' },
};

/** Dondurulmus/kullanima hazir doku anahtarlari. */
export const SnakeTexture = {
    HEAD: 'snake_head_rt',
    BODY: 'snake_body_rt',
    TAIL: 'snake_tail_rt',
};

/** PNG yuklenemezse kullanilan eski uretilmis daireler. */
const FALLBACK = {
    [SnakeTexture.HEAD]: 'snake_head48',
    [SnakeTexture.BODY]: 'snake_body48',
    [SnakeTexture.TAIL]: 'snake_body48',
};

/**
 * DOKU BASINA POT TUVAL BOYUTU (dondurme SONRASI yonelimde: genislik = ileri
 * eksen, yukseklik = carpisma kesiti).
 *
 * <p>Boyut secimi — en buyuk ekran kesiti: kesit = 48 · scale · cssZoom · D.
 * Kamera yilan buyudukce uzaklastigi icin (Game.js: base / (1 + 0.12·(s-1)))
 * scale ~7.5'te kesit ~202·baseZoom CSS px'e doyar → masaustu Retina (D=2)
 * ~404, mobil (base 0.45, D=2) ~182 buffer px. Bu yuzden:
 *   - kafa  512² : 639 → 512 kesit (≥404, masaustu en kotu durumu karsilar).
 *   - govde 256² : 289 → 256 kesit. Kaynak zaten ~290; 512'ye buyutmek detay
 *                  eklemez, yalnizca 4x bellek harcar. Govde yilan basina
 *                  onlarca kez cizilir ama TEK doku paylasir.
 *   - kuyruk 512²: 722x393 → 512x279 (kesit 279).
 *
 * <p>Bellek (RGBA + %33 mip): 512² ≈ 1.4 MB, 256² ≈ 0.35 MB → toplam ~3.1 MB;
 * eski POT olmayan tuvaller (639·623 + 295·289 + 722·393) ≈ 3.0 MB mip'siz.
 */
const POT_CANVAS = {
    [SnakeTexture.HEAD]: { width: 512, height: 512 },
    [SnakeTexture.BODY]: { width: 256, height: 256 },
    [SnakeTexture.TAIL]: { width: 512, height: 512 },
};

/**
 * Carpisma kesiti (px, scale=1). SnakeGeometryConfig.HEAD_RADIUS_PX * 2 = 48.
 * Bu deger sunucu ile SOZLESMEDIR; degistirilecekse iki tarafta birlikte.
 */
const TARGET_DIAMETER_PX = 48;

/** doku anahtari -> normalizasyon carpani (setScale ile CARPILIR). */
const normByTexture = new Map();

/** Sprite dokularinin gercekten hazir olup olmadigi. */
let spritesReady = false;

/**
 * Phaser Scene.preload() icinden cagrilir.
 *
 * <p>Yalnizca HAM dosyalari kuyruga alir; dondurme/normalizasyon dosyalar
 * indikten sonra {@link build} icinde yapilir (create() asamasi).
 */
export function preload(scene) {
    for (const { key, path } of Object.values(SOURCE)) {
        scene.load.image(key, path);
    }
}

/**
 * Phaser Scene.create() icinden cagrilir — yuklenen PNG'leri 90° dondurulmus,
 * olcegi normalize edilmis kullanima hazir dokulara donusturur.
 */
export function build(scene) {
    const missing = Object.values(SOURCE)
        .filter(s => !scene.textures.exists(s.key))
        .map(s => s.path);

    if (missing.length > 0) {
        console.warn('[SnakeSkin] sprite dokulari yuklenemedi, daire dokularina '
            + 'geri dusuluyor:', missing.join(', '));
        spritesReady = false;
        return false;
    }

    bakeRotated(scene, SOURCE.head.key, SnakeTexture.HEAD, BAKE_ROTATION.head);
    bakeRotated(scene, SOURCE.body.key, SnakeTexture.BODY, BAKE_ROTATION.body);
    bakeRotated(scene, SOURCE.tail.key, SnakeTexture.TAIL, BAKE_ROTATION.tail);

    // BILEREK setFilter(LINEAR) YOK: POT tuval + config.mipmapFilter zaten
    // min=LINEAR_MIPMAP_LINEAR / mag=LINEAR kurar (bkz. modul basi, madde 3).

    spritesReady = true;
    return true;
}

/**
 * Kaynak dokuyu dondurup POT bir canvas dokusuna OLCEKLEYEREK ve ORTALAYARAK
 * yazar, normalizasyon carpanini hesaplar.
 *
 * <p>DONUS YONU: canvas'ta y ASAGI oldugu icin pozitif aci SAAT YONUDUR.
 * rotate(+PI/2) altinda goruntunun UST kenari (0,-h/2) noktasi (h/2, 0)'a,
 * yani SAGA taşinir. Sanatin "ileri"si (yukari) boylece Phaser'in rotation=0
 * yonuyle (saga) ortusur.
 *
 * <p>BOYUT TAKASI: dondurmeden sonra en/boy yer degistirir. Yeni YUKSEKLIK
 * eski GENISLIKtir — yani carpisma kesiti odur ve normalizasyon ondan turer.
 *
 * <p>POT SIGDIRMA FORMULU (dondurulmus boyutlar rotW x rotH, tuval PW x PH):
 * <pre>
 *   fit        = min(PW / rotW, PH / rotH)       // oran korunur, tasma yok
 *   drawW,drawH = rotW·fit, rotH·fit             // tuvalde goruntunun kapladigi alan
 *   kesit(texel) = rotH · fit                    // = drawH
 *   norm       = 48 / kesit                      // setScale carpani
 * </pre>
 * Goruntu tuvalde ORTALANDIGI icin sprite origin'i (0.5, 0.5) hala goruntu
 * merkezine denk gelir; saydam dolgu yalnizca tuvalin frame boyutunu buyutur,
 * gorunen kesit ise norm · drawH · scale = 48 · scale olarak KORUNUR →
 * sunucu hitbox sozlesmesi (24·scale yaricap) degismez.
 */
function bakeRotated(scene, sourceKey, targetKey, rotation) {
    const source = scene.textures.get(sourceKey).getSourceImage();
    const w = source.width;
    const h = source.height;

    // 90°'nin TEK katlarinda en/boy yer degistirir; 180°'de degismez.
    // (Bu set yalnizca 90° ve 270° kullanir, ama formul genel tutuldu ki
    // ileride 180°'lik bir varlik eklenirse tuval boyutu yine dogru cikssin.)
    const quarterTurns = Math.round(rotation / (Math.PI / 2)) & 3;
    const swaps = quarterTurns === 1 || quarterTurns === 3;
    const rotW = swaps ? h : w;
    const rotH = swaps ? w : h;

    const pot = POT_CANVAS[targetKey];
    const fit = Math.min(pot.width / rotW, pot.height / rotH);
    const drawW = w * fit;   // dondurme ONCESI eksenlerde cizim boyutu
    const drawH = h * fit;

    const canvasTexture = scene.textures.createCanvas(targetKey, pot.width, pot.height);
    const ctx = canvasTexture.getContext();
    ctx.imageSmoothingEnabled = true;
    // Tek adimli kucultme orani en fazla ~1.4x (722→512); bu aralikta 'high'
    // kalite tarayicinin coklu-ornekli filtresini kullanir, mip zincirinin
    // ilk seviyesi temiz baslar.
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(pot.width / 2, pot.height / 2);
    ctx.rotate(rotation);
    ctx.drawImage(source, -drawW / 2, -drawH / 2, drawW, drawH);
    // refresh → canvasToTexture: POT → min filter = config.mipmapFilter ve
    // WebGLTextureWrapper.update icinde gl.generateMipmap.
    canvasTexture.refresh();

    // Kesit = dondurme sonrasi goruntu YUKSEKLIGI (texel). Tuval yuksekligi
    // DEGIL — dolgu kesite dahil edilirse sprite kucuk gorunurdu.
    normByTexture.set(targetKey, TARGET_DIAMETER_PX / (rotH * fit));
}

/** Sprite dokulari kullanilabilir mi (degilse cagiran daireye duser). */
export function isReady() {
    return spritesReady;
}

/** Hazirsa istenen doku anahtarini, degilse daire karsiligini doner. */
export function textureKey(logicalKey) {
    return spritesReady ? logicalKey : (FALLBACK[logicalKey] ?? 'snake_body48');
}

/**
 * Bir sprite'a dokuyu VE ona ait normalizasyon carpanini birlikte uygular.
 *
 * <p>IKISI AYRILAMAZ: doku degisince carpan da degismelidir (POT tuvallerle
 * kafa ~0.094, govde ~0.191, kuyruk ~0.172). Carpani sprite uzerinde {@code _texNorm} olarak
 * saklamak, sonraki her {@code setScale} cagrisinin (buyume animasyonu, sunucu
 * scale guncellemesi, retire solmasi) dogru olcegi kendiliginden korumasini
 * saglar — cagri yerlerinin hangi dokunun takili oldugunu bilmesi gerekmez.
 *
 * @param {Phaser.GameObjects.Sprite} sprite
 * @param {string} logicalKey SnakeTexture.* degerlerinden biri.
 */
export function applyTexture(sprite, logicalKey) {
    if (!sprite) return;
    const key = textureKey(logicalKey);
    if (sprite.texture?.key !== key) {
        sprite.setTexture(key);
    }
    sprite._texKey = logicalKey;
    sprite._texNorm = spritesReady ? (normByTexture.get(logicalKey) ?? 1) : 1;
}

/**
 * SPRITE GORUNUMUNU SIFIRLAR — dokunun %100 ozgun rengi icin.
 *
 * <p>NEDEN GEREKLI: Phaser'da {@code setTint} bir BOYAMA degil, CARPMADIR
 * (sonuc = doku_rgb x tint_rgb). Eski daire dokulari BEYAZ oldugu icin
 * beyaz x altin = altin verirdi ve tint pratikte "renklendirme" gibi
 * calisirdi. Gercek renkli PNG'lerde ayni islem karartma olur: serit rengi
 * 0x2B2B2B (43,43,43) ile carpmak sanati %83 KARARTIR — bildirilen
 * "dokular olduklarindan koyu" sorununun tam kaynagi budur.
 *
 * <p>Bu fonksiyon tek bir yerde tint/blend/alpha'yi notr degerlere ceker,
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
