#!/usr/bin/env bash
# Detached finisher: once chain A (pid in $1) ends, make sure every Nov 1–3 advert has all three formats.
cd "$(dirname "$0")"
while kill -0 "$1" 2>/dev/null; do sleep 30; done
for ID in AD-20261101-PM AD-20261103-AM AD-20261103-PM; do
  out=../renderer/out
  if [ -f $out/$ID-4x5.mp4 ] && [ -f $out/$ID-9x16.mp4 ] && [ -f $out/$ID-16x9.mp4 ]; then echo "$ID already rendered"; continue; fi
  ./chain.sh $ID
done
echo "FINISHER DONE $(date -u)"
