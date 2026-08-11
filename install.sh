#!/usr/bin/env bash
set -euo pipefail

# Hauspokal one-command installer (Linux / macOS)
# Installs Docker (Engine + Compose plugin) if missing, then builds & starts the
# whole stack. All app packages (pip / npm / apt) install inside the containers,
# so Docker is the only host prerequisite this script bootstraps.

log()  { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWARN:\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

# Ask which port the web app should listen on (default 1339). Falls back to the
# default when not attached to a terminal (e.g. piped/non-interactive runs).
prompt_port() {
  local default=1339 port
  if [ ! -t 0 ]; then echo "$default"; return; fi
  while true; do
    printf 'Port for the web app [%s]: ' "$default" > /dev/tty
    read -r port < /dev/tty || { echo "$default"; return; }
    port="${port:-$default}"
    if [[ "$port" =~ ^[0-9]+$ ]] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ]; then
      echo "$port"; return
    fi
    printf 'Please enter a number between 1 and 65535.\n' > /dev/tty
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

# 4b. Choose the web app port and persist it to .env
APP_PORT=$(prompt_port)
set_env_var APP_PORT "$APP_PORT"
log "Web app port set to $APP_PORT"

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
echo "  API docs  >  http://localhost:8000/docs"
echo
echo "Stop with ./stop.sh"
[ "$NEEDS_RELOGIN" -eq 1 ] && warn "Log out and back in once so you can run docker / ./stop.sh without sudo."
exit 0
