#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

git pull --ff-only origin main
NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection" npm ci --maxsockets=3 --fetch-retries=5 --fetch-timeout=180000
NODE_OPTIONS="--max-old-space-size=1024 --dns-result-order=ipv4first --no-network-family-autoselection" npm run build
sudo systemctl restart gymbro
echo "=== GymBro Analytics mis a jour et redemarre sur le port 3005 ==="
