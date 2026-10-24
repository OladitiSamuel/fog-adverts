#!/usr/bin/env bash
# Voice (if needed) then render one advert in 4:5, 9:16 and 16:9.
#   voice/chain.sh AD-…
set -uo pipefail
cd "$(dirname "$0")"
mkdir -p work
for ID in "$@"; do
  if ! grep -q "caption words" work/$ID.voice.log 2>/dev/null; then
    ./voice_batch_v2.sh $ID 2>&1 | tee work/$ID.voice.log
  fi
  for c in Exec-4x5 Exec-9x16 Exec-16x9; do
    CRF=23 nice ../renderer/render.sh ../renderer/props/$ID-cb-jude.json ../renderer/out/$ID-${c#Exec-}.mp4 $c 2>&1 | grep -E "rendered|rror"
  done
done
