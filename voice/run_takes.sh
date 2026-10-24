#!/usr/bin/env bash
# Full voice test for one advert: YarnGPT take, Chatterbox clone take, score, assemble, render.
set -uo pipefail
cd "$(dirname "$0")"
SPEC=../samples/AD-20261101-PM.json
ID=AD-20261101-PM
Y=.venv-yarn/bin/python
echo "STEP yarngpt"
$Y -u yarn_tts.py $SPEC --speaker jude --out work/$ID-yarn-jude 2>&1 | grep --line-buffered -E "^scene|Error|Traceback"
$Y evaluate.py work/$ID-yarn-jude 2>&1 | grep -E "OVERALL"
$Y make_ref.py work/$ID-yarn-jude refs/jude-ref.wav
echo "STEP chatterbox"
.venv-cb/bin/python -u cb_tts.py $SPEC --ref refs/jude-ref.wav --out work/$ID-cb-jude 2>&1 | grep --line-buffered -E "^scene|Error|Traceback"
$Y evaluate.py work/$ID-cb-jude 2>&1 | grep -E "OVERALL"
echo "STEP assemble"
for take in yarn-jude cb-jude; do $Y assemble.py $SPEC work/$ID-$take --name $ID-$take --public ../renderer/public 2>&1 | grep -E "caption words|Error|Traceback"; done
echo "STEP render"
for take in yarn-jude cb-jude; do ../renderer/render.sh props/$ID-$take.json out/$ID-$take.mp4 2>&1 | grep -E "rendered|Error|error" ; done
echo "ALL DONE"
