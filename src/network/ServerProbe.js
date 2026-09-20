import { client, server } from './bundle.js';
import { PingSampler } from './PingSampler.js';

/** Ölçüm sonucunun "taze" sayıldığı süre. */
const RESULT_TTL_MS = 15000;

/** Soket açılmazsa/pong gelmezse ölçümü sonlandıran süre. */
const PROBE_TIMEOUT_MS = 4000;

/**
 * ── MENÜ ÖLÇÜM PROFİLİ ─────────────────────────────────────────────────────
 * Patlama (burst) fazı hızlı ve kısa, nabız (pulse) fazı seyrektir. Değerler
 * config.json -> ping.menuProbe ile geçersiz kılınabilir; kod tarafında
 * varsayılan bulunması şart, çünkü config yüklenemediğinde de menü çalışır.
 */
const PROBE_DEFAULTS = {
    /** Patlamada alınacak GEÇERLİ örnek sayısı (ısınma örneği hariç). */
    burstSamples: 4,
    /** Patlama örnekleri arası (ms). */
    burstIntervalMs: 150,
    /** Kararlı fazda arka plan nabzı (ms). */
    pulseIntervalMs: 2500,
    /**
     * Nabzın kendiliğinden durduğu süre (ms).
     *
     * SUNUCU MALİYETİ GERÇEKTİR: sunucu, WebSocket el sıkışması tamamlanır
     * tamamlanmaz oyuncu entity'sini ve fizik gövdelerini oluşturur
     * (WebSocketFrameHandler -> HandshakeComplete -> handlePlayerConnect).
     * Yani açık duran her ölçüm soketi, oyuncu daha PLAY'e basmadan sunucuda
     * bir "doğmamış yılan" tutar. Nabzı süresiz açık tutmak, menüde oturan
     * her ziyaretçi için bu maliyeti ödemek olurdu. Süre dolduğunda soket
     * kapanır, EKRANDAKİ DEĞER KALIR (son bilinen ölçüm) ve kullanıcı
     * etkileşimi (modal açma, yenileme, sekmeye dönüş) nabzı yeniden başlatır.
     */
    pulseDurationMs: 30000,
    /** Isınma artefaktı sayılıp atılacak ilk örnek. */
    discardSamples: 1,
    /** UI'ya değer basılmadan önce gereken geçerli örnek. */
    minSamples: 2,
};

export function latencyTier(rttMs) {
    if (rttMs == null) return 'offline';
    if (rttMs < 60) return 'good';
    if (rttMs < 120) return 'ok';
    if (rttMs < 200) return 'high';
    return 'bad';
}

function probeConfig() {
    return { ...PROBE_DEFAULTS, ...(window.gameConfig?.ping?.menuProbe ?? {}) };
}

/**
 * ── TEK BİR SUNUCUYA AÇILAN ÖLÇÜM OTURUMU ──────────────────────────────────
 *
 * <h3>NEDEN EL SIKIŞMASI ARTIK ÖLÇÜM DEĞİL</h3>
 * Önceki sürüm RTT'yi "WebSocket el sıkışmasının yarısı" olarak alıp soketi
 * hemen kapatıyordu. O sayı yapısal olarak ŞİŞKİNDİR: içinde TCP kurulumu,
 * TLS anlaşması, HTTP upgrade ve sunucunun bağlantı-anı işleri vardır —
 * hiçbiri oyun sırasındaki paket gidiş-dönüşünde yaşanmaz. Üstelik TEK
 * örnekti: o ana denk gelen herhangi bir gecikme doğrudan ekrana yazılırdı.
 *
 * <p>Artık el sıkışması yalnızca YOLU ISITIR. Gerçek ölçüm, açık soket
 * üzerinden gönderilen uygulama seviyesi Ping/Pong çerçeveleriyle yapılır —
 * yani oyun içinde ölçülenin BİREBİR aynısı (aynı protobuf mesajı, aynı
 * sunucu handler'ı, aynı pipeline konumu). Menüde görünen ping ile oyunda
 * görünen ping arasındaki fark bu yüzden ortadan kalkar.
 *
 * <h3>YÜK</h3>
 * Ping = 2 alan (uint64 timestamp + uint32 nonce), Pong = 3 alan. Varint
 * kodlamayla çerçeve başına ~10-20 bayt; patlama fazının tamamı tek bir
 * MTU'nun altındadır.
 */
class ProbeSession {

    /**
     * @param {{id:string, wsUrl:string}} serverEntry
     * @param {(result:object)=>void} onResult her yeni değerde çağrılır
     */
    constructor(serverEntry, onResult, onClosed) {
        this.serverEntry = serverEntry;
        this.onResult = onResult;
        // Oturum KENDİ KENDİNE de kapanabilir (nabız süresi dolduğunda). Kapanışı
        // yöneticiye bildirmezse haritada ÖLÜ bir oturum kalır; sonraki watch()
        // onu canlı sanıp üzerine keepAlive yazar ve gösterge bir daha hiç
        // güncellenmez. Kapanış tek bir yerden (stop) duyurulur.
        this.onClosed = onClosed;
        this.config = probeConfig();

        this.sampler = new PingSampler({
            discardSamples: this.config.discardSamples,
            minSamples: this.config.minSamples,
        });

        this.socket = null;
        this.pendingPings = new Map();   // nonce -> performance.now() @ gönderim
        this.nonce = 0;
        this.burstTimer = null;
        this.pulseTimer = null;
        this.timeoutTimer = null;
        this.pulseDeadlineAt = 0;
        this.burstRemaining = 0;
        this.handshakeMs = null;
        this.opened = false;
        this.stopped = false;
        this.keepAlive = false;
        this.settle = null;              // ilk sonucu bekleyen promise resolver
    }

    /**
     * Oturumu başlatır.
     *
     * @param {{keepAlive?:boolean}} [opts] keepAlive=true ise patlamadan sonra
     *        arka plan nabzına geçilir (seçili sunucu için).
     * @returns {Promise<object>} İLK gösterilebilir sonuç (veya çevrimdışı).
     */
    start({ keepAlive = false } = {}) {
        this.keepAlive = keepAlive;
        return new Promise((resolve) => {
            this.settle = resolve;
            this.timeoutTimer = setTimeout(() => this._onTimeout(), PROBE_TIMEOUT_MS);

            try {
                this.socket = new WebSocket(normalizeWsUrl(this.serverEntry.wsUrl));
                this.socket.binaryType = 'arraybuffer';
                this.handshakeStartedAt = performance.now();
                this.socket.onopen = () => this._onOpen();
                this.socket.onmessage = (event) => this._onMessage(event);
                this.socket.onerror = () => this._fail();
                this.socket.onclose = () => this._fail();
            } catch (_) {
                this._fail();
            }
        });
    }

    /** Nabzı (yeniden) başlatır — kullanıcı etkileşimi veya sekmeye dönüş. */
    refresh() {
        if (this.stopped || !this.opened) return;
        this.pulseDeadlineAt = performance.now() + this.config.pulseDurationMs;
        this._startBurst();
    }

    /** Oturumu kapatır: zamanlayıcılar + soket. Çağrılması IDEMPOTENTTİR. */
    stop() {
        if (this.stopped) return;
        this.stopped = true;
        this._clearTimers();
        this.pendingPings.clear();

        const socket = this.socket;
        this.socket = null;
        if (socket) {
            // Dinleyiciler ÖNCE sökülür: close() bu fonksiyonu tekrar
            // tetikleyip "offline" sonucu yazmamalı.
            socket.onopen = null;
            socket.onmessage = null;
            socket.onerror = null;
            socket.onclose = null;
            try { socket.close(); } catch (_) { /* zaten kapalı */ }
        }

        // ── BEKLEYEN SÖZ MUTLAKA SONUÇLANIR ─────────────────────────────────
        // İlk pong geldiğinde zaman aşımı sayacı iptal edilir (artık tahmine
        // gerek yoktur). Patlama o noktadan SONRA tıkanırsa — ikinci pong
        // kaybolursa — geriye hiçbir sayaç kalmaz ve probe()'un döndürdüğü söz
        // SONSUZA DEK askıda kalırdı; probeAll() onu beklediği için sunucu
        // listesi hiç boyanmazdı. Kapanış, hangi yoldan gelirse gelsin, sözü
        // elimizdeki en iyi bilgiyle sonuçlandırır.
        if (this.settle) {
            if (this.sampler.ready) this._publish(false);
            else if (this.opened && this.handshakeMs !== null) this._publish(true);
            else this._resolveOffline();
        }

        this.onClosed?.(this);
    }

    _clearTimers() {
        if (this.burstTimer !== null) { clearTimeout(this.burstTimer); this.burstTimer = null; }
        if (this.pulseTimer !== null) { clearTimeout(this.pulseTimer); this.pulseTimer = null; }
        if (this.timeoutTimer !== null) { clearTimeout(this.timeoutTimer); this.timeoutTimer = null; }
    }

    _onOpen() {
        this.opened = true;
        // ISINMA ÖLÇÜSÜ: sonuç olarak KULLANILMAZ, yalnızca sunucu hiç pong
        // döndürmezse elimizde bir tahmin kalsın diye saklanır (bkz. _onTimeout).
        this.handshakeMs = Math.max(1, Math.round((performance.now() - this.handshakeStartedAt) / 2));
        this.pulseDeadlineAt = performance.now() + this.config.pulseDurationMs;
        this._startBurst();
    }

    _startBurst() {
        if (this.stopped) return;
        if (this.burstTimer !== null) { clearTimeout(this.burstTimer); this.burstTimer = null; }
        if (this.pulseTimer !== null) { clearTimeout(this.pulseTimer); this.pulseTimer = null; }

        // +discardSamples: ilk örnek istatistiğe girmeyeceği için patlamanın
        // boyu o kadar uzun olmalı, yoksa "4 örnek" fiilen 3 olurdu.
        this.burstRemaining = this.config.burstSamples + this.config.discardSamples;
        this._burstTick();
    }

    _burstTick() {
        if (this.stopped || this.burstRemaining <= 0) {
            this._afterBurst();
            return;
        }
        this.burstRemaining--;
        this._sendPing();
        this.burstTimer = setTimeout(() => this._burstTick(), this.config.burstIntervalMs);
    }

    _afterBurst() {
        if (this.stopped) return;
        if (!this.keepAlive) {
            // Tek seferlik ölçüm: soketi AÇIK BIRAKMA. Sunucu her açık soket
            // için bir oyuncu entity'si tutuyor (bkz. pulseDurationMs notu).
            this.stop();
            return;
        }
        this._schedulePulse();
    }

    _schedulePulse() {
        if (this.stopped) return;
        if (performance.now() >= this.pulseDeadlineAt) {
            // Nabız süresi doldu: soket kapanır, son değer ekranda KALIR.
            this.stop();
            return;
        }
        this.pulseTimer = setTimeout(() => {
            this._sendPing();
            this._schedulePulse();
        }, this.config.pulseIntervalMs);
    }

    _sendPing() {
        if (this.stopped || this.socket?.readyState !== WebSocket.OPEN) return;

        // Cevapsız kalan ping'ler birikmesin (paket kaybı / arka plan sekmesi).
        if (this.pendingPings.size > 8) this.pendingPings.clear();

        this.nonce = (this.nonce + 1) >>> 0;
        if (this.nonce === 0) this.nonce = 1;
        this.pendingPings.set(this.nonce, performance.now());

        const envelope = client.ClientEnvelope.create({
            ping: client.Ping.create({ clientTimestamp: Date.now(), nonce: this.nonce }),
        });
        try {
            this.socket.send(client.ClientEnvelope.encode(envelope).finish());
        } catch (_) {
            this._fail();
        }
    }

    _onMessage(event) {
        if (!(event.data instanceof ArrayBuffer)) return;

        let envelope;
        try {
            envelope = server.ServerEnvelope.decode(new Uint8Array(event.data));
        } catch (_) {
            return;   // ölçüm soketi: çözülemeyen çerçeve sessizce yok sayılır
        }

        // Sunucu bağlantı anında StartInformation da gönderir; ölçüm oturumu
        // pong DIŞINDAKİ her şeyi görmezden gelir.
        const pong = envelope.pong;
        if (!pong) return;

        const sentAt = this.pendingPings.get(Number(pong.nonce));
        if (sentAt === undefined) return;   // bilinmeyen/eskimiş nonce
        this.pendingPings.delete(Number(pong.nonce));

        // İlk pong geldi: artık el sıkışması tahminine ihtiyaç yok, zaman
        // aşımı sayacı da anlamını yitirdi.
        if (this.timeoutTimer !== null) { clearTimeout(this.timeoutTimer); this.timeoutTimer = null; }

        this.sampler.addSample(Math.max(0, performance.now() - sentAt));
        if (this.sampler.ready) this._publish(false);
    }

    _onTimeout() {
        this.timeoutTimer = null;
        if (this.stopped) return;

        if (this.opened && this.handshakeMs !== null) {
            // Soket açıldı ama pong gelmedi: sunucu ayakta, ölçüm yolu değil.
            // El sıkışması tahmini ŞİŞKİNDİR — sonucu estimated=true ile
            // işaretle ki UI bunu kesin bir ölçüm gibi sunmasın.
            this._publish(true);
        }
        this.stop();
        this._resolveOffline();
    }

    _publish(estimated) {
        const result = {
            rttMs: estimated ? this.handshakeMs : this.sampler.value,
            online: true,
            estimated,
            samples: this.sampler.acceptedCount,
            jitterMs: Math.round(this.sampler.jitterMs),
            measuredAt: Date.now(),
        };
        this.onResult?.(result);
        if (this.settle) { this.settle(result); this.settle = null; }
    }

    _fail() {
        if (this.stopped) return;
        // Zaten geçerli bir ölçüm yaptıysak, soketin sonradan kapanması
        // sonucu ÇÖPE ATMAMALI: sağlıklı bir sunucuyu "offline" diye
        // önbelleğe almak, listenin yanlış sunucuyu seçmesine yol açar.
        const hadResult = this.sampler.ready;
        this.stop();
        if (!hadResult) this._resolveOffline();
    }

    _resolveOffline() {
        if (!this.settle) return;
        const result = { rttMs: null, online: false, estimated: false, samples: 0, measuredAt: Date.now() };
        this.onResult?.(result);
        this.settle(result);
        this.settle = null;
    }
}

class ServerProbeManager {
    constructor() {
        this.results = new Map();
        this.inFlight = new Map();
        this.sessions = new Map();       // serverId -> ProbeSession
        this.watchers = new Map();       // serverId -> Set<callback>
        // İzlenen sunucunun TANIMI (wsUrl dahil). Sekmeye dönüşte oturumu
        // yeniden kurabilmek için şart: izleyici listesi yalnızca callback
        // tutar, oradan wsUrl'e ulaşılamaz.
        this.watchedEntries = new Map(); // serverId -> serverEntry
        this.locked = false;
        this._installVisibilityHook();
    }

    getResult(serverId) {
        return this.results.get(serverId) ?? null;
    }

    isFresh(serverId) {
        const r = this.results.get(serverId);
        return !!r && (Date.now() - r.measuredAt) < RESULT_TTL_MS;
    }

    /** Oyun başlıyor: menü ölçümü tamamen susar (soket + zamanlayıcı). */
    lock() {
        this.locked = true;
        this.closeAll();
    }

    unlock() {
        this.locked = false;
    }

    /** TÜM oturumları kapatır — zamanlayıcılar dahil (sızıntı yüzeyi burası). */
    closeAll() {
        for (const session of [...this.sessions.values()]) session.stop();
        this.sessions.clear();
        this.inFlight.clear();
    }

    /**
     * Tek bir sunucuyu ölçer (tek seferlik).
     *
     * @param {{id:string, wsUrl:string}} serverEntry
     * @param {{force?:boolean}} [opts] force=true TTL'i yok sayar.
     */
    probe(serverEntry, { force = false } = {}) {
        const cached = this.results.get(serverEntry.id);

        // 1) Kilitliyken (oyun içi) asla yeni soket açma.
        if (this.locked) {
            return Promise.resolve(cached ?? { rttMs: null, online: false, measuredAt: 0 });
        }

        // 2) TTL içindeyse önbellekten servis et — UI tıklaması soket AÇMAZ.
        if (!force && this.isFresh(serverEntry.id)) {
            return Promise.resolve(cached);
        }

        // 3) Canlı bir izleme oturumu varsa YENİ SOKET AÇMA: onun patlamasını
        //    tazele ve mevcut/gelecek değerini kullan.
        const live = this.sessions.get(serverEntry.id);
        if (live) {
            live.refresh();
            // Elde değer varsa onu ver; yoksa oturumun İLK sonucunu bekle —
            // "henüz ölçmedi" ile "çevrimdışı" aynı şey değildir ve ikincisini
            // uydurmak listeyi yanlış sunucuya yönlendirir.
            return cached ? Promise.resolve(cached) : live.firstResultPromise;
        }

        // 4) Aynı sunucu için uçuşta ölçüm varsa ONA katıl (soket çoğaltma).
        const pending = this.inFlight.get(serverEntry.id);
        if (pending) return pending;

        // İZLENEN sunucu için nabızlı oturum kurulur. Nabız penceresi dolmuş
        // olabilir (bkz. pulseDurationMs); kullanıcının bu isteği — modalı
        // açması ya da yenilemesi — onu canlandıran şeydir.
        const watched = (this.watchers.get(serverEntry.id)?.size ?? 0) > 0;
        const task = this._runSession(serverEntry, { keepAlive: watched })
            .finally(() => this.inFlight.delete(serverEntry.id));
        this.inFlight.set(serverEntry.id, task);
        return task;
    }

    /**
     * SEÇİLİ SUNUCUYU CANLI İZLER: patlama → arka plan nabzı.
     *
     * <p>Giriş ekranındaki göstergenin donmamasının tek yolu budur; tek
     * seferlik ölçüm 15 sn sonra bayatlar ve kimse tazelemez.
     *
     * @returns {() => void} aboneliği bırakan fonksiyon (nabzı da durdurur)
     */
    watch(serverEntry, onUpdate) {
        if (this.locked) return () => {};

        let watcherSet = this.watchers.get(serverEntry.id);
        if (!watcherSet) {
            watcherSet = new Set();
            this.watchers.set(serverEntry.id, watcherSet);
        }
        watcherSet.add(onUpdate);
        this.watchedEntries.set(serverEntry.id, serverEntry);

        const existing = this.sessions.get(serverEntry.id);
        if (existing && !existing.stopped) {
            existing.keepAlive = true;
            existing.refresh();
            const known = this.results.get(serverEntry.id);
            if (known) onUpdate(known);
        } else {
            this._runSession(serverEntry, { keepAlive: true });
        }

        return () => {
            const set = this.watchers.get(serverEntry.id);
            if (!set) return;
            set.delete(onUpdate);
            if (set.size === 0) {
                this.watchers.delete(serverEntry.id);
                this.watchedEntries.delete(serverEntry.id);
                // Son izleyici de gitti: nabzı sürdürmenin alıcısı yok.
                this.sessions.get(serverEntry.id)?.stop();
                this.sessions.delete(serverEntry.id);
            }
        };
    }

    _runSession(serverEntry, { keepAlive }) {
        const session = new ProbeSession(serverEntry, (result) => {
            // İptal/çevrimdışı sonucu, ELDEKİ geçerli ölçümün üzerine yazmaz.
            if (result.online || !this.results.has(serverEntry.id)) {
                this.results.set(serverEntry.id, result);
            }
            for (const watcher of this.watchers.get(serverEntry.id) ?? []) {
                watcher(this.results.get(serverEntry.id));
            }
        }, (closedSession) => {
            // Yalnızca HÂLÂ kayıtlı olan oturum silinir: aynı sunucu için yeni
            // bir oturum başlamışsa, eskisinin kapanışı onu düşürmemeli.
            if (this.sessions.get(serverEntry.id) === closedSession) {
                this.sessions.delete(serverEntry.id);
            }
        });
        this.sessions.set(serverEntry.id, session);

        // keepAlive SETTLE ANINDA okunur, closure'dan değil: watch() uçuştaki
        // tek seferlik bir oturumu izlemeye YÜKSELTEBİLİR. Kapanış kararı
        // başlangıçtaki değere bakarsa, yükseltilmiş oturum haritadan silinir
        // ve nabzı atmaya devam eden ama artık KİMSENİN DURDURAMAYACAĞI bir
        // soket kalır (closeAll onu göremez).
        session.firstResultPromise = session.start({ keepAlive }).then((result) => {
            if (!session.keepAlive && this.sessions.get(serverEntry.id) === session) {
                this.sessions.delete(serverEntry.id);
            }
            return this.results.get(serverEntry.id) ?? result;
        });
        return session.firstResultPromise;
    }

    /**
     * Arka plan sekmesinde ölçüm YAPILMAZ.
     *
     * <p>İki nedeni var: (1) tarayıcı arka planda zamanlayıcıları ~1/dk'ya
     * kısar, o yüzden ölçülen RTT'ler zamanlayıcı gecikmesiyle kirlenir ve
     * göstergeyi yalan bir değerle doldurur; (2) görünmeyen bir sekme için
     * sunucuda soket ve entity tutmanın karşılığı yoktur. Sekmeye dönüşte
     * yeni bir patlama ile taze değer alınır.
     */
    _installVisibilityHook() {
        if (typeof document === 'undefined' || !document.addEventListener) return;
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                for (const session of [...this.sessions.values()]) session.stop();
                this.sessions.clear();
                return;
            }
            if (this.locked) return;
            // Görünür oldu: izlenen sunucular için oturumu yeniden kur.
            for (const [serverId, watcherSet] of this.watchers) {
                if (watcherSet.size === 0 || this.sessions.has(serverId)) continue;
                const entry = this.watchedEntries.get(serverId);
                if (entry) this._runSession(entry, { keepAlive: true });
            }
        });
    }

    async probeAll(servers, opts) {
        const entries = await Promise.all(
            servers.map(async (s) => [s.id, await this.probe(s, opts)]),
        );
        return new Map(entries);
    }

    /** En düşük gecikmeli ÇEVRİMİÇİ sunucu; hiçbiri çevrimiçi değilse null. */
    pickLowestLatency(servers) {
        let best = null;
        let bestRtt = Infinity;
        for (const serverEntry of servers) {
            const r = this.results.get(serverEntry.id);
            if (!r || !r.online || r.rttMs == null) continue;
            if (r.rttMs < bestRtt) {
                bestRtt = r.rttMs;
                best = serverEntry;
            }
        }
        return best;
    }
}

/** Sunucu WS endpoint'i /ws path'inde yaşar — normalize et. */
export function normalizeWsUrl(rawUrl) {
    return rawUrl.endsWith('/ws') ? rawUrl : rawUrl.replace(/\/+$/, '') + '/ws';
}

/** Uygulama genelinde TEK örnek (singleton). */
export const serverProbe = new ServerProbeManager();
