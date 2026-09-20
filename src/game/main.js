import { Boot } from './scenes/Boot';
import { Game as MainGame } from './scenes/Game';
import { MainMenu } from './scenes/MainMenu';
import { Preloader } from './scenes/Preloader';
import Phaser, { Game } from 'phaser';
import { attachViewport, bootScaleConfig } from './render/Viewport';

const baseConfig = {
  type: Phaser.AUTO,
  backgroundColor: '#fff',
  pixelArt: false,
  render: {
    // NOT: `resolution` KASITLI OLARAK YOK. Phaser 3.90 bu anahtari okumaz
    // (core/Config.js'te karsiligi yoktur); DPR destegi render/Viewport.js'te
    // backing buffer = CSS boyutu × yogunluk olarak elle uygulanir.
    antialias: true,
    roundPixels: false,
    // 2048x2048 zemin karolari ve yilan dokulari POWER-OF-TWO'dur; Phaser
    // mipmapFilter'i YALNIZCA POT dokulara uygular
    // (WebGLRenderer.createTextureFromSource / canvasToTexture).
    // Kamera uzaklastiginda (mobil baseZoom ~0.45, buyuyen yilanda daha da
    // dusuk) mip zinciri hem titremeyi/aliasing'i kaldirir hem de doku
    // onbellegi isabetini artirir. POT olmayan dokular (yem spritesheet'i)
    // bu ayardan etkilenmez; NEAREST isteyen px* dokulari kendi setFilter
    // cagrilariyla bunu zaten ezer (bkz. Preloader.create).
    mipmapFilter: 'LINEAR_MIPMAP_LINEAR',
  },
  // Scale: Viewport.bootScaleConfig uretir (Scale.NONE + DPR'li buffer).
  // NO_CENTER: canvas her zaman parent'i tam kaplar; merkezleme marjlari
  // eskiden klavye kaynakli "kucuk ortalanmis oyun alani" hatasini uretiyordu.
  // 3 simultaneous touch points: one for the on-screen joystick, one for the
  // boost button, plus a spare. Required for the Phaser-GameObject mobile
  // controls (MobileControls.js) to track both at once.
  input: { activePointers: 3 },
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: [Boot, Preloader, MainMenu, MainGame]
};

const StartGame = (parent) => {
  const parentEl = typeof parent === 'string' ? document.getElementById(parent) : parent;
  const { density, scale } = bootScaleConfig(parentEl);

  const game = new Game({
    ...baseConfig,
    parent: parentEl,
    scale: { ...scale, autoCenter: Phaser.Scale.NO_CENTER },
    render: {
      ...baseConfig.render,
      // MSAA yalnizca poligon KENARLARINI yumusatir (doku orneklemesine etkisi
      // yok) ve bellegi ~4x katlar. Yogunluk >= 2'de kenar merdivenlenmesi
      // zaten fiziksel piksel altindadir → MSAA bos yere VRAM + fill harcar.
      // Baglam olusturma parametresidir: boot'ta bir kez belirlenir.
      antialiasGL: density < 2,
    },
  });

  // Tek resize sahibi: ResizeObserver + visualViewport + window resize +
  // orientationchange + DPR degisimi → rAF'ta birlestirilmis TEK senkron.
  const detachViewport = attachViewport(game, parentEl, density);
  game.events.once('destroy', detachViewport);

  return game;
};

export default StartGame;
