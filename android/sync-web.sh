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

while IFS= read -r line; do
  [[ -z "$line" || "$line" == \#* ]] && continue

  if [[ "$line" == */ ]]; then
    mkdir -p "$ASSETS_DIR/$line"
    cp -r "$DIST_DIR/$line"* "$ASSETS_DIR/$line"
  else
    cp "$DIST_DIR/$line" "$ASSETS_DIR/$line"
  fi
done < "$MANIFEST"

echo "Android assets synced from dist/web/."
