# OBS Multi-Platform Streaming System

Modern arayüzlü, modüler mimariye sahip OBS çoklu platform streaming sistemi.

## Özellikler

- 🎥 **RTMP Server**: OBS Studio'dan gelen RTMP stream'ini alır (node-media-server kullanır)
- 🌐 **Multi-Platform Support**: YouTube, Twitch, Facebook ve daha fazlası
- 🎨 **Modern Dark UI**: Koyu renkli, kullanıcı dostu arayüz
- 🔧 **Web-based Configuration**: Platform ayarlarını web arayüzünden yapabilirsiniz
- 📊 **Real-time Status**: Stream durumunu gerçek zamanlı takip edin
- 🔄 **Auto Relay**: Stream'i otomatik olarak tüm platformlara yönlendirir (FFmpeg kullanır)

## Kurulum

### Gereksinimler

- Node.js >= 18.0.0
- FFmpeg (stream relay için) - [İndirme Linki](https://ffmpeg.org/download.html)
- OBS Studio

### Adımlar

1. Bağımlılıkları yükleyin:

```bash
npm install
```

2. Projeyi derleyin:

```bash
npm run build
```

3. Uygulamayı başlatın:

```bash
npm start
```

Veya development mode'da çalıştırmak için:

```bash
npm run dev
```

## Kullanım

### OBS Studio Ayarları

1. OBS Studio'yu açın
2. Settings > Stream bölümüne gidin
3. Service: Custom
4. Server: `rtmp://localhost:1935/live`
5. Stream Key: `obs` (veya config.yaml'da belirlediğiniz key)

### Web Arayüzü

1. Tarayıcınızda `http://localhost:8000` adresine gidin
2. "Platforms" bölümünden platform ekleyin
3. Her platform için RTMP URL ve Stream Key girin
4. "Start Stream" butonuna tıklayın

### Platform Ayarları

#### YouTube
- RTMP URL: `rtmp://a.rtmp.youtube.com/live2`
- Stream Key: YouTube Studio'dan alın

#### Twitch
- RTMP URL: `rtmp://live.twitch.tv/app/`
- Stream Key: Twitch Dashboard'dan alın

#### Facebook
- RTMP URL: `rtmps://live-api-s.facebook.com:443/rtmp/`
- Stream Key: Facebook Live Producer'dan alın

## Yapılandırma

Yapılandırma dosyası `config.yaml` içinde bulunur:

```yaml
stream_manager:
  rtmp_server:
    host: 0.0.0.0
    port: 1935
    app_name: live
    stream_key: obs
    enabled: true
  platforms:
    - name: youtube
      rtmp_url: rtmp://a.rtmp.youtube.com/live2
      stream_key: YOUR_STREAM_KEY
      enabled: true
    - name: twitch
      rtmp_url: rtmp://live.twitch.tv/app/
      stream_key: YOUR_STREAM_KEY
      enabled: true
ui:
  host: 0.0.0.0
  port: 8000
```

## Geliştirme

### Development Mode

Development mode'da çalıştırmak için TypeScript dosyalarını derlemeden doğrudan çalıştırabilirsiniz:

```bash
npm run dev
```

Bu komut `tsx` kullanarak TypeScript dosyalarını doğrudan çalıştırır. Hot reload özelliği yoktur, değişiklikler için uygulamayı yeniden başlatmanız gerekir.

**Ne zaman kullanılır:**
- Hızlı test ve geliştirme için
- Build işlemi yapmadan kod değişikliklerini test etmek için
- Debugging sırasında

**Çıktı:**
- Uygulama `src/main.ts` dosyasından başlatılır
- TypeScript dosyaları runtime'da derlenir
- Console'da detaylı loglar görüntülenir

---

### Build

Projeyi production için derler. TypeScript kodlarını JavaScript'e çevirir, frontend dosyalarını kopyalar ve minify eder.

```bash
npm run build
```

Bu komut şu adımları sırayla çalıştırır:

1. **TypeScript Derleme** (`tsc`): 
   - `src/` klasöründeki tüm `.ts` dosyalarını derler
   - Çıktı `dist/` klasörüne yazılır
   - Type hatalarını kontrol eder

2. **Frontend Kopyalama** (`copy-frontend`):
   - `src/ui/frontend/` içindeki HTML, CSS, JS dosyalarını `dist/ui/frontend/` klasörüne kopyalar
   - Statik dosyalar (ikonlar, vb.) kopyalanır

3. **Minification** (`minify-frontend`):
   - JavaScript dosyalarını minify eder (terser kullanır)
   - CSS dosyalarını minify eder (cssnano kullanır)
   - Source map dosyaları oluşturulur

**Ne zaman kullanılır:**
- Production build oluşturmadan önce
- Electron uygulaması derlemeden önce
- Deploy etmeden önce
- Kod değişikliklerini test etmek için

**Çıktı:**
- `dist/` klasöründe derlenmiş JavaScript dosyaları
- `dist/ui/frontend/` klasöründe minify edilmiş frontend dosyaları
- Build hataları varsa console'da gösterilir

**Örnek çıktı:**
```
> tsc
> node scripts/copy-frontend.mjs
> terser dist/ui/frontend/static/js/... -o dist/ui/frontend/static/js/main.min.js
> cssnano dist/ui/frontend/static/css/main.css dist/ui/frontend/static/css/main.min.css
```

---

### Watch Mode

TypeScript dosyalarındaki değişiklikleri izler ve otomatik olarak yeniden derler. Build işlemini manuel olarak tekrarlamanıza gerek kalmaz.

```bash
npm run watch
```

**Ne zaman kullanılır:**
- Aktif geliştirme sırasında
- TypeScript dosyalarında sürekli değişiklik yaparken
- Build işlemini otomatikleştirmek için

**Nasıl çalışır:**
- `tsc --watch` komutu çalıştırılır
- `src/` klasöründeki tüm `.ts` dosyaları izlenir
- Bir dosya değiştiğinde otomatik olarak yeniden derlenir
- Sadece TypeScript derlemesi yapılır (frontend kopyalama ve minify işlemleri yapılmaz)

**Çıktı:**
- Her değişiklikte console'da derleme durumu gösterilir
- Hatalar anında gösterilir
- Başarılı derleme sonrası "Found X errors. Watching for file changes." mesajı görünür

**Not:** Watch mode sadece TypeScript derlemesini yapar. Frontend dosyalarını güncellemek için `npm run build` komutunu manuel olarak çalıştırmanız gerekir.

**Kullanım örneği:**
```bash
# Terminal 1: Watch mode'u başlat
npm run watch

# Terminal 2: Uygulamayı çalıştır (watch mode build'leri kullanır)
npm start
```

---

### Lint

Kod kalitesini kontrol eder ve potansiyel hataları, stil sorunlarını ve best practice ihlallerini tespit eder.

```bash
npm run lint
```

**Ne zaman kullanılır:**
- Kod göndermeden önce (pre-commit)
- Code review öncesi
- Kod kalitesini kontrol etmek için
- CI/CD pipeline'ında

**Nasıl çalışır:**
- ESLint kullanarak `src/` klasöründeki tüm `.ts` dosyalarını analiz eder
- TypeScript ESLint kurallarını uygular
- Kod stilini ve best practice'leri kontrol eder

**Çıktı:**
- Hata yoksa: Hiçbir çıktı göstermez (başarılı)
- Hata varsa: Her hata için dosya yolu, satır numarası ve hata açıklaması gösterilir

**Örnek çıktı:**
```
src/main.ts
  15:5  error  'unusedVariable' is assigned a value but never used  @typescript-eslint/no-unused-vars
  23:10  error  Missing return type on function                      @typescript-eslint/explicit-function-return-type

✖ 2 problems (2 errors, 0 warnings)
```

**Hataları otomatik düzeltme:**
Bazı lint hataları otomatik olarak düzeltilebilir:
```bash
npm run lint -- --fix
```

---

### Format

Kod formatını Prettier kullanarak otomatik olarak düzenler. Tüm TypeScript dosyalarını tutarlı bir formatta yazar.

```bash
npm run format
```

**Ne zaman kullanılır:**
- Kod göndermeden önce
- Farklı editörlerden gelen format farklılıklarını düzeltmek için
- Kod stilini standardize etmek için
- Pre-commit hook'larında

**Nasıl çalışır:**
- Prettier kullanarak `src/**/*.ts` pattern'ine uyan tüm dosyaları formatlar
- Indentation, spacing, line breaks, quotes gibi format kurallarını uygular
- Dosyaları yerinde (in-place) düzenler

**Formatlanan öğeler:**
- Indentation (2 spaces)
- Semicolons
- Quotes (single/double)
- Trailing commas
- Line length
- Object/array formatting
- Function formatting

**Çıktı:**
- Formatlanan dosyaların listesi gösterilir
- Örnek: `src/main.ts`, `src/config/Config.ts` gibi

**Örnek çıktı:**
```
src/main.ts 125ms
src/config/Config.ts 89ms
src/stream/StreamManager.ts 234ms
```

**Sadece kontrol etmek (formatlamadan):**
Formatlamadan sadece hangi dosyaların formatlanması gerektiğini görmek için:
```bash
npx prettier --check "src/**/*.ts"
```

**Not:** Format komutu dosyaları değiştirir. Değişiklikleri commit etmeden önce kontrol etmeyi unutmayın.

---

### Geliştirme Workflow Önerisi

1. **Watch mode'u başlatın:**
   ```bash
   npm run watch
   ```

2. **Başka bir terminalde uygulamayı çalıştırın:**
   ```bash
   npm run dev
   ```

3. **Kod değişikliklerinden sonra:**
   - Watch mode otomatik olarak TypeScript'i derler
   - Uygulamayı yeniden başlatın (dev mode'da hot reload yok)

4. **Commit öncesi:**
   ```bash
   npm run format  # Kod formatını düzelt
   npm run lint    # Lint hatalarını kontrol et
   npm run build   # Final build'i test et
   ```

---

### Diğer Geliştirme Komutları

**Test:**
```bash
npm test
```
Vitest kullanarak unit testleri çalıştırır.

**Electron Development:**
```bash
npm run dev:electron
```
Electron uygulamasını development mode'da çalıştırır.

**Port Temizleme:**
```bash
npm run kill-ports
```
Kullanımda olan portları (8000, 1935) temizler (Windows PowerShell).

## Mimari

Proje modüler mimariye sahiptir:

- **Core**: Temel interface'ler ve modül yönetimi
- **Stream**: RTMP server ve stream yönetimi
- **Platforms**: Platform adaptörleri
- **UI**: Web arayüzü ve API

## Nasıl Çalışır?

1. OBS Studio'dan RTMP stream'i `rtmp://localhost:1935/live/obs` adresine gönderilir
2. RTMP server (node-media-server) stream'i alır
3. Stream Manager, stream'i tüm aktif platformlara yönlendirir (FFmpeg kullanarak)
4. Her platform adaptörü, kendi RTMP URL'ine stream'i gönderir

## Lisans

MIT
