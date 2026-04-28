# Game Client Referans Notları

Bu doküman, gelecekteki geliştirmelerde istemci projesini daha iyi anlamak ve yeni özellikleri hızlıca ekleyebilmek için bir başvuru kaynağıdır.

## Mimari ve Ana Bileşenler
- **Oyun Motoru:** Phaser 3 kullanılmaktadır. Ekran boyutlandırması, kamera takibi ve oyun döngüsü Phaser Scene (`src/game/scenes/Game.js`) üzerinden kontrol edilir.
- **Ağ ve Bağlantı:** WebSocket (`NetworkManager.js`) ile sunucuya bağlanılır. Protobuf formatındaki paketler dinlenir ve decode edilir. İlgili komutlar Phaser'ın `event` sistemi kullanılarak `Game.js`'e iletilir (Örn: `start_game`, `entity_collection`).
- **Tahminleme (Client-Side Prediction):** Oyuncu kendi yılanını sunucudan veri gelmesini beklemeden yerel olarak hareket ettirir (`Snake.js` içindeki `updateFromInput` fonksiyonu). Sunucudan asıl pozisyon geldiğinde düzeltme yapılır.

## İlgili Sınıflar ve Fonksiyonlar
1. **Oyun Döngüsü ve Sahne (`Game.js`)**
   - `onStartGame(startInfo)`: Sunucuya bağlanıldığında tetiklenir. `worldRadius` verisini kullanarak kameranın sınırlarını çizer ve kırmızı bir sınır çizgisi render eder. **Önemli:** `boundaryGraphics` `depth=500` ile ayarlanmalıdır; grid `depth=-1, scrollFactor=0` olduğundan boundary'nin `depth=-1` olması çizginin görünmemesine sebep olur. `strokeCircle(worldRadius, worldRadius, worldRadius - 3)` ile worldspace koordinatlarında çizilir.
   - `onEntityCollection(entityCollection)`: Görüş alanındaki (AOI) diğer yılanların verilerini işler. Diğer oyuncuların yılanları oluşturulurken açı bilgisini parse eder.
   - `upsertFood(foodData)`: Yeni yemleri haritaya ekler. Performans için Phaser'ın `Blitter` (çok sayıda statik resmi tek seferde çizen sistem) altyapısını kullanır. Yemler kümeler halinde görselleştirilir.
   - `update(time, delta)`: Her frame'de yılanları hareket ettirir, kamerayı zoomlar (skora göre) ve fare tıklama durumunu sunucuya iletir.

2. **Yılan Çizimi ve Mantığı (`Snake.js`)**
   - Yılan başı (head) ve segmentleri (vücudu) için "Path History" (Geçmiş Yol İzleme) optimizasyonu kullanılır. Sunucudan segmentlerin anlık koordinatları yerine, sadece başın hareketi gelir ve gövde başın eski geçtiği yolları (path) takip ederek render edilir.
   - Yılan boyutunu büyütmek için dinamik `scale` sistemi mevcuttur.
   - **Reconciliation — Velocity-Offset Pattern (Önemli):** `_reconcilePlayerWithServer()` sunucu pozisyonuna uyum sağlamak için `head.setPosition()` KULLANMAZ. Bu, sprite'ı anında hareket ettirir ve jitter yaratır. Bunun yerine `body.velocity`'e küçük bir offset eklenir. `updateFromInput()` bir sonraki frame'de velocity'i sıfırlar, bu offset yalnızca tek frame etkilidir. Emergency snap (>800px) için setPosition+body.reset hâlâ kullanılır ve `cameraAnchor` senkronize edilir.
   - **Bilinen Jitter Kaynakları ve Çözümler:**
     1. `setRoundPixels(true)` + sürekli zoom lerp → 1px pixel-snap → **Çözüm:** kaldırıldı, zoom `|Δ| > 0.0005` eşiğiyle güncelleniyor.
     2. `Math.round()` segment/göz pozisyonlarında → pixel boundary snap → **Çözüm:** kaldırıldı.
     3. `longitudinal > 0` koşulu: sunucu latency nedeniyle her zaman geride olduğundan her frame tetikleniyordu → **Çözüm:** `longitudinal > maxExpectedLag * 0.3` koşuluyla eşikli hâle getirildi.
   - **SnakeConfig Reconciliation Sabitleri:** `RECONCILIATION_LATERAL_DEADZONE=15px`, `RECONCILIATION_LONGITUDINAL_MAX_LAG=1.2`, `RECONCILIATION_VELOCITY_GAIN=4.0`, `RECONCILIATION_SNAP_DISTANCE=800px`.
   - **Kamera Anchor:** Kamera `head` yerine `scene.cameraAnchor = {x, y}` objesini takip eder. `update()` içinde `updateFromInput` sonrasında güncellenir. Emergency snap'te de senkronize edilir.

3. **Veri Formatı ve Encode/Decode (`bundle.js`)**
   - Sunucudan alınan binary (byte[]) paketler protobuf.js modülü ile parse edilir. Projenin `.proto` yapılarının TypeScript tanımları `bundle.d.ts` dosyasında bulunabilir.

## UI ve Kullanıcı Deneyimi
- **Game Over:** Oyuncu öldüğünde (Örn: Çarpışma, Harita sınırı dışına çıkma), `onGameOver` veya `onDeathNotification` eventleri tetiklenir ve ekrana modern tasarımlı bir Game Over modali çizilir.
- **Loading:** Sunucu beklenirken ortada görünen animasyonlu bekleme arayüzü `createLoadingUI` fonksiyonunda tanımlıdır.
- **Oyuna Giriş ve Veri Senkronizasyonu (Loader Gizleme):** Oyun ilk başladığında `StartInformation` ve sonrasında `EntityCollection` (oyuncunun kendisini ve etraftaki varlıkları içeren paket) sunucudan gelir. Erken rendering problemlerini (önüne geçme) için `initialDataFlags` durumu kontrol edilir. Her iki veri de ulaşınca `checkInitialDataComplete()` tetiklenerek oyun aktifleşir ve loading ekranı kapatılır.
- **Fizik Dünya Sınırı ve Camera Bounds Etkileşimi (Önemli):** `cameras.main.setBounds()` bazı Phaser sürümlerinde `physics.world.setBounds()` öğrencisini tetikler ve Arcade physics body snake head'i harita sınırında fiziksel olarak bloke eder (sıkışma). Bu nedenle `onStartGame` içinde `physics.world.setBounds()` görsel dünya boyutunun 3 katı kadar büyük ayarlanır. Ek olarak `Snake.js` içinde `head.body.setCollideWorldBounds(false)` kesin olarak belirtilir. Ölüm kontrolü tamamen sunucu tarafında `SnakeHeadBodyCollisionSystem` üzerinden yapılır.

## Başlangıç Yönü ve Kuyruk Oluşumu (Start Direction)
- `Snake.js` oluşturulurken `StartInformation` veya diğer entity'lerin spawn bilgilerinden gelen `angle` bilgisi constructor'a parametre olarak geçilir (`initialAngleRaw`). `_initPathWarmup` sırasında yılanın ilk kuyruk segmentlerinin yerleştirileceği "path" dizisi hesaplanırken, başlangıç açısına uygun (başın arkasına düşecek) vektörel yön `(-Math.cos(angle), -Math.sin(angle))` kullanılır. Bu sayede oyuna giren yılanın baş yönüyle kuyruk dizilimi birebir örtüşür ve "zıt yön" veya uzun atlamalı lerp hatalarının önüne geçilir.
