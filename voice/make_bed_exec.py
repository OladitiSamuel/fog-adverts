"""Synthesise the executive music bed (FOG owns it outright: generated here, no samples).

    .venv-yarn/bin/python make_bed_exec.py --seconds 95 --out ../renderer/public/music/bed-exec.wav
Slow and restrained for board-level adverts: warm pads, a low drone and a sparse piano-like
motif, no drums. Mixed low so it sits under narration.
"""
import argparse

import numpy as np
import soundfile as sf

from make_bed import SR, lowpass, note


def warm_pad(freqs, n):
    """Soft pad: detuned sines with a little second harmonic, slow attack and release."""
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        for det in (-0.08, 0.0, 0.08):
            ph = 2 * np.pi * f * (1 + det / 100) * t
            out += np.sin(ph) + 0.18 * np.sin(2 * ph)
    env = np.minimum(1, t / 1.6) * np.minimum(1, (n / SR - t) / 1.2)
    return out * env / (len(freqs) * 3)


def piano(f, n):
    """Plucked tone with a fast attack and a long exponential decay."""
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t * 3) + 0.12 * np.sin(6 * np.pi * f * t) * np.exp(-t * 5)
    return tone * np.minimum(1, t / 0.004) * np.exp(-t * 1.6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=float, default=95)
    ap.add_argument("--bpm", type=float, default=68)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    beat = 60 / a.bpm
    bar = int(4 * beat * SR)
    # D - Bm - G - A, voiced open: confident, unhurried.
    prog = [[50, 57, 62, 66, 69], [47, 54, 62, 66, 71], [43, 55, 62, 66, 71], [45, 52, 61, 64, 69]]
    motif = [[74, 69, 66, 69], [74, 71, 66, 71], [74, 71, 67, 71], [73, 69, 64, 69]]
    total = int(a.seconds * SR)
    bars = int(np.ceil(total / bar)) + 1

    # Pads overlap by half a second so chord changes breathe instead of cutting.
    ov = int(0.5 * SR)
    pads = np.zeros(total + bar * 2)
    for i in range(bars):
        seg = warm_pad([note(m) for m in prog[i % 4]], bar + ov)
        s = i * bar
        pads[s:s + len(seg)] += seg[: max(0, len(pads) - s)]
    pads = lowpass(pads[:total], 1400)

    drone = 0.5 * np.sin(2 * np.pi * note(38) * np.arange(total) / SR)
    drone *= 0.6 + 0.4 * np.sin(2 * np.pi * np.arange(total) / SR / 8)

    keys = np.zeros(total + int(6 * SR))
    tail = int(6 * SR)
    for i in range(bars):
        if i < 2:  # motif enters after two bars
            continue
        for k, m in enumerate(motif[i % 4]):
            s = i * bar + int(k * beat * SR)
            if s >= total:
                break
            keys[s:s + tail] += 0.32 * piano(note(m), tail)
    keys = keys[:total]

    mix = 0.62 * pads + 0.18 * drone + 0.35 * keys
    swell = np.minimum(1, np.arange(total) / (8 * SR))
    mix *= 0.75 + 0.25 * swell
    fade = int(2.5 * SR)
    mix[:int(1.5 * SR)] *= np.linspace(0, 1, int(1.5 * SR))
    mix[-fade:] *= np.linspace(1, 0, fade)
    mix = mix / np.abs(mix).max() * 0.8
    stereo = np.stack([mix, np.roll(mix, int(0.015 * SR))], axis=1)
    sf.write(a.out, stereo.astype(np.float32), SR, subtype="PCM_16")
    print(f"wrote {a.out} ({a.seconds:.0f}s)")


if __name__ == "__main__":
    main()
