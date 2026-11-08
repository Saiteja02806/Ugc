"""Prepare explicitly selected talking-head references; never scan ignored originals.

Usage: python scripts/prepare-talking-head-references.py D:/hookswithlinks
       --openings .tmp/reviewed-openings.json
The optional JSON maps reference IDs to explicitly reviewed start/end seconds.
Without a range, preserve the supplied MP4 byte for byte, including long clips.
Source files are never modified. Backend opening PNGs are prepared and verified
before the local catalogue is updated. Application deployment stays separate.
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
    ("talking-kamile-mirror-discovery", "notbeen/o4DAhE8g9IfUvFhERksfCK62tVFcBRgbnqQ7AF (online-video-cutter.com).mp4", "Mirror discovery reaction", "Opening at t=0: a close vertical selfie in a bright bathroom, with a round mirror and grey wall behind her, white top and hoop earrings, one hand raised to the screen-left temple, wide eyes and an open mouth. 0.00-0.40s: hold the hand at the temple and the wide-eyed, open-mouthed expression. 0.40-1.00s: silently mouths an emphatic reaction while narrowing the eyes and changing the mouth shape; the hand stays at the temple. 1.00-1.60s: blink and tilt the head slightly, keeping the mouth moving and the hand in place. 1.60-2.00s: open the mouth wider with raised brows and a surprised stare into the lens. 2.00-2.433s: lower the hand out of frame and settle into a small closed-mouth smile. The source has no audible voice: preserve the visible lip and jaw articulation at the same timing; do not replace the mouth performance with a closed or motionless mouth. The reference is silent and supplies the visible performance only: when sound is enabled, speak the user's own script naturally; when sound is off, keep the visible mouth performance silent. End on the face. Keep the source lighting, room, clothing, framing and visible props, with natural handheld drift. If generation lasts longer than this reference, finish the described action by the reference endpoint and hold its final composition."),
    ("talking-kamile-kitchen-discovery", "notbeen 1/New folder/trimmed_93adc369.mp4", "Kitchen discovery reaction", "Opening at t=0: a close vertical selfie in a bright kitchen or laundry room, with a washing machine and window blinds behind her, white halter top and sunglasses pushed up on her head, an open mouth and a slight head tilt. 0.00-0.80s: silently mouths a surprised reaction with small mouth and brow changes while the head stays mostly still. 0.80-1.80s: narrow the eyes and round the lips through the middle of the reaction, keeping the hands out of frame. 1.80-2.60s: open the mouth wider with raised brows and a small head shake. 2.60-3.60s: settle the mouth into a disbelieving, slightly open expression and hold the face to the lens. The source then cuts to a phone in her hand; end the talking-head performance on the face before that insert and do not recreate the phone, price screen or app UI. The source has no audible voice: preserve the visible lip and jaw articulation at the same timing; do not replace the mouth performance with a closed or motionless mouth. The reference is silent and supplies the visible performance only: when sound is enabled, speak the user's own script naturally; when sound is off, keep the visible mouth performance silent. Keep the source lighting, room, clothing, framing and visible props, with natural handheld drift. If generation lasts longer than this reference, finish the described action by the reference endpoint and hold its final composition."),
    ("talking-kamile-car-what", "notbeen 1/New folder (2)/oofqG9LKEAF3QRgaQIFt2QmDBfTx2xkEDEBbaE (online-video-cutter.com).mp4", "Car what reaction", "Opening at t=0: a close vertical selfie in a parked car, with black leather seats and curtains behind her, a beige hoodie, three fingers pressed to the screen-right temple, wide eyes and an open mouth. 0.00-0.50s: silently mouths an incredulous reaction while holding the hand at the temple with a wide-eyed, open-mouthed stare. 0.50-1.20s: squeeze and narrow the eyes, open the mouth wider and tilt the head slightly, keeping the fingers at the temple. 1.20-1.80s: lower the hand away from the temple and extend it toward the camera while the mouth stays open in disbelief. 1.80-2.40s: bring the hand back down and narrow the eyes into a disbelieving stare. 2.40-2.730s: settle the mouth and hold the face to the lens. The source has no audible voice: preserve the visible lip and jaw articulation at the same timing; do not replace the mouth performance with a closed or motionless mouth. The reference is silent and supplies the visible performance only: when sound is enabled, speak the user's own script naturally; when sound is off, keep the visible mouth performance silent. End on the face. Keep the source lighting, room, clothing, framing and visible props, with natural handheld drift. If generation lasts longer than this reference, finish the described action by the reference endpoint and hold its final composition."),
    ("talking-kamile-lowlight-what", "notbeen 1/New folder (3)/ow05XAIPeyQnciE1naiPCAwmHq1arIIVIEB6Cc (online-video-cutter.com).mp4", "Low-light what reaction", "Opening at t=0: a close vertical selfie in a dim room with a warm brown wall behind her, a black top and hair tied back, the screen-right hand raised with fingers at the temple, eyes narrowed and an open mouth. 0.00-0.50s: silently mouths a pained reaction while holding the hand at the temple. 0.50-1.20s: close the eyes briefly, furrow the brow and keep the mouth open while the hand stays at the temple. 1.20-1.80s: reopen the eyes into a narrow, disbelieving stare and tilt the head slowly. 1.80-2.30s: lower the hand slightly and settle the mouth into a tired, exasperated expression. The source has no audible voice: preserve the visible lip and jaw articulation at the same timing; do not replace the mouth performance with a closed or motionless mouth. The reference is silent and supplies the visible performance only: when sound is enabled, speak the user's own script naturally; when sound is off, keep the visible mouth performance silent. End on the face. Keep the source lighting, room, clothing, framing and visible props, with natural handheld drift. If generation lasts longer than this reference, finish the described action by the reference endpoint and hold its final composition."),
]


def prepare(base, openings, selected=None):
    ffmpeg = ROOT / "node_modules/ffmpeg-static/ffmpeg.exe"
    ffprobe = ROOT / "node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe"
    folder = ROOT / "public/explore/talking-head-references/v1"
    previous_sources = json.loads((ROOT / "lib/explore/talking-head-source-manifest.json").read_text(encoding="utf-8"))["items"]
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
        previous = next((row for row in previous_sources if row["id"] == identity), None)
        if previous and (start != 0 or end != duration or hashlib.sha256(source.read_bytes()).hexdigest() != previous["sourceSha256"]):
            raise ValueError(f"{identity}: changed video bytes require a new ID; existing media will not be overwritten")
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
    # The importer may not expose videos without their durable original openings.
    source_path = ROOT / "lib/explore/talking-head-source-manifest.json"
    frame_path = ROOT / "lib/explore/talking-head-frames.json"
    catalog_path = ROOT / "lib/explore/talking-head-reference-catalog.json"
    frozen = {file: file.read_bytes() for file in [source_path, frame_path, catalog_path]}
    source_manifest = json.loads(frozen[source_path])
    frame_manifest = json.loads(frozen[frame_path])
    catalogue = json.loads(frozen[catalog_path])
    new_sources = []
    for item, record in zip(items, evidence):
        previous = next((row for row in source_manifest["items"] if row["id"] == item["id"]), None)
        if previous and previous["sourceSha256"] != record["outputSha256"]:
            raise ValueError("Use a new reference ID for changed video bytes; preserve historical sources")
        new_sources.append(dict(id=item["id"], file=item["videoUrl"], sourceSha256=record["outputSha256"]))
    output = subprocess.check_output(["node", "--import", "./scripts/next-server-only-test-loader.mjs", "--experimental-transform-types", "scripts/prepare-talking-head-published-frames.mjs"], input=json.dumps(new_sources).encode(), cwd=ROOT)
    new_frames = json.loads(output)
    def merge(previous, additions):
        mapping = {row["id"]: row for row in previous}
        for row in additions:
            mapping[row["id"]] = {**mapping.get(row["id"], {}), **row}
        return list(mapping.values())
    if [row["id"] for row in new_sources] != [frame["id"] for frame in new_frames]:
        raise ValueError("Prepared source identities changed; no catalogue activation")
    for row, frame in zip(new_sources, new_frames):
        row.update(width=frame["width"], height=frame["height"])
    source_manifest["items"] = merge(source_manifest["items"], new_sources)
    frame_manifest["items"] = merge(frame_manifest["items"], new_frames)
    catalogue["items"] = merge(catalogue["items"], items)
    if any(file.read_bytes() != before for file, before in frozen.items()):
        raise ValueError("Catalogue changed during preparation; no activation")
    # Publication last: a failed backend preparation never reaches these writes.
    for file, value in [(source_path, source_manifest), (frame_path, frame_manifest), (catalog_path, catalogue)]:
        pending = file.with_suffix(".pending.json")
        pending.write_text(json.dumps(value, indent=2)+"\n", encoding="utf-8")
        pending.replace(file)
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
