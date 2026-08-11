#!/bin/sh
# POSIX sh — runs under bash, dash, and BusyBox ash alike (no bashisms), so
# `sh install.sh`, `./install.sh`, and `bash install.sh` all behave the same.
set -eu

# Hauspokal one-command installer (Linux / macOS)
# Installs Docker (Engine + Compose plugin) if missing, then builds & starts the
# whole stack. All app packages (pip / npm / apt) install inside the containers,
# so Docker is the only host prerequisite this script bootstraps.

log()  { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWARN:\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

OS="$(uname -s)"
SUDO=""
NEEDS_RELOGIN=0

resolve_sudo() {
  if [ "$(id -u)" -eq 0 ]; then
    SUDO=""
  elif command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    err "This installer needs root privileges (or sudo) to install Docker."
    exit 1
  fi
}

install_docker_linux() {
  log "Docker not found. Installing Docker Engine + Compose plugin..."
  resolve_sudo
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | $SUDO sh
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- https://get.docker.com | $SUDO sh
  else
    err "Need curl or wget to download the Docker installer. Install one and re-run."
    exit 1
  fi

  # Enable + start the daemon (systemd hosts)
  if command -v systemctl >/dev/null 2>&1; then
    $SUDO systemctl enable --now docker || true
  fi

  # Let the current user run docker without sudo (takes effect after re-login)
  if [ "$(id -u)" -ne 0 ]; then
    $SUDO usermod -aG docker "$USER" || true
    NEEDS_RELOGIN=1
  fi
}

# Write KEY=VALUE into .env, replacing an existing line or appending a new one.
# The sed -i.bak form works on both GNU (Linux) and BSD (macOS) sed.
set_env_var() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" .env && rm -f .env.bak
  else
    printf '%s=%s\n' "$key" "$val" >> .env
  fi
}

# Return 0 if a host port is already bound (by any process or Docker container).
# Several Hauspokal-style apps can share one host, so every published port
# (frontend, postgres, API) must be checked before we map it.
port_in_use() {
  local port=$1
  if command -v ss >/dev/null 2>&1; then
    ss -tlnH 2>/dev/null | grep -qE "[[:space:]]:${port}[[:space:]]" && return 0
  fi
  if command -v netstat >/dev/null 2>&1; then
    netstat -tln 2>/dev/null | grep -qE "[[:space:]]:${port}[[:space:]]" && return 0
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1 && return 0
  fi
  if docker info >/dev/null 2>&1; then
    docker ps --format '{{.Ports}}' 2>/dev/null \
      | grep -qE "(0\.0\.0\.0|127\.0\.0\.1|\[::\]):${port}->" && return 0
  fi
  return 1
}

# Echo the next free port at or above $1.
find_free_port() {
  local port=$1
  while port_in_use "$port"; do port=$((port + 1)); done
  echo "$port"
}

# Return 0 if $1 is an integer in the valid TCP port range (POSIX, no [[ =~ ]]).
valid_port() {
  case "$1" in
    ''|*[!0-9]*) return 1 ;;
  esac
  [ "$1" -ge 1 ] && [ "$1" -le 65535 ]
}

# choose_port LABEL DEFAULT ALWAYS_PROMPT
# Picks a conflict-free host port. When DEFAULT is free and ALWAYS_PROMPT != 1 it
# is used silently; otherwise the user is prompted with the next free port as the
# suggested default. Non-interactive runs auto-take the suggested free port.
choose_port() {
  local label=$1 default=$2 always=$3 suggested port
  suggested=$(find_free_port "$default")
  if [ "$always" != "1" ] && [ "$suggested" = "$default" ]; then
    echo "$default"; return
  fi
  if [ ! -t 0 ]; then
    [ "$suggested" != "$default" ] && warn "$label port $default in use — using $suggested." >&2
    echo "$suggested"; return
  fi
  [ "$suggested" != "$default" ] && \
    printf '  \033[1;33m[!]\033[0m %s port %s is already in use.\n' "$label" "$default" > /dev/tty
  while true; do
    printf '  %s port [%s]: ' "$label" "$suggested" > /dev/tty
    read -r port < /dev/tty || { echo "$suggested"; return; }
    port="${port:-$suggested}"
    if ! valid_port "$port"; then
      printf '  Enter a number between 1 and 65535.\n' > /dev/tty; continue
    fi
    if [ "$port" != "$default" ] && port_in_use "$port"; then
      printf '  Port %s is also in use — pick another.\n' "$port" > /dev/tty; continue
    fi
    echo "$port"; return
  done
}

install_docker_macos() {
  log "Docker not found. Installing Docker Desktop for Mac..."
  if command -v brew >/dev/null 2>&1; then
    brew install --cask docker
    open -a Docker || true
    warn "Docker Desktop installed. Finish its first-run setup, then re-run ./install.sh."
    exit 0
  fi
  err "Homebrew not found. Install Docker Desktop manually: https://www.docker.com/products/docker-desktop/"
  exit 1
}

# 1. Ensure Docker is present
if ! command -v docker >/dev/null 2>&1; then
  case "$OS" in
    Linux)  install_docker_linux ;;
    Darwin) install_docker_macos ;;
    *) err "Unsupported OS: $OS. Install Docker manually."; exit 1 ;;
  esac
else
  log "Docker already installed: $(docker --version)"
fi

# 2. Ensure the Compose v2 plugin is available
if ! docker compose version >/dev/null 2>&1 && ! $SUDO docker compose version >/dev/null 2>&1; then
  err "Docker Compose v2 plugin not found. Update Docker to a recent version and re-run."
  exit 1
fi

# 3. Make sure the daemon is reachable; pick the right docker invocation
DOCKER="docker"
if ! docker info >/dev/null 2>&1; then
  if [ "$NEEDS_RELOGIN" -eq 1 ] && [ -n "$SUDO" ] && $SUDO docker info >/dev/null 2>&1; then
    warn "Using sudo for this first run. Log out/in (or run 'newgrp docker') to use Docker without sudo later."
    DOCKER="$SUDO docker"
  else
    log "Starting the Docker daemon..."
    if command -v systemctl >/dev/null 2>&1; then
      ${SUDO:-sudo} systemctl start docker || true
    elif [ "$OS" = "Darwin" ]; then
      open -a Docker || true
    fi
    log "Waiting for the Docker daemon to become ready..."
    tries=0
    until docker info >/dev/null 2>&1; do
      sleep 3; tries=$((tries + 1))
      if [ $tries -ge 40 ]; then
        err "Docker daemon did not become ready. Start Docker and re-run ./install.sh."
        exit 1
      fi
    done
  fi
fi

# 4. Create .env from example if missing
if [ ! -f .env ]; then
  log "Creating .env from .env.example"
  cp .env.example .env
  warn "Edit .env to set a real SECRET_KEY before production use."
fi

# 4b. Choose conflict-free host ports and persist them to .env.
# Frontend is always prompted (it's the user-facing URL); postgres and the API
# are only prompted when their default host port is already taken.
log "Selecting host ports (avoiding conflicts with other apps)..."
APP_PORT=$(choose_port "Frontend (web app)" 1339 1)
set_env_var APP_PORT "$APP_PORT"
DB_PORT=$(choose_port "PostgreSQL" 5435 0)
set_env_var DB_PORT "$DB_PORT"
API_PORT=$(choose_port "Backend API" 8000 0)
set_env_var API_PORT "$API_PORT"
log "Ports — frontend: $APP_PORT · postgres: $DB_PORT · api: $API_PORT"

# 5. Detect LAN IP (same logic as start.sh)
HOST_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1)
[ -z "${HOST_IP:-}" ] && HOST_IP=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep '^192\.168\.' | head -1)
HOST_IP=${HOST_IP:-localhost}
export HOST_IP
log "Detected LAN IP: $HOST_IP"

# 6. Build & start the stack (first build downloads images / installs packages)
log "Building and starting Hauspokal (first run may take several minutes)..."
$DOCKER compose up -d --build

log "Hauspokal is running:"
echo "  Frontend  >  http://$HOST_IP:$APP_PORT"
echo "  API docs  >  http://localhost:$API_PORT/docs"
echo "  Postgres  >  127.0.0.1:$DB_PORT"
echo
echo "Stop with ./stop.sh"
[ "$NEEDS_RELOGIN" -eq 1 ] && warn "Log out and back in once so you can run docker / ./stop.sh without sudo."
exit 0
