#!/bin/sh
set -eu

echo "Stopping TT - Teaching Tools..."
docker compose down
echo "Done."
