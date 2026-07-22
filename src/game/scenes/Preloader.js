import Phaser from 'phaser';

export class Preloader extends Phaser.Scene {
  constructor() { super('Preloader'); }

  preload() {
  }

  create() {
    makeSolid(this, 'px8', 8, 8, 0xffffff);
    makeSolid(this, 'px32', 32, 32, 0xffffff);
    makeSolid(this, 'px64', 64, 64, 0xffffff);

    makeNeonSquareGrid(this, 'grid32', 256);

    generateCircleTexture(this, 'snake_body48', 48, 0xffffff, 0x111111, 2.0);
    generateCircleTexture(this, 'snake_head48', 48, 0xffffff, 0x111111, 2.0);
    generateCircleTexture(this, 'eye10', 16, 0xffffff, 0x000000, 1.5);
    generateCircleTexture(this, 'pupil4', 8, 0x000000);

    // Yem şekilleri: harita okunabilirliği + görsel çeşitlilik için 4 temel
    // parlayan (shimmer) şekil. SENKRON SÖZLEŞMESİ: sıra/id sunucu
    // FoodShape.java ile BİREBİR aynı olmalı: 0=CIRCLE, 1=SQUARE,
    // 2=TRIANGLE, 3=PENTAGON (bkz. Game.js FOOD_SHAPE_TEXTURES).
    makeShimmerSpritesheet(this, 'food_circle', 18, 'circle');
    makeShimmerSpritesheet(this, 'food_square', 18, 'square');
    makeShimmerSpritesheet(this, 'food_triangle', 18, 'triangle');
    makeShimmerSpritesheet(this, 'food_pentagon', 18, 'pentagon');
    // Ölüm sonrası ödül yemi (shape=4/DEATH_DROP): her zaman büyük, altın
    // parıltılı bir beşgen — rakip oyunculara yüksek değerli bir rekabet
    // bölgesi olduğunu görsel olarak sinyaller.
    makeDeathDropSpritesheet(this, 'food_death_drop', 30);

    // Set linear filtering for smooth scaled rendering
    ['snake_body48', 'snake_head48', 'eye10', 'pupil4'].forEach(k => {
      this.textures.get(k).setFilter(Phaser.Textures.FilterMode.LINEAR);
    });

    ['px8', 'px32', 'px64'].forEach(k => {
      this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    });

    // grid32 is rendered as a tileSprite and re-scaled every frame to match
    // camera zoom (see Game.js). LINEAR filtering removes scaling artifacts
    // on mobile devices where zoom is < 1.
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

function makeNeonSquareGrid(scene, key, size) {
  const squareLineColor = 0xc2cad5;
  const backgroundColor = 0x1a063b;
  const gridCellSize = 64; // 256x256 pixel squares
  const strokeWidth = 1; // Thin lines
  const lineOpacity = 0.2; // 40% opacity for rgba(194, 202, 173, 0.4)

  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // Dark background
  g.fillStyle(backgroundColor, 1);
  g.fillRect(0, 0, size, size);

  // Purple grid lines with rgba opacity
  g.lineStyle(strokeWidth, squareLineColor, lineOpacity);

  // Vertical lines
  for (let x = 0; x <= size; x += gridCellSize) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, size);
    g.strokePath();
  }

  // Horizontal lines
  for (let y = 0; y <= size; y += gridCellSize) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(size, y);
    g.strokePath();
  }

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

// Duzgun poligon yolu ciz (kare/ucgen/besgen). `sides` yoksa (circle) cagiran
// taraf ctx.arc kullanir. rotationDeg, koseleri istenen yone hizalar
// (ör. ucgen/besgen "yukari bakan" gorunsun diye -90).
function tracePolygon(ctx, cx, cy, radius, sides, rotationDeg) {
  const rotationRad = (rotationDeg * Math.PI) / 180;
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = rotationRad + (i / sides) * Math.PI * 2;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

const SHAPE_SIDES = { square: 4, triangle: 3, pentagon: 5 };
const SHAPE_ROTATION_DEG = { square: 45, triangle: -90, pentagon: -90 };

function fillShapeAt(ctx, shapeName, cx, cy, radius) {
  const sides = SHAPE_SIDES[shapeName];
  if (sides) {
    tracePolygon(ctx, cx, cy, radius, sides, SHAPE_ROTATION_DEG[shapeName] ?? 0);
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  }
  ctx.fill();
}

// 16 renkli parlayan (shimmer) yem spritesheet üretici — şekil parametrik.
// Her frame `size` × `size` piksel, tüm frame'ler yatay olarak dizilir.
// Blitter Bob'ları frame index ile hangi rengi göstereceklerini seçer.
function makeShimmerSpritesheet(scene, key, size, shapeName) {
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

    // Dış glow (çok soluk, şekilden bağımsız yumuşak yayılma)
    const gradOuter = ctx.createRadialGradient(
      offsetX + cx, cy, midRadius,
      offsetX + cx, cy, outerRadius
    );
    gradOuter.addColorStop(0, `rgba(${r},${g},${b},0.45)`);
    gradOuter.addColorStop(1, `rgba(${r},${g},${b},0.0)`);
    ctx.fillStyle = gradOuter;
    ctx.fillRect(offsetX, 0, size, size);

    // Orta glow — şekil silueti burada belirir
    const gradMid = ctx.createRadialGradient(
      offsetX + cx, cy, innerRadius,
      offsetX + cx, cy, midRadius
    );
    gradMid.addColorStop(0, `rgba(${r},${g},${b},0.9)`);
    gradMid.addColorStop(1, `rgba(${r},${g},${b},0.3)`);
    ctx.fillStyle = gradMid;
    fillShapeAt(ctx, shapeName, offsetX + cx, cy, midRadius);

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
    fillShapeAt(ctx, shapeName, offsetX + cx, cy, innerRadius);
  }

  tex.refresh();

  // Phaser Spritesheet frame tanımlaması: her frame `size`×`size`
  for (let i = 0; i < frameCount; i++) {
    tex.add(i, 0, i * size, 0, size, size);
  }
}

// Ölüm sonrası ödül yemi: tek kare, sabit altın/amber parıltılı beşgen —
// renk varyantı gerekmez, tek görev haritada "yüksek değerli bölge" sinyali.
function makeDeathDropSpritesheet(scene, key, size) {
  const tex = scene.textures.createCanvas(key, size, size);
  const ctx = tex.getContext();
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2 - 1;
  const midRadius = outerRadius * 0.6;
  const innerRadius = outerRadius * 0.3;
  const r = 255, g = 200, b = 60; // altın/amber

  const gradOuter = ctx.createRadialGradient(cx, cy, midRadius, cx, cy, outerRadius);
  gradOuter.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
  gradOuter.addColorStop(1, `rgba(${r},${g},${b},0.0)`);
  ctx.fillStyle = gradOuter;
  ctx.fillRect(0, 0, size, size);

  const gradMid = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, midRadius);
  gradMid.addColorStop(0, `rgba(${r},${g},${b},0.95)`);
  gradMid.addColorStop(1, `rgba(${r},${g},${b},0.35)`);
  ctx.fillStyle = gradMid;
  fillShapeAt(ctx, 'pentagon', cx, cy, midRadius);

  const gradInner = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerRadius);
  gradInner.addColorStop(0, 'rgba(255,255,220,1.0)');
  gradInner.addColorStop(1, `rgba(${r},${g},${b},0.9)`);
  ctx.fillStyle = gradInner;
  fillShapeAt(ctx, 'pentagon', cx, cy, innerRadius);

  tex.refresh();
  tex.add(0, 0, 0, 0, size, size);
}
