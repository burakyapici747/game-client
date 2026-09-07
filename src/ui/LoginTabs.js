// ─────────────────────────────────────────────────────────────────────────────
// LOGIN TABS — giriş kartındaki iki kipli seçici (GUEST · SOCIAL LOGIN)
//
// DOM iskeleti index.html'de (.login-card içindeki .auth-tabs + .auth-pane
// ikilisi), stiller public/style.css'te. Bu modül yalnızca sekme durumunu ve
// sosyal panelin oturum yansımasını yönetir.
//
// ── NEDEN AYRI BİR MODÜL ────────────────────────────────────────────────────
// main.js zaten sunucu seçimi, ayarlar ve Phaser boot'unu taşıyor. Sekme
// mantığını oraya eklemek dosyayı "her şeyin yeri" hâline getirirdi. Burada
// tek sorumluluk var: "oyuncu hangi kimlikle giriyor" sorusunun UI'ı.
//
// ── SEKME ⇄ OTURUM İLİŞKİSİ ─────────────────────────────────────────────────
// Sekme SEÇİMİ ile oturum KİPİ ayrı şeylerdir. Sekme yalnızca kullanıcının
// baktığı paneldir; asıl kip PLAY'e basıldığında (misafir) ya da Google
// callback'i döndüğünde (google) SessionManager'da kurulur. Bu ayrım olmadan
// "Social sekmesindeyim ama giriş yapmadım" durumu temsil edilemezdi.
//
// Google oturumu açıkken GUEST sekmesi KİLİTLENİR: hesabı olan oyuncuyu tek
// tıkla misafire düşürmek, cüzdanını ve skinlerini sessizce kaybettirmek olurdu.
// Kimlikten çıkış yalnızca yan paneldeki açık "Sign out" eylemiyle olur.
// ─────────────────────────────────────────────────────────────────────────────

import { onSessionChange } from '../auth/SessionManager.js';

const $ = (id) => document.getElementById(id);

/** Kullanıcının son seçtiği sekme — yeniden ziyarette hatırlanır. */
const TAB_STORAGE_KEY = 'auth_tab';
const VALID_TABS = new Set(['guest', 'social']);

let activeTab = 'guest';
let initialized = false;

/** Şu an gösterilen sekme: 'guest' | 'social'. */
export function getActiveTab() {
    return activeTab;
}

function readStoredTab() {
    try {
        const stored = localStorage.getItem(TAB_STORAGE_KEY);
        return VALID_TABS.has(stored) ? stored : 'guest';
    } catch (_) {
        return 'guest';   // private mode / storage kapalı
    }
}

function storeTab(tab) {
    try { localStorage.setItem(TAB_STORAGE_KEY, tab); } catch (_) { /* yok say */ }
}

/**
 * Sekmeyi değiştirir.
 *
 * @param {string}  tab
 * @param {boolean} [persist=true] Kullanıcının kendi seçimi mi (kaydedilsin mi).
 *                  Oturumun zorladığı geçişler kaydedilmez — kullanıcı çıkış
 *                  yaptığında kendi tercihine dönmeli.
 */
export function setActiveTab(tab, persist = true) {
    if (!VALID_TABS.has(tab)) return;
    activeTab = tab;

    for (const btn of document.querySelectorAll('.auth-tab')) {
        const isActive = btn.dataset.tab === tab;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-selected', String(isActive));
        // Etkin olmayan sekme klavye sırasından çıkar (roving tabindex).
        btn.tabIndex = isActive ? 0 : -1;
    }

    $('auth-pane-guest')?.classList.toggle('hidden', tab !== 'guest');
    $('auth-pane-social')?.classList.toggle('hidden', tab !== 'social');

    // İşaretçi (thumb) CSS transform ile kayar — index'i data attribute taşır.
    const tabsEl = document.querySelector('.auth-tabs');
    if (tabsEl) tabsEl.dataset.active = tab;

    if (persist) storeTab(tab);
}

/**
 * Oturum durumunu sosyal panele yansıtır.
 *
 * <p>Google oturumu açıkken: butonlar gizlenir, yerine "signed in as …" satırı
 * gelir ve GUEST sekmesi kilitlenir (bkz. dosya başındaki gerekçe).
 */
function applySession({ mode, profile }) {
    const signedIn = mode === 'google';

    const signedInBox = $('social-signed-in');
    const providerBox = $('social-providers');
    const guestTab = $('auth-tab-guest');

    if (signedInBox) {
        signedInBox.classList.toggle('hidden', !signedIn);
        if (signedIn) {
            const nameEl = $('social-signed-in-name');
            const mailEl = $('social-signed-in-email');
            if (nameEl) nameEl.textContent = profile?.nickname || 'Signed in';
            if (mailEl) mailEl.textContent = profile?.email || '';
        }
    }
    if (providerBox) providerBox.classList.toggle('hidden', signedIn);

    if (guestTab) {
        guestTab.disabled = signedIn;
        guestTab.classList.toggle('is-locked', signedIn);
        guestTab.title = signedIn
            ? 'Signed in with Google — use Sign out in the side panel to play as a guest.'
            : '';
    }

    // Girişten sonra kullanıcıyı sonucun görüldüğü sekmede tut; çıkışta kendi
    // kayıtlı tercihine geri dön.
    if (signedIn) setActiveTab('social', false);
    else if (mode === null) setActiveTab(readStoredTab(), false);
}

/**
 * Sosyal panelde hata satırı gösterir (GSI SDK yüklenemedi vb.).
 *
 * <p>Kullanıcıyı SOSYAL sekmeye de taşır: hata yalnızca o panelde görünür,
 * kullanıcı GUEST sekmesindeyken sessizce yazmak onu görünmez kılardı.
 */
export function showSocialError(message) {
    const box = $('social-error');
    if (!box) return;
    box.textContent = String(message ?? 'Sign-in is unavailable right now.');
    box.classList.remove('hidden');
    setActiveTab('social', false);
}

/** Sosyal panel hata satırını temizler (yeniden denemeden önce). */
export function clearSocialError() {
    const box = $('social-error');
    if (!box) return;
    box.textContent = '';
    box.classList.add('hidden');
}

/**
 * Sekmeleri bağlar. Uygulama başlarken BİR KEZ çağrılır (bkz. src/main.js).
 *
 * @param {object}   opts
 * @param {function} [opts.onTabChange] Sekme değiştiğinde çağrılır (PLAY
 *                   düğmesinin etiketini güncellemek için main.js kullanır).
 */
export function initLoginTabs({ onTabChange } = {}) {
    if (initialized) return;
    const tabs = [...document.querySelectorAll('.auth-tab')];
    if (tabs.length === 0) return;
    initialized = true;

    for (const btn of tabs) {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            setActiveTab(btn.dataset.tab);
            onTabChange?.(activeTab);
        });
    }

    // Sekme şeridinde ok tuşlarıyla gezinme (WAI-ARIA tablist deseni).
    const strip = document.querySelector('.auth-tabs');
    strip?.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const enabled = tabs.filter((t) => !t.disabled);
        if (enabled.length < 2) return;
        e.preventDefault();
        const current = enabled.findIndex((t) => t.dataset.tab === activeTab);
        const delta = e.key === 'ArrowRight' ? 1 : -1;
        const next = enabled[(current + delta + enabled.length) % enabled.length];
        setActiveTab(next.dataset.tab);
        next.focus();
        onTabChange?.(activeTab);
    });

    // Apple: görsel eşitlik için var, bu kapsamda İŞLEVSİZ. disabled özniteliği
    // index.html'de duruyor; burada yalnızca yanlışlıkla etkinleştirilirse
    // sessizce hiçbir şey yapmamasını garanti ediyoruz.
    $('apple-signin-btn')?.addEventListener('click', (e) => e.preventDefault());

    setActiveTab(readStoredTab(), false);
    onSessionChange(applySession);
}
