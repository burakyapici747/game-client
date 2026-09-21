import Phaser from 'phaser';
import * as SnakeSkin from '../render/SnakeSkin.js';
import * as Terrain from '../render/Terrain.js';
import * as SnakeBubbles from '../render/SnakeBubbles.js';
import * as FoodStyle from '../render/FoodStyle.js';
import { setConnectingStage } from '../../ui/overlays.js';

// Kameranin zemin rengi — TEK DOGRULUK KAYNAGI.
// Kamera artik harita sinirlarinin DISINA cikabildigi icin (bkz. Game.js →
// removeBounds) zeminin altinda kalan rengin, zemin karolarinin kenar
// tonuyla ayni olmasi sarttir: aksi halde karonun kaplayamadigi her
// alt-piksel bosluk motorun varsayilan gri zemini (#202020) olarak
// yanip sonerdi. Deger, terrain.png'nin kenar pikselleri orneklenerek
// bulunmustur (bkz. Terrain.TERRAIN_BASE_COLOR).
export const VOID_BACKGROUND_COLOR = Terrain.TERRAIN_BASE_COLOR;

// Minimap arka plan dokusu — Game.drawMinimap okur.
export const MINIMAP_TEXTURE_KEY = 'minimap_terrain';

export class Preloader extends Phaser.Scene {
  constructor() { super('Preloader'); }

  preload() {
    // Yilan sprite'lari (public/assets/snake/*.png). Yalnizca HAM dosyalar
    // kuyruga alinir; dondurme + olcek normalizasyonu dosyalar indikten sonra
    // create() icinde yapilir (bkz. SnakeSkin.build).
    SnakeSkin.preload(this);

    // Zemin: public/assets/terrain/terrain.png — tek, 2048x2048, kenarlari
    // sarilan desen. Dosya yolunun TEK sahibi render/Terrain.js'tir.
    Terrain.preload(this);

    // Yilan baloncuklari (16x16). Yuklenemezse efekt sessizce devre disi kalir
    // (bkz. SnakeBubbles) — kozmetik bir varlik oyunu durdurmamali.
    SnakeBubbles.preload(this);

    // Minimap zemini (255x256, dairesel cerceve + izgara). Yuklenemezse
    // Game.drawMinimap duz daire cizimine geri duser.
    this.load.image(MINIMAP_TEXTURE_KEY, 'assets/mini-map/mini_map_terrain.png');

    // Bir varlik yuklenemezse oyun ACILMAYA DEVAM ETMELI: eksik doku
    // SnakeSkin tarafindan daire dokusuna geri dusurulur. Bu dinleyici olmadan
    // Phaser sessizce bekler ve sahne hic baslamazdi.
    this.load.on('loaderror', (file) => {
      console.warn('[Preloader] varlik yuklenemedi:', file?.src ?? file?.key);
    });

    // Bağlanma ekranının "Loading game assets…" aşaması — gerçek yükleme oranı.
    this.load.on('progress', (value) => setConnectingStage('assets', value));
  }

  create() {
    makeSolid(this, 'px8', 8, 8, 0xffffff);
    makeSolid(this, 'px32', 32, 32, 0xffffff);
    makeSolid(this, 'px64', 64, 64, 0xffffff);

    generateCircleTexture(this, 'snake_body48', 48, 0xffffff, 0x111111, 2.0);
    generateCircleTexture(this, 'snake_head48', 48, 0xffffff, 0x111111, 2.0);
    generateCircleTexture(this, 'eye10', 16, 0xffffff, 0x000000, 1.5);
    generateCircleTexture(this, 'pupil4', 8, 0x000000);

    // Yem görseli: CANLI MAVİ (#0691D6) gövde + biyolüminesan hale (iki doku,
    // iki katman — bkz. render/FoodStyle.js). Eski tek 'food_glow' dokusu
    // additive harmanla çiziliyordu ve bir gövde rengini KORUYAMAZDI.
    FoodStyle.buildTextures(this);

    // Yilan sprite dokularini hazirla: 90° dondur (sanat yukari bakiyor,
    // Phaser rotation=0 saga bakar) + carpisma kesitini 48 px'e normalize et.
    // Basarisiz olursa false doner ve yukaridaki daire dokulari kullanilir.
    SnakeSkin.build(this);

    // Set linear filtering for smooth scaled rendering
    ['snake_body48', 'snake_head48', 'eye10', 'pupil4'].forEach(k => {
      this.textures.get(k).setFilter(Phaser.Textures.FilterMode.LINEAR);
    });

    ['px8', 'px32', 'px64'].forEach(k => {
      this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    });

    // NOT: zemin dokusuna ('terrain') BILEREK setFilter() cagrilmaz.
    // 2048x2048 POT oldugu icin Phaser ona game config'teki
    // mipmapFilter'i uygular; setFilter min filter'i LINEAR'a dusurup mipmap
    // zincirini devre disi birakirdi (bkz. render/Terrain.js → preload).

    this.scene.start('Game');
  }
}


function makeSolid(scene, key, w, h, color) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(color, 1);
  g.fillRect(0, 0, w, h);
  g.generateTexture(key, w, h);
  g.destroy();
}

function generateCircleTexture(scene, key, size, fillColor, strokeColor = null, strokeThickness = 0) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(fillColor, 1);
  const radius = size / 2;
  if (strokeColor !== null && strokeThickness > 0) {
    g.fillCircle(radius, radius, radius - strokeThickness);
    g.lineStyle(strokeThickness, strokeColor, 1);
    g.strokeCircle(radius, radius, radius - strokeThickness / 2);
  } else {
    g.fillCircle(radius, radius, radius);
  }
  g.generateTexture(key, size, size);
  g.destroy();
}
