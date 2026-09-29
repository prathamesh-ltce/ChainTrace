@echo off
echo =============================================
echo   Compiling Data Generator...
echo =============================================
echo.

set "GXX=C:\msys64\ucrt64\bin\g++.exe"
set "PATH=C:\msys64\ucrt64\bin;%PATH%"

if not exist "%GXX%" (
    echo ERROR: g++.exe was not found.
    echo Expected location: C:\msys64\ucrt64\bin\g++.exe
    exit /b 1
)

"%GXX%" -std=c++17 -O2 src\generate_data.cpp -o build\generate_data.exe

if errorlevel 1 (
    echo ERROR: Compilation failed.
    pause
    exit /b 1
)

echo Compilation successful. Running generator...
echo.

.\build\generate_data.exe

echo.
pause
