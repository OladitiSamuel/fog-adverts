"""Nigerian-English narration with YarnGPT2 (code MIT, weights Apache-2.0).

    .venv-yarn/bin/python yarn_tts.py SPEC.json --speaker jude --out work/AD-x-yarn-jude
Writes one WAV per sentence plus manifest.json for assemble.py.
"""
import argparse
import json
import sys
import time
from pathlib import Path

import soundfile as sf
import torch

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE / "yarngpt"))


def _shim_outetts():
    """YarnGPT only needs outetts' WavTokenizer decoder. outetts/__init__ pulls in llama-cpp and a
    dozen unrelated packages, so register the package without running its __init__."""
    import importlib.util
    import types

    spec = importlib.util.find_spec("outetts")
    pkg = types.ModuleType("outetts")
    pkg.__path__ = list(spec.submodule_search_locations)
    sys.modules["outetts"] = pkg


_shim_outetts()
from audiotokenizer import AudioTokenizerV2  # noqa: E402

from common import load_spec, narration, spoken  # noqa: E402

MODEL = "saheedniyi/YarnGPT2"
WAVTOK_CKPT = HERE / "models/wavtokenizer_large_speech_320_24k.ckpt"
WAVTOK_CFG = HERE / "models/wavtokenizer.yaml"
SR = 24000


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("--speaker", default="jude")
    ap.add_argument("--out", required=True)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--tries", type=int, default=3, help="max generations per sentence; best by transcript match is kept")
    ap.add_argument("--accept", type=float, default=0.9, help="stop retrying once this share of script words is heard")
    a = ap.parse_args()

    from transformers import AutoModelForCausalLM

    torch.set_num_threads(max(1, torch.get_num_threads()))
    tok = AudioTokenizerV2(MODEL, str(WAVTOK_CKPT), str(WAVTOK_CFG))
    model = AutoModelForCausalLM.from_pretrained(MODEL, torch_dtype=torch.float32).to(tok.device).eval()

    from faster_whisper import WhisperModel

    from evaluate import accuracy

    judge = WhisperModel("small.en", device="cpu", compute_type="int8")

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    manifest = []
    for si, ni, text in narration(load_spec(a.spec)):
        best = None
        for attempt in range(a.tries):
            torch.manual_seed(a.seed + attempt * 101)
            t0 = time.time()
            prompt = tok.create_prompt(spoken(text), lang="english", speaker_name=a.speaker)
            ids = tok.tokenize_prompt(prompt)
            with torch.inference_mode():
                gen = model.generate(input_ids=ids, temperature=0.1, repetition_penalty=1.1, max_length=4000, do_sample=attempt > 0)
            audio = tok.get_audio(tok.get_codes(gen)).squeeze().numpy()
            tmp = out / "_try.wav"
            sf.write(tmp, audio, SR)
            segs, _ = judge.transcribe(str(tmp), language="en", beam_size=5)
            heard = " ".join(x.text.strip() for x in segs)
            score = accuracy(spoken(text), heard)[0]
            print(f"scene {si} sentence {ni} try {attempt + 1}: {len(audio) / SR:.1f}s audio in {time.time() - t0:.0f}s, heard {score:.0%}  {text[:50]}", flush=True)
            if best is None or score > best[0]:
                best = (score, audio, heard)
            if score >= a.accept:
                break
        score, audio, heard = best
        f = out / f"s{si:02d}_{ni:02d}.wav"
        sf.write(f, audio, SR)
        manifest.append(dict(scene=si, sentence=ni, text=text, file=f.name, heard=heard, score=round(score, 3)))

    (out / "_try.wav").unlink(missing_ok=True)
    (out / "manifest.json").write_text(json.dumps(dict(engine="yarngpt2", speaker=a.speaker, sr=SR, items=manifest), indent=2))


if __name__ == "__main__":
    main()
