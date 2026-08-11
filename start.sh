#!/usr/bin/env bash
set -euo pipefail

# Create .env from example if missing
if [ ! -f .env ]; then
    echo "Creating .env from .env.example ..."
    cp .env.example .env
    echo "Done. Edit .env to set a real SECRET_KEY before going to production."
    echo
fi

# Detect LAN IP — use the interface that routes to the internet (excludes virtual/docker bridges)
HOST_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1)
if [ -z "$HOST_IP" ]; then
    HOST_IP=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep '^192\.168\.' | head -1)
fi
HOST_IP=${HOST_IP:-localhost}

echo "Detected LAN IP: $HOST_IP"
echo

export HOST_IP

# Web app port (chosen during install, stored in .env; defaults to 1339)
APP_PORT=$(grep -E '^APP_PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')
APP_PORT=${APP_PORT:-1339}

# Check if Docker is running; attempt to start it if not
if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running. Attempting to start..."
    # macOS
    if [ "$(uname)" = "Darwin" ]; then
        open -a Docker
    # Linux with systemd
    elif command -v systemctl >/dev/null 2>&1; then
        sudo systemctl start docker
    fi

    echo "Waiting for Docker to become ready..."
    attempts=0
    while ! docker info >/dev/null 2>&1; do
        sleep 5
        attempts=$((attempts + 1))
        [ $((attempts % 6)) -eq 0 ] && echo "Still waiting... (${attempts} checks)"
        if [ $attempts -ge 24 ]; then
            echo
            echo "Docker did not start within 2 minutes. Please start Docker manually."
            exit 1
        fi
    done
    echo "Docker is ready."
    echo
fi

echo "Starting Hauspokal..."
docker compose up -d --build

echo
echo "Hauspokal is running:"
echo "  Frontend  >  http://$HOST_IP:$APP_PORT"
echo "  API docs  >  http://localhost:8000/docs"
echo
echo "Use ./stop.sh to shut down."
