"""Build samples/review.html: play every voice take and rendered advert side by side.

    python3 build_review.py
Lists ../renderer/public/voice/*.wav and ../renderer/out/*.mp4 with their accuracy notes
from takes.json (written by the voice test).
"""
import html
import json
from pathlib import Path

HERE = Path(__file__).parent
R = HERE.parent / "renderer"

takes = json.loads((HERE / "takes.json").read_text()) if (HERE / "takes.json").exists() else {}
voices = sorted((R / "public/voice").glob("*.wav"))
videos = sorted((R / "out").glob("*.mp4"))

rows = []
for v in voices:
    t = takes.get(v.stem, {})
    rows.append(f"""<article>
  <h3>{html.escape(t.get('label', v.stem))}</h3>
  <p class="meta">{html.escape(t.get('engine', ''))} · {t.get('seconds', '?')} s · script accuracy {t.get('accuracy', '?')}</p>
  <audio controls preload="none" src="../renderer/public/voice/{v.name}"></audio>
  {f'<p class="note">{html.escape(t["note"])}</p>' if t.get('note') else ''}
</article>""")

vids = "".join(f'<figure><video controls preload="metadata" src="../renderer/out/{v.name}"></video><figcaption>{v.stem}</figcaption></figure>' for v in videos)

(HERE / "review.html").write_text(f"""<!doctype html><meta charset="utf-8"><title>FOG advert samples</title>
<style>
body{{font:16px/1.5 system-ui,sans-serif;background:#0a1424;color:#e8edf5;margin:0;padding:32px 20px}}
main{{max-width:1100px;margin:auto;display:grid;gap:28px}}
h1{{margin:0;font-size:28px}} h2{{margin:8px 0 0;font-size:20px;color:#5aa2ff}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}}
article{{background:#10203a;border:1px solid #1f3558;border-radius:10px;padding:16px;display:grid;gap:8px}}
article h3{{margin:0;font-size:17px}} .meta{{margin:0;color:#9fb0c8;font-size:13px}} .note{{margin:0;font-size:14px;color:#c3c8d0}}
audio{{width:100%}} figure{{margin:0}} video{{width:100%;max-width:360px;border-radius:10px;background:#000}}
figcaption{{color:#9fb0c8;font-size:13px}}
</style>
<main>
<h1>FOG advert samples</h1>
<p>Same script in each voice. Accuracy = share of script words the transcriber heard correctly.</p>
<h2>Sample advert</h2><div class="grid">{vids or '<p>Rendering…</p>'}</div>
<h2>Voice takes</h2><div class="grid">{''.join(rows)}</div>
</main>""")
print("wrote", HERE / "review.html")
