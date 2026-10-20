# Standalone subtitle pilot

The user approved playback of the supplied SaaS sample on October 1, 2026. The next step is a local, standalone upload → style dialog → Generate → preview/download flow. It is not connected to app routes, workflows, Trending, billing, Supabase or production storage. No deployment, migration or application dependency changes are required to try it.

## Start locally

From the repository root, with the evaluated private Python environment and model files already present:

```powershell
npm run worker:build
node --env-file=.env.local scripts/subtitle-pilot.mjs
```

Open `http://127.0.0.1:8780`. The existing local `OPENAI_API_KEY` is read by the Node server. Keep it in the server environment; never put it in browser code, a `NEXT_PUBLIC_` variable, or chat. Vercel/GCP environment variables are not automatically available to this local process. A missing key produces a configuration message; the verified sample's saved transcript can still be reused without a new request.

Optional settings: `SUBTITLE_PILOT_PORT`, `SUBTITLE_PYTHON`, `SUBTITLE_MODEL_DIR`. The default Python venv is `.tmp/subtitle-alignment-venv`, and weights/tokenizer data are in `.tmp/subtitle-alignment-models`. Startup verifies WhisperX 3.8.6 and the evaluated model-weight SHA. See [the sample report](subtitle-video-test-2026-10-01.md#reproduce-the-isolated-alignment) for setup and dependency versions. This partial align-only venv is not a production image.

## Supported flow

- Upload a video or choose the verified SaaS sample. Open Add subtitles, select Clean, Bold box or Word highlight, choose Top/Bottom, and Generate.
- Initial limits: English, up to 30 seconds, 50 MiB, one active job and 20 jobs per server session. The first playable video and first audio track are used. Nonzero stream start times are refused pending offset validation.
- Recognition: OpenAI `gpt-transcribe`, English, text response. Alignment: local WhisperX 3.8.6 with `WAV2VEC2_ASR_BASE_960H`, against the same extracted mono 16 kHz audio. Rendering: the isolated FFmpeg/libass subtitle renderer and bundled fonts.
- Alignment reconstructs words from observed character evidence. It checks token identity, order, nonzero/nonoverlapping intervals and duration. Digits and non-ASCII lexical text are refused pending reviewed normalization. No missing timestamp is guessed or interpolated. Acoustic scores are diagnostics, not calibrated confidence or proof of accuracy.
- Completed output offers original/subtitle preview switching and MP4, SRT and VTT downloads. Generation creates a derivative copy; the selected original is never edited. Stopping or failing a job does not expose an incomplete derivative.

The UI and orchestration are our code. WhisperX is used as the pinned alignment dependency rather than copying an entire third-party caption application into this project. Its package notice remains in the private environment. Model and dependency redistribution notices still require review when building a production image.

## Failure and isolation behavior

The server binds only to `127.0.0.1`, checks exact Host/Origin, has no CORS, and requires a same-origin custom header for writes. Browser requests accept video bytes and allowlisted style/placement values, not paths, external URLs, model settings or shell commands. Static assets and completed derivative paths are exact allowlists; responses omit API keys, local paths and raw diagnostic output. Do not expose this unauthenticated local server through a public tunnel.

Uploads are bounded while streaming. A job reserves the single active slot before awaiting filesystem work; simultaneous uploads cannot both start. UUID request IDs deduplicate retransmission. Only completed jobs can serve derivatives; video byte ranges support playback and seeking. UI polling never repeats a generation POST automatically.

Transcription checkpoints are keyed by extracted audio SHA and model/language policy. A `submitting` checkpoint is written before the paid request, SDK retries are disabled, and a successful text response is saved before alignment/rendering. A timeout, cancellation or crash with an unknown provider outcome stops later attempts with `TRANSCRIPTION_UNCERTAIN`. Reconcile provider usage before explicitly clearing that exact checkpoint or stale lock. No-speech and unusable responses are terminal cached outcomes. Style changes reuse paid text and, when available, alignment.

Alignment cache identity includes audio, duration, text, helper source and model-weight hashes. Cached words are revalidated against saved text. Python runs with an allowlisted environment, offline model settings and weights-only loading; OpenAI/Supabase/GCP credentials and `PYTHONPATH` are excluded from that child process. The pilot refuses missing downloaded alignment resources instead of downloading during generation.

Local job artifacts and speech caches remain under Git-ignored `.tmp/subtitle-pilot/`. They contain private speech and are retained for review. Job status is in memory: restarting drops the HTTP job listing/download URLs while leaving files and cost checkpoints on disk. This is a local pilot, not multi-user job persistence or an authentication boundary.

## Verification

```powershell
node --test --test-concurrency=1 worker/dist/subtitles/captions.test.js worker/dist/subtitles/cache.test.js worker/dist/lib/render-engine.test.js scripts/subtitle-lab.test.mjs scripts/subtitle-benchmark.test.mjs scripts/subtitle-pilot.test.mjs
node node_modules/eslint/bin/eslint.js worker/src/subtitles scripts/subtitle-pilot.mjs scripts/subtitle-pilot.test.mjs scripts/subtitle-pilot
```

56 checks passed, including nine pilot tests, existing render checks and separate text/timing benchmark checks. Worker compilation and scoped lint passed. Pilot coverage includes paid-response retention, uncertain-outcome refusal, concurrent submissions, damaged alignment cache rejection, all three FFmpeg presets, duration/silence rejection before payment, upload/origin restrictions, completed-only downloads, range requests and cancellation. Python credential filtering is checked separately.

The supplied real clip also completed through the browser UI, with 18 words, four cues, 720×1280 dimensions and 6.016-second duration:

| Run | GPT text reused | Alignment reused | Local elapsed |
| --- | --- | --- | ---: |
| Word highlight, bottom | Yes | No | 10.70 s |
| Bold box, top, offline alignment environment | Yes | No (helper policy changed) | 16.57 s |
| Clean, bottom | Yes | Yes | 1.76 s |

The previously completed paid transcript was imported into the pilot cache only after its source/audio identity and completion checkpoint were verified. These UI tests did not submit the sample for another paid transcription. The preview decoded correctly, the SRT download contained the expected four timed cues, and no browser warnings/errors were captured. Timings are local observations, not service latency guarantees.

All three pilot outputs also matched the preserved source's AAC packet hash, frame count and duration. The preserved source SHA still matched the originally recorded SHA. The original D: path was unavailable during this later check, so `.tmp/subtitle-lab/user-video/source.mp4` was used as the reference. Evidence is retained in `.tmp/subtitle-pilot/verification.json`.

User feedback approved visible subtitle playback on this sample. An independent human word-boundary reference has not been supplied; measured WER and timestamp-error results remain pending in [the accuracy report](subtitle-video-test-2026-10-01.md). This approval is enough to advance the isolated pilot; it is not a representative accuracy benchmark.

## Before attaching an existing feature

An additional [Editorial serif style](subtitle-editorial-style-research-2026-10-01.md) has a disconnected research preview inspired by the user's typography reference. It is not yet a selectable pilot or application preset.

The [integration readiness review](subtitle-integration-readiness-2026-10-01.md) records the current application-specific gaps and the safe integration sequence. The local engine is ready for controlled integration development; production enablement remains pending.

Build and validate a separate pinned Linux alignment/rendering worker image with its licenses, fonts and offline model assets. Add owner-scoped source/derivative access, durable job/checkpoint/idempotency behavior, cleanup and cancellation reconciliation. Measure recognition and timestamp errors independently on representative permissioned clips, including names/numbers, accents, fast speech, pauses, noise/music and silence. Add only one feature entry point behind a disabled-by-default gate after these checks. Verify the authenticated integrated flow on `https://www.getugcpilot.com` before accepting production behavior.
