#requires -version 5
<#
  Hauspokal one-command installer (Windows)

  Installs Docker Desktop (+ WSL2 backend) if missing, then builds & starts the
  whole stack. All app packages (pip / npm / apt) install inside the containers,
  so Docker Desktop is the only host prerequisite this script bootstraps.

  Usage (from the repo root):
      powershell -ExecutionPolicy Bypass -File .\install.ps1
#>

$ErrorActionPreference = 'Stop'

function Write-Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Warn($m) { Write-Host "WARN: $m"  -ForegroundColor Yellow }
function Write-Err ($m) { Write-Host "ERROR: $m" -ForegroundColor Red }

# Ask which port the web app should listen on (default 1339).
function Read-AppPort {
    $default = 1339
    while ($true) {
        $inp = Read-Host "Port for the web app [$default]"
        if ([string]::IsNullOrWhiteSpace($inp)) { return $default }
        $n = 0
        if ([int]::TryParse($inp.Trim(), [ref]$n) -and $n -ge 1 -and $n -le 65535) { return $n }
        Write-Warn "Please enter a number between 1 and 65535."
    }
}

# Write KEY=VALUE into .env, replacing an existing line or appending a new one.
# ASCII avoids a UTF-8 BOM, which docker compose would misread on the first line.
function Set-EnvVar($key, $val) {
    $lines = if (Test-Path .env) { @(Get-Content .env) } else { @() }
    if ($lines | Where-Object { $_ -match "^$key=" }) {
        $lines = $lines -replace "^$key=.*", "$key=$val"
    }
    else {
        $lines += "$key=$val"
    }
    Set-Content -Path .env -Value $lines -Encoding ascii
}

# --- Self-elevate to Administrator (needed to install WSL2 + Docker Desktop) ---
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
    Write-Step "Requesting administrator privileges..."
    Start-Process powershell -Verb RunAs -ArgumentList @(
        '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`""
    )
    exit
}

# Run from the repo root (the folder this script lives in)
Set-Location -Path $PSScriptRoot

function Test-DockerInstalled { [bool](Get-Command docker -ErrorAction SilentlyContinue) }

$dockerInstalledNow = $false

if (-not (Test-DockerInstalled)) {
    Write-Step "Docker not found. Installing Docker Desktop..."

    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Err "winget (App Installer) is not available. Install Docker Desktop manually: https://www.docker.com/products/docker-desktop/"
        exit 1
    }

    # Docker Desktop uses WSL2 as its backend. Enable/install it first.
    Write-Step "Ensuring WSL2 is installed (Docker Desktop backend)..."
    try { wsl --install --no-distribution }
    catch { Write-Warn "wsl --install reported an issue; continuing (WSL may already be enabled)." }

    Write-Step "Installing Docker Desktop via winget (downloads ~600 MB)..."
    winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
    $dockerInstalledNow = $true
}
else {
    Write-Step "Docker already installed: $(docker --version)"
}

# Refresh PATH so 'docker' resolves in this session after a fresh install
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')

if ($dockerInstalledNow) {
    Write-Warn "Docker Desktop (and possibly WSL2) was just installed."
    Write-Warn "A REBOOT is usually required before Docker can run."
    Write-Warn "After rebooting: start Docker Desktop once, then re-run install.ps1 to build & launch the stack."
    exit 0
}

# --- Create .env from example if missing ---
if (-not (Test-Path .env)) {
    Write-Step "Creating .env from .env.example"
    Copy-Item .env.example .env
    Write-Warn "Edit .env to set a real SECRET_KEY before production use."
}

# --- Choose the web app port and persist it to .env ---
$APP_PORT = Read-AppPort
Set-EnvVar 'APP_PORT' $APP_PORT
Write-Step "Web app port set to $APP_PORT"

# --- Detect LAN IP (same logic as start.bat) ---
$HOST_IP = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.PrefixOrigin -eq 'Dhcp' -or $_.PrefixOrigin -eq 'Manual' } |
    Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.|172\.)' } |
    Sort-Object InterfaceMetric | Select-Object -First 1).IPAddress
if (-not $HOST_IP) { $HOST_IP = 'localhost' }
$env:HOST_IP = $HOST_IP
Write-Step "Detected LAN IP: $HOST_IP"

# --- Ensure the Docker daemon is running ---
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Step "Starting Docker Desktop..."
    $dd = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dd) { Start-Process $dd } else { Write-Warn "Docker Desktop not found at the default path." }

    Write-Step "Waiting for the Docker daemon to become ready..."
    $tries = 0
    $ready = $false
    do {
        Start-Sleep -Seconds 5
        docker info *> $null
        $ready = ($LASTEXITCODE -eq 0)
        $tries++
        if (-not $ready -and ($tries % 6 -eq 0)) { Write-Host "Still waiting... ($tries checks)" }
    } while (-not $ready -and $tries -lt 36)

    if (-not $ready) {
        Write-Err "Docker daemon did not become ready. Start Docker Desktop manually and re-run install.ps1."
        exit 1
    }
}

# --- Build & start the stack (first run downloads images / installs packages) ---
Write-Step "Building and starting Hauspokal (first run may take several minutes)..."
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Write-Err "docker compose failed."; exit 1 }

Write-Step "Hauspokal is running:"
Write-Host "  Frontend  >  http://$HOST_IP`:$APP_PORT"
Write-Host "  API docs  >  http://localhost:8000/docs"
Write-Host ""
Write-Host "Stop with stop.bat"
