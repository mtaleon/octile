#!/bin/bash
# Build OTA bundle for Android WebView updates.
# Zips web assets, computes SHA-256 hash, updates version.json.
set -e

cd "$(dirname "$0")/.."

VERSION=$(python3 -c "import json; print(json.load(open('version.json'))['versionCode'])")
OUT="ota/bundle-v${VERSION}.zip"

mkdir -p ota

# Build minified JS first
echo "[OTA] Building app.min.js..."
npx terser app.js -o app.min.js --compress --mangle

# Create bundle
echo "[OTA] Packaging bundle v${VERSION}..."
zip -j "$OUT" \
    index.html \
    app.min.js \
    style.css \
    themes.css \
    translations.json \
    config.json \
    privacy.html \
    terms.html \
    help.html \
    feedback.html \
    sw.js \
    favicon.svg

HASH=$(shasum -a 256 "$OUT" | cut -d' ' -f1)
SIZE=$(wc -c < "$OUT" | tr -d ' ')

# Update version.json
python3 -c "
import json
with open('version.json') as f:
    data = json.load(f)
data['bundleUrl'] = 'https://mtaleon.github.io/octile/${OUT}'
data['bundleHash'] = 'sha256:${HASH}'
with open('version.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write('\n')
"

echo "[OTA] Bundle: $OUT ($SIZE bytes)"
echo "[OTA] SHA-256: $HASH"
echo "[OTA] version.json updated"
