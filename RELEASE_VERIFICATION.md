# Release Doğrulama Kılavuzu

Bu doküman, OBS Multi-Platform Streaming System'in release dosyalarının açık kaynak kodundan derlendiğini nasıl doğrulayacağınızı açıklar.

## 🔐 Yöntem 1: Checksum Doğrulama (En Hızlı)

Her release'de `checksums.txt` dosyası yayınlanır. Bu dosya, tüm EXE dosyalarının SHA256 hash değerlerini içerir.

### Windows'ta Doğrulama:

```powershell
# 1. İndirdiğiniz dosyanın hash'ini hesaplayın
Get-FileHash -Path "OBS Multi-Platform Streaming Setup 1.0.0.exe" -Algorithm SHA256

# 2. GitHub Releases'daki checksums.txt dosyasındaki hash ile karşılaştırın
# Hash'ler eşleşiyorsa ✅ dosya doğrulanmış demektir
```

### Linux/Mac'te Doğrulama:

```bash
# Hash hesaplama
sha256sum "OBS Multi-Platform Streaming Setup 1.0.0.exe"

# Veya
shasum -a 256 "OBS Multi-Platform Streaming Setup 1.0.0.exe"
```

## 🏗️ Yöntem 2: Kaynak Koddan Derleme (En Güvenilir)

En güvenilir yöntem, kaynak koddan kendiniz derlemektir:

```bash
# 1. Repository'yi klonlayın
git clone https://github.com/YOUR_USERNAME/SON4.git
cd SON4

# 2. Release tag'ini checkout edin
git checkout v1.0.0  # veya ilgili release tag'i

# 3. Bağımlılıkları yükleyin
npm install

# 4. Projeyi derleyin
npm run build

# 5. Windows EXE oluşturun
npm run build:electron:win

# 6. Oluşturulan dosyalar build-electron/ klasöründe olacak
# 7. İndirdiğiniz dosyalarla karşılaştırın
```

### Derleme Sonrası Karşılaştırma:

```powershell
# Kendi derlediğiniz dosyanın hash'ini alın
Get-FileHash -Path "build-electron\OBS Multi-Platform Streaming Setup 1.0.0.exe" -Algorithm SHA256

# GitHub'dan indirdiğiniz dosyanın hash'ini alın
Get-FileHash -Path "OBS Multi-Platform Streaming Setup 1.0.0.exe" -Algorithm SHA256

# Hash'ler eşleşmeli ✅
```

## 🤖 Yöntem 3: GitHub Actions Build Log'ları

Her release, GitHub Actions ile otomatik olarak derlenir. Bu sayede:

- ✅ Build süreci şeffaftır
- ✅ Build log'ları herkese açıktır
- ✅ Reproducible builds (tekrarlanabilir derlemeler)
- ✅ Checksum'lar otomatik oluşturulur

### Build Log'larını İnceleme:

1. GitHub repository'deki **Actions** sekmesine gidin
2. İlgili release'in build workflow'unu açın
3. Build log'larını inceleyin:
   - Hangi commit'ten derlendi?
   - Hangi bağımlılıklar kullanıldı?
   - Checksum'lar ne?

### GitHub Actions Workflow:

Workflow dosyası: `.github/workflows/build-release.yml`

Bu workflow:
- Her tag push'unda otomatik çalışır
- Windows build'i oluşturur
- Checksum'ları hesaplar
- Release'e dosyaları yükler

## 📋 Mevcut Release Checksum'ları

### v1.0.0

```
4644659C5FBBE301E7A7654753DC722D7517ED14836C6333E2784BB182577705  OBS Multi-Platform Streaming 1.0.0.exe
CBD4C17EC808B763B01374917294ED92C8A133C41EF5727B2708FB6FCCDBD8FF  OBS Multi-Platform Streaming Setup 1.0.0.exe
```

## ⚠️ Güvenlik Notları

### ✅ Güvenli İndirme:

1. **Sadece GitHub Releases'dan indirin**: Resmi release sayfasından indirmeyi unutmayın
2. **Checksum'ları kontrol edin**: Her zaman checksum'ları doğrulayın
3. **Kaynak koddan derleyin**: Maksimum güvenlik için kaynak koddan kendiniz derleyin
4. **Build log'larını inceleyin**: GitHub Actions log'larını kontrol edin

### ❌ Şüpheli Durumlar:

Eğer aşağıdaki durumlardan biriyle karşılaşırsanız, dosyayı kullanmayın:

- ❌ Checksum'lar eşleşmiyorsa
- ❌ GitHub Releases'da dosya yoksa
- ❌ Build log'ları eksikse
- ❌ Dosya beklenmedik bir yerden geliyorsa
- ❌ Dosya boyutu beklenenden farklıysa
- ❌ Antivirus uyarısı veriyorsa (false positive olabilir, ama kontrol edin)

## 🔍 Detaylı Doğrulama

### Tam Build Süreci:

1. **Source Code Hash**: Repository'nin commit hash'ini kontrol edin
2. **Dependencies**: `package-lock.json` dosyasını kontrol edin
3. **Build Environment**: GitHub Actions log'larında build ortamını kontrol edin
4. **Output Files**: Oluşturulan dosyaların hash'lerini kontrol edin

### Reproducible Build:

Aynı kaynak kod, aynı bağımlılıklar ve aynı build ortamı ile aynı çıktıyı üretmelidir. Bu "reproducible build" olarak adlandırılır.

## 📞 Sorular ve Destek

Eğer doğrulama sırasında sorun yaşarsanız:

1. GitHub Issues'da soru açın
2. Build log'larını paylaşın
3. Checksum'ları paylaşın
4. Hangi adımda sorun yaşadığınızı belirtin

## 📚 Ek Kaynaklar

- [GitHub Releases](https://github.com/YOUR_USERNAME/SON4/releases)
- [GitHub Actions](https://github.com/YOUR_USERNAME/SON4/actions)
- [SHA256 Hash Nedir?](https://en.wikipedia.org/wiki/SHA-2)
- [Reproducible Builds](https://reproducible-builds.org/)

