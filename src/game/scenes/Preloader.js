import Phaser from 'phaser';

// Izgara dokusunun zemin rengi — TEK DOGRULUK KAYNAGI.
// Hem 'grid32' dokusunu üreten makeNeonSquareGrid hem de ana kameranın arka
// plan rengi (bkz. Game.js) bunu kullanır. Kamera artık harita sınırlarının
// DIŞINA çıkabildiği için ikisinin aynı renk olması şart: aksi halde harita
// kenarında, ızgara karosunun kaplamadığı her alt-piksel boşluk motorun
// varsayılan gri zemini (#202020) olarak yanıp sönerdi.
export const VOID_BACKGROUND_COLOR = 0x1a063b;

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

    // GÖREV 1+2: Tüm yemler artık TEK, parlayan DAİRE dokusu kullanır (polygon
    // şekiller kaldırıldı). 16 canlı renk varyantı, additive-blend'e uygun neon
    // radyal parıltı. Tek spritesheet → tek Blitter → tüm yemler tek draw call.
    makeGlowCircleSpritesheet(this, 'food_glow', 26);

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
  const backgroundColor = VOID_BACKGROUND_COLOR;
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

// GÖREV 1+2: 16 renkli PARLAYAN DAİRE spritesheet üretici (tek şekil = daire).
// Her frame `size`×`size` px; tüm frame'ler yatay dizilir. Blitter Bob'ları
// frame index ile renk seçer. Tek radyal geçiş (çekirdek → doygun renk →
// saydam hale) additive blend altında canlı neon parıltı verir; kenarlar
// tamamen saydam olduğundan çakışan yemler yıkanmaz (temiz katmanlama).
function makeGlowCircleSpritesheet(scene, key, size) {
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
  const cy = size / 2;
  const outerRadius = size / 2 - 1;

  for (let i = 0; i < frameCount; i++) {
    const offsetX = i * size;
    const cx = offsetX + size / 2;
    const color = FOOD_COLORS[i];

    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    // Beyaza yakın parlak çekirdek — daha canlı/göz alıcı görünüm.
    const brightR = Math.min(255, r + 130);
    const brightG = Math.min(255, g + 130);
    const brightB = Math.min(255, b + 130);

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerRadius);
    grad.addColorStop(0.00, `rgba(${brightR},${brightG},${brightB},1.0)`); // parlak çekirdek
    grad.addColorStop(0.35, `rgba(${r},${g},${b},0.95)`);                  // doygun renk disk
    grad.addColorStop(0.70, `rgba(${r},${g},${b},0.35)`);                  // yumuşak glow
    grad.addColorStop(1.00, `rgba(${r},${g},${b},0.0)`);                   // saydam kenar
    ctx.fillStyle = grad;
    ctx.fillRect(offsetX, 0, size, size);
  }

  tex.refresh();

  // Phaser Spritesheet frame tanımlaması: her frame `size`×`size`.
  for (let i = 0; i < frameCount; i++) {
    tex.add(i, 0, i * size, 0, size, size);
  }
}
