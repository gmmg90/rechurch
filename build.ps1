# ReChurch - build completo (frontend + backend .exe + installer)
# Esegui da PowerShell nella root del progetto:
#     .\build.ps1
#
# Prerequisiti:
#   - Node.js (per build frontend)
#   - Python 3.10+ con dipendenze:
#       pip install -r backend/requirements-dev.txt

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  ReChurch - Build completo"                                  -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Build frontend ----------------------------------------------------
Write-Host "[1/3] Build frontend (Vite)..." -ForegroundColor Yellow
Set-Location "$ROOT\frontend"
if (-not (Test-Path "node_modules")) {
    Write-Host "  - Installazione dipendenze npm..."
    npm install
}
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Build frontend fallito" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Frontend buildato in frontend\dist\" -ForegroundColor Green

# --- 2. Build backend con PyInstaller -------------------------------------
Write-Host ""
Write-Host "[2/3] Build backend .exe (PyInstaller)..." -ForegroundColor Yellow
Set-Location "$ROOT\backend"

if (Test-Path "build") { Remove-Item -Recurse -Force "build" }
if (Test-Path "dist")  { Remove-Item -Recurse -Force "dist" }

pyinstaller rechurch.spec --clean --noconfirm
if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Build backend fallito" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Eseguibile in backend\dist\ReChurch\" -ForegroundColor Green

# --- 3. Installer Inno Setup (se installato) ------------------------------
Write-Host ""
Write-Host "[3/3] Compila installer (Inno Setup)..." -ForegroundColor Yellow
Set-Location $ROOT

$iscc = $null
$candidates = @(
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
)
foreach ($c in $candidates) {
    if (Test-Path $c) { $iscc = $c; break }
}
if (-not $iscc) {
    $cmd = Get-Command "iscc" -ErrorAction SilentlyContinue
    if ($cmd) { $iscc = $cmd.Source }
}

if ($iscc) {
    & $iscc "installer\rechurch.iss"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Installer creato in installer\Output\" -ForegroundColor Green
    } else {
        Write-Host "  [X] Compilazione installer fallita" -ForegroundColor Red
    }
} else {
    Write-Host "  [!] Inno Setup non trovato. Salto la creazione dell'installer." -ForegroundColor Yellow
    Write-Host "      Installa da: https://jrsoftware.org/isdl.php" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  Build completato"                                          -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Per testare l'app:"
$exePath = Join-Path $ROOT "backend\dist\ReChurch\ReChurch.exe"
Write-Host "  $exePath"
Write-Host ""
