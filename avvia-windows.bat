@echo off
setlocal
cd /d "%~dp0"
title ReChurch - avvio locale

echo ============================================
echo   ReChurch - avvio locale (Windows)
echo ============================================
echo.

REM --- Controlli prerequisiti ---
where python >nul 2>&1 || (echo [ERRORE] Python non trovato. Installa Python 3.10+ da https://www.python.org/downloads/ ^(spunta "Add to PATH"^) & pause & exit /b 1)
where npm >nul 2>&1 || (echo [ERRORE] Node/npm non trovato. Installa Node 18+ da https://nodejs.org & pause & exit /b 1)

REM --- Backend ---
cd backend
if not exist .venv (
    echo [backend] Creo l'ambiente virtuale Python...
    python -m venv .venv
)
echo [backend] Installo/aggiorno le dipendenze ^(attendi^)...
call .venv\Scripts\python.exe -m pip install -q -r requirements.txt
echo [backend] Avvio il server su http://localhost:8000
start "ReChurch Backend" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
cd ..

REM --- Frontend ---
cd frontend
if not exist node_modules (
    echo [frontend] Installo le dipendenze npm ^(prima volta: qualche minuto^)...
    call npm install
)
echo [frontend] Avvio l'interfaccia su http://localhost:5173
start "ReChurch Frontend" cmd /k "npm run dev"
cd ..

echo.
echo Attendo l'avvio dei server (circa 10 secondi)...
timeout /t 10 /nobreak >nul
start "" http://localhost:5173

echo.
echo ============================================
echo   Pronto!  Apri:  http://localhost:5173
echo   Login:  admin@parrocchia.it  /  admin123
echo ============================================
echo Lascia aperte le due finestre "ReChurch Backend" e "ReChurch Frontend".
echo Per fermare l'app, chiudi quelle due finestre.
echo.
pause
