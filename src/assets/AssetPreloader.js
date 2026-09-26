// ─────────────────────────────────────────────────────────────────────────────
// ASSET PRELOADER — açılış ekranının (SplashScreen) yükleme motoru.
//
// Oyun DOM tabanlı bir ana menüyle açılır; Phaser yalnızca PLAY'de boot edilir
// (bkz. src/main.js). Bu yüzden "her şeyi Phaser this.load ile yükle" burada
// çalışmaz: menü çizilmeden önce Phaser yoktur. Bunun yerine tarayıcının kendi
// yükleyicileri kullanılır (Image.decode, FontFace, fetch): dosyalar HTTP
// önbelleğine ve font/görsel önbelleğine iner. PLAY'de Phaser'ın Preloader'ı
// aynı dosyaları ister ve anında önbellekten alır — görünür "pop-in" kalmaz.
//
// SÖZLEŞME
//   • Kaynak: public/assets/manifest.json (scripts/gen-asset-manifest.mjs
//     üretir; skin dizinleri taranır, elle liste yoktur).
//   • Her dosya bir "iş"tir; ilerleme = biten iş / toplam iş. HATA DA BİTİŞTİR:
//     yüklenemeyen dosya sayacı ilerletir, çubuk asla donmaz.
//   • Yüklenemeyen skin, SnakeSkin.markSkinUnavailable ile kaydedilir; oyun o
//     id'yi gördüğünde varsayılan skine (843309) düşer.
//   • Olaylar: onProgress({loaded,total,fraction,label}), onComplete(summary).
// ─────────────────────────────────────────────────────────────────────────────
import { DEFAULT_SKIN_ID, registerSkinManifest, markSkinUnavailable } from '../game/render/SnakeSkin.js';

export const MANIFEST_URL = '/assets/manifest.json';

/** Aynı anda kaç dosya indirilir (HTTP/1.1 tarayıcı sınırına yakın). */
const CONCURRENCY = 6;

/** Tek dosya için üst sınır: takılan bir istek çubuğu kilitlemesin. */
const FILE_TIMEOUT_MS = 10000;

const SKIN_PARTS = ['1.png', '2.png', '3.png'];

function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`zaman aşımı: ${label}`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // decode() BEKLENMEZ: piksel çözümlemesi arka planda tetiklenir (ilk
            // çizimde takılma azalır) ama sözü beklenmez. Chromium, sayfanın ilk
            // boyamasından ÖNCE çağrılan decode() sözlerini süresiz erteleyebiliyor;
            // açılışta ilk altı iş tam bu yüzden 15 sn "zaman aşımı" alıyordu.
            // Önbelleğe inen dosya için onload tek güvenilir bitiş sinyalidir.
            if (img.decode) img.decode().catch(() => {});
            resolve(img);
        };
        img.onerror = () => reject(new Error(`görsel yüklenemedi: ${url}`));
        img.src = url;
    });
}

async function loadFont({ family, weight, url }) {
    if (typeof FontFace === 'undefined' || !document.fonts) return;
    const face = new FontFace(family, `url(${url})`, { weight: String(weight) });
    await face.load();
    document.fonts.add(face);
}

async function loadAudio(url) {
    // Ses için tam çözümleme yerine önbelleğe indirme yeterli: oynatma anında
    // AudioContext/HTMLAudio dosyayı önbellekten alır.
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`ses yüklenemedi: ${url} (${res.status})`);
    await res.arrayBuffer();
}

/**
 * Manifesti okur; okunamazsa yalnızca varsayılan skini yükleyen asgari bir
 * manifest döner — açılış hiçbir koşulda kilitlenmez.
 */
export async function fetchManifest() {
    try {
        const res = await fetch(MANIFEST_URL, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
        const manifest = await res.json();
        if (!Array.isArray(manifest.skins)) throw new Error('manifest: skins listesi yok');
        return manifest;
    } catch (err) {
        console.warn('[preload] manifest okunamadı, varsayılan skinle devam:', err?.message ?? err);
        return { defaultSkinId: DEFAULT_SKIN_ID, skins: [DEFAULT_SKIN_ID], images: [], fonts: [], audio: [] };
    }
}

/**
 * Manifestten iş listesi kurar. Her iş: { label, group, run(), skinId? }.
 * Varsayılan skin listenin BAŞINA alınır: yüklemenin en başında hazır olur.
 */
function buildJobs(manifest) {
    const jobs = [];
    const defaultId = Number(manifest.defaultSkinId) || DEFAULT_SKIN_ID;
    const skins = [...new Set([defaultId, ...manifest.skins.map(Number).filter(Number.isInteger)])];

    for (const skinId of skins) {
        for (const part of SKIN_PARTS) {
            // Manifest yollari kok goreli (/assets/...); skin parcalari da ayni bicimde.
            const url = `/assets/snake/${skinId}/${part}`;
            jobs.push({ label: `skin ${skinId}`, group: 'skins', skinId, url, run: () => loadImage(url) });
        }
    }
    for (const url of manifest.images ?? []) {
        jobs.push({ label: url.split('/').pop(), group: 'ui', url, run: () => loadImage(url) });
    }
    for (const font of manifest.fonts ?? []) {
        jobs.push({ label: `${font.family} ${font.weight}`, group: 'fonts', url: font.url, run: () => loadFont(font) });
    }
    for (const url of manifest.audio ?? []) {
        jobs.push({ label: url.split('/').pop(), group: 'audio', url, run: () => loadAudio(url) });
    }
    return jobs;
}

/** Grup → durum metni ("Loading skins…" vb.). */
export const GROUP_LABELS = {
    skins: 'Loading skins…',
    ui: 'Loading interface…',
    fonts: 'Loading fonts…',
    audio: 'Loading sound effects…',
};

/**
 * Tüm varlıkları yükler.
 *
 * @param {{ onProgress?: Function, onComplete?: Function }} [hooks]
 * @returns {Promise<{ total:number, loaded:number, failed:Array<{url:string,error:string}>, unavailableSkins:number[] }>}
 */
export async function preloadAssets(hooks = {}) {
    const manifest = await fetchManifest();
    registerSkinManifest(manifest);

    const jobs = buildJobs(manifest);
    const total = jobs.length;
    const failed = [];
    const failedSkins = new Set();
    let done = 0;

    const report = (job) => {
        done += 1;
        hooks.onProgress?.({
            loaded: done,
            total,
            fraction: total === 0 ? 1 : done / total,
            label: GROUP_LABELS[job.group] ?? 'Loading…',
            file: job.label,
        });
    };

    // Sabit genişlikli işçi havuzu: sıra korunur (varsayılan skin önce),
    // eşzamanlılık sınırlı kalır, hata bir işçiyi durdurmaz.
    let cursor = 0;
    const worker = async () => {
        while (cursor < jobs.length) {
            const job = jobs[cursor++];
            try {
                await withTimeout(job.run(), FILE_TIMEOUT_MS, job.url);
            } catch (err) {
                failed.push({ url: job.url, error: err?.message ?? String(err) });
                if (job.skinId !== undefined) failedSkins.add(job.skinId);
            } finally {
                report(job);
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, jobs.length)) }, worker));

    // Parçası eksik skin: oyun içinde varsayılana düşer. Varsayılanın kendisi
    // eksikse SnakeSkin zaten daire dokusuna geri düşer (bkz. SnakeSkin.build).
    for (const skinId of failedSkins) {
        if (skinId !== (Number(manifest.defaultSkinId) || DEFAULT_SKIN_ID)) markSkinUnavailable(skinId);
    }
    if (failed.length > 0) {
        console.warn(`[preload] ${failed.length}/${total} varlık yüklenemedi (oyun devam eder):`, failed);
    }

    const summary = { total, loaded: total - failed.length, failed, unavailableSkins: [...failedSkins] };
    // Teşhis: DevTools'tan window.__seanakesPreload ile okunur.
    window.__seanakesPreload = summary;
    hooks.onComplete?.(summary);
    return summary;
}
