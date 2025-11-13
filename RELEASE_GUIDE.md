# Manuel Release Oluşturma Kılavuzu

GitHub Actions billing sorunu nedeniyle otomatik build çalışmıyorsa, manuel olarak release oluşturabilirsiniz.

## Adım 1: Local Build

```bash
# 1. Projeyi temizle ve derle
npm run build

# 2. İkonları oluştur
npm run generate-icons

# 3. Windows EXE oluştur
npm run build:electron:win

# 4. Checksum'ları oluştur
npm run generate-checksums
```

Build tamamlandığında `build-electron/` klasöründe şu dosyalar olacak:
- `OBS Multi-Platform Streaming Setup 1.0.0.exe` (Installer)
- `OBS Multi-Platform Streaming 1.0.0.exe` (Portable)
- `checksums.txt` (Root klasörde)

## Adım 2: GitHub Release Oluşturma

1. GitHub repository'nize gidin: https://github.com/akmaster/StreamHub

2. **Releases** sekmesine tıklayın

3. **"Draft a new release"** veya **"Create a new release"** butonuna tıklayın

4. Release bilgilerini doldurun:
   - **Tag version**: `v1.0.0` (veya ilgili versiyon)
   - **Release title**: `v1.0.0` veya `Release v1.0.0`
   - **Description**: CHANGELOG.md'den kopyalayabilirsiniz veya şunu kullanın:
     ```
     ## v1.0.0 - Initial Release
     
     İlk stabil release.
     
     ### Özellikler
     - Multi-platform streaming support
     - Modern UI
     - Real-time statistics
     - Release verification with checksums
     ```

5. **"Attach binaries"** veya dosya yükleme alanına şu dosyaları sürükleyin:
   - `build-electron/OBS Multi-Platform Streaming Setup 1.0.0.exe`
   - `build-electron/OBS Multi-Platform Streaming 1.0.0.exe`
   - `checksums.txt` (root klasörden)

6. **"Publish release"** butonuna tıklayın

## Adım 3: Doğrulama

Release oluşturulduktan sonra:
- ✅ EXE dosyaları yüklendi mi?
- ✅ checksums.txt dosyası var mı?
- ✅ Release notes düzgün görünüyor mu?

## GitHub Billing Sorununu Çözme

### Seçenek 1: Free Plan (2000 dakika/ay)

1. GitHub Settings > Billing
2. Billing bilgilerinizi ekleyin (kart bilgisi gerekebilir ama ücret alınmaz)
3. Free plan'da aylık 2000 dakika Actions süresi var
4. Bu yeterli olmalı (her build ~15-20 dakika)

### Seçenek 2: GitHub Pro Plan

- Aylık $4 (öğrenci indirimi varsa ücretsiz)
- 3000 dakika Actions süresi
- Daha fazla özellik

### Seçenek 3: Self-Hosted Runner

Kendi bilgisayarınızda GitHub Actions runner kurarak ücretsiz kullanabilirsiniz:

1. GitHub Settings > Actions > Runners > New self-hosted runner
2. Windows için kurulum talimatlarını takip edin
3. Runner'ı repository'nize ekleyin

## Hızlı Komutlar

Tüm build ve release hazırlığı için:

```bash
# Tek komutla tüm işlemler
npm run build && npm run generate-icons && npm run build:electron:win && npm run generate-checksums
```

Veya package.json'a script ekleyebilirsiniz:

```json
"release:prepare": "npm run build && npm run generate-icons && npm run build:electron:win && npm run generate-checksums"
```

Sonra:
```bash
npm run release:prepare
```

