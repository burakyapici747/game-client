import Phaser from 'phaser';

export class Preloader extends Phaser.Scene {
  constructor() { super('Preloader'); }

  preload() {
  }

  create() {
    makeSolid(this, 'px8', 8, 8, 0xffffff);
    makeSolid(this, 'px32', 32, 32, 0xffffff);
    makeSolid(this, 'px64', 64, 64, 0xffffff);
    makeFoodOrb(this, 'food10', 10);

    makeCheckerScaled(this, 'grid32', 32, 0x2a2a2a, 0x242424, 4);

    const bodyRows48 = buildDiskRows({
      size: 48,
      outlineThickness: 1,
      outlineChar: '1',
      fillChar: '2'
    });
    const headRows48 = buildHeadRows48();
    const palette = { '1': 0x000000, '2': 0xffffff, '3': 0xe7e7e7 };

    makePixelArtSized(this, 'snake_body48', bodyRows48, palette);
    makePixelArtSized(this, 'snake_head48', headRows48, palette);

    makeEye10(this, 'eye10');
    makePupil4(this, 'pupil4');

    ['px8','px32','px64','food10','grid32','snake_body48','snake_head48','eye10','pupil4'].forEach(k => {
      this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    });

    this.scene.start('Game');
  }
}

function makeFoodOrb(scene, key, size = 10) {
  const radius = size / 2;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  g.fillStyle(0xffbe55, 1);
  g.fillCircle(radius, radius, radius - 0.5);
  g.fillStyle(0xffefb8, 0.9);
  g.fillCircle(radius - 1.5, radius - 1.5, Math.max(1, radius * 0.35));
  g.lineStyle(1, 0x8b5a00, 0.85);
  g.strokeCircle(radius, radius, radius - 0.75);

  g.generateTexture(key, size, size);
  g.destroy();
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

function makePixelArtSized(scene, key, rows, palette) {
  const w = rows[0].length;
  const h = rows.length;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();

  for (let y = 0; y < h; y++) {
    const line = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = line[x];
      const c = palette[ch];
      if (c === undefined) continue; // '.' -> boş
      ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  tex.refresh();
}

function buildDiskRows({ size, outlineThickness = 3, outlineChar = '1', fillChar = '2' }) {
  const rows = [];
  const cx = (size - 1) / 2, cy = (size - 1) / 2;
  const radius = size / 2 - 1;

  for (let y = 0; y < size; y++) {
    let s = '';
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= radius) s += (d >= radius - outlineThickness) ? outlineChar : fillChar;
      else s += '.';
    }
    rows.push(s);
  }
  return rows;
}

function buildHeadRows48() {
  const size = 48;
  const rows = buildDiskRows({ size, outlineThickness: 1, outlineChar: '1', fillChar: '2' });

  const cx = (size - 1) / 2, cy = (size - 1) / 2;
  const spotRadius = 8, spotOffsetX = -12, spotOffsetY = -10;

  for (let y = 0; y < size; y++) {
    const line = rows[y].split('');
    for (let x = 0; x < size; x++) {
      if (line[x] !== '2') continue;
      const d = Math.hypot(x - (cx + spotOffsetX), y - (cy + spotOffsetY));
      if (d <= spotRadius) line[x] = '3';
    }
    rows[y] = line.join('');
  }
  return rows;
}

function makeEye10(scene, key) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0xffffff, 1);
  g.fillCircle(8, 8, 8);
  g.lineStyle(1, 0x000000, 1);
  g.strokeCircle(8, 8, 8);
  g.generateTexture(key, 16, 16);
  g.destroy();
}

function makePupil4(scene, key) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x000000, 1);
  g.fillCircle(3, 3, 3);
  g.generateTexture(key, 8, 8);
  g.destroy();
}
