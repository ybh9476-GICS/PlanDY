$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$listener = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalAddress -in @('127.0.0.1', '::1', '0.0.0.0', '::') } |
    Select-Object -First 1

if ($listener) {
    exit 0
}

$pythonPath = (Get-Command python -ErrorAction Stop).Source
Start-Process -FilePath $pythonPath `
    -ArgumentList '-m', 'http.server', '4173', '--bind', '127.0.0.1' `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden
