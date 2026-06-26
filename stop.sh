#!/usr/bin/env bash
set -euo pipefail

echo "Stopping Hauspokal..."
docker compose down
echo "Done."
