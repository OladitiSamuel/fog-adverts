"""Join per-sentence narration into one voice track and time every word for captions.

    .venv-yarn/bin/python assemble.py SPEC.json WORKDIR --name AD-x-yarn-jude --public ../renderer/public
Writes <public>/voice/<name>.wav and <public>/../props/<name>.json (Remotion input props).
Word timings come from faster-whisper (MIT), aligned back to the script's own words so captions
always show the approved text, never a mis-hearing.
"""
import argparse
import difflib
import json
import re
from pathlib import Path

import numpy as np
import soundfile as sf

from common import load_spec

LEAD_IN = 0.25
GAP_SENTENCE = 0.22
GAP_SCENE = 0.45
TARGET_RMS_DB = -19.0


def trim(x, sr, thresh_db=-42, pad=0.04):
    """Cut leading/trailing silence and the tail noise small TTS models sometimes add."""
    win = int(sr * 0.02)
    if len(x) < win * 3:
        return x
    frames = np.lib.stride_tricks.sliding_window_view(x, win)[::win]
    db = 20 * np.log10(np.sqrt((frames ** 2).mean(axis=1)) + 1e-9)
    loud = np.where(db > thresh_db)[0]
    if not len(loud):
        return x
    a = max(0, loud[0] * win - int(pad * sr))
    b = min(len(x), (loud[-1] + 1) * win + int(pad * sr))
    y = x[a:b].copy()
    fade = int(0.012 * sr)
    y[:fade] *= np.linspace(0, 1, fade)
    y[-fade:] *= np.linspace(1, 0, fade)
    return y


def norm_word(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("work")
    ap.add_argument("--name", required=True)
    ap.add_argument("--public", required=True)
    ap.add_argument("--whisper", default="small.en")
    ap.add_argument("--gap-sentence", type=float, default=GAP_SENTENCE)
    ap.add_argument("--gap-scene", type=float, default=GAP_SCENE)
    a = ap.parse_args()

    spec = load_spec(a.spec)
    work = Path(a.work)
    man = json.loads((work / "manifest.json").read_text())
    sr = man["sr"]

    parts, sentences, scene_bounds = [np.zeros(int(LEAD_IN * sr), dtype=np.float32)], [], {}
    t = LEAD_IN
    prev_scene = None
    for it in man["items"]:
        if prev_scene is not None:
            gap = a.gap_scene if it["scene"] != prev_scene else a.gap_sentence
            parts.append(np.zeros(int(gap * sr), dtype=np.float32))
            t += gap
        x, file_sr = sf.read(work / it["file"], dtype="float32")
        assert file_sr == sr
        x = trim(x if x.ndim == 1 else x.mean(axis=1), sr)
        start, end = t, t + len(x) / sr
        parts.append(x)
        t = end
        sentences.append(dict(scene=it["scene"], text=it["text"], start=start, end=end))
        b = scene_bounds.setdefault(it["scene"], [start, end])
        b[1] = end
        prev_scene = it["scene"]

    audio = np.concatenate(parts)
    rms = np.sqrt((audio ** 2).mean())
    audio *= 10 ** (TARGET_RMS_DB / 20) / (rms + 1e-9)
    peak = np.abs(audio).max()
    if peak > 0.97:
        audio *= 0.97 / peak

    public = Path(a.public)
    (public / "voice").mkdir(parents=True, exist_ok=True)
    wav_rel = f"voice/{a.name}.wav"
    sf.write(public / wav_rel, audio, sr, subtype="PCM_16")
    duration = len(audio) / sr

    from faster_whisper import WhisperModel

    wm = WhisperModel(a.whisper, device="cpu", compute_type="int8")
    segs, _ = wm.transcribe(str(public / wav_rel), word_timestamps=True, language="en", beam_size=5)
    heard = [dict(w=w.word.strip(), s=w.start, e=w.end) for seg in segs for w in seg.words]

    words = []
    for sen in sentences:
        script = sen["text"].split()
        inside = [h for h in heard if h["s"] >= sen["start"] - 0.15 and h["s"] < sen["end"] + 0.05]
        sm = difflib.SequenceMatcher(a=[norm_word(w) for w in script], b=[norm_word(h["w"]) for h in inside], autojunk=False)
        times = [None] * len(script)
        for blk in sm.get_matching_blocks():
            for k in range(blk.size):
                h = inside[blk.b + k]
                times[blk.a + k] = (h["s"], h["e"])
        # Words whisper heard differently get times interpolated between their matched neighbours.
        known = [(i, tt) for i, tt in enumerate(times) if tt]
        anchors = [(-1, (sen["start"], sen["start"]))] + known + [(len(script), (sen["end"], sen["end"]))]
        for (i0, (_, e0)), (i1, (s1, _)) in zip(anchors, anchors[1:]):
            n = i1 - i0 - 1
            for k in range(n):
                frac0, frac1 = k / n, (k + 1) / n
                times[i0 + 1 + k] = (e0 + (s1 - e0) * frac0, e0 + (s1 - e0) * frac1)
        for w, (s, e) in zip(script, times):
            words.append(dict(text=w, start=round(s, 3), end=round(e, 3)))

    props = dict(
        id=spec["id"],
        division=spec["division"],
        service=spec.get("service", ""),
        style=spec.get("style", "standard"),
        credits=spec.get("credits", ""),
        textStyle=spec.get("textStyle", "bold"),
        exampleLabel=bool(spec.get("exampleLabel", False)),
        scenes=spec["scenes"],
        voice=dict(
            audio=wav_rel,
            duration=round(duration, 3),
            scenes=[dict(start=round(scene_bounds[i][0], 3), end=round(scene_bounds[i][1], 3)) for i in range(len(spec["scenes"]))],
            words=words,
        ),
    )
    if spec.get("music"):
        props["music"] = spec["music"]
    props_dir = public.parent / "props"
    props_dir.mkdir(exist_ok=True)
    (props_dir / f"{a.name}.json").write_text(json.dumps(props, indent=2, ensure_ascii=False))
    matched = sum(1 for h in heard)
    print(f"{a.name}: {duration:.1f}s, {len(words)} caption words, whisper heard {matched} words")


if __name__ == "__main__":
    main()
