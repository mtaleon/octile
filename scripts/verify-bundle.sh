#!/bin/bash
# Verify dist/web/ contains all files listed in the web bundle manifest.
# Exits 1 if anything is missing. Used by CI before deploy.
set -euo pipefail
cd "$(dirname "$0")/.."

MANIFEST="scripts/web-bundle-manifest.txt"
DIST="dist/web"
MISSING=0

if [ ! -d "$DIST" ]; then
  echo "ERROR: $DIST does not exist. Run ./scripts/build.sh first." >&2
  exit 1
fi

while IFS= read -r line; do
  # Skip comments and blank lines
  [[ -z "$line" || "$line" == \#* ]] && continue

  if [[ "$line" == */ ]]; then
    # Directory entry
    if [ ! -d "$DIST/$line" ]; then
      echo "MISSING dir:  $line" >&2
      MISSING=1
    fi
  else
    if [ ! -f "$DIST/$line" ]; then
      echo "MISSING file: $line" >&2
      MISSING=1
    fi
  fi
done < "$MANIFEST"

if [ $MISSING -eq 1 ]; then
  echo "Bundle verification FAILED." >&2
  exit 1
fi

echo "Bundle verified: all manifest entries present in $DIST"
