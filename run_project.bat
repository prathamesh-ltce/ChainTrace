@echo off
title SIH VASP Attribution Engine - Full Stack Forensic Platform
echo =========================================================================
echo       SIH VASP ATTRIBUTION & FORENSIC ENGINE (FULL-STACK PLATFORM)       
echo    Multi-Hop Blockchain Traversal & Centralized VASP Resolution (LEAs)   
echo =========================================================================
echo.

set "ROOT_DIR=%~dp0"

:: Locate Backend & Frontend
set "PY_DIR=%ROOT_DIR%SIH"
if not exist "%PY_DIR%\analyzer" (
    set "PY_DIR=%ROOT_DIR%"
)

set "UI_DIR=%ROOT_DIR%vasp-react"

echo [1/3] Starting Python FastAPI Forensic Backend (Port 8000)...
if exist "%PY_DIR%\.venv\Scripts\python.exe" (
    start "SIH-Backend" cmd /c "cd /d "%PY_DIR%" && .venv\Scripts\python.exe -m uvicorn api.main:app --port 8000 --host 0.0.0.0 --reload"
) else (
    start "SIH-Backend" cmd /c "cd /d "%PY_DIR%" && python -m uvicorn api.main:app --port 8000 --host 0.0.0.0 --reload"
)
timeout /t 3 >nul

echo [2/3] Starting React Forensic UI Frontend (Port 5173)...
start "SIH-Frontend" cmd /c "cd /d "%UI_DIR%" && npm run dev"
timeout /t 3 >nul

echo [3/3] Opening Forensic Investigation Console in browser...
start "" http://localhost:5173

echo.
echo =========================================================================
echo  [+] Forensic Backend API : http://localhost:8000 (Swagger: /docs)
echo  [+] Investigation Console : http://localhost:5173
echo  [+] Default Officer Login : admin / sih2026
echo =========================================================================
echo.
echo Both servers are running in dedicated background terminal windows.
pause
