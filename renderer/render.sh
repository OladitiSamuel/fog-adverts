#!/usr/bin/env bash
# Render one advert: ./render.sh props/<name>.json [out/<name>.mp4] [composition]
# CRF (env, default 20): higher = smaller file; the worker uses 23 to stay under the 20 MB storage limit.
# composition: Advert (default, 9:16 standard style) or Exec-4x5 / Exec-9x16 / Exec-16x9 (executive style).
set -euo pipefail
cd "$(dirname "$0")"
props="$1"; out="${2:-out/$(basename "${props%.json}").mp4}"; comp="${3:-Advert}"
mkdir -p "$(dirname "$out")"
npx remotion render src/index.ts "$comp" "$out" --props="$props" --codec=h264 --crf=${CRF:-20} --audio-bitrate=192k --concurrency=3 --log=warn
echo "rendered $out"
