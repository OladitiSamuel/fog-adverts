#!/usr/bin/env bash
# Chatterbox Turbo take for the sample advert, after run_takes.sh has finished.
set -uo pipefail
cd "$(dirname "$0")"
../renderer/render.sh props/AD-20261101-PM-cb-jude.json out/AD-20261101-PM-cb-jude.mp4 2>&1 | grep -E "rendered|Error|error"
SPEC=../samples/AD-20261101-PM.json; ID=AD-20261101-PM; Y=.venv-yarn/bin/python
echo "STEP turbo"
start=$(date +%s)
.venv-cb/bin/python -u cb_tts.py $SPEC --turbo --ref refs/jude-ref.wav --out work/$ID-cbturbo-jude 2>&1 | grep --line-buffered -E "^scene|Error|Traceback"
echo "turbo wall time: $(( $(date +%s) - start ))s"
$Y evaluate.py work/$ID-cbturbo-jude 2>&1 | grep -E "REDO|ok  |OVERALL"
$Y assemble.py $SPEC work/$ID-cbturbo-jude --name $ID-cbturbo-jude --public ../renderer/public 2>&1 | grep -E "caption words|Error|Traceback"
../renderer/render.sh props/$ID-cbturbo-jude.json out/$ID-cbturbo-jude.mp4 2>&1 | grep -E "rendered|Error|error"
echo "TURBO DONE"
