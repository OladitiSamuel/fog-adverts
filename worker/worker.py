"""FOG Adverts render worker.

Claims a scripted advert from FOG Nexus, voices it (Chatterbox, Nigerian-English
reference voice, same settings as the hand-made launch advert), renders the
executive style in 4:5, 9:16 and 16:9, uploads the files with one-time signed
URLs and reports back. Rendering itself needs no internet; only claiming and
uploading do.

    python3 worker/worker.py --once            # one job if there is one (timer / CI runner)
    python3 worker/worker.py --loop            # keep polling every 10 minutes
    python3 worker/worker.py --spec FILE.json  # build a spec locally, no FOG Nexus (testing)

Config (env or ~/.config/fog-adverts/worker.env, mode 600):
    FOG_NEXUS_URL=https://fogtechnexus.space
    FOG_WORKER_TOKEN=fogw_…   (Platform → Workers, capability "Advert rendering")
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOICE = ROOT / "voice"
RENDERER = ROOT / "renderer"
SAMPLES = ROOT / "samples"
FORMATS = {"4x5": "Exec-4x5", "9x16": "Exec-9x16", "16x9": "Exec-16x9"}
MAX_BYTES = 20 * 1024 * 1024
CTA_LINES = ["ceo@fogtechnexus.space", "+234 814 835 5789", "fogtechnexus.space"]
VOICE_ENGINE = "chatterbox (jude reference)"
EXEC_TAIL_SECONDS = 3.8  # renderer/src/Root.tsx
STOP = {"the", "a", "an", "and", "of", "for", "to", "in", "on", "with", "at", "your", "our", "every", "one"}


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def load_config():
    cfg = {}
    f = Path.home() / ".config/fog-adverts/worker.env"
    if f.exists():
        for line in f.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip().strip('"')
    cfg.update({k: v for k, v in os.environ.items() if k.startswith("FOG_")})
    return cfg


# ─── FOG Nexus API ────────────────────────────────────────────────────────

class Api:
    def __init__(self, base, token):
        self.base = base.rstrip("/")
        self.token = token

    def post(self, path, body=None, timeout=60):
        req = urllib.request.Request(
            f"{self.base}{path}",
            data=json.dumps(body or {}).encode(),
            method="POST",
            headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read() or b"{}")

    @staticmethod
    def put_file(url, path, content_type):
        data = Path(path).read_bytes()
        req = urllib.request.Request(url, data=data, method="PUT", headers={"Content-Type": content_type, "x-upsert": "false"})
        with urllib.request.urlopen(req, timeout=600) as r:
            if r.status >= 300:
                raise RuntimeError(f"upload failed: HTTP {r.status}")


# ─── Script → renderer spec ───────────────────────────────────────────────

def words(text):
    return {w for w in re.findall(r"[a-z]+", (text or "").lower()) if w not in STOP and len(w) > 2}


def pick_image(scene, library, used):
    """Best-matching library photo for a scene's visual phrase (and headline), or None for a graphic scene."""
    want = words(scene.get("visual", "")) | words(scene.get("headline", ""))
    best, best_score = None, 0
    for img in library:
        if img["file"] in used:
            continue
        tags = set(img["tags"].split())
        score = 2 * len(words(scene.get("visual", "")) & tags) + len(want & tags)
        if score > best_score:
            best, best_score = img, score
    return best


def build_spec(job):
    library = json.loads((RENDERER / "public/media/library.json").read_text())["images"]
    script = job["script"]
    used, credits, scenes = set(), [], []
    for i, sc in enumerate(script["scenes"]):
        s = {k: v for k, v in sc.items() if k in ("kind", "eyebrow", "headline", "lines", "items", "voice")}
        if sc["kind"] == "cta":
            s["lines"] = CTA_LINES
        elif sc["kind"] in ("title", "statement", "process"):
            img = pick_image(sc, library, used)
            if img is None and i == 0:  # the opening scene always gets a photo
                img = next((x for x in library if x["file"] not in used), None)
            if img:
                used.add(img["file"])
                s["image"], s["focus"] = img["file"], img.get("focus", "50% 50%")
                if img.get("credit") and img["credit"] not in credits:
                    credits.append(img["credit"])
        scenes.append(s)
    return dict(
        id=job["slotKey"],
        style="executive",
        textStyle="bold",
        exampleLabel=bool(script.get("exampleLabel")),
        division=job["division"],
        service="",
        sector=job["sector"],
        audience=job["audience"],
        targetSeconds=job["targetSeconds"],
        title=job["title"],
        scenes=scenes,
        music="music/bed-exec.wav",
        credits=("Imagery: " + " · ".join(credits)) if credits else "",
    )


# ─── Voice, render, files ─────────────────────────────────────────────────

def run(cmd, cwd, env=None):
    log("$", " ".join(str(c) for c in cmd[:4]), "…")
    p = subprocess.run(cmd, cwd=cwd, env={**os.environ, **(env or {})}, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed: {(p.stderr or p.stdout)[-1500:]}")
    return p.stdout


def produce(spec):
    """Voice + render one spec. Returns {format: mp4 path}, poster path, seconds."""
    sid = spec["id"]
    (SAMPLES / f"{sid}.json").write_text(json.dumps(spec, indent=2, ensure_ascii=False))
    out = run(["bash", "voice_batch_v2.sh", sid], VOICE)
    if "caption words" not in out:
        raise RuntimeError(f"voice step did not finish: {out[-800:]}")
    flagged = re.search(r"OVERALL script accuracy (\d+)%, (\d+) of (\d+)", out)
    log("voice:", flagged.group(0) if flagged else "scored")

    props = RENDERER / "props" / f"{sid}-cb-jude.json"
    seconds = json.loads(props.read_text())["voice"]["duration"] + EXEC_TAIL_SECONDS
    files = {}
    for fmt, comp in FORMATS.items():
        mp4 = RENDERER / "out" / f"{sid}-{fmt}.mp4"
        for crf in ("23", "27"):  # second pass only if the first is over the storage limit
            run(["bash", "render.sh", str(props), str(mp4), comp], RENDERER, {"CRF": crf})
            if mp4.stat().st_size <= MAX_BYTES:
                break
        if mp4.stat().st_size > MAX_BYTES:
            raise RuntimeError(f"{fmt} video is over 20 MB even at CRF 27")
        files[fmt] = mp4
    poster = RENDERER / "out" / f"{sid}-poster.jpg"
    run(["npx", "remotion", "ffmpeg", "-v", "error", "-y", "-ss", "2", "-i", str(files["4x5"]), "-frames:v", "1", "-q:v", "3", str(poster)], RENDERER)
    return files, poster, round(seconds, 2)


def handle(api, job):
    aid = job["advertId"]
    log("claimed", job["slotKey"], "-", job["title"])
    try:
        spec = build_spec(job)
        files, poster, seconds = produce(spec)
        targets = api.post(f"/api/adverts/worker/{aid}/uploads")
        for fmt, mp4 in files.items():
            api.put_file(targets["files"][fmt]["url"], mp4, "video/mp4")
        api.put_file(targets["poster"]["url"], poster, "image/jpeg")
        r = api.post(
            f"/api/adverts/worker/{aid}/complete",
            dict(files={f: targets["files"][f]["path"] for f in files}, poster=targets["poster"]["path"], seconds=seconds, voiceEngine=VOICE_ENGINE, credits=spec["credits"] or None),
        )
        log("done:", job["slotKey"], "→", r.get("status"))
    except Exception as err:  # report and let FOG Nexus decide whether to retry
        log("FAILED:", job["slotKey"], err)
        try:
            api.post(f"/api/adverts/worker/{aid}/fail", dict(error=str(err)[:1900]))
        except Exception as e2:
            log("could not report the failure:", e2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--loop", action="store_true")
    ap.add_argument("--interval", type=int, default=600)
    ap.add_argument("--spec", help="render a job JSON locally (no FOG Nexus)")
    a = ap.parse_args()

    if a.spec:
        job = json.loads(Path(a.spec).read_text())
        files, poster, seconds = produce(build_spec(job))
        log("rendered", {k: str(v) for k, v in files.items()}, poster, seconds)
        return

    cfg = load_config()
    if not cfg.get("FOG_WORKER_TOKEN"):
        sys.exit("FOG_WORKER_TOKEN is not set (env or ~/.config/fog-adverts/worker.env).")
    api = Api(cfg.get("FOG_NEXUS_URL", "https://fogtechnexus.space"), cfg["FOG_WORKER_TOKEN"])
    while True:
        try:
            job = api.post("/api/adverts/worker/next").get("job")
        except Exception as err:
            log("could not reach FOG Nexus:", err)
            job = None
        if job:
            handle(api, job)
            if a.once:
                return
            continue  # there may be more waiting
        if not a.loop:
            log("no advert to render")
            return
        time.sleep(a.interval)


if __name__ == "__main__":
    main()
