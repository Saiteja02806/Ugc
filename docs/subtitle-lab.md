# Isolated subtitle generator

Implemented and locally evaluated September 30, 2026. This is an operator-run prototype. No application screen, API route, job handler, queue, database migration, media asset, or scheduling flow imports it. Nothing was deployed.

The narrow implementation is our own TypeScript, using the existing OpenAI SDK, FFmpeg and Sharp dependencies and the existing Arial font assets. No GitHub application was cloned, no repository code was vendored, and no dependency or lockfile was changed for this prototype. The repository comparisons and future integration proposal are in [the research document](subtitle-generator-research-2026-09-30.md).

## What works

`worker/src/subtitles/generate.ts` exports a standalone `generateSubtitles` function. `scripts/subtitle-lab.mjs` is its local command-line harness. It takes a local video, obtains validated word timestamps, measures and wraps captions into at most two lines, and writes a new captioned MP4. Presets are:

- `clean`: white text with an outline.
- `bold-box`: bold white text with a dark background.
- `active-word`: bold outlined text with the current word highlighted in yellow.

Both top and bottom placement are supported. Phrase pages contain at most six words, normally at most 2.8 seconds of speech, and split across substantial pauses. A single unusually long word can exceed this page duration; no timestamps are invented to split it. Captions disappear at the phrase's end. Word highlighting follows actual supplied boundaries; ASS rendering has centisecond precision and video frames impose their own timing precision.

Outputs are `captioned.mp4`, `captions.ass`, `captions.srt`, `captions.vtt`, `transcript.json`, and `manifest.json`. The manifest is written last and marks a completed result. SRT/VTT are text exports; they do not preserve the selected burn-in style. Raw transcript text is retained in JSON/SRT. Braces and backslashes are normalized to visible punctuation equivalents in the ASS display to prevent subtitle override-command injection.

## Run it

Requires the project's installed dependencies and worker build. No package installation is needed.

```powershell
npm run worker:build
node scripts/subtitle-lab.mjs --help

# Uses OPENAI_API_KEY from the existing local environment file.
# Replace paths with a permissioned local video and a NEW output directory.
node --env-file=.env.local scripts/subtitle-lab.mjs --input C:/videos/example.mp4 --output-dir .tmp/subtitle-lab/example-clean --style clean --language en

# Same video/provider/language: reuses transcription, creates another render.
node --env-file=.env.local scripts/subtitle-lab.mjs --input C:/videos/example.mp4 --output-dir .tmp/subtitle-lab/example-active --style active-word --language en
```

`--placement top` and `--cache-dir DIRECTORY` are optional. `--language` accepts a two-letter code; omitting it uses provider detection. Only English was tested with real speech. Other languages require font and speech-quality evaluation before acceptance. `FFMPEG_PATH` and `FFPROBE_PATH` can override the existing local static binaries. Local rendering and provider requests can incur costs; the live harness submits one transcription for each new source/provider policy/language combination.

For renderer testing without an API key, supply a JSON transcript using `--transcript PATH`. This tests supplied-timestamp rendering, not speech recognition:

```json
{
  "schemaVersion": 1,
  "provider": "fixture",
  "model": "manual-test",
  "language": "en",
  "durationMs": 3000,
  "words": [
    { "text": "Hello", "startMs": 200, "endMs": 700 },
    { "text": "world.", "startMs": 800, "endMs": 1200 }
  ]
}
```

The duration must match the actual video. A non-silent audio stream is still required in offline mode, so rendering and audio preservation use the same path.

```powershell
node scripts/subtitle-lab.mjs --input C:/videos/example.mp4 --output-dir .tmp/subtitle-lab/offline-example --transcript .tmp/example-transcript.json
```

## OpenAI findings and recommendation

The current OpenAI key successfully authenticated and generated a real subtitle result. The evaluation adapter uses `whisper-1` because the current [OpenAI transcription guide](https://developers.openai.com/api/docs/guides/speech-to-text) limits `timestamp_granularities` to this model. OpenAI lists its [retirement date as February 26, 2027](https://developers.openai.com/api/docs/deprecations). The adapter refuses live requests after that date and its policy is versioned separately from the renderer cache.

Actual local evaluation results:

| Input | Whisper / timed subtitle result | `gpt-transcribe` text result |
| --- | --- | --- |
| Existing 10.934-second hook clip | Returned “Thank you for watching” in approximately 100 ms at the end. This was suspicious; the current policy rejects this implausible timing. The initial exploratory render remains a rejected diagnostic artifact, not an accepted example. | Empty transcript. |
| AI-generated English test voice, 23 known words, approximately 11 seconds | Returned the correct word sequence, but several words had zero-duration or identical-start timings. The generator rejected them without guessing replacement timings. | All 23 words matched the expected text, ignoring punctuation/case. No word timestamps were returned. |
| First sentence of that test voice, six words, 3.1-second MP4 | All six words matched. Valid word timestamps produced Clean, Bold Box and Active Word MP4s. The second and third presets reused the cached transcript. | Not separately submitted; the full recording already matched. |

This is a small diagnostic sample, not a general accuracy benchmark. The voice was generated with OpenAI TTS solely to establish known evaluation text; speech generation is not part of the subtitle implementation. Timestamps were validated, but alignment error against manually annotated speech was not measured.

`gpt-transcribe` gave the more promising text result on these samples, but it is not a complete word-highlight subtitle backend without a verified alignment stage. We did not add a second model or invent timestamps. Whisper is useful for evaluating the pipeline now, but its observed failures and upcoming retirement make it unsuitable as the long-term production choice.

Before integration, evaluate one supported provider with native word timestamps, such as the AssemblyAI or Deepgram candidates described in the research document, against representative permissioned recordings. Their accuracy has not been tested here because keys were unavailable. Choose based on measured text/timing quality and no-speech behavior, then replace only the provider adapter. Do not assume a provider is best from pricing or documentation alone.

## Failure and file safety

- Inputs are limited to 120 seconds, 250 MiB, and dimensions between 64 and 4096 pixels. Local probing requires video and audio streams. Original files are copied into a private temporary working directory and never edited. Output dimensions and video duration are checked after rendering.
- Existing output directories are rejected. Outputs use H.264 video and AAC audio; existing AAC packets are copied, while other codecs are transcoded to AAC. AAC packet hashes matched in the renderer integration tests. Metadata, subtitles embedded in the source, and other audio tracks are not copied. The first playable video and first audio stream are used; choosing tracks is future work.
- FFmpeg uses argument arrays without a shell, local-only input protocols, bounded process output, time limits, and cancellation. Recursive cleanup is restricted to the verified private `mkdtemp` directory. Caller-provided output directories are never recursively deleted.
- Exact digital silence and missing audio are rejected before a provider request. Music-only detection is not solved generally. The adapter rejects implausible segment word rates, suspicious provider confidence/repetition, malformed responses, and invalid/zero-duration word timings. These are conservative checks and may reject genuine speech; they do not guarantee that every hallucination is caught.
- The cache is keyed by source SHA-256, implementation version and provider identity/policy/language. Style and placement do not trigger another transcription. A per-source lock prevents concurrent submissions, and successful transcription survives a render failure.
- Before a paid submission, an atomic `submitting` checkpoint is saved. SDK automatic retries are disabled. A network timeout or cancellation may leave submission outcome uncertain; subsequent attempts stop with `TRANSCRIPTION_UNCERTAIN`. Deterministically unusable results are marked `rejected`; no-speech results are terminal too. Do not clear a checkpoint to retry until its provider usage has been reviewed. A process crash may also leave a `.lock` directory; inspect it before explicitly removing that exact lock.
- Only a completed manifest is an accepted output. Cancellation/failure during copying can leave partial files in the new output directory without a manifest; the operator must discard that incomplete directory. Transcripts contain private speech. The `.tmp` cache and diagnostics are ignored by Git, retained locally, and must be handled accordingly. This is a local cache, not a multi-user authentication boundary.

## Verification

```powershell
npm run worker:build
node --test --test-concurrency=1 worker/dist/subtitles/captions.test.js worker/dist/subtitles/cache.test.js worker/dist/lib/render-engine.test.js scripts/subtitle-lab.test.mjs
node node_modules/eslint/bin/eslint.js worker/src/subtitles scripts/subtitle-lab.mjs scripts/subtitle-lab.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

43 tests passed: 19 new subtitle checks plus 24 existing renderer checks. New coverage includes all three real FFmpeg renders, visible highlighting, caption-free pauses, source and AAC preservation, exports, transcript caching, concurrent submission prevention, uncertain/terminal outcomes, corrupt-cache rejection, silent/no-audio/over-duration inputs, existing output preservation, cancellation, process time limits, measured line wrapping, and ASS injection handling. Worker compilation, targeted lint and application TypeScript checks also passed.

Accepted local samples and diagnostic recordings are under `.tmp/subtitle-lab/`. The final `accepted-clean`, `accepted-bold-box`, and `accepted-active-word` outputs are local evaluation artifacts; their source and AAC packet hashes were also verified. A style comparison image, sample MP4s, and `verification.json` were copied to `C:/Users/chund/.codex/visualizations/2026/09/30/01a0f1cf-8f6a-7851-8998-e240b8973475/subtitle-lab/` for review. Do not reuse the earlier `live-clean` hook output; it was produced before the hallucination check, is marked `REJECTED.txt`, and has no completed manifest under the expected filename.

Before any connection to the application, verify the deployed Linux FFmpeg/libass/fonts image, supported-provider quality across intended languages, owner-scoped asset access, durable job/idempotency/checkpoint behavior, storage and derivative ownership, cancellation reconciliation, and the original-audio behavior of composed Trending videos. Add the modal and one entry point only after that validation. Authenticated end-to-end acceptance must then run on `https://www.getugcpilot.com`; local results do not establish production readiness.
