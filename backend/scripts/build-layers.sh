#!/usr/bin/env bash
# Rebuilds the Sharp Lambda layer used by the visual encyclopedia worker.
# The layer is gitignored (native binaries) and must be rebuilt before
# `sam deploy` on a fresh checkout.
#
# Seed images used to be a second layer attached to the 30s API gateway so
# POST /api/admin/visual/seed could read them. That verb is gone; seed is
# `npm run seed-visual --workspace backend`, which normalizes images locally.
#
# Usage: from backend/:  bash scripts/build-layers.sh
set -euo pipefail

SHARP_VERSION="0.35.3"
HERE="$(cd "$(dirname "$0")/.." && pwd)"          # backend/

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

# Layers are gitignored. Fail here — not inside a cryptic SAM zip error —
# if the script somehow finished without writing them.
if [[ ! -d "$HERE/layers/sharp/nodejs/node_modules" ]]; then
  echo "ERROR: sharp layer missing at $HERE/layers/sharp/nodejs/node_modules" >&2
  echo "       backend/layers/ is gitignored; sam deploy needs it on disk." >&2
  exit 1
fi

echo "==> Sharp layer built. You can now run sam deploy."
