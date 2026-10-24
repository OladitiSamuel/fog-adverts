#!/usr/bin/env bash
# Voice several adverts in turn, the same way as the launch advert:
# Chatterbox (Nigerian-English reference voice), score every sentence, re-voice
# flagged sentences with other seeds, then assemble with executive pacing.
#   ./voice_batch.sh AD-20261101-PM AD-20261102-AM ...
set -uo pipefail
cd "$(dirname "$0")"
Y=.venv-yarn/bin/python; CB=.venv-cb/bin/python
for ID in "$@"; do
  SPEC=../samples/$ID.json; W=work/$ID-cb-jude
  echo "=== $ID"
  if [ ! -f $W/manifest.json ]; then
    nice $CB -u cb_tts.py $SPEC --ref refs/jude-ref.wav --exaggeration 0.4 --cfg 0.5 --out $W 2>&1 | grep --line-buffered "^scene"
  fi
  for seed in 23 11; do
    $Y evaluate.py $W > $W/eval.txt 2>&1
    redo=$(grep "^REDO" $W/eval.txt | awk '{print $2}' | sed 's/\.wav//' | tr '\n' ' ')
    [ -z "$redo" ] && break
    echo "redo with seed $seed: $redo"
    nice $CB -u cb_tts.py $SPEC --ref refs/jude-ref.wav --exaggeration 0.4 --cfg 0.5 --seed $seed --only $redo --out $W 2>&1 | grep --line-buffered "^scene"
  done
  $Y evaluate.py $W > $W/eval.txt 2>&1; grep -E "REDO|OVERALL" $W/eval.txt
  $Y assemble.py $SPEC $W --name $ID-cb-jude --public ../renderer/public --gap-sentence 0.38 --gap-scene 0.9 2>&1 | grep -E "caption words|Error|Traceback"
done
echo "VOICE BATCH DONE"
