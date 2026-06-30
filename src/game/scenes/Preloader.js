import Phaser from 'phaser';

export class Preloader extends Phaser.Scene {
  constructor() { super('Preloader'); }

  preload() {
  }

  create() {
    makeSolid(this, 'px8', 8, 8, 0xffffff);
    makeSolid(this, 'px32', 32, 32, 0xffffff);
    makeSolid(this, 'px64', 64, 64, 0xffffff);

    makeCheckerScaled(this, 'grid32', 32, 0x2a2a2a, 0x242424, 4);

    generateCircleTexture(this, 'snake_body48', 48, 0xffffff, 0x111111, 2.0);
    generateCircleTexture(this, 'snake_head48', 48, 0xffffff, 0x111111, 2.0);
    generateCircleTexture(this, 'eye10', 16, 0xffffff, 0x000000, 1.5);
    generateCircleTexture(this, 'pupil4', 8, 0x000000);

    // Food glow dot spritesheet: 16 renk varyantı, her biri 16×16 px
    makeFoodDotSpritesheet(this, 'food_dot', 16);
    // Large food glow dot: 24×24 px
    makeFoodDotSpritesheet(this, 'food_dot_large', 24);

    // Set linear filtering for smooth scaled rendering
    ['snake_body48', 'snake_head48', 'eye10', 'pupil4'].forEach(k => {
      this.textures.get(k).setFilter(Phaser.Textures.FilterMode.LINEAR);
    });

    ['px8', 'px32', 'px64'].forEach(k => {
      this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    });

    // grid32 is rendered as a tileSprite and re-scaled every frame to match
    // camera zoom (see Game.js). NEAREST filtering on a minified, fractionally
    // scaled checker pattern produces moire/aliasing artifacts on mobile where
    // zoom is < 1. LINEAR filtering removes that distortion.
    this.textures.get('grid32').setFilter(Phaser.Textures.FilterMode.LINEAR);

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

function makeCheckerScaled(scene, key, baseSize, c1, c2, scale = 1) {
  const size = baseSize * scale;
  const cell = (baseSize / 2) * scale;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  g.fillStyle(c1, 1);
  g.fillRect(0, 0, size, size);

  g.fillStyle(c2, 1);
  g.fillRect(0, 0, cell, cell);
  g.fillRect(cell, cell, cell, cell);

  g.generateTexture(key, size, size);
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

// 16 renkli parlayan food dot spritesheet üretici.
// Her frame `size` × `size` piksel, tüm frame'ler yatay olarak dizilir.
// Blitter Bob'ları frame index ile hangi rengi göstereceklerini seçer.
function makeFoodDotSpritesheet(scene, key, size) {
  const FOOD_COLORS = [
    '#FF4444', '#FF8833', '#FFDD33', '#AAFF33',
    '#33FF66', '#33FFBB', '#33DDFF', '#3388FF',
    '#5533FF', '#AA33FF', '#FF33EE', '#FF3388',
    '#FFFF44', '#44FFAA', '#FF6644', '#DDDDFF'
  ];

  const frameCount = FOOD_COLORS.length;
  const totalWidth = size * frameCount;
  const tex = scene.textures.createCanvas(key, totalWidth, size);
  const ctx = tex.getContext();
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2 - 1;
  const midRadius = outerRadius * 0.55;
  const innerRadius = outerRadius * 0.25;

  for (let i = 0; i < frameCount; i++) {
    const offsetX = i * size;
    const color = FOOD_COLORS[i];

    // Parse hex color to RGB
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Dış glow (çok soluk)
    const gradOuter = ctx.createRadialGradient(
      offsetX + cx, cy, midRadius,
      offsetX + cx, cy, outerRadius
    );
    gradOuter.addColorStop(0, `rgba(${r},${g},${b},0.45)`);
    gradOuter.addColorStop(1, `rgba(${r},${g},${b},0.0)`);
    ctx.fillStyle = gradOuter;
    ctx.fillRect(offsetX, 0, size, size);

    // Orta glow
    const gradMid = ctx.createRadialGradient(
      offsetX + cx, cy, innerRadius,
      offsetX + cx, cy, midRadius
    );
    gradMid.addColorStop(0, `rgba(${r},${g},${b},0.9)`);
    gradMid.addColorStop(1, `rgba(${r},${g},${b},0.3)`);
    ctx.fillStyle = gradMid;
    ctx.beginPath();
    ctx.arc(offsetX + cx, cy, midRadius, 0, Math.PI * 2);
    ctx.fill();

    // Parlak merkez (beyaza yakın)
    const gradInner = ctx.createRadialGradient(
      offsetX + cx, cy, 0,
      offsetX + cx, cy, innerRadius
    );
    const brightR = Math.min(255, r + 100);
    const brightG = Math.min(255, g + 100);
    const brightB = Math.min(255, b + 100);
    gradInner.addColorStop(0, `rgba(${brightR},${brightG},${brightB},1.0)`);
    gradInner.addColorStop(1, `rgba(${r},${g},${b},0.85)`);
    ctx.fillStyle = gradInner;
    ctx.beginPath();
    ctx.arc(offsetX + cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  tex.refresh();

  // Phaser Spritesheet frame tanımlaması: her frame `size`×`size`
  for (let i = 0; i < frameCount; i++) {
    tex.add(i, 0, i * size, 0, size, size);
  }
}
