@echo off
echo =============================================
echo   Transaction Graph Production Benchmarks
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

echo Compiling Production Benchmark Suite...
echo.

"%GXX%" -std=c++17 -O2 src\benchmark_runner.cpp src\Graph.cpp src\TraceEngine.cpp src\TransactionStore.cpp src\WalletRegistry.cpp src\QueryResult.cpp -lpsapi -o build\benchmark_runner.exe

if errorlevel 1 (
    echo ERROR: Compilation failed.
    pause
    exit /b 1
)

echo Compilation successful. Running benchmarks...
echo.

.\build\benchmark_runner.exe

echo.
pause
