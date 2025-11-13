# Auto-Update System (Otomatik Güncelleme Sistemi)

Bu proje, Electron uygulaması için otomatik güncelleme sistemi içerir. İlk açılışta ve periyodik olarak (24 saatte bir) yeni versiyon kontrolü yapar.

## Özellikler

✅ **İlk açılışta otomatik kontrol** - Uygulama açıldığında 3 saniye sonra versiyon kontrolü yapar  
✅ **Periyodik kontrol** - Her 24 saatte bir otomatik kontrol  
✅ **GitHub Releases entegrasyonu** - GitHub Releases üzerinden güncellemeleri yönetir  
✅ **Kullanıcı onayı ile indirme** - Güncelleme bulunduğunda kullanıcıya sorar  
✅ **İndirme ilerleme gösterimi** - Güncelleme indirilirken ilerleme gösterir  
✅ **Otomatik kurulum** - Uygulama kapanırken otomatik kurulum yapar  
✅ **Manuel kontrol** - IPC üzerinden manuel kontrol yapılabilir  

## Kurulum

### 1. GitHub Repository Bilgilerini Güncelle

`package.json` dosyasında GitHub repository bilgilerinizi güncelleyin:

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "YOUR_GITHUB_USERNAME",  // ← GitHub kullanıcı adınız
      "repo": "YOUR_REPO_NAME"          // ← Repository adınız
    }
  }
}
```

**Örnek:**
```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "akmaster",
      "repo": "SON4"
    }
  }
}
```

### 2. GitHub Token (Opsiyonel)

Eğer private repository kullanıyorsanız veya rate limit sorunları yaşıyorsanız, GitHub token ekleyebilirsiniz:

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "YOUR_GITHUB_USERNAME",
      "repo": "YOUR_REPO_NAME",
      "token": "${GH_TOKEN}"  // Ortam değişkeninden alınır
    }
  }
}
```

Ortam değişkenini ayarlayın:
```bash
# Windows PowerShell
$env:GH_TOKEN="your_github_token_here"

# Linux/Mac
export GH_TOKEN="your_github_token_here"
```

### 3. Paket Kurulumu

```bash
npm install
```

## Kullanım

### Otomatik Kontrol

Uygulama ilk açıldığında otomatik olarak versiyon kontrolü yapar:
- İlk açılışta 3 saniye sonra kontrol eder
- Her 24 saatte bir otomatik kontrol yapar
- Güncelleme bulunduğunda kullanıcıya bildirim gösterir

### Manuel Kontrol (IPC)

Renderer process'ten manuel kontrol yapabilirsiniz:

```javascript
// Preload script'ten
const { ipcRenderer } = require('electron');

// Güncelleme kontrolü
const result = await ipcRenderer.invoke('check-for-updates');
console.log(result);
// { available: true, version: "1.0.1", currentVersion: "1.0.0" }

// Güncelleme durumunu al
const status = await ipcRenderer.invoke('get-update-status');
console.log(status);
// { available: true, version: "1.0.1", currentVersion: "1.0.0" }
```

## Release Oluşturma

### 1. Versiyon Güncelle

`package.json` dosyasında versiyonu güncelleyin:

```json
{
  "version": "1.0.1"
}
```

### 2. Build ve Release

```bash
# Build ve release hazırlığı
npm run release:prepare

# GitHub'a tag oluştur
git tag v1.0.1
git push origin v1.0.1
```

### 3. GitHub Actions (Otomatik)

GitHub Actions workflow'u otomatik olarak:
- Build yapar
- Release oluşturur
- Güncelleme dosyalarını yükler

Workflow'u manuel tetiklemek için:
1. GitHub repository'nize gidin
2. **Actions** sekmesine tıklayın
3. **Build and Release** workflow'unu seçin
4. **Run workflow** butonuna tıklayın
5. Versiyon tag'ini girin (örn: `v1.0.1`)

## Güncelleme Akışı

1. **Kontrol**: Uygulama GitHub Releases'ı kontrol eder
2. **Bildirim**: Yeni versiyon bulunduğunda kullanıcıya bildirim gösterilir
3. **Onay**: Kullanıcı "Download Now" veya "Later" seçer
4. **İndirme**: Kullanıcı onaylarsa güncelleme indirilir
5. **Kurulum**: İndirme tamamlandığında kurulum için onay istenir
6. **Yeniden Başlatma**: Uygulama yeniden başlatılır ve güncelleme kurulur

## Yapılandırma

### Update Modülü Ayarları

`src/electron/modules/ElectronUpdateModule.ts` dosyasında:

```typescript
// Kontrol aralığı (varsayılan: 24 saat)
private readonly CHECK_INTERVAL = 1000 * 60 * 60 * 24;

// Otomatik indirme (varsayılan: false - kullanıcı onayı gerekli)
autoUpdater.autoDownload = false;

// Uygulama kapanırken otomatik kurulum (varsayılan: true)
autoUpdater.autoInstallOnAppQuit = true;
```

## Sorun Giderme

### Güncelleme Kontrolü Çalışmıyor

1. **Development Mode**: Development mode'da güncelleme kontrolü devre dışıdır. Sadece packaged uygulamalarda çalışır.

2. **GitHub Repository**: `package.json`'daki repository bilgilerinin doğru olduğundan emin olun.

3. **Release Oluşturuldu mu?**: GitHub Releases'da release oluşturulmuş olmalı.

4. **Versiyon Formatı**: Versiyon numarası semantic versioning formatında olmalı (örn: `1.0.0`, `1.0.1`).

### Rate Limit Hatası

GitHub API rate limit'ine takılıyorsanız:
- GitHub token kullanın
- Kontrol aralığını artırın (24 saatten daha uzun)

### İndirme Başarısız

- İnternet bağlantınızı kontrol edin
- GitHub Releases'ın erişilebilir olduğundan emin olun
- Firewall/antivirus yazılımının engellemediğinden emin olun

## Notlar

- ⚠️ Development mode'da (`npm run dev:electron`) güncelleme kontrolü çalışmaz
- ⚠️ Sadece packaged uygulamalarda (`npm run build:electron:win`) çalışır
- ⚠️ İlk açılışta 3 saniye gecikme ile kontrol yapar (uygulama başlarken)
- ⚠️ Periyodik kontrol 24 saatte bir yapılır
- ⚠️ Kullanıcı onayı olmadan otomatik indirme yapılmaz (güvenlik)

## Geliştirme

### Test Etme

Development mode'da test etmek için:

1. `app.isPackaged` kontrolünü geçici olarak kaldırın
2. Test release oluşturun
3. Versiyon numarasını düşürün (örn: `0.9.9`)
4. Uygulamayı çalıştırın ve güncelleme kontrolünü test edin

### Debug

Update modülü logları:
- `[electron_update]` prefix'i ile loglar görüntülenir
- Console'da güncelleme durumu takip edilebilir

## Lisans

MIT License - Bu özellik açık kaynak kodludur.

