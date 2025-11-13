# GitHub Actions Ücret Alınmasını Engelleme Kılavuzu

GitHub Actions'tan ücret alınmasını tamamen engellemek için birkaç yöntem:

## 🛡️ Yöntem 1: Budget Limitleri Ayarlama (Önerilen)

GitHub'da budget limitleri ayarlayarak otomatik olarak durdurulmasını sağlayabilirsiniz.

### Adımlar:

1. **GitHub Settings > Billing** sayfasına gidin
2. **"Metered usage"** bölümünde **"Manage budgets"** linkine tıklayın
3. **"Actions"** için budget oluşturun:
   - **Spending limit**: `$0` (sıfır dolar)
   - Bu limit aşıldığında Actions otomatik durur

### Avantajları:
- ✅ Otomatik koruma
- ✅ Limit aşıldığında workflow durur
- ✅ Beklenmedik ücretler engellenir

---

## 🖥️ Yöntem 2: Self-Hosted Runner Kullanma (Tamamen Ücretsiz)

Kendi bilgisayarınızda GitHub Actions runner kurarak tamamen ücretsiz kullanabilirsiniz.

### Avantajları:
- ✅ Tamamen ücretsiz (sınırsız)
- ✅ Daha hızlı build (local makine)
- ✅ Özel yazılımlar kullanabilirsiniz

### Dezavantajları:
- ❌ Bilgisayarınız açık olmalı
- ❌ İnternet bağlantısı gerekli
- ❌ Kurulum gerektirir

### Kurulum:

1. **GitHub Repository > Settings > Actions > Runners > New self-hosted runner**
2. **Windows** için kurulum talimatlarını takip edin
3. Runner'ı repository'nize ekleyin
4. Workflow'u self-hosted runner kullanacak şekilde güncelleyin

---

## 🔒 Yöntem 3: Workflow'u Sadece Manuel Tetiklemek

Workflow'u otomatik çalışmaktan çıkarıp sadece manuel tetiklemek.

### Avantajları:
- ✅ Kontrol sizde
- ✅ İstediğiniz zaman çalıştırırsınız
- ✅ Beklenmedik build'ler olmaz

### Workflow Güncelleme:

```yaml
on:
  # push:
  #   tags:
  #     - 'v*'  # Bu satırları kaldırın
  workflow_dispatch:  # Sadece manuel tetikleme
    inputs:
      version:
        description: 'Version tag (e.g., v1.0.0)'
        required: true
        type: string
```

---

## 📊 Yöntem 4: Free Plan Limitlerini Takip Etme

GitHub Free plan'da aylık 2,000 dakika ücretsiz Actions süresi var.

### Limitler:
- **Actions Minutes**: 2,000 dakika/ay (ücretsiz)
- **Actions Storage**: 0.5 GB/ay (ücretsiz)
- Her build ~15-20 dakika sürer
- Ayda ~100 build yapabilirsiniz (ücretsiz)

### Takip:
- GitHub Settings > Billing > Metered usage
- Actions kullanımınızı düzenli kontrol edin
- Limit yaklaştığında dikkatli olun

---

## 🚫 Yöntem 5: Workflow'u Tamamen Devre Dışı Bırakma

Workflow'u tamamen kapatıp sadece manuel release yapmak.

### Avantajları:
- ✅ %100 ücretsiz garantisi
- ✅ Tam kontrol

### Dezavantajları:
- ❌ Otomatik build yok
- ❌ Manuel işlem gerekir

---

## 💡 Önerilen Kombinasyon

**En İyi Çözüm:**
1. ✅ Budget limiti ayarlayın ($0)
2. ✅ Free plan limitlerini takip edin
3. ✅ Gerekirse self-hosted runner kullanın

Bu kombinasyon ile:
- Otomatik koruma (budget limiti)
- Ücretsiz kullanım (free plan limitleri)
- Sınırsız seçenek (self-hosted runner)

---

## 📋 Hızlı Kontrol Listesi

- [ ] Budget limiti ayarlandı mı? ($0)
- [ ] Free plan limitleri takip ediliyor mu?
- [ ] Self-hosted runner kuruldu mu? (opsiyonel)
- [ ] Workflow sadece gerektiğinde çalışıyor mu?

---

## ⚠️ Önemli Notlar

1. **Budget limiti** en güvenli yöntemdir
2. **Free plan limitleri** aşılmadığı sürece ücret alınmaz
3. **Self-hosted runner** tamamen ücretsizdir
4. **Manuel release** her zaman ücretsizdir

---

## 🔗 İlgili Linkler

- [GitHub Actions Pricing](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions)
- [Self-Hosted Runners](https://docs.github.com/en/actions/hosting-your-own-runners)
- [Setting Spending Limits](https://docs.github.com/en/billing/managing-billing-for-github-actions/managing-your-spending-limit-for-github-actions)

