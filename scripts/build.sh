#!/bin/bash
# Build app.js from src/ modules, then minify.
#
# Usage:
#   ./scripts/build.sh          # concat + minify
#   ./scripts/build.sh --dev    # concat only (skip minify, for debugging)
#
# Source files are numbered (00-core.js, 01-data.js, ...) to ensure
# correct concatenation order. All globals are shared across files.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "Concatenating src/*.js → app.js"
cat src/*.js > app.js

LINES=$(wc -l < app.js | tr -d ' ')
echo "  $LINES lines"

if [[ "${1:-}" == "--dev" ]]; then
  echo "Dev mode — skipping minify"
  exit 0
fi

echo "Minifying → app.min.js"
npx terser app.js -o app.min.js --compress --mangle

SIZE=$(wc -c < app.min.js | tr -d ' ')
echo "  $(( SIZE / 1024 ))KB minified"
echo "Done. Remember to bump CACHE_NAME in sw.js if deploying."
