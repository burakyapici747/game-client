// Varlik manifestini URETIR: public/assets/manifest.json
//
// public/ dizininin TAMAMI ozyinelemeli taranir; dosyalar uzantisina ve
// konumuna gore gruplanir. Elle tutulan liste YOKTUR — public/ altina konan
// her dosya bir sonraki `npm run build-manifest` (dev/build oncesi otomatik)
// ile manifeste girer. Tuketiciler: src/assets/AssetPreloader.js (acilis
// ekrani) ve SnakeSkin.preloadKnown (Phaser).
//
// GRUPLAR
//   skins  : public/assets/snake/<assetId>/{1,2,3}.png tam seti -> sayisal id
//   images : png/jpg/jpeg/gif/webp/svg/avif (skin parcalari haric)
//   fonts  : ttf/otf/woff/woff2 -> {family, weight, url} (dosya adindan turetilir)
//   audio  : mp3/ogg/wav/m4a/aac/flac
//   other  : geri kalan her sey (json/css/txt/html/pb...) — listelenir, ON YUKLENMEZ
// Yollar tarayicinin gordugu bicimde KOK GORELI verilir: "/assets/...".
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, relative, extname, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const OUT = join(publicDir, 'assets', 'manifest.json');
const DEFAULT_SKIN_ID = 843309;   // sunucu game.default-guest-skin-id ile AYNI
const SKIN_DIR = ['assets', 'snake'];
const SKIN_PARTS = ['1.png', '2.png', '3.png'];

/** Manifestin kendisi ve tarayicinin zaten kendi basina aldigi/sistem dosyalari. */
const EXCLUDED_NAMES = new Set(['manifest.json', 'favicon.ico', 'favicon.png', '.DS_Store', 'Thumbs.db']);

const EXT_GROUPS = {
    images: new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif']),
    fonts: new Set(['.ttf', '.otf', '.woff', '.woff2']),
    audio: new Set(['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.flac']),
};

const FONT_WEIGHTS = {
    thin: '100', extralight: '200', ultralight: '200', light: '300', regular: '400', normal: '400',
    book: '400', medium: '500', semibold: '600', demibold: '600', bold: '700', extrabold: '800',
    ultrabold: '800', black: '900', heavy: '900',
};

function walk(dir, out = []) {
    for (const name of readdirSync(dir).sort()) {
        if (name.startsWith('.') || EXCLUDED_NAMES.has(name)) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

/** Kok goreli tarayici yolu: public/assets/x.png -> /assets/x.png */
const toUrl = (file) => '/' + relative(publicDir, file).split(sep).join('/');

/** "Baloo2-ExtraBold.ttf" -> { family: "Baloo 2", weight: "800" } */
function fontMeta(file) {
    const stem = basename(file, extname(file));
    const [rawFamily, ...rest] = stem.split(/[-_]/);
    const style = rest.join('').toLowerCase().replace(/italic|oblique/g, '');
    const weight = FONT_WEIGHTS[style] ?? '400';
    // "Baloo2" -> "Baloo 2", "OpenSans" -> "Open Sans"
    const family = rawFamily.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/(\d)([A-Za-z])/g, '$1 $2');
    return { family, weight, italic: /italic|oblique/i.test(rest.join('')), url: toUrl(file) };
}

const files = walk(publicDir);
const manifest = { version: 2, generatedAt: new Date().toISOString(), defaultSkinId: DEFAULT_SKIN_ID,
    skins: [], images: [], fonts: [], audio: [], other: [] };

// 1) Skin setleri: assets/snake/<id>/ altinda 1,2,3.png TAMAMI varsa skin.
const skinDirs = new Map();
for (const file of files) {
    const parts = relative(publicDir, file).split(sep);
    if (parts.length === 4 && parts[0] === SKIN_DIR[0] && parts[1] === SKIN_DIR[1] && /^\d+$/.test(parts[2])) {
        skinDirs.set(parts[2], (skinDirs.get(parts[2]) ?? new Set()).add(parts[3]));
    }
}
const skinPartFiles = new Set();
for (const [id, names] of skinDirs) {
    if (SKIN_PARTS.every((p) => names.has(p))) {
        manifest.skins.push(Number(id));
        for (const p of SKIN_PARTS) skinPartFiles.add(join(publicDir, ...SKIN_DIR, id, p));
    } else {
        console.warn(`uyari: assets/snake/${id} eksik parca (${SKIN_PARTS.filter((p) => !names.has(p)).join(', ')}) — skin sayilmadi`);
    }
}
manifest.skins.sort((a, b) => a - b);

// 2) Geri kalan dosyalar uzantiya gore.
for (const file of files) {
    if (skinPartFiles.has(file)) continue;
    const ext = extname(file).toLowerCase();
    if (EXT_GROUPS.images.has(ext)) manifest.images.push(toUrl(file));
    else if (EXT_GROUPS.fonts.has(ext)) manifest.fonts.push(fontMeta(file));
    else if (EXT_GROUPS.audio.has(ext)) manifest.audio.push(toUrl(file));
    else manifest.other.push(toUrl(file));
}

if (!manifest.skins.includes(DEFAULT_SKIN_ID)) {
    throw new Error(`Varsayilan skin dizini eksik: public/assets/snake/${DEFAULT_SKIN_ID}/{1,2,3}.png`);
}

manifest.counts = { skins: manifest.skins.length, images: manifest.images.length,
    fonts: manifest.fonts.length, audio: manifest.audio.length, other: manifest.other.length };
writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json: ${files.length} dosya tarandi ->`, manifest.counts);
