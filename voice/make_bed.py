"""Synthesise a royalty-free music bed (FOG owns it outright: generated here, no samples).

    .venv-yarn/bin/python make_bed.py --seconds 90 --out ../renderer/public/music/bed-pulse.wav
A soft pad progression with a muted pulse and light hats, mixed low so it sits under narration.
"""
import argparse

import numpy as np
import soundfile as sf

SR = 44100


def note(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def lowpass(x, cutoff):
    # One-pole low-pass, applied twice for a gentle 12 dB/oct slope.
    a = np.exp(-2 * np.pi * cutoff / SR)
    for _ in range(2):
        y = np.empty_like(x)
        acc = 0.0
        for i in range(len(x)):
            acc = (1 - a) * x[i] + a * acc
            y[i] = acc
        x = y
    return x


def pad(freqs, n):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        for det in (-0.12, 0.0, 0.12):  # three slightly detuned voices per note
            ph = 2 * np.pi * f * (1 + det / 100) * t
            out += 2 * (ph / (2 * np.pi) % 1) - 1  # saw
    env = np.minimum(1, t / 0.6) * np.minimum(1, (n / SR - t) / 0.6)
    return out * env / (len(freqs) * 3)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=float, default=90)
    ap.add_argument("--bpm", type=float, default=100)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    beat = 60 / a.bpm
    bar = int(4 * beat * SR)
    # A minor - F - C - G, voiced low and open.
    prog = [[57, 64, 69, 72], [53, 60, 65, 69], [48, 55, 64, 67], [55, 62, 67, 71]]
    total = int(a.seconds * SR)
    bars = int(np.ceil(total / bar)) + 1

    pads = np.concatenate([pad([note(m) for m in prog[i % 4]], bar) for i in range(bars)])[:total]
    pads = lowpass(pads, 900)

    t = np.arange(total) / SR
    pulse = np.zeros(total)
    step = int(beat / 2 * SR)
    rng = np.random.default_rng(3)
    for k, start in enumerate(range(0, total, step)):
        ln = min(step, total - start)
        tt = np.arange(ln) / SR
        root = note(prog[(start // bar) % 4][0] - 12)
        pulse[start:start + ln] += 0.5 * np.sin(2 * np.pi * root * tt) * np.exp(-tt * 9)
        if k % 2 == 1:  # off-beat hat
            hat = rng.standard_normal(ln) * np.exp(-tt * 60)
            pulse[start:start + ln] += 0.05 * np.diff(hat, prepend=0)
    if True:
        kick_t = np.arange(int(0.25 * SR)) / SR
        kick = np.sin(2 * np.pi * (45 + 60 * np.exp(-kick_t * 30)) * kick_t) * np.exp(-kick_t * 12)
        for start in range(0, total - len(kick), int(beat * SR)):
            pulse[start:start + len(kick)] += 0.35 * kick

    mix = 0.55 * pads + 0.45 * pulse
    fade = int(1.5 * SR)
    mix[:fade] *= np.linspace(0, 1, fade)
    mix[-fade:] *= np.linspace(1, 0, fade)
    mix = mix / np.abs(mix).max() * 0.8
    stereo = np.stack([mix, np.roll(mix, int(0.012 * SR))], axis=1)  # slight width
    sf.write(a.out, stereo.astype(np.float32), SR, subtype="PCM_16")
    print(f"wrote {a.out} ({a.seconds:.0f}s)")


if __name__ == "__main__":
    main()
