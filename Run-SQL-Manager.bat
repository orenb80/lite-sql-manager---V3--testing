@echo off
title SQL Server Manager
color 0A
cls

:: Set the directory to where this batch file is located
cd /d "%~dp0"

:: Default port
set DEFAULT_PORT=3000
set SERVER_PORT=%DEFAULT_PORT%

:: Check if config.txt exists for custom port
if exist "config.txt" (
    for /f "usebackq tokens=1,2 delims==" %%a in ("config.txt") do (
        if "%%a"=="PORT" set SERVER_PORT=%%b
    )
)

:: Check for command line port argument
if "%1"=="-p" (
    if not "%2"=="" (
        set SERVER_PORT=%2
    )
)

cls
echo.
echo  ============================================================
echo              SQL SERVER MANAGER v1.0
echo  ============================================================
echo.
echo  Port: %SERVER_PORT%
echo  URL: http://localhost:%SERVER_PORT%
echo.

:: Check if Node.js is installed
echo  [1/5] Checking Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo  [X] ERROR: Node.js is not installed!
    echo.
    echo  Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo      ^> Node.js %NODE_VERSION% detected
echo.

:: Check if required files exist
echo  [2/5] Checking files...
if not exist "server.js" (
    color 0C
    echo      [X] server.js not found!
    pause
    exit /b 1
)
if not exist "package.json" (
    color 0C
    echo      [X] package.json not found!
    pause
    exit /b 1
)
if not exist "public\index.html" (
    color 0C
    echo      [X] public\index.html not found!
    pause
    exit /b 1
)
echo      ^> All files found
echo.

:: Check and install dependencies
echo  [3/5] Checking dependencies...
if not exist "node_modules\" (
    echo      ^> Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        color 0C
        echo      [X] Failed to install dependencies
        pause
        exit /b 1
    )
    echo      ^> Dependencies installed
) else (
    echo      ^> Dependencies OK
)
echo.

:: Check if port is already in use
echo  [4/5] Checking port %SERVER_PORT%...
netstat -ano | findstr ":%SERVER_PORT%" | findstr "LISTENING" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    color 0E
    echo      [!] WARNING: Port %SERVER_PORT% is in use!
    echo.
    echo      Try: Run-SQL-Manager.bat -p 8080
    echo.
    timeout /t 3 /nobreak >nul
)
echo      ^> Port check complete
echo.

:: Start the application
echo  [5/5] Starting server...
echo.
echo  ============================================================
echo.
echo      SERVER: http://localhost:%SERVER_PORT%
echo      STATUS: Running
echo.
echo  ============================================================
echo.
echo  Browser will open in 3 seconds...
echo.

:: Wait and open browser
timeout /t 3 /nobreak >nul
start http://localhost:%SERVER_PORT%

:: Start server
echo  Starting on port %SERVER_PORT%...
echo.
node server.js %SERVER_PORT%

:: Server stopped
echo.
echo  ============================================================
echo  Server stopped.
echo  ============================================================
echo.
pause