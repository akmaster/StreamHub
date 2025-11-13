# Desktop Shortcut Oluşturma Script'i
# OBS Multi-Platform Streaming için masaüstü kısayolu oluşturur

param(
    [Parameter(Mandatory=$false)]
    [string]$ExePath = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ShortcutName = "OBS Multi-Platform Streaming",
    
    [Parameter(Mandatory=$false)]
    [string]$IconPath = ""
)

# Varsayılan değerler
if ([string]::IsNullOrEmpty($ExePath)) {
    # Portable exe'yi ara
    $portableExe = Join-Path $PSScriptRoot "..\build-electron\OBS Multi-Platform Streaming 1.0.0.exe"
    $unpackedExe = Join-Path $PSScriptRoot "..\build-electron\win-unpacked\OBS Multi-Platform Streaming.exe"
    
    if (Test-Path $portableExe) {
        $ExePath = $portableExe
    } elseif (Test-Path $unpackedExe) {
        $ExePath = $unpackedExe
    } else {
        Write-Host "❌ HATA: Executable dosyası bulunamadı!" -ForegroundColor Red
        Write-Host "   Lütfen önce build işlemini tamamlayın veya -ExePath parametresi ile path belirtin." -ForegroundColor Yellow
        exit 1
    }
}

if ([string]::IsNullOrEmpty($IconPath)) {
    $IconPath = Join-Path $PSScriptRoot "..\assets\icon.ico"
    
    if (-not (Test-Path $IconPath)) {
        # Icon.ico yoksa .exe'nin kendi iconunu kullan
        $IconPath = $ExePath
        Write-Host "⚠ UYARI: assets/icon.ico bulunamadı, executable'ın kendi iconu kullanılacak." -ForegroundColor Yellow
    }
}

# Masaüstü path'i
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "$ShortcutName.lnk"

# Kısayol oluştur
try {
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = $ExePath
    $Shortcut.WorkingDirectory = Split-Path $ExePath
    $Shortcut.IconLocation = "$IconPath,0"
    $Shortcut.Description = "OBS Multi-Platform Streaming - Multi-platform streaming system"
    $Shortcut.Save()
    
    Write-Host "✅ Masaüstü kısayolu başarıyla oluşturuldu!" -ForegroundColor Green
    Write-Host "   📁 Konum: $ShortcutPath" -ForegroundColor Cyan
    Write-Host "   🎯 Hedef: $ExePath" -ForegroundColor Cyan
    Write-Host "   🎨 Icon: $IconPath" -ForegroundColor Cyan
} catch {
    Write-Host "❌ HATA: Kısayol oluşturulurken hata oluştu!" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Yellow
    exit 1
}

