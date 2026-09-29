@echo off
cd /d "%~dp0"
echo =========================================================
echo   VASP ATTRIBUTION ENGINE - DIRECT WALLET TRACER
echo =========================================================
echo.
set /p WALLET_ADDR="Enter Suspect Wallet Address (or press ENTER for default): "

if "%WALLET_ADDR%"=="" (
    .venv\Scripts\python.exe -m analyzer.wallet bc1qpfw8hmpcyuwz6fca9yfn35kcgnqh59xm8c3x24
) else (
    .venv\Scripts\python.exe -m analyzer.wallet %WALLET_ADDR%
)

echo.
pause
