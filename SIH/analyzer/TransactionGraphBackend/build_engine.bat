@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
cd /d "%~dp0"
if not exist "build" mkdir build
cl /std:c++17 /O2 /EHsc /Fe:build\graph_engine.exe src\Graph.cpp src\QueryResult.cpp src\TraceEngine.cpp src\TransactionStore.cpp src\WalletRegistry.cpp src\main.cpp
copy /Y build\graph_engine.exe build\graph_demo.exe
echo COMPILE_STATUS=%ERRORLEVEL%
