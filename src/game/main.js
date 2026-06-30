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
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: [Boot, Preloader, MainMenu, MainGame]
};

const StartGame = (parent) => new Game({ ...config, parent });
export default StartGame;
