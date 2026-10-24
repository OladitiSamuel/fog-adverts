#!/usr/bin/env bash
# Executive advert: score the Chatterbox take, assemble with executive pacing, render 4:5, 9:16 and 16:9.
#   ./run_exec.sh AD-20261101-AM
set -uo pipefail
cd "$(dirname "$0")"
ID="$1"; SPEC=../samples/$ID.json; TAKE=$ID-cb-jude; Y=.venv-yarn/bin/python
echo "STEP evaluate"; $Y evaluate.py work/$TAKE 2>&1 | grep -E "REDO|ok  |OVERALL"
echo "STEP assemble"; $Y assemble.py $SPEC work/$TAKE --name $TAKE --public ../renderer/public --gap-sentence 0.38 --gap-scene 0.9 2>&1 | grep -E "caption words|Error|Traceback"
echo "STEP render"
for c in Exec-4x5 Exec-9x16 Exec-16x9; do ../renderer/render.sh ../renderer/props/$TAKE.json ../renderer/out/$TAKE-${c#Exec-}.mp4 $c 2>&1 | grep -E "rendered|Error|error"; done
echo "ALL DONE"
