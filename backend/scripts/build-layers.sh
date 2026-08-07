#!/usr/bin/env bash
# Rebuilds the Lambda layers used by the visual encyclopedia worker/seed.
# These layers are gitignored (large binaries / images) and must be rebuilt
# before `sam deploy` on a fresh checkout.
#
#   1. sharp layer  -> layers/sharp/nodejs/node_modules  (linux-x64 native binaries)
#   2. seed images  -> layers/seed-images/seed-images/*.png (mounted at /opt/seed-images)
#
# Usage: from backend/:  bash scripts/build-layers.sh
set -euo pipefail

SHARP_VERSION="0.35.3"
HERE="$(cd "$(dirname "$0")/.." && pwd)"          # backend/
REPO="$(cd "$HERE/.." && pwd)"
IMG_SRC="$REPO/valdren-context/valdren-images"

echo "==> Building sharp linux-x64 layer (sharp@$SHARP_VERSION)"
rm -rf "$HERE/layers/sharp"
mkdir -p "$HERE/layers/sharp"
# Install OUTSIDE the npm workspace tree so deps are not hoisted to the repo root.
TMP_SHARP="$(mktemp -d)"
mkdir -p "$TMP_SHARP/nodejs"
( cd "$TMP_SHARP/nodejs" \
    && npm init -y >/dev/null \
    && npm install --cpu=x64 --os=linux --libc=glibc "sharp@$SHARP_VERSION" >/dev/null )
test -f "$TMP_SHARP/nodejs/node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64-$SHARP_VERSION.node" \
  || { echo "ERROR: linux-x64 sharp binary missing"; rm -rf "$TMP_SHARP"; exit 1; }
cp -R "$TMP_SHARP/nodejs" "$HERE/layers/sharp/nodejs"
rm -rf "$TMP_SHARP"
echo "    sharp layer ready"

echo "==> Staging + normalizing canonical seed images to PNG"
rm -rf "$HERE/layers/seed-images"
mkdir -p "$HERE/layers/seed-images/seed-images"
node "$HERE/scripts/normalize-seed-images.mjs" "$IMG_SRC" "$HERE/layers/seed-images/seed-images"
echo "==> Layers built. You can now run sam deploy."
