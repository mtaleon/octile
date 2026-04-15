#!/bin/bash
# Sync web assets from dist/web/ into Android assets folder.
# Reads scripts/web-bundle-manifest.txt for the file list.
# Run from anywhere: ./android/sync-web.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$ROOT_DIR/dist/web"
ASSETS_DIR="$SCRIPT_DIR/app/src/main/assets"
MANIFEST="$ROOT_DIR/scripts/web-bundle-manifest.txt"

if [ ! -d "$DIST_DIR" ]; then
  echo "Error: dist/web/ not found. Run ./scripts/build.sh first." >&2
  exit 1
fi

# Create assets directory if it doesn't exist
mkdir -p "$ASSETS_DIR"

while IFS= read -r line; do
  [[ -z "$line" || "$line" == \#* ]] && continue

  if [[ "$line" == */ ]]; then
    mkdir -p "$ASSETS_DIR/$line"
    cp -r "$DIST_DIR/$line"* "$ASSETS_DIR/$line"
  else
    mkdir -p "$(dirname "$ASSETS_DIR/$line")"
    cp "$DIST_DIR/$line" "$ASSETS_DIR/$line"
  fi
done < "$MANIFEST"

# Replace privacy and terms with pure versions if pure mode enabled
if grep -q '"pure": true' "$DIST_DIR/config.json" 2>/dev/null; then
  echo "Pure mode detected, using pure versions of privacy/terms"
  cp "$DIST_DIR/privacy_pure.html" "$ASSETS_DIR/privacy.html"
  cp "$DIST_DIR/terms_pure.html"   "$ASSETS_DIR/terms.html"
fi

echo "Android assets synced from dist/web/."
