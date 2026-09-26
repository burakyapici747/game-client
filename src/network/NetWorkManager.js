import { client, server } from './bundle.js';
import { resolveWsUrl } from './endpoint.js';
import { PingSampler } from './PingSampler.js';
import { isAuthenticated, getPlayer, getSessionProfile } from '../auth/SessionManager.js';

// ── KATILIM KİMLİĞİ ──────────────────────────────────────────────────────────
// Sunucu YALNIZCA SOCIAL isteklerde skin çözümlemesi yapar (proxy → LootLocker
// Player Storage, 50 ms'lik toplu pencere); GUEST hiç dış servise gitmez ve
// yapılandırılmış varsayılan skini alır.
//
// Google oturumu var ama LootLocker eşleşmesi kurulamadıysa (giriş sırasında
// proxy 503 verdi) playerId null'dır. O oyuncu GUEST olarak katılır: SOCIAL +
// boş kimlik sunucuda SKIN_NOT_SELECTED ile reddedilir ve oyuncu hiç
// oynayamazdı. Takılı skin zaten eşleşme olmadan var olamaz — kayıp yoktur.
function resolveJoinIdentity() {
    const playerId = isAuthenticated()
        ? (getPlayer()?.player?.playerId ?? getSessionProfile()?.playerId ?? null)
        : null;
    if (playerId === null || playerId === undefined || playerId === '') {
        return { authType: client.JoinAuthType.GUEST, socialPlayerId: '' };
    }
    // uint64 yerine STRING taşınır (protobufjs Long dönüşümünden kaçınmak için).
    return { authType: client.JoinAuthType.SOCIAL, socialPlayerId: String(playerId) };
}


export class NetworkManager {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.socket = null;
        this.connected = false;


        // Config-driven sunucu seçimi: kullanıcının menüden seçtiği sunucunun
        // wsUrl'i (public/config.json) önceliklidir; yoksa şema-duyarlı fallback
        // devreye girer. Şema artık sabit değil — HTTPS sayfada ws:// mixed
        // content olarak bloklanır. Tek sahiplik noktası: ./endpoint.js.
        this.wsUrl = resolveWsUrl(options.wsUrl);
        this.isCurrentlyBoosting = false;

        this.lastSentAngleValue = -1;
        this.angleSendTimer = 0;
        // Dosya: NetWorkManager.js. Neden: 60fps gonderim gereksiz bandwidth tuketiyor.
        // 30Hz gonderim yeterli hassasiyet sagliyor, paket sayisi yarisina dusuyor.
        this.angleSendIntervalMoving = 1000 / 30;
        this.angleSendIntervalStill = 250;
        this.nextSequenceId = 0;

        // ── Ping / RTT heartbeat ─────────────────────────────────────────────
        // Config-driven aralıkla ping atılır; RTT nonce üzerinden LOKAL monoton
        // saatle ölçülür (performance.now). Sunucunun echo'ladığı uint64
        // clientTimestamp'e güvenmiyoruz: protobufjs uint64'ü Long objesi
        // olarak döndürebilir ve Date.now() farkları saat kaymasına açıktır.
        const pingCfg = window.gameConfig?.ping ?? {};
        const calCfg = pingCfg.calibration ?? {};
        this.pingIntervalMs = options.pingIntervalMs ?? pingCfg.heartbeatIntervalMs ?? 2500;
        this.pingTimer = null;
        this.pingNonce = 0;
        this.pendingPings = new Map();   // nonce -> performance.now() @ send

        // ── Kalibrasyon (ilk ping spike düzeltmesi) ──────────────────────────
        // İlk pong, bağlantı ısınması yüzünden şişkin ölçülür (~200ms görünüp
        // ~60ms'e oturuyordu): TCP slow start + WS upgrade artçıları, sunucunun
        // handshake sırasında yolladığı büyük StartInformation/food payload'ının
        // arkasında kuyruklanma ve JIT ısınması. Çözüm: ilk discardSamples örnek
        // tamamen atılır, UI'ya minSamples örnek ORTALANANA kadar değer basılmaz;
        // kalibrasyon örnekleri hızlandırılmış aralıkla (intervalMs) toplanır ki
        // gösterge saniyeler içinde doğru değerle açılsın.
        this.pingCalibDiscard = calCfg.discardSamples ?? 1;
        this.pingCalibMinSamples = calCfg.minSamples ?? 3;
        this.pingCalibIntervalMs = calCfg.intervalMs ?? 500;
        this.pingCalibrated = false;

        // ── ÖLÇÜM İSTATİSTİĞİ: TEK ALGORİTMA, İKİ ÇAĞIRAN ────────────────────
        // Aynı sınıfı menüdeki ölçüm de kullanır (ServerProbe). Formül iki
        // yerde ayrı ayrı yazılsaydı, menüde 60ms gösterip oyuna girince 90ms
        // gösteren bir arayüz kaçınılmazdı — ve fark ağdan değil, iki farklı
        // yumuşatmadan gelirdi. Ayrıntılar: PingSampler.
        this.pingSampler = new PingSampler({
            discardSamples: this.pingCalibDiscard,
            minSamples: this.pingCalibMinSamples,
        });
    }

    /**
     * Yumuşatılmış RTT (ms) — Snake.js tahmin/telafi zincirinin okuduğu alan.
     * Getter'dır: tek gerçek kaynak {@link PingSampler}, bu yalnızca vitrin.
     */
    get pingEmaMs() {
        return this.pingSampler.rawValue;
    }

    /**
     * RTT SAPMASI (jitter) — |rtt - ema|'nın hareketli ortalaması.
     * Adaptif interpolasyon buffer'ı (EntityInterpolator) bunu doğrudan
     * tüketir: buffer derinliğini belirleyen şey ortalama gecikme DEĞİL,
     * gecikmenin oynaklığıdır.
     */
    get pingJitterMs() {
        return this.pingSampler.jitterMs;
    }

    canSend() {
        return this.connected && this.socket?.readyState === WebSocket.OPEN;
    }

    connect() {
        if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
            return;
        }

        this.socket = new WebSocket(this.wsUrl);
        this.socket.binaryType = 'arraybuffer';

        this.socket.onopen = () => {
            console.log('Sunucuya bağlanıldı.');
            this.connected = true;
            // Bağlanma ekranının "Connecting to server…" aşamasını tamamlar.
            this.scene.events.emit('socket_open');

            // Nickname bilgisini sunucuya gonder
            const nickname = window.gameSettings?.nickname || '';
            this.sendJoinRequest(nickname);
            this._startPingLoop();
        };

        this.socket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                try {
                    const message = server.ServerEnvelope.decode(new Uint8Array(event.data));
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Sunucu mesajı çözümlenemedi:', error);
                }
            }
        };

        this.socket.onclose = () => {
            console.log('Sunucu bağlantısı kapandı.');
            this.connected = false;
            this._stopPingLoop();
            this.scene.events.emit('disconnected');
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket hatası:', error);
        };
    }

    handleMessage(envelope) {
        // Herhangi bir veri geldiginde loader'i gizlemek icin bir flag gonderelim
        const hasData = envelope.selfPosition || envelope.foodCollection || 
                        envelope.startInformation || envelope.start_information ||
                        envelope.entityCollection || envelope.entity_collection;

        if (envelope.selfPosition) {
            this.scene.events.emit('self_position', envelope.selfPosition);
        }

        const segmentMutationCollection =
            envelope.segmentMutationCollection ?? envelope.segment_mutation_collection;
        if (segmentMutationCollection) {
            this.scene.events.emit('segment_mutation_collection', segmentMutationCollection);
        }

        const foodCollection = envelope.foodCollection ?? envelope.food_collection;
        if (foodCollection) {
            this.scene.events.emit('food_collection', foodCollection);
        }

        // ── AOI YEM SIRASI: BOOTSTRAP -> MUTASYON -> TAHLIYE ───────────────
        // Sira KEYFI DEGILDIR:
        //
        // 1) BOOTSTRAP ONCE. Yeni abone olunan bir sektorun TABANI kurulmadan o
        //    sektorun deltasi uygulanirsa, REMOVE bilinmeyen bir id'ye dusup
        //    no-op olur ve ARDINDAN gelen bootstrap o OLU yemi diriltir —
        //    kalici hayalet. (Sunucu ayni tick'te ikisini birden gondermemeli;
        //    bu sira o sozlesmeye DAYANMAYAN bir emniyettir.)
        // 2) MUTASYON SONRA. Kendi icinde istemci once REMOVE'lari sonra
        //    ADD'leri uygular (bkz. Game.onFoodMutationCollection).
        // 3) TAHLIYE EN SON. Bir yem ayni tick'te hem silinip hem tahliye
        //    edilirse, gorsel onayi olan SILME once uygulanir; tahliye zararsiz
        //    bir no-op'a duser. Tersi olsaydi yem sessizce yok edilir ve
        //    oyuncu kendi yedigi yemin animasyonunu goremezdi.
        const foodSectorBootstraps =
            envelope.foodSectorBootstraps ?? envelope.food_sector_bootstraps;
        if (Array.isArray(foodSectorBootstraps)) {
            for (const bootstrap of foodSectorBootstraps) {
                this.scene.events.emit('food_sector_bootstrap', bootstrap);
            }
        }

        const foodMutationCollection =
            envelope.foodMutationCollection ?? envelope.food_mutation_collection;
        if (foodMutationCollection) {
            this.scene.events.emit('food_mutation_collection', foodMutationCollection);

            const sectorEvictions =
                foodMutationCollection.sectorEvictions ?? foodMutationCollection.sector_evictions;
            if (Array.isArray(sectorEvictions)) {
                for (const eviction of sectorEvictions) {
                    this.scene.events.emit('food_sector_eviction', eviction);
                }
            }
        }

        // Sıralama: sunucu bunu 5 sn'de birden sık GÖNDERMEZ ve yalnızca
        // sıralama değiştiğinde ekler — alan çoğu pakette hiç bulunmaz.
        //
        // TEK İSTİSNA: handshake. Sunucu, StartInformation zarfına da o anki
        // sıralama anlık görüntüsünü ekler (bkz. Game.buildInitialLeaderboard),
        // böylece oyuncu 5 sn'lik yayın penceresini beklemeden listeyi görür.
        // Alan `oneof` DIŞINDA olduğu için bu blok her iki durumu da tek yoldan
        // karşılar; ayrı bir handshake dalı gerekmez.
        //
        // SIRA ÖNEMLİ: bu emit, aşağıdaki 'start_game'den ÖNCE gelir. onStartGame
        // sıralama hâlâ boşsa "Connecting…" yer tutucusunu boş çerçeveyle
        // değiştirir; sıralamayı önce işlemek o yedek yolun gereksiz yere
        // çalışmasını (ve aynı karede iki kez DOM yazılmasını) önler.
        const leaderboardUpdate =
            envelope.leaderboardUpdate ?? envelope.leaderboard_update;
        if (leaderboardUpdate) {
            this.scene.events.emit('leaderboard_update', leaderboardUpdate);
        }

        // İlk karşılaşma path tohumu: bir entity AOI'ye ilk girdiğinde gövde
        // polyline'ı bir KEZ eklenir (bkz. newproto/server/upgrade/path-seed.proto).
        // leaderboard ile aynı gerekçeyle `oneof` DIŞINDA olduğu için burada,
        // payload switch'inden ÖNCE karşılanır — bu emit yılan HENÜZ
        // yaratılmamışken gelebilir, o yüzden Game tarafı tohumu kuyruğa alıp
        // entity kurulduktan sonra uygular (bkz. queuePendingPathSeed).
        const pathSeedCollection =
            envelope.pathSeedCollection ?? envelope.path_seed_collection;
        if (pathSeedCollection) {
            this.scene.events.emit('path_seed_collection', pathSeedCollection);
        }

        // Start Info kontrolu (payload tipine bakılmaksızın)
        const startInfo = envelope.startInformation || envelope.start_information;
        if (startInfo) {
            console.log("Start Information Yakalandı:", startInfo);
            this.scene.events.emit('start_game', startInfo);
        }

        const payloadType = envelope.payload;
        if (!payloadType) {
            // Eğer payload ismi gelmiyorsa bile startInfo veya entityCollection varsa devam et
            if (envelope.entityCollection || envelope.entity_collection) {
                 this.scene.events.emit('entity_collection', envelope.entityCollection || envelope.entity_collection);
            }
            return;
        }

        switch (payloadType) {
            case 'startInformation':
            case 'start_information':
                // Zaten yukarıda handle ettik ama switch yapısını bozmayalım
                break;
            case 'entityCollection':
            case 'entity_collection':
                this.scene.events.emit('entity_collection', envelope.entityCollection || envelope.entity_collection);
                break;
            case 'removeEntity':
            case 'remove_entity':
                this.scene.events.emit('remove_entity', envelope.removeEntity || envelope.remove_entity);
                break;
            case 'pong':
                this._handlePong(envelope.pong);
                break;
            case 'death_notification':
            case 'deathNotification':
                this.scene.events.emit('death_notification', envelope.deathNotification || envelope.death_notification);
                break;
            // Katılım reddi: sunucu bu kareden hemen sonra bağlantıyı kapatır.
            // Sahne kodu sebebi saklar ve 'disconnected' geldiğinde genel
            // "bağlantı koptu" yerine bu sebebi gösterir (bkz. Game.onJoinRejected).
            case 'joinRejected':
            case 'join_rejected':
                this.scene.events.emit('join_rejected', envelope.joinRejected || envelope.join_rejected);
                break;
            // Katılım kabulü + OTORİTER skin id (GUEST: varsayılan, SOCIAL: LootLocker).
            case 'joinAccepted':
            case 'join_accepted':
                this.scene.events.emit('join_accepted', envelope.joinAccepted || envelope.join_accepted);
                break;
            default:
                console.warn('Bilinmeyen sunucu mesajı türü:', payloadType);
        }
    }

    sendUsername() {
        console.warn('SetUsername mesajı newproto şemasında yok. Bu istek atlandı.');
    }

    // Kasıtlı kapanış (ör. Play Again → scene.restart): soketi sessizce kapat.
    // onclose null'lanır ki yeni tura sahte bir 'disconnected' event'i sızmasın.
    disconnect() {
        this._stopPingLoop();
        this.connected = false;
        if (this.socket) {
            this.socket.onopen = null;
            this.socket.onmessage = null;
            this.socket.onclose = null;
            this.socket.onerror = null;
            try { this.socket.close(); } catch (_) { /* zaten kapalı */ }
            this.socket = null;
        }
    }

    _startPingLoop() {
        this._stopPingLoop();
        this.pingCalibrated = false;
        this.pingSampler.reset();
        this.sendPing(); // ilk örneği bekletmeden al
        // Kalibrasyon fazı: hızlandırılmış aralık. _handlePong yeterli örnek
        // toplandığında _switchToSteadyPingInterval() ile normale döndürür.
        this.pingTimer = setInterval(() => this.sendPing(), this.pingCalibIntervalMs);
    }

    _switchToSteadyPingInterval() {
        if (this.pingTimer !== null) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => this.sendPing(), this.pingIntervalMs);
    }

    _stopPingLoop() {
        if (this.pingTimer !== null) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
        this.pendingPings.clear();
    }

    sendPing() {
        if (!this.canSend()) return;

        // Kaybolan pong'ların birikmesini engelle (paket kaybı / sekme arka planı)
        if (this.pendingPings.size > 8) this.pendingPings.clear();

        this.pingNonce = (this.pingNonce + 1) >>> 0;
        if (this.pingNonce === 0) this.pingNonce = 1;
        const nonce = this.pingNonce;
        this.pendingPings.set(nonce, performance.now());

        const pingMsg = client.Ping.create({
            clientTimestamp: Date.now(), // sunucu tarafı görünürlük için; RTT hesabında kullanılmıyor
            nonce
        });
        const envelope = client.ClientEnvelope.create({ ping: pingMsg });
        const buffer = client.ClientEnvelope.encode(envelope).finish();
        this.socket.send(buffer);
    }

    _handlePong(pong) {
        if (!pong) return;
        const nonce = Number(pong.nonce);
        const sentAt = this.pendingPings.get(nonce);
        if (sentAt === undefined) return; // bilinmeyen/eskimiş pong

        this.pendingPings.delete(nonce);
        const rtt = Math.max(0, performance.now() - sentAt);

        // Isınma örneğinin atılması, budanmış pencere ve EMA — hepsi
        // PingSampler'ın içindedir. Burada yalnızca "yayınlanabilir mi"
        // sorusu sorulur.
        if (!this.pingSampler.addSample(rtt)) return;

        if (!this.pingCalibrated) {
            this.pingCalibrated = true;
            this._switchToSteadyPingInterval();
        }

        this.scene.events.emit('ping_update', this.pingSampler.value);
    }
    
    /**
     * Dereceyi ağ formatına (0..250 tamsayı) kuantalar. STATİK ve TEK kaynak:
     * Game.js lokal tahmini de bu değerin geri-çözümüyle (k * 1.44°) besler,
     * böylece client simülasyonu ile sunucunun gördüğü hedef açı birebir aynıdır.
     */
    static quantizeAngleDeg(deg) {
        let positive = deg % 360;
        if (positive < 0) positive += 360;
        const q = Math.round(positive / 1.44);
        // 250 = 360° ≡ 0°; 251/252 boost aksiyonlarına ayrılmıştır, taşma yok.
        return Math.min(250, q);
    }

    // angleValue: quantizeAngleDeg ile önceden kuantalanmış 0..250 değeri.
    // isBoosting: oyuncunun HAM NIYETI (tus basili mi) — uygunluk kapisindan
    //   GECMIS deger DEGIL. Kapi (skor esigi + histerezis) hem sunucuda
    //   (SnakeDynamicsSystem) hem de yerel tahminde (Snake._resolveBoostActive)
    //   ayrica uygulanir; tele giden sey yalnizca niyettir.
    // sendAngle: girdi katmanindaki deadzone/epsilon guard'i aci gonderimini
    //   bastirdiginda false gelir — bu durumda YALNIZCA boost islenir, aci
    //   paketi uretilmez (mouse head merkezine cok yakinken paket spam'ini
    //   onler).
    updateAndSendInput(angleValue, isBoosting, delta, sendAngle = true) {
        if (!this.canSend()) return;

        // 1. NIYET degistiginde anında paket gönder. (Deadzone'da bile boost
        //    her zaman islenmeli — aci gonderiminden bagimsizdir.)
        //
        // KENAR TETIKLEMELI GONDERIM — sunucu tarafinda bir on kosulu vardir:
        // niyet orada KALICI olmalidir. Sunucu eskiden tek bir isBoosting
        // alani tutuyor ve uygunluk kapisi kapandiginda onu false'a cekiyordu;
        // yani ETKIYI ifade etmek icin NIYETI siliyordu. Bizim gonderecegimiz
        // yeni bir kenar OLMADIGI icin (tus durumu degismedi) boost oyuncu
        // tusu birakip yeniden basana kadar KALICI OLARAK kapali kaliyordu.
        // Sunucu artik niyeti (boostRequested) ve etkin durumu (boostActive)
        // ayri alanlarda tutar, dolayisiyla kenar tetikleme yeterlidir ve
        // periyodik bir "niyet tazeleme" paketine gerek yoktur.
        if (isBoosting !== this.isCurrentlyBoosting) {
            this.isCurrentlyBoosting = isBoosting;
            // 251: boost NIYETI basladi, 252: boost NIYETI bitti.
            const actionValue = isBoosting ? 251 : 252;
            this.nextSequenceId++;
            this.sendAction(actionValue, this.nextSequenceId);
        }

        // 2. Zamanlayıcıyı, son kareden bu yana geçen gerçek süre (delta) ile artır.
        //    (Guard aktifken de ilerlesin ki deadzone'dan cikista aci aninda gitsin.)
        this.angleSendTimer += delta;

        // Deadzone / epsilon guard: aci gonderimi bastirildi — boost islendi, cik.
        if (!sendAngle) return;

        const angleChanged = angleValue !== this.lastSentAngleValue;

        // 4. Gönderme koşullarını kontrol et.
        let shouldSendAngle = false;

        if (angleChanged) {
            // Açı değiştiyse, "hareketli" gönderme aralığını kontrol et.
            if (this.angleSendTimer >= this.angleSendIntervalMoving) {
                shouldSendAngle = true;
            }
        } else {
            // Açı aynıysa, "sabit" gönderme aralığını kontrol et.
            if (this.angleSendTimer >= this.angleSendIntervalStill) {
                shouldSendAngle = true;
            }
        }

        // 5. Eğer gönderme koşulu sağlandıysa, paketi gönder ve zamanlayıcıyı sıfırla.
        if (shouldSendAngle) {
            // Sunucuya sadece 0-250 arasındaki sıkıştırılmış değeri gönderiyoruz.
            this.nextSequenceId++;
            this.sendAction(angleValue, this.nextSequenceId);
            this.lastSentAngleValue = angleValue;
            this.angleSendTimer = 0; // Zamanlayıcıyı sıfırla
        }
    }

    sendAction(value, sequenceId = 0) {
        if (!this.canSend()) return;
        const actionValue = Math.max(0, Math.min(252, Number(value) || 0));
        const inputMsg = client.ClientInput.create({ actionValue, sequenceId });
        const envelope = client.ClientEnvelope.create({ clientInput: inputMsg });
        const buffer = client.ClientEnvelope.encode(envelope).finish();
        this.socket.send(buffer);
    }

    sendJoinRequest(nickname) {
        if (!this.canSend()) return;
        const { authType, socialPlayerId } = resolveJoinIdentity();
        const joinRequest = client.JoinRequest.create({ nickname, authType, socialPlayerId });
        const envelope = client.ClientEnvelope.create({ joinRequest: joinRequest });
        const buffer = client.ClientEnvelope.encode(envelope).finish();
        this.socket.send(buffer);
    }
}
