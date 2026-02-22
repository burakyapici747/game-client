import Phaser from 'phaser';
import { Snake } from './Snake';
import { NetworkManager } from './../../network/NetWorkManager';

export class Game extends Phaser.Scene {
    constructor() {
        super('Game');
        this.snakes = new Map();
        // YENİ: Yiyecekleri takip etmek için yeni bir Map ekledik.
        this.foods = new Map();
        this.myId = null;
        this.networkManager = null;
        this.gameStarted = false;

        this.pointer = null;
        this.fpsText = null;
        this.grid = null;
    }

    create() {
        console.log("Game Scene: create()");

        this.networkManager = new NetworkManager(this);
        
        this.events.on('start_game', this.onStartGame, this);
        this.events.on('self_position', this.onSelfPosition, this);
        this.events.on('entity_collection', this.onEntityCollection, this);
        this.events.on('remove_entity', this.onRemoveEntity, this);
        this.events.on('disconnected', this.onDisconnected, this);

        this.networkManager.connect();

        this.cameras.main.setZoom(1).roundPixels = true;

        this.fpsText = this.add.text(4, 4, 'Sunucuya Bağlanılıyor...', {
            fontSize: '12px', fontFamily: 'monospace', color: '#ffffff',
            backgroundColor: '#00000088', padding: { left: 4, right: 4, top: 2, bottom: 2 }
        }).setScrollFactor(0).setDepth(1000);
    }

    onStartGame(startInfo) {
        console.log("Oyun başlıyor...", startInfo);
        const clientId = this.toId(startInfo?.clientId);
        if (clientId === null) {
            console.warn('Geçersiz clientId alındı:', startInfo);
            return;
        }

        this.gameStarted = true;
        this.myId = clientId;

        if (!this.grid) {
            this.createTiledBackground();
        }

        const startX = Number(startInfo?.x);
        const startY = Number(startInfo?.y);
        const startSegmentCount = Number(startInfo?.segmentCount ?? startInfo?.segment_count);
        this.ensurePlayerSnake(
            clientId,
            Number.isFinite(startX) ? startX : 0,
            Number.isFinite(startY) ? startY : 0,
            Number.isFinite(startSegmentCount) ? startSegmentCount : undefined
        );
    }

    onEntityCollection(entityCollection) {
        const entities = entityCollection?.entities ?? [];
        if (entities.length === 0) return;

        if (!this.gameStarted) {
            this.gameStarted = true;
            if (!this.grid) {
                this.createTiledBackground();
            }
        }

        entities.forEach((entity) => {
            const entityId = this.toId(entity.entityId ?? entity.clientId);
            if (entityId === null) return;
            const initialX = Number(entity.x);
            const initialY = Number(entity.y);

            if (this.myId !== null && entityId === this.myId) {
                this.ensurePlayerSnake(
                    entityId,
                    Number.isFinite(initialX) ? initialX : 0,
                    Number.isFinite(initialY) ? initialY : 0
                );
                return;
            }

            let snake = this.snakes.get(entityId);

            if (!snake) {
                snake = new Snake(
                    this,
                    false,
                    Number.isFinite(initialX) ? initialX : 0,
                    Number.isFinite(initialY) ? initialY : 0
                );
                this.snakes.set(entityId, snake);
            }

            snake.updateFromServerState(entity);
        });
    }

    onSelfPosition(selfPosition) {
        const entityId = this.toId(selfPosition?.entityId ?? selfPosition?.clientId);
        if (entityId === null) return;

        if (this.myId === null) {
            this.myId = entityId;
        }
        if (entityId !== this.myId) return;

        if (!this.gameStarted) {
            this.gameStarted = true;
            if (!this.grid) {
                this.createTiledBackground();
            }
        }

        const x = Number(selfPosition?.x);
        const y = Number(selfPosition?.y);
        const snake = this.ensurePlayerSnake(
            entityId,
            Number.isFinite(x) ? x : 0,
            Number.isFinite(y) ? y : 0
        );
        snake.updateSelfPositionFromServer(selfPosition);
    }

    onRemoveEntity(removeEntity) {
        const entityId = this.toId(removeEntity?.entityId ?? removeEntity?.clientId);
        if (entityId === null) return;

        const snake = this.snakes.get(entityId);
        if (!snake) return;

        snake.destroy();
        this.snakes.delete(entityId);

        if (entityId === this.myId) {
            this.gameStarted = false;
            this.myId = null;
        }
    }

    ensurePlayerSnake(entityId, x, y, segmentCount) {
        const existingSnake = this.snakes.get(entityId);
        if (existingSnake?.isPlayerControlled) {
            if (segmentCount !== undefined) {
                existingSnake.syncSegmentCountFromServer(segmentCount);
            }
            return existingSnake;
        }

        if (existingSnake) {
            existingSnake.destroy();
            this.snakes.delete(entityId);
        }

        const playerSnake = new Snake(this, true, x, y, segmentCount);
        this.snakes.set(entityId, playerSnake);
        this.cameras.main.startFollow(playerSnake.getHead(), true, 0.1, 0.1);
        return playerSnake;
    }

    toId(rawId) {
        if (rawId === undefined || rawId === null) return null;
        const value = Number(rawId);
        return Number.isFinite(value) ? value : null;
    }

    onGameOver(gameOverInfo) {
        console.log(`Oyun Bitti! Skor: ${gameOverInfo.score}, Öldüren: ${gameOverInfo.killedBy}`);
        this.gameStarted = false;
        // Burada bir "Oyun Bitti" ekranı gösterebilir veya ana menüye dönebilirsiniz.
        this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 
            `Oyun Bitti!\nSkor: ${gameOverInfo.score}`, 
            { fontSize: '32px', color: '#ff0000', backgroundColor: '#000' }
        ).setOrigin(0.5, 0.5).setScrollFactor(0);
    }

    onDisconnected() {
        console.log("Bağlantı koptu!");
        this.gameStarted = false;
         this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 
            `Sunucu bağlantısı koptu!`, 
            { fontSize: '24px', color: '#ffdd00', backgroundColor: '#000' }
        ).setOrigin(0.5, 0.5).setScrollFactor(0);
    }


    update(time, delta) {
        if (!this.gameStarted) return;
        
        const mySnake = this.myId !== null ? this.snakes.get(this.myId) : null;

        if (mySnake) {
            this.pointer = this.input.activePointer;
            const isBoosting = this.pointer.isDown;
            const head = mySnake.getHead();

            const worldPoint = this.cameras.main.getWorldPoint(this.pointer.x, this.pointer.y);
            const targetAngle = Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(head.x, head.y, worldPoint.x, worldPoint.y));

            this.networkManager.updateAndSendInput(targetAngle, isBoosting, delta);

            // İstemci tarafı tahminleme (Client-Side Prediction)
            mySnake.updateFromInput(targetAngle, isBoosting, delta);
        }

        this.snakes.forEach(snake => {
            if (snake.getHead() && snake.getHead().visible) {
                snake.postUpdate(delta);
            }
        });

        if (this.grid) {
            this.grid.tilePositionX = this.cameras.main.scrollX;
            this.grid.tilePositionY = this.cameras.main.scrollY;
        }
        const fps = this.game.loop.actualFps;
        this.fpsText.setText(`FPS: ${Math.round(fps)} | Yılanlar: ${this.snakes.size} | Yiyecekler: ${this.foods.size}`);
    }

    createTiledBackground() {
        this.grid = this.add.tileSprite(0, 0, this.cameras.main.width, this.cameras.main.height, 'grid32')
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(-1);
    }
}
