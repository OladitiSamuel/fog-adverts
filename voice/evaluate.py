"""Score a narration take: transcribe each sentence and compare with the script.

    .venv-yarn/bin/python evaluate.py work/<take> [--whisper small.en]
Prints per-sentence word accuracy and flags sentences that should be regenerated.
The production pipeline uses the same check to retry bad sentences automatically.
"""
import argparse
import difflib
import json
import re
from pathlib import Path

import soundfile as sf

from common import spoken


# British spellings in the scripts vs the American ones the transcriber writes.
SPELLING = {"centres": "centers", "centre": "center", "organisation": "organization", "organisations": "organizations",
            "itemised": "itemized", "recognise": "recognize", "optimise": "optimize", "programme": "program"}


def norm(t):
    t = t.lower()
    # Letters spoken one by one ("c e o", "a i") and web addresses compare as single words.
    t = re.sub(r"\b(?:[a-z] ){1,4}[a-z]\b", lambda m: m.group(0).replace(" ", ""), t)
    t = t.replace("fog tech nexus dot space", "fogtechnexus.space").replace("cyber security", "cybersecurity")
    t = re.sub(r"(\w)\.(\w)", r"\1\2", t)
    return [SPELLING.get(w, w) for w in re.sub(r"[^a-z0-9 ]", " ", t).split()]


def accuracy(script, heard):
    a, b = norm(script), norm(heard)
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    hit = sum(blk.size for blk in sm.get_matching_blocks())
    return hit / max(1, len(a)), hit / max(1, len(b))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("work")
    ap.add_argument("--whisper", default="small.en")
    a = ap.parse_args()

    from faster_whisper import WhisperModel

    wm = WhisperModel(a.whisper, device="cpu", compute_type="int8")
    work = Path(a.work)
    man = json.loads((work / "manifest.json").read_text())
    total_words = total_hit = 0
    results = []
    for it in man["items"]:
        x, sr = sf.read(work / it["file"])
        segs, _ = wm.transcribe(str(work / it["file"]), language="en", beam_size=5)
        heard = " ".join(s.text.strip() for s in segs)
        recall, precision = accuracy(spoken(it["text"]), heard)
        n = len(norm(spoken(it["text"])))
        total_words += n
        total_hit += recall * n
        wps = n / (len(x) / sr)
        bad = recall < 0.85 or precision < 0.8 or not (1.6 <= wps <= 4.2)
        results.append(dict(file=it["file"], seconds=round(len(x) / sr, 2), recall=round(recall, 2), precision=round(precision, 2), words_per_sec=round(wps, 2), redo=bad, heard=heard))
        flag = "REDO" if bad else "ok  "
        print(f"{flag} {it['file']} {len(x) / sr:5.1f}s  recall {recall:.0%} precision {precision:.0%}  {wps:.1f} w/s  heard: {heard[:90]}")
    overall = total_hit / max(1, total_words)
    print(f"OVERALL script accuracy {overall:.0%}, {sum(r['redo'] for r in results)} of {len(results)} sentences flagged")
    (work / "evaluation.json").write_text(json.dumps(dict(overall=round(overall, 3), sentences=results), indent=2))


if __name__ == "__main__":
    main()
