#!/usr/bin/env bash
# Usage: add.sh <ComponentName> [variant=tailwind|content|ts-tailwind|ts-default] [dest=src/components/reactbits]
# Copies a React Bits component from GitHub (sparse git clone; works when reactbits.dev / api.github.com are blocked)
# and prints the npm deps it imports.
set -euo pipefail
NAME="${1:?component name, e.g. SplitText}"; VARIANT="${2:-tailwind}"; DEST="${3:-src/components/reactbits}"
CACHE="${REACTBITS_CACHE:-${TMPDIR:-/tmp}/react-bits-src}"
if [ ! -d "$CACHE/.git" ]; then
  git clone -q --depth 1 --filter=blob:none --sparse https://github.com/DavidHDev/react-bits.git "$CACHE"
fi
git -C "$CACHE" sparse-checkout set "src/$VARIANT" >/dev/null
SRC=$(find "$CACHE/src/$VARIANT" -mindepth 2 -maxdepth 2 -type d -name "$NAME" | head -1)
[ -z "$SRC" ] && { echo "Component '$NAME' not found in variant '$VARIANT'. See catalog.md" >&2; exit 1; }
mkdir -p "$DEST/$NAME"
cp -r "$SRC"/. "$DEST/$NAME/"
ls "$DEST/$NAME" | sed "s|^|added $DEST/$NAME/|"
DEPS=$(grep -rhoE "from ['\"][^'\".][^'\"]*['\"]" "$DEST/$NAME" | sed -E "s/from ['\"]([^'\"]+)['\"]/\1/" \
  | awk -F/ '{ if ($1 ~ /^@/) print $1"/"$2; else print $1 }' | grep -vE '^(react|react-dom)$' | sort -u | tr '\n' ' ' || true)
if [ -n "$DEPS" ]; then echo "npm deps needed: npm install $DEPS"; else echo "no extra npm deps"; fi
