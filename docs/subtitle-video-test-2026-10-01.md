# GPT transcription + WhisperX: supplied-video evaluation

The isolated pipeline ran successfully on `Marketing_SaaS_with_influencers_20260917235611 (1).mp4`, supplied at `D:/demo's/new lib/`. It is a 6.016-second 720×1280 English presenter clip with AAC audio. Source SHA-256: `fd14067d5368aea2a87fef670c31a9974a1e4dd5c28dbb936f9e4c106caf6ba0`.

This establishes a working local transcript → forced alignment → caption render. It does **not** establish acoustic timing accuracy: no human-annotated reference has been supplied or completed. WER and timestamp error are deliberately pending, not zero. The agent can inspect exported video frames but has no audio-listening input capability in this session, so it cannot honestly provide human-reviewed acoustic boundaries. One clean English clip also does not cover the requested representative benchmark.

The user subsequently reviewed playback and reported: “verfied , subtitles are show correctly nice we can go further”. This is recorded locally in `human-playback-review.json` as qualitative sample approval. It does not supply independently annotated word boundaries or numeric text/timing error measurements. The next isolated step is now available as [the standalone subtitle pilot](subtitle-pilot.md); existing application features remain disconnected.

## Actual model output

`gpt-transcribe` returned:

> If you're building a SaaS and marketing is taking up too much of your time, check this out.

The existing local `OPENAI_API_KEY` authenticated. One request was submitted, with SDK retries disabled and a submitting/completed checkpoint; latency was 2,320 ms. No audio was sent to another hosted provider. GPT supplied text only. WhisperX used the same mono 16 kHz PCM audio extracted from the final source MP4.

Pinned WhisperX 3.8.6, CPU `WAV2VEC2_ASR_BASE_960H`, produced 18 valid intervals. The harness reconstructed boundaries from observed character evidence, with zero interpolated words and zero wildcard characters. It preserves original capitalization/punctuation in display text. English ASCII letters/apostrophes are supported in this evaluation; numbers and other scripts require a reviewed normalization mapping and are refused. Model acoustic scores ranged from 0.629 to 0.996 per word on this sample; these are not accuracy percentages or calibrated confidence.

Example **predicted**, not human-verified, intervals:

| Word | Start | End |
| --- | ---: | ---: |
| If | 441 ms | 501 ms |
| SaaS | 1,163 ms | 1,544 ms |
| marketing | 2,025 ms | 2,426 ms |
| time, | 3,750 ms | 4,091 ms |
| check | 4,913 ms | 5,134 ms |
| out. | 5,414 ms | 5,515 ms |

Initial model loading including the 360 MiB weight download took 119.2 seconds; alignment itself took 1.21 seconds. A cached repeat took 7.40 seconds to load and 1.07 seconds to align, returning identical intervals. These timings exclude Python imports, audio preparation and encoding; they are not end-to-end production latency. A later hardened run took 10.95 seconds including model-weight hash verification and 1.17 seconds for alignment, again returning identical intervals. It is saved separately with weights-only loading and the evaluated model-weight SHA checked. No full WhisperX ASR/VAD/diarization models are used.

## Render checks

Clean, Bold Box and Active Word outputs each contain 144 frames, 720×1280 dimensions and a 6.016-second duration. AAC packet MD5 is identical in the original and all three outputs. The original file SHA still matches. The active-word export contains visible yellow highlights for all 18 predicted intervals; a contact sheet visually confirms the highlighted token. Captions are readable below the speaker's face and disappear during the long pause. This checks rendering against the predicted intervals, not whether those intervals follow the acoustic word boundaries.

The ASS format truncates boundaries to 10 ms; the exported video displays them on its roughly 41.7 ms frame grid. A highlighted 40 ms word can occupy only one frame. These representation effects must be kept separate from aligner error. The outputs are evaluation previews and remain disconnected from the app, workflows, Trending and production storage.

Artifacts under `.tmp/subtitle-lab/user-video/`:

- `source.mp4`, `audio.wav`, source metadata/hash and paid-request checkpoint.
- `gpt-transcript.json`, `aligned/transcript.json`, raw character alignment and diagnostic evidence.
- `clean/`, `bold-box/`, `active-word/`: MP4, ASS, SRT, VTT, JSON and completed render manifest.
- `prediction.json`, `verification.json`, selected full frames and `highlight-contact-sheet.png`.
- `review.html`: portable review page with embedded original and captioned videos, waveform, slow playback, 10 ms seeking and blank manual timing inputs.
- `reference-pending.json`: empty timing reference explicitly marked pending. No model predictions have been copied into human reference fields.
- `human-playback-review.json`: user-approved qualitative playback, with word-boundary reference and numeric accuracy measurements still pending.

The review page passed browser checks: both embedded videos decode at the expected size/duration, 18 annotation rows appear, predictions start hidden, no captured browser warnings/errors, and an incomplete reference is refused. Browser CLI was unavailable, so the available Codex browser controller was used. The review is also open at `http://127.0.0.1:8774/review.html` while the local server remains running. The portable HTML can be opened independently after the server stops.

## Complete the requested accuracy comparison

1. A person listens to the original, corrects the transcript and marks each word's audible beginning/end independently. The page initially hides model times to reduce anchoring. Zoom the waveform and listen at reduced speed; waveform energy alone is not a word label.
2. Export `subtitle-human-reference.json` after entering reviewer name and explicitly confirming the word/boundary check. Record any ambiguous boundaries; ideally have a second reviewer check disagreements, since acoustic word ends can be subjective.
3. Score against the unmodified `prediction.json`:

```powershell
node scripts/subtitle-benchmark.mjs .tmp/subtitle-lab/user-video/prediction.json PATH_TO_HUMAN_REFERENCE.json .tmp/subtitle-lab/user-video/benchmark.json
```

The scorer requires an explicit human-checked reference, valid review date/duration, matching source hash and valid intervals. It reports substitutions, deletions, insertions and WER independently of start/end timing distributions. Timing includes only exact normalized words matched by minimum edit distance; excluded reference/prediction counts remain visible, so accurate timing on a few matched words cannot conceal recognition failures. It reports signed bias (positive = late), median/P95/max absolute boundary error and per-word errors. Repeated-word matching uses a documented deterministic tie break.

Provisional evaluation tolerance set **before human scoring**: zero word errors on this short clean clip, median absolute boundary error ≤100 ms and P95 ≤200 ms. This is a proposed initial test threshold, not a production service guarantee or benchmark result. Manual inspection of the burned-in video is a separate acceptance check.

Repeat on permissioned clips covering fast speech, accents, background music/noise, names/numbers, silence/music only, overlapping speech and each intended language. Preserve untouched evaluation inputs and reference annotations. Do not tune an offset on the same clips used to report final quality. Only after those measurements should this model/runtime be selected for production or attached to an existing feature.

## Reproduce the isolated alignment

The evaluation used a private venv, not the app's package manifests or global Python. CPU Torch comes from its official index; WhisperX is the pinned stable PyPI wheel. The helper imports only alignment; the full package's ASR/diarization dependencies remain absent.

```powershell
PYTHON -m venv .tmp/subtitle-alignment-venv
.tmp/subtitle-alignment-venv/Scripts/python.exe -m pip install torch==2.8.0 torchaudio==2.8.0 --index-url https://download.pytorch.org/whl/cpu
.tmp/subtitle-alignment-venv/Scripts/python.exe -m pip install --no-deps whisperx==3.8.6
.tmp/subtitle-alignment-venv/Scripts/python.exe -m pip install numpy==2.2.6 pandas==2.2.3 nltk==3.9.2 transformers==4.57.6 huggingface-hub==0.36.0
.tmp/subtitle-alignment-venv/Scripts/python.exe scripts/subtitle-align.py --audio .tmp/subtitle-lab/user-video/audio.wav --text-json .tmp/subtitle-lab/user-video/gpt-transcript.json --output-dir NEW_ALIGNMENT_DIRECTORY --model-dir .tmp/subtitle-alignment-models
node scripts/subtitle-lab.mjs --input .tmp/subtitle-lab/user-video/source.mp4 --output-dir NEW_RENDER_DIRECTORY --style active-word --transcript NEW_ALIGNMENT_DIRECTORY/transcript.json
node scripts/subtitle-review.mjs .tmp/subtitle-lab/user-video
```

Output directories and reports must be new. The review builder expects the sample's source metadata, source MP4, mono PCM WAV, aligned JSON and `active-word/captioned.mp4`. This is a sample review harness, not a generic app endpoint. The raw environment package inventory is stored locally for reproduction. The inspected WhisperX BSD-2-Clause notice remains in the installed package; model and redistribution licensing still need inclusion in any production image audit.

Four new benchmark tests passed (timing bias, text errors/exclusions, insertions/deletions and unchecked/malformed reference rejection). Targeted script lint passed. The hardened aligner was rerun against this same recording. The existing subtitle renderer checks cover all presets, cache/failure behavior and source/audio preservation; no app dependency or existing functionality was changed for this test.

Primary references: [OpenAI speech-to-text guide](https://developers.openai.com/api/docs/guides/speech-to-text), [WhisperX stable package](https://pypi.org/project/whisperx/3.8.6/), [WhisperX source](https://github.com/m-bain/whisperX), [WhisperX alignment paper](https://arxiv.org/abs/2303.00747).
