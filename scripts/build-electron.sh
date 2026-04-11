#!/bin/bash
# Build Electron .dmg variants with proper config and naming
#
# Usage:
#   ./scripts/build-electron.sh demo       # Octile Demo
#   ./scripts/build-electron.sh d1         # Octile D1
#   ./scripts/build-electron.sh pure       # Octile Pure
#   ./scripts/build-electron.sh all        # Build all 3 variants

set -euo pipefail
cd "$(dirname "$0")/.."

VARIANT="${1:-}"

if [[ ! "$VARIANT" =~ ^(demo|d1|pure|all)$ ]]; then
  echo "Usage: $0 {demo|d1|pure|all}"
  echo ""
  echo "  demo  - Steam demo with level caps, CTA after 10 solves"
  echo "  d1    - D1 release with Daily Challenge"
  echo "  pure  - Production release test (cleanest experience)"
  echo "  all   - Build all 3 variants"
  exit 1
fi

build_variant() {
  local VARIANT=$1
  local PRODUCT_NAME=""
  local APP_ID=""
  local ARTIFACT_NAME=""
  local CONFIG_FILE=""

  case "$VARIANT" in
    demo)
      PRODUCT_NAME="Octile Demo"
      APP_ID="cc.eu.octile.game.demo"
      ARTIFACT_NAME="Octile-Demo-\${version}.\${ext}"
      CONFIG_FILE="electron/configs/config.demo.json"
      ;;
    d1)
      PRODUCT_NAME="Octile D1"
      APP_ID="cc.eu.octile.game.d1"
      ARTIFACT_NAME="Octile-D1-\${version}.\${ext}"
      CONFIG_FILE="electron/configs/config.d1.json"
      ;;
    pure)
      PRODUCT_NAME="Octile Pure"
      APP_ID="cc.eu.octile.game.pure"
      ARTIFACT_NAME="Octile-Pure-\${version}.\${ext}"
      CONFIG_FILE="electron/configs/config.pure.json"
      ;;
  esac

  echo ""
  echo "========================================="
  echo "Building: $PRODUCT_NAME"
  echo "========================================="

  # Step 1: Clean previous .dmg to avoid confusion
  rm -f electron/dist/*.dmg 2>/dev/null || true

  # Step 2: Build web assets (if not already built)
  if [ ! -d "dist/web" ] || [ ! -f "dist/web/app.min.js" ]; then
    echo "Building web assets..."
    ./scripts/build.sh
  else
    echo "Web assets already built, skipping build.sh"
  fi

  # Step 3: Copy variant-specific config to dist/web/
  echo "Injecting $VARIANT config..."
  cp "$CONFIG_FILE" dist/web/config.json

  # Step 4: Build Electron with CLI overrides
  echo "Building Electron package..."
  cd electron
  npx electron-builder --mac \
    --config.productName="$PRODUCT_NAME" \
    --config.appId="$APP_ID" \
    --config.artifactName="$ARTIFACT_NAME"
  cd ..

  echo "✓ Built: $PRODUCT_NAME"
  ls -lh electron/dist/*.dmg | tail -1
}

# Build single or all variants
if [ "$VARIANT" = "all" ]; then
  echo "Building all variants..."

  build_variant "demo"
  build_variant "d1"
  build_variant "pure"

  echo ""
  echo "========================================="
  echo "All builds complete!"
  echo "========================================="
  ls -lh electron/dist/*.dmg
else
  build_variant "$VARIANT"
fi
