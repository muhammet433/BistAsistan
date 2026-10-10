# BIST Analiz

Borsa İstanbul hisseleri için gerçek zamanlı fiyat takibi, teknik analiz, alarm
ve bildirim sistemi sunan mobil uygulama projesi.

## Teknolojiler

**Backend** — Node.js + Express
**Mobil** — Expo (React Native) + TypeScript + Expo Router
**Veri** — Yahoo Finance API (BIST sembolleri, `.IS` uzantısı ile)
**Grafik** — react-native-svg
**Bildirim** — Firebase Cloud Messaging

## Proje Yapısı

```
bist-analiz/
├── backend/
│   ├── src/
│   │   ├── index.js                      # Express sunucu + cron + endpoint'ler
│   │   ├── database.js                   # SQLite şeması ve katmanı
│   │   ├── dataFetcher.js                # Yahoo Finance BIST veri çekme
│   │   ├── analysisEngine.js             # RSI, MACD, SMA, EMA, Bollinger
│   │   ├── authService.js                # Kayıt, giriş, token yönetimi
│   │   ├── alertService.js               # Alarm oluşturma / tetikleme
│   │   ├── notificationService.js        # FCM gönderimi
│   │   ├── notificationHistoryService.js # Bildirim geçmişi
│   │   └── newsService.js                # RSS haber akışı
│   ├── data/bist.db                      # Otomatik oluşur (git'e dahil değil)
│   ├── .env.example
│   └── package.json
└── mobile/
    └── src/
        ├── app/
        │   ├── (tabs)/
        │   │   ├── index.tsx        # Hisse listesi
        │   │   ├── watchlist.tsx    # Takip listem
        │   │   ├── alerts.tsx       # Alarmlar
        │   │   ├── news.tsx         # Haberler
        │   │   ├── history.tsx      # Bildirim geçmişi
        │   │   └── notifications.tsx# FCM ayarları
        │   ├── detail/[symbol].tsx  # Hisse detayı + grafik
        │   ├── auth.tsx             # Login / Register
        │   └── _layout.tsx          # Root navigator
        ├── components/
        │   └── PriceChart.tsx       # SVG fiyat grafiği
        └── services/
            └── api.ts               # Backend API istemcisi
```

## Veritabanı

Backend, Node'un yerleşik `node:sqlite` modülünü kullanır — ek paket
gerekmez. Veriler `backend/data/bist.db` dosyasında saklanır ve sunucu
yeniden başlatıldığında korunur.

**Tablolar:** `users`, `sessions`, `watchlist`, `alerts`, `notifications`

Şifreler her kullanıcı için rastgele üretilen salt ile SHA-256 hashlenir,
karşılaştırma `timingSafeEqual` ile yapılır. Oturumlar 30 gün sonunda
otomatik temizlenir.

## Kurulum

### 1. Backend

```bash
cd backend
npm install
node src/index.js
```

Sunucu `http://localhost:3000` adresinde çalışır.

### 2. Mobil

```bash
cd mobile
npm install
npx expo start
```

Fiziksel cihazda Expo Go ile tarayıp çalıştırabilirsiniz.

## Firebase Kurulumu (Opsiyonel)

Push bildirimleri kullanmak için:

1. [Firebase Console](https://console.firebase.google.com) → proje oluştur
2. Proje Ayarları → Hizmet Hesapları → yeni anahtar oluştur
3. İndirilen JSON dosyasını `backend/firebase-service-account.json`
   olarak kaydedin
4. `mobile/.env` dosyasına ekleyin:
   ```
   EXPO_PUBLIC_PROJECT_ID=proje-id
   ```

Firebase yapılandırılmamışsa backend otomatik olarak **mock modda**
çalışır ve bildirimleri konsola yazar; uygulama sorunsuz çalışır.

## API Endpoint'leri

| Metot | Yol | Açıklama |
|-------|-----|----------|
| GET | `/api/health` | Sunucu durumu |
| GET | `/api/quotes` | Tüm BIST hisseleri anlık fiyat |
| GET | `/api/quote/:symbol` | Tek hisse detayı |
| GET | `/api/historical/:symbol` | Geçmiş fiyat verisi |
| GET | `/api/analyze/:symbol` | Teknik analiz + sinyaller |
| GET | `/api/news` | Haber akışı |
| GET | `/api/market-summary` | En çok yükselen/düşen |
| POST | `/api/auth/register` | Kullanıcı kaydı |
| POST | `/api/auth/login` | Giriş |
| POST | `/api/auth/logout` | Çıkış |
| GET | `/api/user/profile` | Kullanıcı profili |
| PUT | `/api/user/preferences` | Min. güven eşiği |
| POST | `/api/user/fcm-token` | FCM token kaydı |
| GET | `/api/watchlist` | Takip listesi |
| POST | `/api/watchlist/add` | Takibe ekle |
| POST | `/api/watchlist/remove` | Takipten çıkar |
| GET | `/api/alerts` | Alarm listesi |
| POST | `/api/alerts` | Alarm oluştur |
| DELETE | `/api/alerts/:alertId` | Alarm sil |
| POST | `/api/alerts/:alertId/reactivate` | Alarmı yeniden aktif et |
| GET | `/api/notifications` | Bildirim geçmişi + okunmamış sayısı |
| POST | `/api/notifications/read` | Tümünü okundu işaretle |
| DELETE | `/api/notifications` | Geçmişi temizle |

`/api/user/*`, `/api/watchlist/*`, `/api/alerts/*` ve `/api/notifications/*`
uçları `Authorization: Bearer <token>` başlığı ister.

## Teknik Analiz Göstergeleri

- **RSI (14)** — 30 altı aşırı satım, 70 üstü aşırı alım
- **MACD (12/26/9)** — sinyal çizgisi kesişimleri
- **SMA / EMA (20)** — kısa vadeli trend yönü
- **Bollinger Bantları (20, 2σ)** — volatilite aralığı
- **Momentum (10 gün)** — güçlü yükseliş/düşüş tespiti

Sinyaller ağırlıklandırılır (güçlü 2, orta 1.5, zayıf 1) ve net sonuç
%0–100 güven skoru üretir.

## Notlar

- Veriler 15 dakikada bir otomatik yenilenir
- Şifreler salt ile SHA-256 hashlenir, oturumlar 30 gün geçerlidir
- Bildirimler takip listesindeki hisseler için gönderilir
- **Bu uygulama yatırım tavsiyesi değildir**

## Kontrol Komutları

```bash
# Backend
node src/index.js

# Mobil tip kontrolü
npx tsc --noEmit

# Mobil lint
npx eslint src/ --ext .ts,.tsx
```