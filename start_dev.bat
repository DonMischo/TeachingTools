@echo off
setlocal EnableDelayedExpansion

:: Create .env from example if missing
if not exist .env (
    echo Creating .env from .env.example ...
    copy .env.example .env >nul
    echo Done. Edit .env to set a real SECRET_KEY before going to production.
    echo.
)

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

echo Starting TT - Teaching Tools (DEV mode - hot reload)...
echo   API:      uvicorn --reload  ^(restarts on .py changes^)
echo   Frontend: npx next dev      ^(HMR on every save^)
echo.

docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

if %ERRORLEVEL% neq 0 (
    echo.
    echo Docker Compose failed.
    exit /b 1
)

echo.
echo Dev server is running:
echo   Frontend  ^>  http://localhost:1339   ^(HMR active^)
echo   API docs  ^>  http://localhost:8000/docs
echo.
echo Use stop.bat to shut down.
