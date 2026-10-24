"""Narration with Chatterbox (MIT), cloning the voice in a short reference clip.

    .venv-cb/bin/python cb_tts.py SPEC.json --ref voices/ref.wav --out work/AD-x-cb
The reference sets the accent and timbre. Use only a voice FOG has the right to use
(a YarnGPT voice we generated, or a staff member who has consented in writing).
"""
import argparse
import json
import time
from pathlib import Path

import soundfile as sf
import torch
from chatterbox.tts import ChatterboxTTS

from common import load_spec, narration, spoken


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("--ref", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--exaggeration", type=float, default=0.55)
    ap.add_argument("--cfg", type=float, default=0.45)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--turbo", action="store_true", help="Chatterbox Turbo (350M, MIT): faster, no exaggeration control")
    ap.add_argument("--only", nargs="+", help="re-voice just these sentences (e.g. s01_00) into an existing take, keeping its manifest")
    a = ap.parse_args()

    if a.turbo:
        from chatterbox.tts_turbo import ChatterboxTurboTTS

        model = ChatterboxTurboTTS.from_pretrained(device="cpu")
    else:
        model = ChatterboxTTS.from_pretrained(device="cpu")
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    manifest = []
    for si, ni, text in narration(load_spec(a.spec)):
        if a.only and f"s{si:02d}_{ni:02d}" not in a.only:
            continue
        torch.manual_seed(a.seed)
        t0 = time.time()
        if a.turbo:
            wav = model.generate(spoken(text), audio_prompt_path=a.ref)
        else:
            wav = model.generate(spoken(text), audio_prompt_path=a.ref, exaggeration=a.exaggeration, cfg_weight=a.cfg)
        audio = wav.squeeze().cpu().numpy()
        f = out / f"s{si:02d}_{ni:02d}.wav"
        sf.write(f, audio, model.sr)
        manifest.append(dict(scene=si, sentence=ni, text=text, file=f.name))
        print(f"scene {si} sentence {ni}: {len(audio) / model.sr:.1f}s audio in {time.time() - t0:.0f}s  {text[:60]}", flush=True)

    if a.only:  # files were replaced in place; the existing manifest still describes the take
        return
    (out / "manifest.json").write_text(json.dumps(dict(engine="chatterbox-turbo" if a.turbo else "chatterbox", ref=str(a.ref), sr=model.sr, items=manifest), indent=2))


if __name__ == "__main__":
    main()
