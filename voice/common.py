"""Shared helpers for the voice step: read an advert spec and split narration into sentences."""
import json
import re
from pathlib import Path


def load_spec(path):
    return json.loads(Path(path).read_text())


def sentences(text):
    """Split narration into sentences. Each sentence is synthesised separately: short inputs keep
    small TTS models stable, and the gaps between them become natural pauses."""
    parts = re.split(r"(?<=[.?!])\s+", text.strip())
    return [p for p in parts if p]


def narration(spec):
    """[(scene_index, sentence_index, text), ...] for every sentence in the advert."""
    out = []
    for si, scene in enumerate(spec["scenes"]):
        for ni, s in enumerate(sentences(scene["voice"])):
            out.append((si, ni, s))
    return out


def spoken(text):
    """Text as it should be pronounced. Brand names and web addresses are spelled for the ear."""
    t = text
    t = t.replace("fogtechnexus.space", "fog tech nexus dot space")
    t = re.sub(r"\bCCTV\b", "C C T V", t)
    t = re.sub(r"\bAI\b", "A I", t)
    t = re.sub(r"\bCEO\b", "C E O", t)
    t = re.sub(r"\bFOG\b", "Fog", t)
    return t
