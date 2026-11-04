# Übungsinstanz für Online-Workshops, erreichbar über einen Cloudflare-Quick-Tunnel.
#
#   workshop.bat start [-Anzahl 30]   Instanz hochfahren, Zugänge anlegen, Tunnel öffnen
#   workshop.bat stop                 Tunnel schließen, Instanz anhalten (Daten bleiben)
#   workshop.bat reset                Alles löschen: Datenbank, Zugänge, Uploads
#
# Eigene Datenbank und Port 1340, nur erfundene Daten. Die Schulinstanz (Port 1339)
# läuft unberührt weiter. Nicht für den Produktivbetrieb: Der Tunnel lebt nur,
# solange dieser Rechner läuft, und die Adresse ist bei jedem Start neu.
param(
    [Parameter(Mandatory = $true)][ValidateSet("start", "stop", "reset")][string]$Aktion,
    [int]$Anzahl = 30
)
# Continue: docker schreibt Fortschritt nach stderr, das wäre unter "Stop" ein Abbruch.
# Fehler prüfen wir selbst über $LASTEXITCODE bzw. -ErrorAction Stop.
$ErrorActionPreference = "Continue"
$root = $PSScriptRoot
$ws = Join-Path $root ".workshop"
$envFile = Join-Path $ws "workshop.env"
$pidFile = Join-Path $ws "tunnel.pid"
$port = 1340

function Compose {
    docker compose -p tt-workshop --env-file $envFile -f (Join-Path $root "docker-compose.yml") -f (Join-Path $root "docker-compose.workshop.yml") @args
    if ($LASTEXITCODE -ne 0) { throw "docker compose $args fehlgeschlagen" }
}

function Stop-Tunnel {
    if (Test-Path $pidFile) {
        try { Stop-Process -Id ([int](Get-Content $pidFile)) -Force -ErrorAction Stop } catch {}
        Remove-Item $pidFile
    }
}

if ($Aktion -eq "start") {
    if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
        throw "cloudflared fehlt: winget install Cloudflare.cloudflared"
    }
    New-Item -ItemType Directory -Force $ws | Out-Null
    # Nur versionierte Dateien aus data/: Beispiele, Kompendium, Grafiken.
    # Nicht versionierte Schuldaten (Listen, Uploads) kommen nicht mit.
    if (-not (Test-Path (Join-Path $ws "data"))) {
        $tar = Join-Path $ws "data.tar"
        git -C $root archive --format=tar -o $tar HEAD data
        if ($LASTEXITCODE -ne 0) { throw "git archive fehlgeschlagen" }
        tar -xf $tar -C $ws
        Remove-Item $tar
    }
    if (-not (Test-Path $envFile)) {
        $key = -join ((1..32) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) })
        Set-Content $envFile -Encoding ascii -Value @(
            "APP_PORT=$port", "API_PORT=8001", "DB_PORT=5436", "SECRET_KEY=$key", "NEXT_SKIP_TYPECHECK=1"
        )
    }

    Write-Host "Starte die Workshop-Instanz (der erste Start baut das Frontend, das dauert einige Minuten) ..."
    Compose up -d --build
    $bereit = $false
    for ($i = 0; $i -lt 180 -and -not $bereit; $i++) {
        try { Invoke-WebRequest "http://localhost:$port/" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop | Out-Null; $bereit = $true }
        catch { Start-Sleep -Seconds 5 }
    }
    if (-not $bereit) { throw "Frontend antwortet nicht. Log: docker logs tt-workshop-frontend" }

    Stop-Tunnel
    $log = Join-Path $ws "tunnel.log"
    if (Test-Path $log) { Remove-Item $log }
    $proc = Start-Process cloudflared -ArgumentList "tunnel --no-autoupdate --url http://localhost:$port" `
        -RedirectStandardError $log -RedirectStandardOutput (Join-Path $ws "tunnel.out") -WindowStyle Hidden -PassThru
    Set-Content $pidFile $proc.Id
    $url = $null
    for ($i = 0; $i -lt 60 -and -not $url; $i++) {
        Start-Sleep -Seconds 1
        $m = Select-String -Path $log -Pattern "https://[a-z0-9]+(-[a-z0-9]+)+\.trycloudflare\.com" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($m) { $url = $m.Matches[0].Value }
    }
    if (-not $url) { Stop-Tunnel; throw "Kein Tunnel. Log: $log" }

    docker exec tt-workshop-api python -m api.workshop_seed --anzahl $Anzahl --url $url
    if ($LASTEXITCODE -ne 0) { throw "Befüllen fehlgeschlagen" }
    Set-Clipboard $url
    Write-Host ""
    Write-Host "Workshop-Adresse (in der Zwischenablage): $url"
    Write-Host "Zugänge: $(Join-Path $ws 'data\zugaenge.txt')   QR: $(Join-Path $ws 'data\workshop-qr.png')"
    Write-Host "Beenden mit: workshop.bat stop"
}
elseif ($Aktion -eq "stop") {
    Stop-Tunnel
    if (Test-Path $envFile) { Compose stop }
    Write-Host "Tunnel zu, Workshop-Instanz angehalten."
}
else {
    Stop-Tunnel
    if (Test-Path $envFile) { Compose down -v }
    if (Test-Path $ws) { Remove-Item -Recurse -Force $ws }
    Write-Host "Workshop-Instanz samt Daten gelöscht."
}
