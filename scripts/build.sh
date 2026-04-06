#!/bin/bash
# Build web assets into dist/web/ from src/ modules + manifest.
#
# Usage:
#   ./scripts/build.sh               # concat + minify → dist/web/
#   ./scripts/build.sh --dev         # concat only (skip minify)
#
# Source files are numbered (00-core.js, 01-data.js, ...) to ensure
# correct concatenation order. All globals are shared across files.

set -euo pipefail
cd "$(dirname "$0")/.."

DEV=0
for arg in "$@"; do
  case "$arg" in
    --dev) DEV=1 ;;
  esac
done

MANIFEST="scripts/web-bundle-manifest.txt"
DIST="dist/web"

# 1. Clean and create output directory
rm -rf "$DIST"
mkdir -p "$DIST"

# 2. Concatenate source modules
echo "Concatenating src/js/*.js → $DIST/app.js"
cat src/js/*.js > "$DIST/app.js"
LINES=$(wc -l < "$DIST/app.js" | tr -d ' ')
echo "  $LINES lines"

# 3. Minify (unless --dev)
if [ $DEV -eq 0 ]; then
  echo "Minifying → $DIST/app.min.js"
  npx terser "$DIST/app.js" -o "$DIST/app.min.js" --compress --mangle
  SIZE=$(wc -c < "$DIST/app.min.js" | tr -d ' ')
  echo "  $(( SIZE / 1024 ))KB minified"
fi

# 4. Copy manifest entries from src/web/ to dist/web/
while IFS= read -r line; do
  # Skip comments and blank lines
  [[ -z "$line" || "$line" == \#* ]] && continue

  # Skip app.min.js — already built in place
  [[ "$line" == "app.min.js" ]] && continue

  if [[ "$line" == */ ]]; then
    # Directory entry — recursive copy
    if [ ! -d "src/web/$line" ]; then
      echo "ERROR: source dir src/web/$line not found" >&2; exit 1
    fi
    cp -r "src/web/$line" "$DIST/$line"
  else
    if [ ! -f "src/web/$line" ]; then
      echo "ERROR: source file src/web/$line not found" >&2; exit 1
    fi
    cp "src/web/$line" "$DIST/$line"
  fi
done < "$MANIFEST"

# 5. Generate bundle-info.json
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
FILES=$(cd "$DIST" && find . -type f | sed 's|^\./||' | sort | awk '
  BEGIN { printf "[" }
  NR > 1 { printf "," }
  { printf "\"%s\"", $0 }
  END { printf "]" }
')
printf '{"built":"%s","commit":"%s","files":%s}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$COMMIT" "$FILES" > "$DIST/bundle-info.json"

echo "Done. Output in $DIST/"
echo "Remember to bump CACHE_NAME in sw.js if deploying."
