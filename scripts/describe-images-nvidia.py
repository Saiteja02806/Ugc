#!/usr/bin/env python3
"""Describe images with a vision model on the NVIDIA hosted NIM gateway.

OpenAI-compatible endpoint: https://integrate.api.nvidia.com/v1/chat/completions

The API key is never read from this file. It comes from the NVIDIA_API_KEY
environment variable, falling back to %USERPROFILE%/.continue/.env (the same
location documented in docs/cursor-mistral-setup.md).

Examples
--------
  # one image, one prompt
  python scripts/describe-images-nvidia.py public/marketing/showcase/slideshow/image_1.jpg \
      -p "Describe the color and shape on the left and on the right."

  # every frame in a directory, with the model's reasoning shown
  python scripts/describe-images-nvidia.py tmp/frames --show-reasoning \
      -p "Describe the subject, camera angle, hands and props."

  # prompt from a file, full JSON records for later use
  python scripts/describe-images-nvidia.py tmp/frames --prompt-file prompt.txt --json -o out.jsonl

  # sizes and estimated request size only, no API call, no credits spent
  python scripts/describe-images-nvidia.py tmp/frames --dry-run
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

try:
    import requests
except ImportError:  # pragma: no cover
    sys.exit("Missing dependency: requests (pip install requests)")

# Model descriptions often contain em dashes, curly quotes and emoji. Windows
# consoles default to a legacy code page, so force UTF-8 rather than crash.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

DEFAULT_MODEL = "mistralai/mistral-large-4-1t-a52b"
INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
ENV_FILE = Path(os.path.expanduser("~")) / ".continue" / ".env"

SUPPORTED_SUFFIXES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}

# Above this the request body gets large enough to risk gateway limits and to
# burn a lot of prompt tokens, so images are re-encoded smaller by default.
DEFAULT_MAX_IMAGE_BYTES = 1_500_000
DEFAULT_MAX_DIMENSION = 1568

RETRY_STATUSES = {429, 500, 502, 503, 504}


# --------------------------------------------------------------------------- #
# configuration
# --------------------------------------------------------------------------- #

def load_api_key(explicit: str | None = None) -> str:
    """Resolve the key from a flag, the environment, or ~/.continue/.env."""
    if explicit:
        return explicit.strip()

    key = os.environ.get("NVIDIA_API_KEY", "").strip()
    if key:
        return key

    if ENV_FILE.is_file():
        for raw in ENV_FILE.read_text(encoding="utf-8", errors="replace").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, _, value = line.partition("=")
            # tolerate `export NVIDIA_API_KEY=...`
            if name.strip().removeprefix("export ").strip() == "NVIDIA_API_KEY":
                return value.strip().strip("'\"")

    sys.exit(
        "No NVIDIA API key found.\n"
        f"  Set NVIDIA_API_KEY in the environment, or add it to {ENV_FILE}\n"
        "  e.g.  $env:NVIDIA_API_KEY = 'nvapi-...'   (PowerShell)\n"
        "  Never commit the key. docs/cursor-mistral-setup.md describes the convention."
    )


# --------------------------------------------------------------------------- #
# image preparation
# --------------------------------------------------------------------------- #

class PreparedImage:
    __slots__ = ("path", "data_url", "mime", "bytes_sent", "raw_bytes", "note")

    def __init__(self, path: Path, data_url: str, mime: str, bytes_sent: int, raw_bytes: int, note: str = ""):
        self.path = path
        self.data_url = data_url
        self.mime = mime
        self.bytes_sent = bytes_sent
        self.raw_bytes = raw_bytes
        self.note = note


def _downscale(raw: bytes, max_bytes: int, max_dim: int) -> tuple[bytes, str, str]:
    """Re-encode an oversized image with Pillow. Returns (bytes, mime, note)."""
    try:
        from PIL import Image
    except ImportError:
        return raw, "", "Pillow not installed, sent original size"

    try:
        with Image.open(io.BytesIO(raw)) as img:
            original_size = img.size
            img = img.convert("RGB")
            width, height = img.size
            scale = min(1.0, max_dim / max(width, height))
            if scale < 1.0:
                img = img.resize((max(1, int(width * scale)), max(1, int(height * scale))), Image.LANCZOS)

            quality = 88
            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=quality, optimize=True)
            data = buffer.getvalue()

            while len(data) > max_bytes and quality > 45:
                quality -= 8
                buffer = io.BytesIO()
                img.save(buffer, format="JPEG", quality=quality, optimize=True)
                data = buffer.getvalue()

            note = f"re-encoded {original_size[0]}x{original_size[1]} -> {img.size[0]}x{img.size[1]} q{quality}"
            return data, "image/jpeg", note
    except Exception as exc:  # noqa: BLE001 - a bad image should not abort a batch
        return raw, "", f"re-encode failed ({exc}), sent original size"


def prepare_image(path: Path, max_bytes: int, max_dim: int, downscale: bool = True) -> PreparedImage:
    suffix = path.suffix.lower()
    if suffix not in SUPPORTED_SUFFIXES:
        raise ValueError(f"unsupported image type {path.suffix!r} (use {', '.join(sorted(SUPPORTED_SUFFIXES))})")

    raw = path.read_bytes()
    if not raw:
        raise ValueError("file is empty")

    data = raw
    mime = SUPPORTED_SUFFIXES[suffix]
    note = ""

    if downscale and len(raw) > max_bytes:
        data, new_mime, note = _downscale(raw, max_bytes, max_dim)
        if new_mime:
            mime = new_mime

    encoded = base64.b64encode(data).decode("ascii")
    return PreparedImage(path, f"data:{mime};base64,{encoded}", mime, len(data), len(raw), note)


def natural_key(path: Path) -> list[Any]:
    """Sort frames as frame_2 < frame_10 rather than lexically."""
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", path.name)]


def collect_images(targets: list[str], recursive: bool = False) -> list[Path]:
    found: list[Path] = []
    for target in targets:
        path = Path(target)
        if path.is_dir():
            pattern = "**/*" if recursive else "*"
            found.extend(p for p in path.glob(pattern) if p.is_file() and p.suffix.lower() in SUPPORTED_SUFFIXES)
        elif path.is_file():
            found.append(path)
        else:
            # allow a shell-style glob such as tmp/frames/frame_*.jpg
            matches = sorted(Path().glob(target))
            if not matches:
                sys.exit(f"No such file or directory: {target}")
            found.extend(p for p in matches if p.is_file())

    unique: list[Path] = []
    seen: set[str] = set()
    for path in found:
        key = str(path.resolve()).lower()
        if key not in seen:
            seen.add(key)
            unique.append(path)
    return sorted(unique, key=lambda p: (str(p.parent).lower(), natural_key(p)))


# --------------------------------------------------------------------------- #
# request
# --------------------------------------------------------------------------- #

def build_payload(
    model: str,
    prompt: str,
    image: PreparedImage,
    max_tokens: int,
    temperature: float,
    top_p: float,
    reasoning_effort: str | None,
    stream: bool,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": image.data_url}},
                ],
            }
        ],
        "max_tokens": max_tokens,
        "stream": stream,
        "temperature": temperature,
        "top_p": top_p,
        "frequency_penalty": 0,
        "presence_penalty": 0,
    }
    if reasoning_effort:
        payload["reasoning_effort"] = reasoning_effort
    if stream:
        # The gateway honours this and emits a final usage-only chunk.
        payload["stream_options"] = {"include_usage": True}
    return payload


def _parse_sse(lines) -> dict[str, Any]:
    """Accumulate an SSE stream into the same shape as a non-streaming reply."""
    content: list[str] = []
    reasoning: list[str] = []
    finish_reason = None
    usage: dict[str, Any] | None = None
    model = None

    for raw in lines:
        if not raw:
            continue
        text = raw.decode("utf-8", errors="replace").strip()
        if not text.startswith("data:"):
            continue
        data = text[5:].strip()
        if data == "[DONE]":
            break
        try:
            chunk = json.loads(data)
        except json.JSONDecodeError:
            continue

        model = chunk.get("model", model)
        if chunk.get("usage"):
            usage = chunk["usage"]
        for choice in chunk.get("choices") or []:
            delta = choice.get("delta") or {}
            if delta.get("content"):
                content.append(delta["content"])
            if delta.get("reasoning_content"):
                reasoning.append(delta["reasoning_content"])
            if choice.get("finish_reason"):
                finish_reason = choice["finish_reason"]

    return {
        "model": model,
        "content": "".join(content) or None,
        "reasoning_content": "".join(reasoning) or None,
        "finish_reason": finish_reason,
        "usage": usage,
    }


def describe_image(
    api_key: str,
    payload: dict[str, Any],
    *,
    stream: bool,
    timeout: float,
    retries: int,
    verbose: bool = True,
) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "text/event-stream" if stream else "application/json",
    }

    attempt = 0
    while True:
        attempt += 1
        started = time.time()
        try:
            response = requests.post(
                INVOKE_URL,
                headers=headers,
                json=payload,
                stream=stream,
                timeout=timeout,
            )
        except requests.exceptions.RequestException as exc:
            if attempt > retries:
                raise RuntimeError(f"network error after {attempt} attempt(s): {exc}") from exc
            delay = min(2 ** attempt, 20)
            if verbose:
                print(f"  network error ({exc}); retrying in {delay}s", file=sys.stderr)
            time.sleep(delay)
            continue

        elapsed = time.time() - started

        # Some models in the catalogue reject reasoning_effort. Drop it and retry once.
        if response.status_code == 400 and "reasoning_effort" in (payload or {}) and attempt <= retries:
            body = response.text.lower()
            if "reasoning" in body:
                if verbose:
                    print("  model rejected reasoning_effort; retrying without it", file=sys.stderr)
                payload = {k: v for k, v in payload.items() if k != "reasoning_effort"}
                continue

        if response.status_code in RETRY_STATUSES and attempt <= retries:
            delay = min(2 ** attempt, 20)
            if verbose:
                print(f"  HTTP {response.status_code}; retrying in {delay}s", file=sys.stderr)
            time.sleep(delay)
            continue

        if response.status_code != 200:
            body = response.text[:800]
            raise RuntimeError(f"HTTP {response.status_code}: {body}")

        if stream:
            result = _parse_sse(response.iter_lines())
        else:
            data = response.json()
            if "choices" not in data:
                raise RuntimeError(f"unexpected response shape: {json.dumps(data)[:800]}")
            choice = data["choices"][0]
            message = choice.get("message") or {}
            result = {
                "model": data.get("model"),
                "content": message.get("content"),
                "reasoning_content": message.get("reasoning_content"),
                "finish_reason": choice.get("finish_reason"),
                "usage": data.get("usage"),
            }

        result["elapsed_seconds"] = round(elapsed, 2)
        return result


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #

def human_size(num: int) -> str:
    return f"{num / 1024 / 1024:.2f} MB" if num >= 1024 * 1024 else f"{num / 1024:.0f} KB" 


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Describe images with NVIDIA's hosted vision models.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split("Examples")[-1],
    )
    parser.add_argument("images", nargs="+", help="image files, directories or globs")
    parser.add_argument("-p", "--prompt", default="Describe this image in detail.",
                        help="instruction sent with each image")
    parser.add_argument("--prompt-file", help="read the instruction from a file instead")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"model id (default: {DEFAULT_MODEL})")
    parser.add_argument("--reasoning-effort", default="high",
                        choices=["none", "low", "medium", "high", "off"],
                        help="'off' omits the field entirely (default: high)")
    parser.add_argument("--max-tokens", type=int, default=4096)
    parser.add_argument("--temperature", type=float, default=0.5)
    parser.add_argument("--top-p", type=float, default=1.0)
    parser.add_argument("--stream", action="store_true", help="use SSE streaming")
    parser.add_argument("--show-reasoning", action="store_true", help="also print reasoning_content")
    parser.add_argument("--json", action="store_true", help="emit one JSON record per image")
    parser.add_argument("-o", "--output", help="append results to this file")
    parser.add_argument("--recursive", "-r", action="store_true", help="walk directories recursively")
    parser.add_argument("--timeout", type=float, default=180.0, help="per-request timeout in seconds")
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--max-image-bytes", type=int, default=DEFAULT_MAX_IMAGE_BYTES,
                        help="re-encode images larger than this (default 1.5 MB)")
    parser.add_argument("--max-dimension", type=int, default=DEFAULT_MAX_DIMENSION,
                        help="longest edge when re-encoding (default 1568)")
    parser.add_argument("--no-downscale", action="store_true", help="send images byte-for-byte")
    parser.add_argument("--dry-run", action="store_true", help="show sizes only; makes no API call")
    parser.add_argument("--api-key", help="override the key (prefer the env var)")
    args = parser.parse_args(argv)

    if args.prompt_file:
        prompt = Path(args.prompt_file).read_text(encoding="utf-8").strip()
        if not prompt:
            sys.exit(f"Prompt file is empty: {args.prompt_file}")
    else:
        prompt = args.prompt.strip()
    if not prompt:
        sys.exit("A prompt is required.")

    paths = collect_images(args.images, recursive=args.recursive)
    if not paths:
        sys.exit("No supported images found.")

    reasoning = None if args.reasoning_effort in {"off", "none"} else args.reasoning_effort
    downscale = not args.no_downscale

    api_key = "" if args.dry_run else load_api_key(args.api_key)
    results: list[dict[str, Any]] = []
    failures = 0
    output_lines: list[str] = []

    for index, path in enumerate(paths, start=1):
        label = f"[{index}/{len(paths)}] {path}"
        try:
            prepared = prepare_image(path, args.max_image_bytes, args.max_dimension, downscale)
        except Exception as exc:  # noqa: BLE001
            print(f"{label}: SKIPPED - {exc}", file=sys.stderr)
            failures += 1
            continue

        body_mb = len(prepared.data_url) / 1024 / 1024
        print(f"{label}  raw {human_size(prepared.raw_bytes)} -> sent {human_size(prepared.bytes_sent)}"
              f"  data-uri {body_mb:.2f} MB" + (f"  [{prepared.note}]" if prepared.note else ""))

        if args.dry_run:
            request_mb = body_mb + len(json.dumps({"p": prompt})) / 1024 / 1024
            print(f"  dry run: would POST ~{request_mb:.2f} MB to {args.model}; no call made")
            continue

        payload = build_payload(
            args.model, prompt, prepared, args.max_tokens, args.temperature,
            args.top_p, reasoning, args.stream,
        )

        try:
            result = describe_image(
                api_key, payload,
                stream=args.stream, timeout=args.timeout, retries=args.retries,
            )
        except Exception as exc:  # noqa: BLE001
            print(f"  FAILED: {exc}", file=sys.stderr)
            failures += 1
            continue

        record = {
            "image": str(path),
            "model": result.get("model") or args.model,
            "prompt": prompt,
            "content": result.get("content"),
            "reasoning_content": result.get("reasoning_content"),
            "finish_reason": result.get("finish_reason"),
            "usage": result.get("usage"),
            "elapsed_seconds": result.get("elapsed_seconds"),
        }
        results.append(record)

        if args.json:
            line = json.dumps(record, ensure_ascii=False)
            print(line)
            output_lines.append(line)
        else:
            print(f"  finish={record['finish_reason']}  {record['elapsed_seconds']}s  "
                  f"usage={record['usage']}")
            print()
            print((record["content"] or "(no content returned)").strip())
            if args.show_reasoning and record["reasoning_content"]:
                print("\n--- reasoning ---")
                print(record["reasoning_content"].strip())
            print()

    if args.output and output_lines:
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        existing = out.read_text(encoding="utf-8") if out.is_file() else ""
        separator = "\n" if existing and not existing.endswith("\n") else ""
        with out.open("a", encoding="utf-8") as handle:
            handle.write(separator + "\n".join(output_lines) + "\n")
        print(f"wrote {len(output_lines)} record(s) to {out}", file=sys.stderr)

    if not args.dry_run and not args.json:
        sys.stdout.flush()
        print(f"done: {len(results)} succeeded, {failures} failed", file=sys.stderr)

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
