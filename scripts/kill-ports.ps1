# Kill processes using specified ports
# Usage: .\scripts\kill-ports.ps1 8000 1935 8001
# Or: .\scripts\kill-ports.ps1 -Ports @(8000,1935,8001)

param(
    [Parameter(Mandatory=$false, Position=0, ValueFromRemainingArguments=$true)]
    [int[]]$Ports = @(8000, 1935, 8001)
)

Write-Host "Checking for processes using ports: $($Ports -join ', ')" -ForegroundColor Yellow

foreach ($port in $Ports) {
    Write-Host "`nChecking port $port..." -ForegroundColor Cyan
    
    # Find processes using the port
    $connections = netstat -ano | Select-String -Pattern ":$port\s" | ForEach-Object {
        $line = $_.Line.Trim() -replace '\s+', ' '
        $parts = $line -split ' '
        if ($parts.Length -ge 5) {
            $pid = $parts[-1]
            if ($pid -match '^\d+$') {
                [PSCustomObject]@{
                    PID = $pid
                    Port = $port
                }
            }
        }
    } | Select-Object -Unique -Property PID, Port

    if ($connections) {
        foreach ($conn in $connections) {
            $pid = $conn.PID
            $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
            
            if ($process) {
                Write-Host "  Found process: $($process.ProcessName) (PID: $pid)" -ForegroundColor Yellow
                
                # Ask for confirmation (skip in non-interactive mode)
                if ([Environment]::UserInteractive) {
                    $confirm = Read-Host "  Kill this process? (Y/N)"
                    if ($confirm -eq 'Y' -or $confirm -eq 'y') {
                        try {
                            Stop-Process -Id $pid -Force -ErrorAction Stop
                            Write-Host "  Success: Process $pid killed" -ForegroundColor Green
                        } catch {
                            $errorMsg = $_.Exception.Message
                            Write-Host "  Error: Failed to kill process $pid : $errorMsg" -ForegroundColor Red
                        }
                    }
                } else {
                    # Non-interactive mode - kill directly
                    try {
                        Stop-Process -Id $pid -Force -ErrorAction Stop
                        Write-Host "  Success: Process $pid killed" -ForegroundColor Green
                    } catch {
                        $errorMsg = $_.Exception.Message
                        Write-Host "  Error: Failed to kill process $pid : $errorMsg" -ForegroundColor Red
                    }
                }
            } else {
                Write-Host "  Process $pid not found (may have already exited)" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "  Port $port is available" -ForegroundColor Green
    }
}

Write-Host "`nPort check complete" -ForegroundColor Green
