#!/bin/bash
# Build OTA bundle for Android WebView updates.
# Zips web assets from dist/web/, computes SHA-256 hash, updates version.json.
set -e

cd "$(dirname "$0")/.."

if [ ! -f "src/web/version.json" ]; then
  echo "ERROR: src/web/version.json not found" >&2; exit 1
fi

VERSION=$(python3 -c "import json; d=json.load(open('src/web/version.json')); print(d.get('otaVersionCode', d['versionCode']))")
OUT="ota/bundle-v${VERSION}.zip"

mkdir -p ota

# Build into dist/web/ (concat src/js/*.js → app.js → app.min.js + manifest copy)
echo "[OTA] Building dist/web/..."
./scripts/build.sh

DIST="dist/web"

# Verify critical dist files exist after build
for f in index.html app.min.js; do
  if [ ! -f "$DIST/$f" ]; then
    echo "ERROR: $DIST/$f missing — build may have failed" >&2; exit 1
  fi
done

# Files to include in OTA bundle (from manifest, excluding directories)
OTA_FILES="index.html app.min.js style.css themes.css translations.json config.json privacy.html terms.html help.html feedback.html sw.js favicon.svg"

# Generate ota_manifest.json with per-file SHA-256 hashes
echo "[OTA] Generating ota_manifest.json..."
echo '{"files":{' > ota_manifest.json
FIRST=1
for f in $OTA_FILES; do
    FHASH=$(shasum -a 256 "$DIST/$f" | cut -d' ' -f1)
    if [ $FIRST -eq 1 ]; then FIRST=0; else echo ',' >> ota_manifest.json; fi
    printf '"%s":"sha256:%s"' "$f" "$FHASH" >> ota_manifest.json
done
echo '}}' >> ota_manifest.json

# Create bundle (files from dist/web/ + manifest)
echo "[OTA] Packaging bundle v${VERSION}..."
(cd "$DIST" && zip -j "../../$OUT" $OTA_FILES)
zip -j "$OUT" ota_manifest.json
rm -f ota_manifest.json

HASH=$(shasum -a 256 "$OUT" | cut -d' ' -f1)
SIZE=$(wc -c < "$OUT" | tr -d ' ')

# Update version.json
python3 -c "
import json
with open('src/web/version.json') as f:
    data = json.load(f)
data['bundleUrl'] = 'https://app.octile.eu.cc/${OUT}'
data['bundleHash'] = 'sha256:${HASH}'
with open('src/web/version.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write('\n')
"

echo "[OTA] Bundle: $OUT ($SIZE bytes)"
echo "[OTA] SHA-256: $HASH"
echo "[OTA] src/web/version.json updated"
