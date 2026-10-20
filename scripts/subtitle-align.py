"""Isolated English alignment evaluation. Never imported by the app or worker.

Uses WhisperX 3.8.6's public alignment API. Installs are in a private venv.
Unsupported lexical characters require manual normalization; no wildcard timing.
"""
import argparse
import hashlib
import json
import os
import re
import time
import wave
from pathlib import Path
from importlib.metadata import version


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audio", required=True)
    parser.add_argument("--text-json", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--offline", action="store_true", help="Require already installed model/tokenizer assets")
    args = parser.parse_args()
    output = Path(args.output_dir).resolve()
    output.mkdir(parents=True, exist_ok=False)
    model_dir = Path(args.model_dir).resolve()
    model_dir.mkdir(parents=True, exist_ok=True)
    os.environ["NLTK_DATA"] = str(model_dir / "nltk")
    os.environ["TORCH_FORCE_WEIGHTS_ONLY_LOAD"] = "1"
    import nltk
    nltk.data.path.insert(0, os.environ["NLTK_DATA"])
    try:
        nltk.data.find("tokenizers/punkt_tab/english/")
    except LookupError:
        if args.offline:
            raise RuntimeError("Offline alignment requires the installed sentence tokenizer")
        if not nltk.download("punkt_tab", download_dir=os.environ["NLTK_DATA"], quiet=True):
            raise RuntimeError("Could not obtain sentence tokenizer")
    import numpy as np
    import torch
    import whisperx
    torch.set_num_threads(min(4, os.cpu_count() or 1))
    if version("whisperx") != "3.8.6":
        raise RuntimeError("Evaluation requires inspected WhisperX 3.8.6")
    text = json.loads(Path(args.text_json).read_text(encoding="utf-8"))["text"]
    display_words = text.split()
    if not display_words or len(display_words) > 2000:
        raise ValueError("Empty or oversized transcript")
    normalized = []
    for word in display_words:
        # Keep apostrophes; drop punctuation with no phonetic content.
        # Do not silently discard digits or foreign lexical characters.
        if re.search(r"[^\x00-\x7f]", word) or re.search(r"\d", word):
            raise ValueError("Unsupported lexical spelling needs a reviewed spoken-form mapping")
        spoken = re.sub(r"[^a-z']", "", word.lower()).strip("'")
        if not spoken:
            raise ValueError("A display token has no alignable letters")
        normalized.append(spoken)
    alignment_text = " ".join(normalized)
    with wave.open(str(Path(args.audio).resolve()), "rb") as wav:
        if wav.getframerate() != 16000 or wav.getnchannels() != 1 or wav.getsampwidth() != 2:
            raise ValueError("Expected the renderer's mono 16 kHz PCM16 WAV")
        duration = wav.getnframes() / 16000
        if not 0 < duration <= 120:
            raise ValueError("Audio duration out of bounds")
        audio = np.frombuffer(wav.readframes(wav.getnframes()), np.int16).astype(np.float32) / 32768.0
    start = time.perf_counter()
    weights = model_dir / "wav2vec2_fairseq_base_ls960_asr_ls960.pth"
    expected_weights_hash = "488fd4f16de84438ffc945334278c1b9fb9b7159a806c1080b16111a958c945d"
    if args.offline and not weights.exists():
        raise RuntimeError("Offline alignment requires the installed model weights")
    if weights.exists() and hashlib.sha256(weights.read_bytes()).hexdigest() != expected_weights_hash:
        raise ValueError("Cached weights differ from the evaluated official artifact")
    model, metadata = whisperx.load_align_model("en", "cpu", model_name="WAV2VEC2_ASR_BASE_960H", model_dir=str(model_dir))
    if hashlib.sha256(weights.read_bytes()).hexdigest() != expected_weights_hash:
        raise ValueError("Downloaded weights differ from the evaluated official artifact")
    loaded = time.perf_counter()
    if any(char.replace(" ", "|") not in metadata["dictionary"] for char in alignment_text):
        raise ValueError("Unsupported dictionary character; wildcard alignment is forbidden")
    result = whisperx.align([{"start": 0.0, "end": duration, "text": alignment_text}], model, metadata,
                            audio, "cpu", return_char_alignments=True)
    ended = time.perf_counter()
    (output / "alignment-raw.json").write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
    # Use observed characters, never WhisperX's interpolated word intervals.
    # This input deliberately has no punctuation/sentence splits, so one segment
    # must retain the exact normalized text and character sequence.
    if len(result["segments"]) != 1 or result["segments"][0]["text"] != alignment_text:
        raise ValueError("Unexpected sentence split or missing alignment")
    chars = result["segments"][0].get("chars") or []
    if "".join(c["char"] for c in chars) != alignment_text:
        raise ValueError("Missing/duplicated character evidence")
    words, evidence = [], []
    offset = 0
    for index, (display, spoken) in enumerate(zip(display_words, normalized)):
        observed = chars[offset:offset + len(spoken)]
        if any(not all(k in c for k in ("start", "end", "score")) or c["end"] <= c["start"] for c in observed):
            raise ValueError(f"Missing character evidence for word {index}")
        start_ms = round(min(c["start"] for c in observed) * 1000)
        end_ms = round(max(c["end"] for c in observed) * 1000)
        if not 0 <= start_ms < end_ms <= round(duration * 1000):
            raise ValueError("Invalid observed interval")
        if words and start_ms < words[-1]["endMs"]:
            raise ValueError("Overlapping observed words")
        words.append({"text": display, "startMs": start_ms, "endMs": end_ms})
        evidence.append({"index": index, "text": display, "alignmentText": spoken,
                         "meanCharacterScore": round(sum(c["score"] for c in observed) / len(observed), 3),
                         "minCharacterScore": min(c["score"] for c in observed)})
        offset += len(spoken) + 1
    transcript = {"schemaVersion": 1, "provider": "openai", "model": "gpt-transcribe+whisperx-3.8.6:WAV2VEC2_ASR_BASE_960H",
                  "language": "en", "durationMs": round(duration * 1000), "words": words}
    (output / "transcript.json").write_text(json.dumps(transcript, indent=2), encoding="utf-8")
    report = {"runtime": {name: version(name) for name in ("whisperx", "torch", "torchaudio", "transformers", "numpy", "pandas", "nltk")},
              "model": "WAV2VEC2_ASR_BASE_960H", "device": "cpu", "modelLoadMs": round((loaded-start)*1000),
              "weightsOnlyLoad": True,
              "alignMs": round((ended-loaded)*1000), "audioSha256": hashlib.sha256(Path(args.audio).read_bytes()).hexdigest(),
              "weightsSha256": hashlib.sha256(weights.read_bytes()).hexdigest() if weights.exists() else None,
              "normalization": "ASCII English letters/apostrophes, punctuation removed, original display tokens retained",
              "interpolatedWords": 0, "wildcardCharacters": 0, "wordCount": len(words), "evidence": evidence,
              "humanTimingReview": "pending", "scoreMeaning": "Acoustic character score; not calibrated confidence"}
    (output / "evidence.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"wordCount": len(words), "modelLoadMs": report["modelLoadMs"], "alignMs": report["alignMs"], "humanTimingReview": "pending"}))


if __name__ == "__main__":
    main()
