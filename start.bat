@echo off
setlocal EnableDelayedExpansion

:: Create .env from example if missing
if not exist .env (
    echo Creating .env from .env.example ...
    copy .env.example .env >nul
    echo Done. For a random SECRET_KEY and database password run install.bat instead.
    echo.
)

:: Detect LAN IP — pick the IP on the interface that has the default gateway
for /f "usebackq" %%a in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq 'Dhcp' -or $_.PrefixOrigin -eq 'Manual' } | Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.|172\.)' } | Sort-Object InterfaceMetric | Select-Object -First 1).IPAddress"`) do set HOST_IP=%%a
if not defined HOST_IP set HOST_IP=localhost

echo Detected LAN IP: %HOST_IP%
echo.

:: Host ports (chosen during install, stored in .env; defaults match compose)
set APP_PORT=1339
set API_PORT=8000
if exist .env for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b "APP_PORT= API_PORT=" .env`) do set %%a=%%b

:: Check if Docker is running; attempt to start Docker Desktop if not
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Docker is not running. Attempting to start Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Waiting for Docker to become ready
    set /a attempts=0
    :wait_loop
    timeout /t 5 /nobreak >nul
    docker info >nul 2>&1
    if %ERRORLEVEL% equ 0 goto docker_ready
    set /a attempts+=1
    set /a dot=attempts %% 10
    if !dot! equ 0 echo Still waiting... (!attempts! checks)
    if !attempts! lss 24 goto wait_loop
    echo.
    echo Docker did not start within 2 minutes. Please start Docker Desktop manually.
    exit /b 1
    :docker_ready
    echo Docker is ready.
    echo.
)

:: Build and start all services
echo Starting TT - Teaching Tools...
set HOST_IP=%HOST_IP%
:: Next.js wird erst beim Containerstart gebaut (server-wrapper.js), nicht im Image.
:: Ohne Neuerstellung bliebe der alte Container mit dem alten Build laufen.
docker compose up -d --build postgres api
if %ERRORLEVEL% equ 0 docker compose up -d --build --force-recreate --no-deps frontend

if %ERRORLEVEL% neq 0 (
    echo.
    echo Docker Compose failed.
    exit /b 1
)

echo.
echo TT - Teaching Tools is running:
echo   Frontend  ^>  http://%HOST_IP%:%APP_PORT%
echo   API docs  ^>  http://localhost:%API_PORT%/docs
echo.
echo Use stop.bat to shut down.
