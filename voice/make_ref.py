"""Build a ~10 s voice reference for Chatterbox from the best-scoring sentences of a YarnGPT take."""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

work, out = Path(sys.argv[1]), sys.argv[2]
man = json.loads((work / "manifest.json").read_text())
items = sorted(man["items"], key=lambda i: -i.get("score", 0))
parts, total = [], 0.0
for it in items:
    x, sr = sf.read(work / it["file"], dtype="float32")
    parts += [x, np.zeros(int(0.3 * sr), dtype=np.float32)]
    total += len(x) / sr
    if total >= 10:
        break
sf.write(out, np.concatenate(parts), sr)
print(f"reference {out}: {total:.1f}s from {len(parts) // 2} sentences")
