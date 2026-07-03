import { Boot } from './scenes/Boot';
import { Game as MainGame } from './scenes/Game';
import { MainMenu } from './scenes/MainMenu';
import { Preloader } from './scenes/Preloader';
import Phaser, { Game } from 'phaser';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#202020',
  pixelArt: false,
  render: { antialias: true, roundPixels: false, mipmapFilter: 'NEAREST' },
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
