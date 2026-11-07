#!/usr/bin/env python3
"""Chat with a model on NVIDIA's hosted NIM gateway (OpenAI-compatible).

Works for text-only chat and optional image input. Useful for improving video
prompts, rewriting text, brainstorming, or any ad-hoc model call from the CLI.

Endpoint: https://integrate.api.nvidia.com/v1/chat/completions
Default model: mistralai/mistral-large-4-1t-a52b

The API key comes from NVIDIA_API_KEY (env) or %USERPROFILE%/.continue/.env.

Examples
--------
  # improve a video prompt
  python scripts/chat-nvidia.py --improve-prompt -p "woman walking in city, cinematic"

  # improve from a file
  python scripts/chat-nvidia.py --improve-prompt --prompt-file draft.txt

  # plain chat
  python scripts/chat-nvidia.py -p "Explain depth of field in one paragraph."

  # with a system prompt
  python scripts/chat-nvidia.py --system "You are a concise editor." -p "Rewrite: ..."

  # with an image
  python scripts/chat-nvidia.py -p "What is wrong with this frame?" --image frame.jpg

  # stream, save to file
  python scripts/chat-nvidia.py -p "..." --stream -o out.txt
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:  # pragma: no cover
    sys.exit("Missing dependency: requests (pip install requests)")

DEFAULT_MODEL = "mistralai/mistral-large-4-1t-a52b"
INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
ENV_FILE = Path(os.path.expanduser("~")) / ".continue" / ".env"

SUPPORTED_SUFFIXES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}

IMPROVE_SYSTEM = (
    "You are an expert UGC video prompt engineer. "
    "The user gives you a rough video prompt or scene description. "
    "Rewrite it into a clear, specific, production-ready prompt that preserves "
    "the original intent but adds concrete detail about subject, action, camera, "
    "lighting, pacing, and composition. Keep it concise. "
    "Return only the improved prompt, with no commentary."
)

RETRY_STATUSES = {429, 500, 502, 503, 504}


def load_api_key(explicit=None):
    if explicit:
        return explicit.strip()
    key = os.environ.get("NVIDIA_API_KEY", "").strip()
    if key:
        return key
    if ENV_FILE.is_file():
        text = ENV_FILE.read_text(encoding="utf-8", errors="replace")
        import re
        match = re.search(r"^\s*(?:export\s+)?NVIDIA_API_KEY\s*=\s*['\"]?([^'\"\s]+)", text, re.M)
        if match:
            return match.group(1)
    sys.exit(
        "No NVIDIA API key found.\n"
        f"  Set NVIDIA_API_KEY or add it to {ENV_FILE}\n"
        "  e.g.  $env:NVIDIA_API_KEY = 'nvapi-...'   (PowerShell)"
    )


def image_data_url(path):
    suffix = path.suffix.lower()
    if suffix not in SUPPORTED_SUFFIXES:
        sys.exit(f"unsupported image type {path.suffix!r}")
    raw = path.read_bytes()
    if not raw:
        sys.exit(f"empty file: {path}")
    encoded = base64.b64encode(raw).decode("ascii")
    return f"data:{SUPPORTED_SUFFIXES[suffix]};base64,{encoded}"


def build_messages(prompt, system, images):
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    content = [{"type": "text", "text": prompt}]
    for img in images:
        content.append({"type": "image_url", "image_url": {"url": image_data_url(img)}})
    messages.append({"role": "user", "content": content if images else prompt})
    return messages


def _parse_sse(lines):
    content = []
    reasoning = []
    finish = None
    usage = None
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
                finish = choice["finish_reason"]
    return {
        "model": model,
        "content": "".join(content) or None,
        "reasoning_content": "".join(reasoning) or None,
        "finish_reason": finish,
        "usage": usage,
    }


def chat(api_key, payload, stream, timeout, retries, verbose=True):
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "text/event-stream" if stream else "application/json",
    }
    attempt = 0
    while True:
        attempt += 1
        started = time.time()
        try:
            response = requests.post(INVOKE_URL, headers=headers, json=payload, stream=stream, timeout=timeout)
        except requests.exceptions.RequestException as exc:
            if attempt > retries:
                raise RuntimeError(f"network error: {exc}")
            time.sleep(min(2 ** attempt, 20))
            continue
        if response.status_code in RETRY_STATUSES and attempt <= retries:
            time.sleep(min(2 ** attempt, 20))
            continue
        if response.status_code != 200:
            raise RuntimeError(f"HTTP {response.status_code}: {response.text[:600]}")
        elapsed = time.time() - started
        if stream:
            result = _parse_sse(response.iter_lines())
        else:
            data = response.json()
            choice = data["choices"][0]
            msg = choice.get("message") or {}
            result = {
                "model": data.get("model"),
                "content": msg.get("content"),
                "reasoning_content": msg.get("reasoning_content"),
                "finish_reason": choice.get("finish_reason"),
                "usage": data.get("usage"),
            }
        result["elapsed_seconds"] = round(elapsed, 2)
        return result


def main(argv=None):
    parser = argparse.ArgumentParser(description="Chat with Mistral Large (or any NIM model) from the CLI.")
    parser.add_argument("-p", "--prompt", default=None)
    parser.add_argument("--prompt-file", help="read prompt from file")
    parser.add_argument("--system", default=None, help="system prompt")
    parser.add_argument("--system-file", help="read system prompt from file")
    parser.add_argument("--improve-prompt", action="store_true",
                        help="wrap input in a video-prompt improvement system prompt")
    parser.add_argument("--image", action="append", default=[], help="image file (repeatable)")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--max-tokens", type=int, default=2048)
    parser.add_argument("--temperature", type=float, default=0.7)
    parser.add_argument("--top-p", type=float, default=1.0)
    parser.add_argument("--reasoning-effort", default="off", choices=["off", "none", "low", "medium", "high"])
    parser.add_argument("--stream", action="store_true")
    parser.add_argument("--show-reasoning", action="store_true")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("-o", "--output", help="write result to file")
    parser.add_argument("--timeout", type=float, default=180.0)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--api-key", default=None)
    args = parser.parse_args(argv)

    if args.prompt_file:
        prompt = Path(args.prompt_file).read_text(encoding="utf-8").strip()
    elif args.prompt:
        prompt = args.prompt.strip()
    else:
        sys.exit("A prompt is required (-p or --prompt-file).")

    if args.system_file:
        system = Path(args.system_file).read_text(encoding="utf-8").strip()
    elif args.system:
        system = args.system.strip()
    elif args.improve_prompt:
        system = IMPROVE_SYSTEM
    else:
        system = None

    if args.improve_prompt and system == IMPROVE_SYSTEM:
        prompt = "Improve this video prompt:\n\n" + prompt

    images = [Path(p) for p in args.image]
    for img in images:
        if not img.is_file():
            sys.exit(f"image not found: {img}")

    reasoning = None if args.reasoning_effort in {"off", "none"} else args.reasoning_effort
    api_key = load_api_key(args.api_key)

    messages = build_messages(prompt, system, images)
    payload = {
        "model": args.model,
        "messages": messages,
        "max_tokens": args.max_tokens,
        "stream": args.stream,
        "temperature": args.temperature,
        "top_p": args.top_p,
        "frequency_penalty": 0,
        "presence_penalty": 0,
    }
    if reasoning:
        payload["reasoning_effort"] = reasoning
    if args.stream:
        payload["stream_options"] = {"include_usage": True}

    try:
        result = chat(api_key, payload, args.stream, args.timeout, args.retries)
    except Exception as exc:
        sys.exit(f"FAILED: {exc}")

    content = result.get("content") or ""
    reasoning_text = result.get("reasoning_content")

    if not content and result.get("finish_reason") == "length":
        print("hint: Mistral used all tokens for reasoning. Re-run with a larger --max-tokens (e.g. 1024+).", file=sys.stderr)

    if args.json:
        record = {
            "model": result.get("model") or args.model,
            "prompt": prompt,
            "system": system,
            "content": content,
            "reasoning_content": reasoning_text,
            "finish_reason": result.get("finish_reason"),
            "usage": result.get("usage"),
            "elapsed_seconds": result.get("elapsed_seconds"),
        }
        line = json.dumps(record, ensure_ascii=False)
        print(line)
        if args.output:
            Path(args.output).write_text(line + "\n", encoding="utf-8")
        return 0

    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_text(content + "\n", encoding="utf-8")

    print(content.strip() if content else "(no content returned)")
    if args.show_reasoning and reasoning_text:
        print("\n--- reasoning ---")
        print(reasoning_text.strip())
    print(f"\n[finish={result.get('finish_reason')}  {result.get('elapsed_seconds')}s  usage={result.get('usage')}]", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
