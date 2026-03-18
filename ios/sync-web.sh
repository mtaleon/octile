#!/bin/bash
# Sync web assets from root into iOS bundle Web/ folder
# Run from the ios/ directory: ./sync-web.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
WEB_DIR="$SCRIPT_DIR/Octile/Octile/Web"

cp "$ROOT_DIR/index.html" "$WEB_DIR/"
cp "$ROOT_DIR/favicon.svg" "$WEB_DIR/"
cp "$ROOT_DIR/manifest.json" "$WEB_DIR/"
cp "$ROOT_DIR/sw.js" "$WEB_DIR/"
cp "$ROOT_DIR/icons/"* "$WEB_DIR/icons/"

echo "iOS Web assets synced from web root."
