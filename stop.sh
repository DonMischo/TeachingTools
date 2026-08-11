#!/bin/sh
set -eu

echo "Stopping Hauspokal..."
docker compose down
echo "Done."
