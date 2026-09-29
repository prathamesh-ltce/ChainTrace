@echo off
echo =============================================
echo   Blockchain Transaction Graph Demo Build
echo =============================================
echo.

set "GXX=C:\msys64\ucrt64\bin\g++.exe"
set "PATH=C:\msys64\ucrt64\bin;%PATH%"

if not exist "%GXX%" (
    echo ERROR: g++.exe was not found.
    echo Expected location: C:\msys64\ucrt64\bin\g++.exe
    exit /b 1
)

echo Compiler found. Compiling...
echo.

"%GXX%" -std=c++17 -O2 src\main.cpp src\Graph.cpp src\TraceEngine.cpp src\TransactionStore.cpp src\WalletRegistry.cpp src\QueryResult.cpp -o build\graph_demo.exe

if errorlevel 1 (
    echo ERROR: Compilation failed.
    exit /b 1
)

echo Compilation successful. Running program...
echo.

.\build\graph_demo.exe data/stress_transactions.csv

echo.
pause
