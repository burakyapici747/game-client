/**
 * TERRAIN — statik zemin dokularinin TEK sahiplik noktasi.
 *
 * Gecici `grid32` tileSprite'inin (neon kare izgara) yerini alir. Sanat
 * varliklari public/assets/terrain/ altinda: 1..8.png + 1x4.png + 2x4.png,
 * toplam 10 varyant. HEPSI 2048x2048, POT (power-of-two) ve tamamen opak.
 *
 * <p>NOT: "1x4"/"2x4" yalnizca DOSYA ADIDIR, en-boy orani degil — bu iki
 * dosya da olcum sonucu tam 2048x2048'dir (bkz. PNG IHDR). Dolayisiyla
 * cok-hucre boyunca UZATILMAZLAR: standart 2048'lik izgara birimine birebir
 * oturan, digerleriyle tamamen esdeger iki varyanttir. Gercekten 4 hucre
 * genisliginde bir sanat gelirse SOURCE tanimina bir `cells` alani eklemek
 * ve _reposition icinde o kadar hucreyi tek quad'a atamak gerekir.
 *
 * ── COZULEN DORT PROBLEM ────────────────────────────────────────────────────
 *
 * 1) DRAW CALL. Dunya 20000x20000 px; 2048'lik hucrelerle ~10x10 = 100 karo
 *    eder. Hepsini display list'e koymak Phaser'da 100 quad demektir — Phaser 3
 *    display list nesnelerini frustum'a gore KIRPMAZ (culling yalnizca
 *    TilemapLayer'da vardir), yani ekran disindaki 90+ karo da her kare
 *    gonderilirdi.
 *
 *    COZUM: KAYAN PENCERE HAVUZU. Yalnizca kameranin gorus dikdortgenini
 *    kaplayacak kadar Image tutulur (tipik 4–9, mobil zoom-out'ta ~12) ve
 *    kamera bir hucre sinirini gectiginde bunlar YENIDEN KONUMLANDIRILIR.
 *    AYNI ANDA bagli tutulmasi gereken farkli doku sayisi = gorunur karo
 *    sayisidir (10 varyantin hepsi ayni anda ekranda olamaz); tipik 4–9,
 *    yani WebGL'in garanti ettigi 8 doku birimi butcesinin icinde → zemin
 *    TEK draw call'da batch'lenir. Yalnizca asiri zoom-out'ta (~24 karo)
 *    farkli doku sayisi 10'a ulasabilir; 8 birimlik eski cihazlarda bu en
 *    fazla bir-iki ek batch flush demektir.
 *
 * 2) DETERMINIZM. Yerlesim her yenilemede AYNI olmalidir. Math.random() ile
 *    her sayfa yuklemesinde farkli bir harita cikardi.
 *
 *    COZUM: sabit tohumlu (LAYOUT_SEED) mulberry32 ile modul yuklenirken BIR KEZ
 *    uretilen 64x64'luk Uint8Array yerlesim tablosu. Hucre -> doku eslemesi
 *    `layout[(row mod 64) * 64 + (col mod 64)]` ile O(1) okunur; tablo torus
 *    gibi sarildigi icin dunya boyutundan bagimsizdir ve negatif koordinatlarda
 *    (kamera harita disina cikabiliyor, bkz. Game.onStartGame -> removeBounds)
 *    da calisir.
 *
 * 3) TEKRAR HISSI. Saf hash, 1/10 ihtimalle ayni dokuyu yan yana koyar ve goz
 *    bunu hemen "kopyala-yapistir" olarak okur.
 *
 *    COZUM: tablo uretilirken her hucre BATI ve KUZEY komsusuyla karsilastirilir;
 *    catisma varsa indeks deterministik olarak kaydirilir. Maliyet: uretimde
 *    4096 karsilastirma, calisma aninda SIFIR.
 *
 * 4) DIKIS (seam). Komsu quad'lar tam 2048 px arayla dursa bile, tam sayi
 *    olmayan kamera scroll/zoom degerlerinde vertex yuvarlamasi tek piksellik
 *    sac teli bosluklar birakabilir.
 *
 *    COZUM: her karo TILE_OVERLAP_PX kadar buyuk cizilir (%0.05 esneme —
 *    gozle gorulmez, ama bosluk yapisal olarak imkansiz hale gelir).
 *
 * ── KARE BASINA MALIYET ─────────────────────────────────────────────────────
 * update() once dort tam sayi (gorunur hucre araligi) hesaplar ve arali
 * degismediyse ANINDA doner. Kamera bir hucre sinirini gectiginde (2048 px'de
 * bir) havuz yeniden konumlandirilir. Hicbir yolda tahsis (allocation) yoktur.
 */

/** Kaynak karo kenari (px). Dosyalar 2048x2048 — POT oldugu icin mipmap alir. */
export const TERRAIN_TILE_SIZE = 2048;

/**
 * Karolarin kenar rengi (orneklenmis ortalama: #0d829c).
 *
 * <p>Kamera sinirsizdir (removeBounds) ve zemin karolari alt-piksel duzeyinde
 * kameranin her yerini kaplamayabilir. Kameranin zemin rengi bu tonda olursa
 * hem harita disi bosluk hem de olasi sac teli bosluklar gorunmez kalir.
 */
export const TERRAIN_BASE_COLOR = 0x0d829c;

/**
 * Varyant kimlikleri = dosya adlari (uzantisiz). YENI ZEMIN EKLEMEK icin tek
 * dokunulacak yer burasidir: listeye bir id eklemek preload'i, doku
 * anahtarlarini ve yerlesim tablosunun varyant sayisini birlikte gunceller.
 *
 * <p>Sira ANLAMLIDIR: yerlesim tablosu indeks -> anahtar eslemesi uzerinden
 * calisir, yani listeyi yeniden siralamak haritanin gorunumunu degistirir
 * (determinizmi bozmaz, ama farkli bir harita uretir). Yeni varyantlar SONA
 * eklenmelidir.
 */
const SOURCE_IDS = Object.freeze([
    '1', '2', '3', '4', '5', '6', '7', '8',
    '1x4', '2x4',
]);

/** Yuklenmis doku anahtarlari — 1.png -> 'terrain_1', 1x4.png -> 'terrain_1x4'. */
export const TERRAIN_TEXTURE_KEYS = Object.freeze(
    SOURCE_IDS.map(id => `terrain_${id}`)
);

/** Kaynak dosyalar public/assets/terrain/ altinda; Vite bunlari aynen kopyalar. */
const SOURCE_PATHS = Object.freeze(
    SOURCE_IDS.map(id => `assets/terrain/${id}.png`)
);

/**
 * Yerlesim tohumu. DEGISTIRILIRSE tum haritanin gorunumu degisir — ama yine
 * her yenilemede AYNI kalir. Rastgelelik yalnizca burada, bir kez tuketilir.
 */
const LAYOUT_SEED = 0x5eed7e44;

/**
 * Yerlesim tablosunun kenari (hucre). Tablo torus gibi sarilir, yani desen
 * 64 * 2048 = 131072 px'de bir tekrar eder — 20000 px'lik dunyanin ~6 kati,
 * pratikte hic tekrar gorunmez.
 */
const LAYOUT_PERIOD = 64;

/** Zemin her seyin ALTINDA: yem/yilan depth >= 0, sinir cemberi 500. */
const TERRAIN_DEPTH = -1000;

/**
 * Gorus dikdortgenine eklenen emniyet payi (px).
 *
 * <p>Scene.update() kamera preRender'INDAN once calisir, yani okudugumuz
 * worldView bir kare bayattir. Hizli hareket eden kamerada bu, karo sinirini
 * gectigimiz karede sag/alt kenarda bir karelik bosluk demek olurdu. Pay,
 * kameranin bir karede alabilecegi mesafeden fazladir.
 */
const VIEW_MARGIN_PX = 512;

/** Komsu quad'lar arasinda sac teli bosluk kalmamasi icin cakisma (px). */
const TILE_OVERLAP_PX = 1;

/**
 * Phaser Scene.preload() icinden cagrilir — 10 zemin dokusunu kuyruga alir.
 *
 * <p>Dokular POT oldugundan Phaser, game config'teki
 * `render.mipmapFilter: 'LINEAR_MIPMAP_LINEAR'` degerini bunlara UYGULAR
 * (bkz. src/game/main.js). Kamera uzaklastiginda (mobil baseZoom ~0.45, buyuyen
 * yilanda daha da dusuk) 2048'lik dokular mip zincirinden orneklenir: hem
 * titreme/aliasing kaybolur hem de doku onbellegi rahatlar.
 *
 * <p>NOT: bu dokulara setFilter() CAGRILMAZ — cagrilirsa min filter LINEAR'a
 * duser ve mipmap devre disi kalir.
 */
export function preload(scene) {
    for (let i = 0; i < TERRAIN_TEXTURE_KEYS.length; i++) {
        scene.load.image(TERRAIN_TEXTURE_KEYS[i], SOURCE_PATHS[i]);
    }
}

/** Sabit tohumlu PRNG — yalnizca yerlesim tablosu uretiminde kullanilir. */
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** variantCount -> Uint8Array(LAYOUT_PERIOD^2). Modul omru boyunca tek uretim. */
const layoutCache = new Map();

/**
 * Deterministik yerlesim tablosunu uretir (ya da onbellekten dondurur).
 *
 * <p>Satir satir taranir; her hucrede BATI ve KUZEY komsusuyla ayni doku
 * secilirse indeks bir sonrakine kaydirilir. Tarama sirasi sabit oldugu icin
 * sonuc her calistirmada bit-bit aynidir.
 */
function buildLayout(variantCount) {
    const cached = layoutCache.get(variantCount);
    if (cached) return cached;

    const P = LAYOUT_PERIOD;
    const data = new Uint8Array(P * P);
    const rand = mulberry32(LAYOUT_SEED);

    for (let row = 0; row < P; row++) {
        for (let col = 0; col < P; col++) {
            const west = col > 0 ? data[row * P + col - 1] : -1;
            const north = row > 0 ? data[(row - 1) * P + col] : -1;

            let idx = Math.floor(rand() * variantCount);
            if (idx >= variantCount) idx = variantCount - 1; // rand() == 1 kenar durumu
            for (let guard = 0;
                guard < variantCount && (idx === west || idx === north);
                guard++) {
                idx = (idx + 1) % variantCount;
            }

            data[row * P + col] = idx;
        }
    }

    layoutCache.set(variantCount, data);
    return data;
}

/** Hucre -> doku varyant indeksi. Negatif koordinatlarda da dogru sarar. */
function variantAt(layout, col, row) {
    const P = LAYOUT_PERIOD;
    const c = ((col % P) + P) % P;
    const r = ((row % P) + P) % P;
    return layout[r * P + c];
}

/**
 * Kayan pencere zemin cizici.
 *
 * @param {Phaser.Scene} scene
 * @param {object}   [options]
 * @param {number}   [options.worldSize]   Dunya kenari (px) = worldRadius * 2.
 *                                         Yalnizca clipToWorldBounds ile anlamli.
 * @param {boolean}  [options.clipToWorldBounds=false]
 *        false (varsayilan): zemin harita disinda da desenle devam eder — kamera
 *        sinirsiz oldugu icin (removeBounds) kenarda duz renkli bosluk olusmaz.
 *        true: karolar [0, worldSize] karesiyle kirpilir, disarisi zemin rengi
 *        kalir (haritanin kenari gorsel olarak isaretlenir).
 * @param {number}   [options.depth=-1000]
 * @param {Phaser.Cameras.Scene2D.Camera} [options.camera]
 * @param {(obj: Phaser.GameObjects.GameObject) => void} [options.register]
 *        Yeni olusturulan her karo icin cagrilir — sahnenin kamera yonlendirmesi
 *        (registerWorld: HUD kamerasi bu nesneyi yok saysin) buradan baglanir.
 */
export class TerrainRenderer {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.camera = options.camera ?? scene.cameras.main;
        this.depth = Number.isFinite(options.depth) ? options.depth : TERRAIN_DEPTH;
        this.clipToWorldBounds = options.clipToWorldBounds === true;
        this.worldSize = Number.isFinite(options.worldSize) && options.worldSize > 0
            ? options.worldSize
            : 0;
        this.register = typeof options.register === 'function' ? options.register : null;

        // Eksik doku oyunu ACMAYA ENGEL OLMAMALI: yuklenemeyen dosyalar
        // listeden duser, kalanlarla desen uretilir. Hicbiri yoksa zemin hic
        // cizilmez ve kameranin zemin rengi (TERRAIN_BASE_COLOR) gorunur.
        this.keys = TERRAIN_TEXTURE_KEYS.filter(key => scene.textures.exists(key));
        this.ready = this.keys.length > 0;
        this.layout = this.ready ? buildLayout(this.keys.length) : null;

        /** @type {Phaser.GameObjects.Image[]} yeniden kullanilan karo havuzu */
        this.tiles = [];
        /** Su an gorunur karo sayisi = zeminin quad maliyeti. */
        this.activeCount = 0;

        // Bos aralik (min > max) — ilk update() mutlaka yeniden yerlestirir.
        this._range = { minCol: 1, maxCol: 0, minRow: 1, maxRow: 0 };

        if (!this.ready) {
            console.warn('[Terrain] hicbir zemin dokusu yuklenemedi; '
                + 'duz zemin rengine geri dusuluyor.');
            return;
        }

        if (this.keys.length < TERRAIN_TEXTURE_KEYS.length) {
            console.warn(`[Terrain] ${this.keys.length}/${TERRAIN_TEXTURE_KEYS.length} `
                + 'doku yuklendi; desen kalanlarla uretiliyor.');
        }

        this.update();
    }

    /** Dunya boyutu sunucudan sonradan gelirse (StartInformation) guncellenir. */
    setWorldSize(worldSize) {
        const next = Number.isFinite(worldSize) && worldSize > 0 ? worldSize : 0;
        if (next === this.worldSize) return;
        this.worldSize = next;
        this.refresh();
    }

    /** Onbellege alinmis araligi gecersiz kilar (resize / zoom sicramasi sonrasi). */
    refresh() {
        this._range.minCol = 1;
        this._range.maxCol = 0;
        this._range.minRow = 1;
        this._range.maxRow = 0;
        this.update();
    }

    /**
     * Scene.update() icinden her kare cagrilir.
     *
     * <p>Sicak yol: dort Math.floor + dort karsilastirma, ardindan erken cikis.
     * Tahsis yok, doku degisimi yok, GC baskisi yok.
     */
    update() {
        if (!this.ready) return;

        const view = this.camera.worldView;
        if (!(view.width > 0) || !(view.height > 0)) return;

        const T = TERRAIN_TILE_SIZE;
        let minCol = Math.floor((view.x - VIEW_MARGIN_PX) / T);
        let maxCol = Math.floor((view.right + VIEW_MARGIN_PX) / T);
        let minRow = Math.floor((view.y - VIEW_MARGIN_PX) / T);
        let maxRow = Math.floor((view.bottom + VIEW_MARGIN_PX) / T);

        if (this.clipToWorldBounds && this.worldSize > 0) {
            const lastCell = Math.ceil(this.worldSize / T) - 1;
            minCol = Math.max(minCol, 0);
            minRow = Math.max(minRow, 0);
            maxCol = Math.min(maxCol, lastCell);
            maxRow = Math.min(maxRow, lastCell);
        }

        const range = this._range;
        if (minCol === range.minCol && maxCol === range.maxCol
            && minRow === range.minRow && maxRow === range.maxRow) {
            return;
        }

        range.minCol = minCol;
        range.maxCol = maxCol;
        range.minRow = minRow;
        range.maxRow = maxRow;
        this._reposition();
    }

    /** Havuzu gorunur hucre araligina yeniden dagitir. Yalnizca sinir gecisinde. */
    _reposition() {
        const { minCol, maxCol, minRow, maxRow } = this._range;
        const cols = maxCol - minCol + 1;
        const rows = maxRow - minRow + 1;

        if (cols <= 0 || rows <= 0) { // kamera tamamen harita disinda (clip modu)
            this._hideFrom(0);
            return;
        }

        this._ensurePool(cols * rows);

        const T = TERRAIN_TILE_SIZE;
        const size = T + TILE_OVERLAP_PX;
        let i = 0;

        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                const tile = this.tiles[i++];
                tile.setPosition(col * T, row * T);
                tile.setTexture(this.keys[variantAt(this.layout, col, row)]);
                tile.setDisplaySize(size, size);
                tile.setVisible(true);
            }
        }

        this.activeCount = i;
        this._hideFrom(i);
    }

    _hideFrom(index) {
        for (let i = index; i < this.tiles.length; i++) {
            this.tiles[i].setVisible(false);
        }
        if (index === 0) this.activeCount = 0;
    }

    /**
     * Havuzu buyutur. Yalnizca gorus alani DAHA ONCE gorulmemis kadar
     * genisledigin de calisir (ilk kare + ekran dondurme + yilan buyudukce
     * gelen zoom-out); birkac kareden sonra kalici olarak susar.
     */
    _ensurePool(needed) {
        for (let i = this.tiles.length; i < needed; i++) {
            const tile = this.scene.add.image(0, 0, this.keys[0])
                .setOrigin(0, 0)
                .setDepth(this.depth)
                .setVisible(false);
            this.register?.(tile);
            this.tiles.push(tile);
        }
    }

    destroy() {
        for (let i = 0; i < this.tiles.length; i++) this.tiles[i].destroy();
        this.tiles.length = 0;
        this.activeCount = 0;
        this.ready = false;
        this.layout = null;
        this.scene = null;
        this.camera = null;
    }
}
