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
 * 3) GERI DUSUS. Bir PNG yuklenemezse (404, bozuk dosya) oyun kirmizi kutu
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

    for (const key of Object.values(SnakeTexture)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }

    spritesReady = true;
    return true;
}

/**
 * Kaynak dokuyu 90° dondurup yeni bir canvas dokusu olarak kaydeder ve
 * normalizasyon carpanini hesaplar.
 *
 * <p>DONUS YONU: canvas'ta y ASAGI oldugu icin pozitif aci SAAT YONUDUR.
 * rotate(+PI/2) altinda goruntunun UST kenari (0,-h/2) noktasi (h/2, 0)'a,
 * yani SAGA taşinir. Sanatin "ileri"si (yukari) boylece Phaser'in rotation=0
 * yonuyle (saga) ortusur.
 *
 * <p>BOYUT TAKASI: dondurmeden sonra en/boy yer degistirir. Yeni YUKSEKLIK
 * eski GENISLIKtir — yani carpisma kesiti odur ve normalizasyon ondan turer.
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
    const canvasW = swaps ? h : w;
    const canvasH = swaps ? w : h;

    const canvasTexture = scene.textures.createCanvas(targetKey, canvasW, canvasH);
    const ctx = canvasTexture.getContext();
    ctx.imageSmoothingEnabled = true;
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.rotate(rotation);
    ctx.drawImage(source, -w / 2, -h / 2);
    canvasTexture.refresh();

    // Kesit = dondurme sonrasi YUKSEKLIK. 90/270°'de bu kaynagin GENISLIGIDIR.
    normByTexture.set(targetKey, TARGET_DIAMETER_PX / canvasH);
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
 * <p>IKISI AYRILAMAZ: doku degisince carpan da degismelidir (kafa 0.075, govde
 * 0.166, kuyruk 0.122). Carpani sprite uzerinde {@code _texNorm} olarak
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
