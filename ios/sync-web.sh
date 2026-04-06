#!/bin/bash
# Sync web assets from dist/web/ into iOS bundle Web/ folder.
# Reads scripts/web-bundle-manifest.txt for the file list.
# Run from anywhere: ./ios/sync-web.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$ROOT_DIR/dist/web"
WEB_DIR="$SCRIPT_DIR/Octile/Octile/Web"
MANIFEST="$ROOT_DIR/scripts/web-bundle-manifest.txt"

if [ ! -d "$DIST_DIR" ]; then
  echo "Error: dist/web/ not found. Run ./scripts/build.sh first." >&2
  exit 1
fi

while IFS= read -r line; do
  [[ -z "$line" || "$line" == \#* ]] && continue

  if [[ "$line" == */ ]]; then
    mkdir -p "$WEB_DIR/$line"
    cp -r "$DIST_DIR/$line"* "$WEB_DIR/$line"
  else
    cp "$DIST_DIR/$line" "$WEB_DIR/$line"
  fi
done < "$MANIFEST"

echo "iOS Web assets synced from dist/web/."
