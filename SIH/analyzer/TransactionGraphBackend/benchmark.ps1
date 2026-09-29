$ErrorActionPreference = 'Stop'
$env:PATH = "C:\msys64\ucrt64\bin;" + $env:PATH

Write-Host "============================================="
Write-Host " Compiling Backend and Generator... "
Write-Host "============================================="

g++ -std=c++17 -O2 src\generate_data.cpp -o build\generate_data.exe
g++ -std=c++17 -O2 src\main.cpp src\Graph.cpp src\TraceEngine.cpp src\TransactionStore.cpp src\WalletRegistry.cpp src\QueryResult.cpp -o build\graph_demo.exe
g++ -std=c++17 -O2 src\benchmark_runner.cpp src\Graph.cpp src\TraceEngine.cpp src\TransactionStore.cpp src\WalletRegistry.cpp src\QueryResult.cpp -o build\benchmark_runner.exe

$sizes = @(1000, 10000, 100000, 1000000)

foreach ($size in $sizes) {
    Write-Host "`n============================================="
    Write-Host " BENCHMARKING $size TRANSACTIONS "
    Write-Host "============================================="
    
    # Generate data
    .\build\generate_data.exe $size
    
    # Run backend
    .\build\graph_demo.exe data/stress_transactions.csv
}

Write-Host "`n============================================="
Write-Host " RUNNING COMPREHENSIVE TOPOLOGY SUITE "
Write-Host "============================================="
.\build\benchmark_runner.exe
