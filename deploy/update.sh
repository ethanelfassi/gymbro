#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

git pull --ff-only origin main
npm ci
NODE_OPTIONS="--max-old-space-size=1024" npm run build
sudo systemctl restart gymbro
echo "=== GymBro Analytics mis a jour et redemarre sur le port 3005 ==="
