"""Prepare explicitly selected talking-head references; never scan ignored originals.

Usage: python scripts/prepare-talking-head-references.py D:/hookswithlinks
       --openings .tmp/reviewed-openings.json
The optional JSON maps reference IDs to explicitly reviewed start/end seconds.
Without a range, preserve the supplied MP4 byte for byte, including long clips.
Source files are never modified. Outputs stay local
until the application release is deployed.
"""
import argparse
import hashlib
import json
import re
import subprocess
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    ("talking-car-story", "New folder (24)/trimmed_85f6a038.mp4", "Car story", "A close conversational shot inside a parked car. Use relaxed hand gestures and natural daylight."),
    ("talking-warm-story", "New folder (25)/New folder/ooS0qEIotgDsAYAsQs0EBmIfEVF6RnzErIsgf2.mp4", "Warm indoor story", "A conversational indoor shot with warm lighting and expressive, natural delivery."),
    ("talking-outdoor-discovery", "New folder (25)/New folder (2)/oEcByfdAWW9DplpMbX3Rv7f0E4BFS2EqgQiI0h.mp4", "Outdoor discovery", "A handheld outdoor selfie with an engaged, surprised opening. Keep the camera on the person."),
    ("talking-outdoor-reaction", "New folder (25)/New folder (3)/ow41svdKINVAiNXhdIALaBgEXAhEYoJBiXM41 (1).mp4", "Outdoor reaction", "A close outdoor selfie with expressive facial movement and direct-to-camera delivery. Keep the camera on the person."),
    ("talking-room-explainer", "New folder (25)/New folder (4)/trimmed_9520ee60.mp4", "Room explainer", "A close indoor talking-head shot with a casual delivery and small explanatory hand gestures."),
    ("talking-car-explainer", "New folder (35)/oIefm3nn8HX7gAIC80YLYioGKZfEfRNfjnQAAc.mp4", "Car explainer", "A seated selfie inside a parked car with conversational gestures and a direct, friendly delivery."),
    ("talking-discovery", "New folder (37)/trimmed_87bdaa0_with sound.mp4", "Expressive discovery", "An expressive close selfie, with a raised hand and an animated opening reaction."),
    ("talking-surprised-story", "New folder (38)/trimmed_6aff8a17.mp4", "Surprised opening", "An energetic close selfie with expressive eyebrows and a conversational hand gesture."),
    ("talking-mug-story", "New folder (41)/trimmed_afd1cf5d.mp4", "Story with a mug", "A close indoor talking-head shot, holding a mug naturally while delivering the opening message."),
]


def prepare(base, openings, selected=None):
    ffmpeg = ROOT / "node_modules/ffmpeg-static/ffmpeg.exe"
    ffprobe = ROOT / "node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe"
    folder = ROOT / "public/explore/talking-head-references/v1"
    plans = []
    for identity, relative, title, directions in SOURCES:
        if selected and identity not in selected:
            continue
        assert not any(re.sub(r"[^a-z0-9]", "", part.lower()) == "fullvideoignore" for part in Path(relative).parts)
        source = (base / relative).resolve()
        assert source.is_relative_to(base.resolve()) and source.is_file(), relative
        metadata = json.loads(subprocess.check_output([str(ffprobe), "-v", "error", "-show_format", "-show_streams", "-of", "json", str(source)]))
        duration = float(metadata["format"]["duration"])
        start, end = openings.get(identity, [0, duration])
        if not (0 <= start < end <= duration + .01):
            raise ValueError(f"{identity}: the reviewed range must stay inside the source ({duration:.3f}s)")
        texts = [p.read_text(encoding="utf-8-sig") for p in source.parent.glob("*.txt")]
        links = [url.split("?")[0] for text in texts for url in re.findall(r"https://www\.tiktok\.com/@[^\s]+/video/\d+", text)]
        assert len(set(links)) == 1, f"{relative}: one matching source link is required"
        plans.append((identity, source, title, directions, start, end, links[0], duration))
    # Validate every input before producing any files.
    folder.mkdir(parents=True, exist_ok=True)
    items, evidence = [], []
    for identity, source, title, directions, start, end, link, duration in plans:
        video, poster = folder / f"{identity}.mp4", folder / f"{identity}.jpg"
        original_hash = hashlib.sha256(source.read_bytes()).hexdigest()
        if start == 0 and end == duration:
            shutil.copyfile(source, video)
            assert hashlib.sha256(video.read_bytes()).hexdigest() == original_hash
        else:
            subprocess.run([str(ffmpeg), "-y", "-v", "error", "-ss", str(start), "-i", str(source), "-t", str(end-start), "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", str(video)], check=True)
        subprocess.run([str(ffmpeg), "-y", "-v", "error", "-ss", str(min(.2, (end-start)/4)), "-i", str(video), "-frames:v", "1", "-vf", "scale=360:-1", str(poster)], check=True)
        measured = json.loads(subprocess.check_output([str(ffprobe), "-v", "error", "-show_format", "-of", "json", str(video)]))
        seconds = float(measured["format"]["duration"])
        assert abs(seconds - (end-start)) < .15 and hashlib.sha256(source.read_bytes()).hexdigest() == original_hash
        prefix = "/explore/talking-head-references/v1/"
        prompt = directions + " Use the reference for framing, scene and delivery. Follow the user's own spoken message and product instructions; do not copy the original script or claims. If appearance images are attached, use them for the person's appearance. Keep this clip talking-head only: do not add the source's phone demonstration, app screens, captions, logos or watermarks."
        items.append(dict(id=identity, title=title, videoUrl=prefix+video.name, posterUrl=prefix+poster.name, durationSeconds=round(seconds, 3), generationPrompt=prompt, sourceUrl=link))
        evidence.append(dict(id=identity, source=str(source), sourceSha256=original_hash, sourceDuration=duration, openingStart=start, openingEnd=end, durationSeconds=seconds, outputSha256=hashlib.sha256(video.read_bytes()).hexdigest()))
    (ROOT / "lib/explore/talking-head-reference-catalog.json").write_text(json.dumps(dict(version=1, items=items), indent=2)+"\n", encoding="utf-8")
    audit = ROOT / ".tmp/talking-reference-review"
    audit.mkdir(parents=True, exist_ok=True)
    (audit / "prepared-media.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    print(json.dumps(dict(prepared=len(items), totalBytes=sum(p.stat().st_size for p in folder.glob("*")), ids=[item["id"] for item in items])))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument("--openings", type=Path)
    parser.add_argument("--only", nargs="+")
    args = parser.parse_args()
    prepare(args.root, json.loads(args.openings.read_text()) if args.openings else {}, set(args.only) if args.only else None)
