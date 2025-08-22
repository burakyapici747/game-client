export class Chain {
    constructor(origin, jointCount, linkSize) {
        this.linkSize = linkSize;
        this.joints = [];
        this.angles = [];

        this.joints.push(origin.clone());
        this.angles.push(0);

        for (let i = 1; i < jointCount; i++) {
            const prev = this.joints[i - 1];
            this.joints.push(new Phaser.Math.Vector2(prev.x, prev.y));
            this.angles.push(0);
        }
    }

    setHead(x, y) {
        this.joints[0].setTo(x, y);
    }

    resolve(iterations = 4) {
        for (let it = 0; it < iterations; it++) {
            for (let i = 1; i < this.joints.length; i++) {
                const prev = this.joints[i - 1];
                const cur = this.joints[i];

                let dx = cur.x - prev.x;
                let dy = cur.y - prev.y;
                let len = Math.hypot(dx, dy);

                if (len < 1e-6) {
                    dx = 1; dy = 0; len = 1;
                }

                const diff = (len - this.linkSize) / len;

                cur.x -= dx * diff;
                cur.y -= dy * diff;
            }
        }
    }

    debugDraw(graphics) {
        if (!graphics) return;
        graphics.lineStyle(2, 0x00ff00);
        for (let i = 0; i < this.joints.length; i++) {
            const joint = this.joints[i];
            graphics.fillStyle(i === 0 ? 0xff0000 : 0x00ff00, 1);
            graphics.fillCircle(joint.x, joint.y, 4);
            if (i > 0) {
                const prev = this.joints[i - 1];
                graphics.lineBetween(prev.x, prev.y, joint.x, joint.y);
            }
        }
    }
}
