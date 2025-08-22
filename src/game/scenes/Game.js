import { Scene } from 'phaser';
import { Snake } from './Snake.js';

export class Game extends Scene {
    constructor() {
        super('Game');
        this.snake = null;
        this.pointer = null;
        this.fpsText = null;
        this.grid = null;
    }

    create() {
        const WORLD_SIZE = 1500;
        const GRID_SIZE = 64;

        this.createGrid(GRID_SIZE);

        this.snake = new Snake(this, WORLD_SIZE / 2, WORLD_SIZE / 2);

        this.createCircularBoundary(WORLD_SIZE);

        const cam = this.cameras.main;
        cam.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
        //cam.startFollow(this.snake.getHead(), true, 1, 1);

        this.physics.world.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);

        const debugGraphics = this.add.graphics();
        this.snake.setDebugGraphics(debugGraphics);

        this.fpsText = this.add.text(16, 16, 'FPS: 0', {
            fontSize: '20px',
            fill: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 10, y: 5 }
        });
        this.fpsText.setScrollFactor(0);
        this.fpsText.setDepth(1000);

        this.input.keyboard.on('keydown-G', () => {
            this.snake.grow(5);
            console.log('Snake grew. Segments:', this.snake.sct);
        });
    }

    createGrid(gridSize) {
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        graphics.lineStyle(1, 0x000000, 0.2);
        graphics.fillStyle(0xffff, 1);
        graphics.fillRect(0, 0, gridSize, gridSize);
        graphics.strokeRect(0, 0, gridSize, gridSize);

        graphics.generateTexture('grid', gridSize, gridSize);
        graphics.destroy();

        this.grid = this.add.tileSprite(0, 0, this.cameras.main.width, this.cameras.main.height, 'grid');
        this.grid.setOrigin(0, 0);
        this.grid.setScrollFactor(0);
        this.grid.setDepth(-1);
    }

    createCircularBoundary(worldSize) {
        const center = worldSize / 2;
        const radius = worldSize / 2;

        const boundaryGroup = this.physics.add.staticGroup();
        const segments = 256;
        const segmentSize = 50;

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = center + Math.cos(angle) * radius;
            const y = center + Math.sin(angle) * radius;

            const wallSegment = boundaryGroup.create(x, y, null);
            wallSegment.setSize(segmentSize, segmentSize);
            wallSegment.setVisible(false);
        }

        this.physics.add.collider(this.snake.getHead(), boundaryGroup);

        const g = this.add.graphics();
        g.lineStyle(30, 0x000000, 0.3);
        g.strokeCircle(center, center, radius);
        g.setDepth(-1);
    }

    update(time, delta) {
        if (!this.snake) return;

        if (this.grid) {
            this.grid.tilePositionX = Math.round(this.cameras.main.scrollX);
            this.grid.tilePositionY = Math.round(this.cameras.main.scrollY);
        }

        this.pointer = this.input.activePointer;
        this.snake.setBoost(this.pointer.isDown);

        this.snake.update(this.pointer.x, this.pointer.y, this.cameras.main, delta);

        const fps = Math.round(1000 / delta);
        this.fpsText.setText(`FPS: ${fps}`);
    }
}
