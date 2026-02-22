import { Boot } from './scenes/Boot';
import { Game as MainGame } from './scenes/Game';
import { MainMenu } from './scenes/MainMenu';
import { Preloader } from './scenes/Preloader';
import Phaser, { Game } from 'phaser';

const V_WIDTH = 1280;
const V_HEIGHT = 720;

const config = {
  type: Phaser.AUTO,
  width: V_WIDTH,
  height: V_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#202020',
  pixelArt: true,
  render: { antialias: false, roundPixels: true, mipmapFilter: 'NEAREST' },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: [Boot, Preloader, MainMenu, MainGame]
};

const StartGame = (parent) => new Game({ ...config, parent });
export default StartGame;
