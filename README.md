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

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Lint

```bash
npm run lint
```

### Format

```bash
npm run format
```

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
