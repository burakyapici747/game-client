import { client, server } from './bundle.js';


export class NetworkManager {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.socket = null;
        this.connected = false;


        const serverIP = import.meta.env.VITE_SERVER_URL || '127.0.0.1';
        this.wsUrl = `ws://${serverIP}:8080/ws`;
        this.isCurrentlyBoosting = false;

        this.lastSentAngleValue = -1;
        this.angleSendTimer = 0;
        // Dosya: NetWorkManager.js. Neden: 60fps gonderim gereksiz bandwidth tuketiyor.
        // 30Hz gonderim yeterli hassasiyet sagliyor, paket sayisi yarisina dusuyor.
        this.angleSendIntervalMoving = 1000 / 30;
        this.angleSendIntervalStill = 250;
        this.nextSequenceId = 0;
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

            // Nickname bilgisini sunucuya gonder
            const nickname = window.gameSettings?.nickname || '';
            this.sendJoinRequest(nickname);
            this.sendPing();
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

        const foodMutationCollection =
            envelope.foodMutationCollection ?? envelope.food_mutation_collection;
        if (foodMutationCollection) {
            this.scene.events.emit('food_mutation_collection', foodMutationCollection);
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
                if (envelope.pong?.clientTimestamp !== undefined) {
                    const clientTimestamp = Number(envelope.pong.clientTimestamp);
                    if (Number.isFinite(clientTimestamp) && clientTimestamp > 0) {
                        const latency = Date.now() - clientTimestamp;
                        console.log(`Ping: ${latency}ms`);
                    }
                }
                break;
            case 'death_notification':
            case 'deathNotification':
                this.scene.events.emit('death_notification', envelope.deathNotification || envelope.death_notification);
                break;
            default:
                console.warn('Bilinmeyen sunucu mesajı türü:', payloadType);
        }
    }

    sendUsername() {
        console.warn('SetUsername mesajı newproto şemasında yok. Bu istek atlandı.');
    }

    sendPing(nonce = 0) {
        if (!this.canSend()) return;
        const pingMsg = client.Ping.create({
            clientTimestamp: Date.now(),
            nonce: Math.floor(Math.random() * 1000000)
        });
        const envelope = client.ClientEnvelope.create({ ping: pingMsg });
        const buffer = client.ClientEnvelope.encode(envelope).finish();
        this.socket.send(buffer);
    }
    
    updateAndSendInput(targetAngle, isBoosting, delta) {
        if (!this.canSend()) return;

        // 1. Boost durumu değiştiğinde anında paket gönder.
        if (isBoosting !== this.isCurrentlyBoosting) {
            this.isCurrentlyBoosting = isBoosting;
            const actionValue = isBoosting ? 251 : 252; // 251: Boost Başlat, 252: Boost Bitir
            this.nextSequenceId++;
            this.sendAction(actionValue, this.nextSequenceId);
        }

        // 2. Zamanlayıcıyı, son kareden bu yana geçen gerçek süre (delta) ile artır.
        this.angleSendTimer += delta;

        // 3. Açıyı ağ paketi için optimize et (0-360 aralığını 0-250 aralığına sıkıştır).
        // a. Açıyı her zaman pozitif yap (0-360 aralığı).
        let positiveAngle = targetAngle;
        if (positiveAngle < 0) {
            positiveAngle += 360;
        }

        // b. Açıyı 0-250 aralığına haritala ve tam sayıya yuvarla.
        // Sunucu bu değeri 1.44 ile çarparak orijinal açıya (~360 derece) geri dönecek.
        const angleValue = Math.round(positiveAngle / 1.44);
        
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
        const joinRequest = client.JoinRequest.create({ nickname });
        const envelope = client.ClientEnvelope.create({ joinRequest: joinRequest });
        const buffer = client.ClientEnvelope.encode(envelope).finish();
        this.socket.send(buffer);
    }
}
