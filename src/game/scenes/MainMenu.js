import { Scene } from 'phaser';

export class MainMenu extends Scene
{
    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        // Skip MainMenu as we use HTML UI now
        this.scene.start('Game');
    }
}
