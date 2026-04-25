# Game Client Referans Notları

Bu doküman, gelecekteki geliştirmelerde istemci projesini daha iyi anlamak ve yeni özellikleri hızlıca ekleyebilmek için bir başvuru kaynağıdır.

## Mimari ve Ana Bileşenler
- **Oyun Motoru:** Phaser 3 kullanılmaktadır. Ekran boyutlandırması, kamera takibi ve oyun döngüsü Phaser Scene (`src/game/scenes/Game.js`) üzerinden kontrol edilir.
- **Ağ ve Bağlantı:** WebSocket (`NetworkManager.js`) ile sunucuya bağlanılır. Protobuf formatındaki paketler dinlenir ve decode edilir. İlgili komutlar Phaser'ın `event` sistemi kullanılarak `Game.js`'e iletilir (Örn: `start_game`, `entity_collection`).
- **Tahminleme (Client-Side Prediction):** Oyuncu kendi yılanını sunucudan veri gelmesini beklemeden yerel olarak hareket ettirir (`Snake.js` içindeki `updateFromInput` fonksiyonu). Sunucudan asıl pozisyon geldiğinde düzeltme yapılır.

## İlgili Sınıflar ve Fonksiyonlar
1. **Oyun Döngüsü ve Sahne (`Game.js`)**
   - `onStartGame(startInfo)`: Sunucuya bağlanıldığında tetiklenir. `worldRadius` verisini kullanarak kameranın sınırlarını çizer (örn. `this.cameras.main.setBounds(0, 0, worldSize, worldSize)`) ve kırmızı bir sınır çizgisi render eder.
   - `onEntityCollection(entityCollection)`: Görüş alanındaki (AOI) diğer yılanların verilerini işler.
   - `upsertFood(foodData)`: Yeni yemleri haritaya ekler. Performans için Phaser'ın `Blitter` (çok sayıda statik resmi tek seferde çizen sistem) altyapısını kullanır. Yemler kümeler halinde görselleştirilir.
   - `update(time, delta)`: Her frame'de yılanları hareket ettirir, kamerayı zoomlar (skora göre) ve fare tıklama durumunu sunucuya iletir.

2. **Yılan Çizimi ve Mantığı (`Snake.js`)**
   - Yılan başı (head) ve segmentleri (vücudu) için "Path History" (Geçmiş Yol İzleme) optimizasyonu kullanılır. Sunucudan segmentlerin anlık koordinatları yerine, sadece başın hareketi gelir ve gövde başın eski geçtiği yolları (path) takip ederek render edilir.
   - Yılan boyutunu büyütmek için dinamik `scale` sistemi mevcuttur.

3. **Veri Formatı ve Encode/Decode (`bundle.js`)**
   - Sunucudan alınan binary (byte[]) paketler protobuf.js modülü ile parse edilir. Projenin `.proto` yapılarının TypeScript tanımları `bundle.d.ts` dosyasında bulunabilir.

## UI ve Kullanıcı Deneyimi
- **Game Over:** Oyuncu öldüğünde (Örn: Çarpışma, Harita sınırı dışına çıkma), `onGameOver` veya `onDeathNotification` eventleri tetiklenir ve ekrana modern tasarımlı bir Game Over modali çizilir.
- **Loading:** Sunucu beklenirken ortada görünen animasyonlu bekleme arayüzü `createLoadingUI` fonksiyonunda tanımlıdır.
