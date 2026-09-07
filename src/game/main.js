import { Boot } from './scenes/Boot';
import { Game as MainGame } from './scenes/Game';
import { MainMenu } from './scenes/MainMenu';
import { Preloader } from './scenes/Preloader';
import Phaser, { Game } from 'phaser';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#fff',
  pixelArt: false,
  render: {
    resolution: window.devicePixelRatio || 1,
    antialias: true,
    antialiasGL: true,
    roundPixels: false,
    // 2048x2048 zemin karolari POWER-OF-TWO'dur ve Phaser mipmapFilter'i
    // YALNIZCA POT dokulara uygular (WebGLRenderer.createTextureFromSource).
    // Kamera uzaklastiginda (mobil baseZoom ~0.45, buyuyen yilanda daha da
    // dusuk) mip zinciri hem titremeyi/aliasing'i kaldirir hem de doku
    // onbellegi isabetini artirir. NPOT dokular (yem spritesheet'i, yilan
    // sprite'lari) bu ayardan etkilenmez; NEAREST isteyen px* dokulari kendi
    // setFilter cagrilariyla bunu zaten ezer (bkz. Preloader.create).
    mipmapFilter: 'LINEAR_MIPMAP_LINEAR',
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    // NO_CENTER is required with RESIZE: ScaleManager.updateCenter() runs in
    // every mode and, if the canvas is ever smaller than its parent (e.g. the
    // game booted while the mobile on-screen keyboard shrank the viewport),
    // CENTER_BOTH margins the undersized canvas into the middle of the screen
    // — producing the "small centered playable rectangle" input bug.
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  // 3 simultaneous touch points: one for the on-screen joystick, one for the
  // boost button, plus a spare. Required for the Phaser-GameObject mobile
  // controls (MobileControls.js) to track both at once.
  input: { activePointers: 3 },
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: [Boot, Preloader, MainMenu, MainGame]
};

const StartGame = (parent) => new Game({ ...config, parent });
export default StartGame;
