/**
 * TERRAIN — statik zemin dokusunun TEK sahiplik noktasi.
 *
 * Sanat varligi: public/assets/terrain/terrain.png — TEK, 2048x2048, POT,
 * tamamen opak ve KENARLARI SARILAN (seamless) bir desen. Sag kenar sol
 * kenara, alt kenar ust kenara piksel duzeyinde oturur (olculen ortalama kenar
 * farki ~1/255, ic komsu sutunlarla ayni mertebede), yani ayni doku yan yana
 * dizildiginde gorunur dikis olusmaz.
 *
 * <p>Onceki surum 10 ayri 2048'lik varyanti (1..8.png, 1x4.png, 2x4.png) sabit
 * tohumlu bir yerlesim tablosuyla karistiriyordu. Tek sarilan desenle o
 * mekanizmanin (PRNG, 64x64 tablo, komsu catisma kontrolu) cozdugu "tekrar
 * hissi" problemi artik dokunun kendisinde cozulu; kaldirildi.
 *
 * ── COZULEN UC PROBLEM ──────────────────────────────────────────────────────
 *
 * 1) DRAW CALL. Dunya 20000x20000 px; 2048'lik hucrelerle ~10x10 = 100 karo
 *    eder. Phaser 3 display list nesnelerini frustum'a gore KIRPMAZ (culling
 *    yalnizca TilemapLayer'da vardir), yani hepsini sahneye koymak ekran
 *    disindaki 90+ quad'i da her kare gondermek olurdu.
 *
 *    COZUM: KAYAN PENCERE HAVUZU. Yalnizca kameranin gorus dikdortgenini
 *    kaplayacak kadar Image tutulur (tipik 4–9, mobil zoom-out'ta ~12) ve
 *    kamera bir hucre sinirini gectiginde bunlar YENIDEN KONUMLANDIRILIR.
 *    Hepsi AYNI dokuyu kullandigi icin zemin her zoom seviyesinde TEK draw
 *    call'dur.
 *
 * 2) BELLEK. 2048x2048 RGBA = 16 MB, mip zinciriyle ~21 MB GPU bellegi. Eski
 *    10 varyant ~213 MB tutuyordu; dusuk bellekli mobil GPU'larda doku
 *    tahliyesi ve kaydirma sirasinda takilma riski buradan geliyordu. 2048,
 *    WebGL cihazlarinin pratikte tamaminin MAX_TEXTURE_SIZE sinirinin (>= 4096)
 *    altindadir.
 *
 * 3) DIKIS (seam). Komsu quad'lar tam 2048 px arayla dursa bile, tam sayi
 *    olmayan kamera scroll/zoom degerlerinde vertex yuvarlamasi tek piksellik
 *    sac teli bosluklar birakabilir.
 *
 *    COZUM: her karo TILE_OVERLAP_PX kadar buyuk cizilir (%0.05 esneme —
 *    gozle gorulmez, ama bosluk yapisal olarak imkansiz hale gelir). Kalan
 *    alt-piksel kenarlar kameranin zemin rengine (TERRAIN_BASE_COLOR) duser,
 *    o da dokunun kenar tonudur.
 *
 * ── KARE BASINA MALIYET ─────────────────────────────────────────────────────
 * update() once dort tam sayi (gorunur hucre araligi) hesaplar ve aralik
 * degismediyse ANINDA doner. Kamera bir hucre sinirini gectiginde (2048 px'de
 * bir) havuz yeniden konumlandirilir. Hicbir yolda tahsis (allocation) ya da
 * doku degisimi yoktur.
 */

/**
 * Hucre kenari — DUNYA pikseli cinsinden. Doku 1:1 cizilir: 1 doku pikseli =
 * 1 dunya pikseli. Dosya 2048x2048 — POT oldugu icin mipmap alir.
 */
export const TERRAIN_TILE_SIZE = 2048;

/**
 * Dokunun kenar rengi (terrain.png'nin dort kenar piksel satirinin
 * ortalamasi: #bdebee; tum dokunun ortalamasi #bfebec).
 *
 * <p>Kamera sinirsizdir (removeBounds) ve zemin karolari alt-piksel duzeyinde
 * kameranin her yerini kaplamayabilir. Kameranin zemin rengi bu tonda olursa
 * hem harita disi bosluk hem de olasi sac teli bosluklar gorunmez kalir.
 * DOKU DEGISIRSE bu deger yeniden orneklenmelidir.
 */
export const TERRAIN_BASE_COLOR = 0xbdebee;

/** Yuklenmis doku anahtari. */
export const TERRAIN_TEXTURE_KEY = 'terrain';

/** Kaynak dosya public/assets/terrain/ altinda; Vite onu aynen kopyalar. */
const SOURCE_PATH = 'assets/terrain/terrain.png';

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
 * Phaser Scene.preload() icinden cagrilir — zemin dokusunu kuyruga alir.
 *
 * <p>Doku POT oldugundan Phaser, game config'teki
 * `render.mipmapFilter: 'LINEAR_MIPMAP_LINEAR'` degerini ona UYGULAR
 * (bkz. src/game/main.js). Kamera uzaklastiginda (mobil baseZoom ~0.45, buyuyen
 * yilanda daha da dusuk) doku mip zincirinden orneklenir: hem titreme/aliasing
 * kaybolur hem de her karede 2048'lik tam cozunurluk orneklenmez.
 *
 * <p>NOT: bu dokuya setFilter() CAGRILMAZ — cagrilirsa min filter LINEAR'a
 * duser ve mipmap devre disi kalir.
 */
export function preload(scene) {
    scene.load.image(TERRAIN_TEXTURE_KEY, SOURCE_PATH);
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

        // Eksik doku oyunu ACMAYA ENGEL OLMAMALI: dosya yuklenemediyse zemin
        // hic cizilmez ve kameranin zemin rengi (TERRAIN_BASE_COLOR) gorunur.
        this.ready = scene.textures.exists(TERRAIN_TEXTURE_KEY);

        /** @type {Phaser.GameObjects.Image[]} yeniden kullanilan karo havuzu */
        this.tiles = [];
        /** Su an gorunur karo sayisi = zeminin quad maliyeti. */
        this.activeCount = 0;

        // Bos aralik (min > max) — ilk update() mutlaka yeniden yerlestirir.
        this._range = { minCol: 1, maxCol: 0, minRow: 1, maxRow: 0 };

        if (!this.ready) {
            console.warn('[Terrain] zemin dokusu yuklenemedi; '
                + 'duz zemin rengine geri dusuluyor.');
            return;
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
        let i = 0;

        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                const tile = this.tiles[i++];
                tile.setPosition(col * T, row * T);
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
     * genislediginde calisir (ilk kare + ekran dondurme + yilan buyudukce
     * gelen zoom-out); birkac kareden sonra kalici olarak susar.
     *
     * <p>Doku ve boyut karo basina BIR KEZ, burada atanir — hepsi ayni dokuyu
     * kullandigi icin _reposition yalnizca konum ve gorunurluk degistirir.
     */
    _ensurePool(needed) {
        const size = TERRAIN_TILE_SIZE + TILE_OVERLAP_PX;
        for (let i = this.tiles.length; i < needed; i++) {
            const tile = this.scene.add.image(0, 0, TERRAIN_TEXTURE_KEY)
                .setOrigin(0, 0)
                .setDisplaySize(size, size)
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
        this.scene = null;
        this.camera = null;
    }
}
