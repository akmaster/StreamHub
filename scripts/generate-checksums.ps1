# Generate checksums for release files
# This script creates SHA256 checksums for all release files

param(
    [string]$ReleaseDir = "build-electron",
    [string]$OutputFile = "checksums.txt"
)

Write-Host "Generating checksums for release files..." -ForegroundColor Cyan
Write-Host ""

$checksums = @()
$files = Get-ChildItem -Path $ReleaseDir -Filter *.exe -File

if ($files.Count -eq 0) {
    Write-Host "No EXE files found in $ReleaseDir" -ForegroundColor Red
    exit 1
}

foreach ($file in $files) {
    Write-Host "Processing: $($file.Name)..." -ForegroundColor Yellow
    $hash = Get-FileHash -Path $file.FullName -Algorithm SHA256
    $checksums += "$($hash.Hash)  $($file.Name)"
    Write-Host "   SHA256: $($hash.Hash)" -ForegroundColor Green
}

# Write checksums to file
$checksums | Out-File -FilePath $OutputFile -Encoding UTF8

Write-Host ""
Write-Host "Checksums generated successfully!" -ForegroundColor Green
Write-Host "Output file: $OutputFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "Checksums:" -ForegroundColor Yellow
Get-Content $OutputFile

