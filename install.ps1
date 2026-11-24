#requires -version 5
<#
  TT - Teaching Tools one-command installer (Windows)

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

# Return $true if a host port is already bound (by any process or Docker
# container). Several Hauspokal-style apps can share one host, so every published
# port (frontend, postgres, API) must be checked before we map it.
function Test-PortInUse($port) {
    try {
        if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { return $true }
    }
    catch {
        # Older hosts without Get-NetTCPConnection: fall back to netstat
        if (netstat -ano -p TCP 2>$null | Select-String -Quiet ":$port\s.*LISTENING") { return $true }
    }
    try {
        if ((docker ps --format '{{.Ports}}' 2>$null) -match "[:.]$port->") { return $true }
    }
    catch {}
    return $false
}

# Echo the next free port at or above $start.
function Find-FreePort($start) {
    $p = [int]$start
    while (Test-PortInUse $p) { $p++ }
    return $p
}

# Pick a conflict-free host port. When $default is free and -AlwaysPrompt is not
# set it is used silently; otherwise prompt with the next free port suggested.
function Select-Port($label, $default, [switch]$AlwaysPrompt) {
    $suggested = Find-FreePort $default
    if (-not $AlwaysPrompt -and $suggested -eq $default) { return $default }
    if ($suggested -ne $default) { Write-Warn "$label port $default is already in use." }
    while ($true) {
        $inp = Read-Host "  $label port [$suggested]"
        if ([string]::IsNullOrWhiteSpace($inp)) { return $suggested }
        $n = 0
        if (-not ([int]::TryParse($inp.Trim(), [ref]$n)) -or $n -lt 1 -or $n -gt 65535) {
            Write-Warn "Enter a number between 1 and 65535."; continue
        }
        if ($n -ne $default -and (Test-PortInUse $n)) {
            Write-Warn "Port $n is also in use - pick another."; continue
        }
        return $n
    }
}

# Write KEY=VALUE into .env, replacing an existing line or appending a new one.
# ASCII avoids a UTF-8 BOM, which docker compose would misread on the first line.
function Set-EnvVar($key, $val) {
    # @(...) around the whole if is required: a single-line file returned through
    # an if-expression collapses to a scalar, and $lines += would then do string
    # concatenation instead of an array append (mashing .env onto one line).
    $lines = @(if (Test-Path .env) { Get-Content .env })
    if ($lines | Where-Object { $_ -match "^$key=" }) {
        $lines = @($lines -replace "^$key=.*", "$key=$val")
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
}

# --- Choose conflict-free host ports and persist them to .env ---
# Frontend is always prompted (user-facing URL); postgres and the API are only
# prompted when their default host port is already taken by another app.
Write-Step "Selecting host ports (avoiding conflicts with other apps)..."
$APP_PORT = Select-Port 'Frontend (web app)' 1339 -AlwaysPrompt
Set-EnvVar 'APP_PORT' $APP_PORT
$DB_PORT = Select-Port 'PostgreSQL' 5435
Set-EnvVar 'DB_PORT' $DB_PORT
$API_PORT = Select-Port 'Backend API' 8000
Set-EnvVar 'API_PORT' $API_PORT
Write-Step "Ports - frontend: $APP_PORT, postgres: $DB_PORT, api: $API_PORT"

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

# --- Per-install secrets instead of the public defaults ---
# SECRET_KEY signs logins and encrypts stored passwords: a missing, default or
# too short key is replaced by a random one. On an existing install the old key
# goes to SECRET_KEY_ALT, so the API re-encrypts stored passwords on its next start.
# POSTGRES_PASSWORD is only chosen for a fresh install: Postgres sets the password
# when its data volume is created, so an existing install keeps the old default
# (docker-compose.yml falls back to it) or the API could no longer connect.
function Get-EnvVar($key) {
    $line = Get-Content .env | Where-Object { $_ -match "^$key=" } | Select-Object -Last 1
    if ($line) { return ($line -replace "^$key=", '').Trim() }
    return ''
}
function New-RandomHex($bytes) {
    $buf = New-Object byte[] $bytes
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($buf); $rng.Dispose()
    return -join ($buf | ForEach-Object { $_.ToString('x2') })
}
$ErrorActionPreference = 'Continue'   # docker writes to stderr for a missing volume
$m = docker compose config 2>$null | Select-String -Pattern '^name:\s*(.+)$' | Select-Object -First 1
$project = if ($m) { $m.Matches[0].Groups[1].Value.Trim() } else { (Split-Path $PSScriptRoot -Leaf).ToLower() }
docker volume inspect "${project}_hauspokal-pg-data" *> $null
$dbExists = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = 'Stop'

$defaultKey = 'change-me-in-production'
$key = Get-EnvVar 'SECRET_KEY'
if (-not $key -or $key -eq $defaultKey -or $key.Length -lt 32) {
    Set-EnvVar 'SECRET_KEY' (New-RandomHex 48)
    if ($dbExists -and -not (Get-EnvVar 'SECRET_KEY_ALT')) {
        Set-EnvVar 'SECRET_KEY_ALT' $(if ($key) { $key } else { $defaultKey })
        Write-Step "New random SECRET_KEY in .env (old one kept as SECRET_KEY_ALT, stored passwords get re-encrypted; everyone logs in once more)."
    }
    else {
        Write-Step "Random SECRET_KEY written to .env."
    }
}
if (-not (Get-EnvVar 'POSTGRES_PASSWORD') -and -not $dbExists) {
    Set-EnvVar 'POSTGRES_PASSWORD' (New-RandomHex 24)
    Write-Step "Random database password written to .env (POSTGRES_PASSWORD)."
}

# --- Build & start the stack (first run downloads images / installs packages) ---
Write-Step "Building and starting TT - Teaching Tools (first run may take several minutes)..."
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Write-Err "docker compose failed."; exit 1 }

Write-Step "TT - Teaching Tools is running:"
Write-Host "  Frontend  >  http://$HOST_IP`:$APP_PORT"
Write-Host "  API docs  >  http://localhost`:$API_PORT/docs"
Write-Host "  Postgres  >  127.0.0.1`:$DB_PORT"
Write-Host ""
Write-Host "Stop with stop.bat"
