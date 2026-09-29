@echo off
echo =============================================
echo   Transaction Graph Correctness Test Suite
echo =============================================
echo.

set "GXX=C:\msys64\ucrt64\bin\g++.exe"
set "PATH=C:\msys64\ucrt64\bin;%PATH%"

if not exist "%GXX%" (
    echo ERROR: g++.exe was not found at C:\msys64\ucrt64\bin\g++.exe
    pause
    exit /b 1
)

if not exist "build" mkdir build

echo Compiling Correctness Test Suite...
echo.

"%GXX%" -std=c++17 -O2 src\test_correctness.cpp src\Graph.cpp src\TraceEngine.cpp src\TransactionStore.cpp src\WalletRegistry.cpp src\QueryResult.cpp -o build\test_correctness.exe

if errorlevel 1 (
    echo ERROR: Compilation failed.
    pause
    exit /b 1
)

echo Compilation successful. Running correctness tests...
echo.

.\build\test_correctness.exe

echo.
pause
