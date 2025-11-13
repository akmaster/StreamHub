# Copy config.yaml to build directory for executable
$configSource = Join-Path $PSScriptRoot "..\config.yaml"
$configDest = Join-Path $PSScriptRoot "..\build\config.yaml"

if (Test-Path $configSource) {
    Copy-Item $configSource $configDest -Force
    Write-Host "Config file copied to build directory: $configDest"
} else {
    Write-Host "Warning: config.yaml not found at $configSource"
    Write-Host "Executable will use default configuration"
}

