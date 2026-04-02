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

# Files to include in OTA bundle
OTA_FILES="index.html app.min.js style.css themes.css translations.json config.json privacy.html terms.html help.html feedback.html sw.js favicon.svg"

# Generate ota_manifest.json with per-file SHA-256 hashes
echo "[OTA] Generating ota_manifest.json..."
echo '{"files":{' > ota_manifest.json
FIRST=1
for f in $OTA_FILES; do
    FHASH=$(shasum -a 256 "$f" | cut -d' ' -f1)
    if [ $FIRST -eq 1 ]; then FIRST=0; else echo ',' >> ota_manifest.json; fi
    printf '"%s":"sha256:%s"' "$f" "$FHASH" >> ota_manifest.json
done
echo '}}' >> ota_manifest.json

# Create bundle (including manifest)
echo "[OTA] Packaging bundle v${VERSION}..."
zip -j "$OUT" $OTA_FILES ota_manifest.json
rm -f ota_manifest.json

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
