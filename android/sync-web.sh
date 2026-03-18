#!/bin/bash
# Sync web assets from root into Android assets folder
# Run from the android/ directory: ./sync-web.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ASSETS_DIR="$SCRIPT_DIR/app/src/main/assets"

cp "$ROOT_DIR/index.html" "$ASSETS_DIR/"
cp "$ROOT_DIR/favicon.svg" "$ASSETS_DIR/"
cp "$ROOT_DIR/manifest.json" "$ASSETS_DIR/"
cp "$ROOT_DIR/sw.js" "$ASSETS_DIR/"
cp "$ROOT_DIR/icons/"* "$ASSETS_DIR/icons/"

echo "Android assets synced from web root."
