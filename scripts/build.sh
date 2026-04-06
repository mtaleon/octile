#!/bin/bash
# Build web assets into dist/web/ from src/ modules + manifest.
#
# Usage:
#   ./scripts/build.sh               # concat + minify → dist/web/
#   ./scripts/build.sh --dev         # concat only (skip minify)
#   ./scripts/build.sh --watch       # build + watch for changes (implies --dev)
#   ./scripts/build.sh --serve       # build + watch + dev server (implies --watch --dev)
#
# Source files are numbered (00-core.js, 01-data.js, ...) to ensure
# correct concatenation order. All globals are shared across files.

set -euo pipefail
cd "$(dirname "$0")/.."

DEV=0
WATCH=0
SERVE=0
SOURCEMAP=0

for arg in "$@"; do
  case "$arg" in
    --dev) DEV=1 ;;
    --watch) WATCH=1; DEV=1 ;;
    --serve) SERVE=1; WATCH=1; DEV=1 ;;
    --source-map) SOURCEMAP=1 ;;
  esac
done

MANIFEST="scripts/web-bundle-manifest.txt"
DIST="dist/web"

# --- Core build functions ---

build_js() {
  echo "Concatenating src/js/*.js → $DIST/app.js"
  cat src/js/*.js > "$DIST/app.js"
  LINES=$(wc -l < "$DIST/app.js" | tr -d ' ')
  echo "  $LINES lines"
}

copy_file() {
  local REL="$1"
  mkdir -p "$(dirname "$DIST/$REL")"
  cp "src/web/$REL" "$DIST/$REL"
}

copy_manifest() {
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" == "app.min.js" ]] && continue

    if [[ "$line" == */ ]]; then
      if [ ! -d "src/web/$line" ]; then
        echo "ERROR: source dir src/web/$line not found" >&2; return 1
      fi
      cp -r "src/web/$line" "$DIST/$line"
    else
      if [ ! -f "src/web/$line" ]; then
        echo "ERROR: source file src/web/$line not found" >&2; return 1
      fi
      copy_file "$line"
    fi
  done < "$MANIFEST"
}

bundle_info() {
  COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  FILES=$(cd "$DIST" && find . -type f | sed 's|^\./||' | sort | awk '
    BEGIN { printf "[" }
    NR > 1 { printf "," }
    { printf "\"%s\"", $0 }
    END { printf "]" }
  ')
  printf '{"built":"%s","commit":"%s","files":%s}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$COMMIT" "$FILES" > "$DIST/bundle-info.json"
}

# --- Full build ---

# 1. Clean and create output directory
rm -rf "$DIST"
mkdir -p "$DIST"

# 2. Concatenate source modules
build_js

# 3. Minify or copy as app.min.js
if [ $DEV -eq 1 ] && [ $SOURCEMAP -eq 0 ]; then
  cp "$DIST/app.js" "$DIST/app.min.js"
elif [ $DEV -eq 0 ] || [ $SOURCEMAP -eq 1 ]; then
  TERSER_OPTS="--compress --mangle"
  [ $SOURCEMAP -eq 1 ] && TERSER_OPTS="$TERSER_OPTS --source-map"
  echo "Minifying → $DIST/app.min.js"
  npx terser "$DIST/app.js" -o "$DIST/app.min.js" $TERSER_OPTS
  SIZE=$(wc -c < "$DIST/app.min.js" | tr -d ' ')
  echo "  $(( SIZE / 1024 ))KB minified"
fi


# 4. Copy manifest entries from src/web/ to dist/web/
copy_manifest

# 5. Generate bundle-info.json
bundle_info

echo "Done. Output in $DIST/"
if [ $WATCH -eq 0 ]; then
  echo "Remember to bump CACHE_NAME in sw.js if deploying."
fi

# --- Watch + Serve ---

if [ $SERVE -eq 1 ]; then
  PORT=${PORT:-8371}
  python3 -m http.server "$PORT" -d "$DIST" &
  SERVER_PID=$!
  trap 'kill $SERVER_PID 2>/dev/null; exit 0' INT TERM EXIT
  echo "Dev server: http://localhost:$PORT"
fi

if [ $WATCH -eq 1 ]; then
  echo "Watching src/ for changes... (Ctrl-C to stop)"
  STAMP=$(mktemp)
  touch "$STAMP"

  rebuild() {
    local CHANGED="$1"
    echo "[$(date +%H:%M:%S)] Changed: $CHANGED"
    if [[ "$CHANGED" == src/js/* ]]; then
      build_js
      cp "$DIST/app.js" "$DIST/app.min.js"
    else
      local REL="${CHANGED#src/web/}"
      copy_file "$REL"
      echo "  Copied $REL"
    fi
  }

  if command -v fswatch >/dev/null 2>&1; then
    fswatch -0 src/js/ src/web/ | while IFS= read -r -d '' file; do
      rebuild "$file"
    done
  else
    echo "(tip: brew install fswatch for instant rebuilds)"
    while true; do
      find src/js src/web -newer "$STAMP" -type f 2>/dev/null | while IFS= read -r file; do
        rebuild "$file"
      done
      touch "$STAMP"
      sleep 1
    done
  fi
fi
