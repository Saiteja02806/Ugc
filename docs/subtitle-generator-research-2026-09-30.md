# Subtitle generator research and integration proposal

Researched September 30, 2026. The application integration below is proposed and has not been production-validated. Existing application source and deployment settings were left intact. Two research agents checked transcription providers and reusable repositories; local code inspection and an isolated FFmpeg smoke test checked architectural fit. Subsequently, a disconnected prototype was implemented and live OpenAI transcription was evaluated; see [the isolated subtitle lab](subtitle-lab.md) for its code, usage, measured results and limitations.

## Recommendation

Build one reusable subtitle modal and service for completed videos. Use one hosted speech-to-text provider that returns real word timestamps, save the transcript, and burn three predefined subtitle styles into a new MP4 using the existing video worker. Start by evaluating AssemblyAI Universal-3.5 Pro against Deepgram Nova-3 on representative clips; ship one provider after that comparison. Do not build a multi-provider router or self-host a speech model for the first release.

The proposed flow is: **Subtitles button → select style → Generate → preview, optional text correction → Use captioned version**. Users can close the modal while generation continues and reopen its durable result. A failed subtitle operation must leave the original video usable.

Automatic subtitles describe audible speech. Silent demos and music-only hooks should return “No speech detected.” Writing explanatory text for those videos is a separate feature. Start with original-language captions; translation and broad timeline editing can follow demonstrated demand.

## What the current code supports

| Existing implementation | Relevant finding |
| --- | --- |
| `package.json` | Next.js 16.2.11, React 19.2.4, TypeScript and the current OpenAI SDK. No dedicated subtitle implementation found in searched application/worker files. |
| `worker/package.json`, `worker/Dockerfile` | Separate Node 22/TypeScript worker. FFmpeg, fontconfig and several fonts are already installed; a browser renderer is unnecessary for these presets. |
| `worker/src/lib/render-engine.ts` | Existing video download, composition, FFmpeg execution, validation and object-storage upload patterns. Keep subtitle-specific logic in a separate module rather than enlarging unrelated renderers. |
| `lib/jobs/background-job-service.ts`, `lib/queues/config.ts` | Durable job creation, recovery and GCP queue dispatch already exist. Reuse these rather than introducing another queue system. |
| `lib/jobs/gcp-cloud-run-jobs.ts`, `infra/gcp/video-render-worker/` | Video tasks use a one-shot Cloud Run Job. Checked Terraform defaults are 2 CPU, 4 GiB and a 3,600-second job timeout; these are repository configuration, not a live deployment inspection. |
| `lib/media/media-storage.ts`, `lib/media/types.ts` | Owner-scoped lookup and parent-asset relationships exist. `sourceType` is an explicit union, so a new derived-video type requires coordinated schema/type updates. |
| `lib/media/editable-video.ts`, `lib/media/media-library-visibility.ts` | Editing eligibility and Library/scheduling visibility are separate rules. Saving an output row alone does not make it work in every picker. |
| `app/api/edit/render/route.ts` | Application API authentication uses `requireFirebaseUser`. Reuse the actual Firebase ownership identity; do not assume Supabase `auth.uid()` equals the application's owner identifier. |

The installed Next.js route-handler and server/client-component guides were read. The modal belongs in a client component; authenticated APIs enqueue work and return job IDs. Transcription and encoding belong in the worker, with provider secrets kept server-side.

### Trending requires an explicit audio decision

`buildScheduleCombinationSoundtrackArgs` in `worker/src/lib/render-engine.ts` maps video from input 0 and audio from the selected soundtrack input 1. When that soundtrack path succeeds, it replaces the concatenated clips' original speech audio. Captioning a demo beforehand could therefore produce words that are absent from the posted video.

For the first release, caption the completed final video with its final audio. Add Trending support only when its final-video selection can explicitly use the captioned derivative. If users need narration plus music in Hook + Demo, implement a deliberate speech-preserving mix/ducking option and test it separately; do not silently alter every existing composition's audio behavior.

Captioning individual clips before composition is a later optimization. It requires clipping word intervals at trims, subtracting trim offsets, adding the measured hook duration to demo timings, and accounting for speed changes and audio replacement. Taking timestamps from the final video avoids those transformations initially.

## How generation works

1. Resolve a ready video by owner-scoped asset ID. Derive its storage object server-side. Validate duration, dimensions, decodability, audio streams and file-size limits. A reasonable proposed initial duration cap is 120 seconds; this is a product choice, not a provider restriction.
2. Create one durable subtitle job keyed by owner, immutable source version, language/model settings, transcript revision, style/placement and renderer version. Return immediately to the browser. Repeated clicks on the same request should reuse the same job.
3. In a job-specific temporary directory, extract audio with FFmpeg. The local smoke test used mono 16 kHz WAV; use the chosen provider's documented accepted encoding/sample rate in production. Probe silence separately from a missing audio stream. Do not remove pauses without restoring their offsets.
4. Submit that audio to the selected provider. For an asynchronous provider, checkpoint its transcript ID and resume polling on retries. Bound submission/poll time and retry only transient failures. A crash between a successful upstream submission and saving its ID remains a reconciliation case; application idempotency alone does not guarantee exactly-once upstream billing.
5. Normalize output into timed words with `text`, `startMs`, `endMs` and optional confidence. Validate finite, nonnegative, ordered intervals against the decoded duration, allowing a small explicit rounding tolerance. Keep the source transcript separate from edited display text. Treat no-speech outcomes as a terminal user-facing result, not an outage to retry repeatedly.
6. Group words by punctuation, pauses, available width and reading duration. Use at most two lines with measured font widths and preset safe margins. Do not divide sentence duration evenly to invent word timings. End captions during meaningful pauses. Native word timing is essential for active-word highlighting.
7. Serialize an ASS subtitle file and render with FFmpeg/libass into a new H.264 MP4. Preserve source aspect ratio and audible content; copy compatible audio or deliberately re-encode it when required. Validate final duration, video/audio streams and nonempty output before marking it ready.
8. Upload an immutable derived asset and return its ID. Preserve the original asset and existing scheduled-post snapshot. Only the explicit “Use captioned version” action changes the selected video. Exports and scheduling must use that exact ready derivative.

Style changes reuse the timed transcript. A render retry resumes from the transcript checkpoint rather than buying another transcription. Source replacement, trimming or changing the audible track invalidates the relevant cache. Keep reuse owner-scoped even if two users have identical media.

Generated scripts can supply useful brand vocabulary, but actual audio remains authoritative. Avoid automatic LLM rewriting of recognized text. For a small v1 correction UI, allow edits to existing timed word labels. Adding/deleting words requires a deliberate retiming policy; do not silently redistribute word timings to make arbitrary sentence edits appear accurate.

## Styles and preview

| Preset | Behavior |
| --- | --- |
| Clean | White sentence-case text with black outline, at most two lines. |
| Bold Box | Short bold phrases on a dark box for contrast. |
| Active Word | Short bold phrases with only the currently spoken word highlighted. |

Keep the fonts, colors, wrapping, outline and timing behavior in versioned server-controlled presets. Offer a small placement control, with a default above the bottom platform controls. Reserve space for existing hook or other text overlays; provide top placement when needed. “Any video” cannot mean guaranteed readable placement over every existing burned-in title.

For v1, show a style example before generation and the actual rendered MP4 afterward. That provides an accurate final preview without another renderer. A light browser overlay can be added later, but should not be advertised as pixel-identical to FFmpeg unless tested. Optional SRT/VTT downloads can be generated from the saved transcript; these files do not reproduce the branded burned-in styles.

## Provider findings

| Provider/model | Fit and caveat | Listed base transcription rate |
| --- | --- | --- |
| AssemblyAI `universal-3-5-pro` | Native timed words/confidence, asynchronous transcription. Current docs describe 18 supported languages and automatic Universal-2 routing for broader coverage. First evaluation candidate; not a measured accuracy winner. | $0.21/hour, approximately $0.0035/minute. |
| Deepgram Nova-3 | Native word timing/confidence. A good comparison candidate; configure language explicitly or use the appropriate detection/multilingual option. | $0.0043/minute monolingual; $0.0052/minute multilingual. |
| OpenAI `gpt-transcribe` | Current recommended recorded-audio model, but the reviewed guide does not establish native word timestamp output. A separate alignment stage would add complexity. | $0.0045/minute before any alignment. |

Sources: [AssemblyAI model selection](https://www.assemblyai.com/docs/getting-started/models), [word response](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/transcripts/get), [pricing](https://www.assemblyai.com/pricing/); [Deepgram prerecorded guide](https://developers.deepgram.com/docs/pre-recorded-audio), [languages](https://developers.deepgram.com/docs/models-languages-overview), [pricing](https://deepgram.com/pricing); [OpenAI transcription guide](https://developers.openai.com/api/docs/guides/speech-to-text), [pricing](https://developers.openai.com/api/docs/pricing).

AssemblyAI word timings use milliseconds; Deepgram timings use seconds. Normalize at the provider boundary. Confidence scores need tuning on real clips and are not comparable accuracy guarantees across vendors. AssemblyAI documents a no-spoken-audio error when language detection encounters silence/music; map the known case to “No speech detected.” Sources: [AssemblyAI errors](https://www.assemblyai.com/docs/pre-recorded-audio/guides/common_errors_and_solutions), [Deepgram confidence limitations](https://developers.deepgram.com/docs/confidence).

OpenAI's current deprecation page lists `whisper-1`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe` and `gpt-4o-transcribe-diarize` for API removal on **February 26, 2027**. Avoid starting a new feature on these hosted models. This retirement does not imply a shutdown of self-hosted open-source Whisper. [Official deprecations](https://developers.openai.com/api/docs/deprecations).

At the listed base rates, 1,000 one-minute videos cost approximately $3.50 for AssemblyAI or $4.30/$5.20 for Deepgram transcription. These arithmetic estimates exclude optional features, encoding compute, storage, bandwidth and any applicable billing minimums. Obtain an end-to-end cost from the real-video evaluation before defining user credits. Brand/context prompting should be added only if it improves measured results.

## GitHub reuse assessment

| Repository/package | Verified compatibility | Decision |
| --- | --- | --- |
| [libass](https://github.com/libass/libass) | ISC-licensed ASS renderer used by FFmpeg; local FFmpeg has working ASS/subtitles filters. | Reuse through FFmpeg. Verify the deployed Linux image's filters and fonts before release. |
| [Remotion captions](https://github.com/remotion-dev/remotion/tree/main/packages/captions) | Its actual package manifest independently declares MIT and no dependencies or peer dependencies. Provides timed caption utilities and SRT helpers in TypeScript. | Optional focused reuse; inspect the pinned release before adoption. It does not provide transcription or the video renderer. |
| [Remotion TikTok template](https://github.com/remotion-dev/template-tiktok) | React 19/TS example, but adds Remotion rendering and a script that installs whisper.cpp/downloads a model. Its template manifest says `UNLICENSED`, while the README directs readers to Remotion terms. | Useful reference; avoid importing wholesale. |
| [auto-subtitle](https://github.com/m1guelpf/auto-subtitle) | MIT Python/Whisper/FFmpeg CLI. Inspected implementation uses segment-level SRT, one fixed style and basename-derived temporary files. | Demonstrates the pipeline; substantial wrapping required for this SaaS. |
| [Subtitle Edit](https://github.com/SubtitleEdit/subtitleedit) | MIT .NET desktop editor. | Useful QA tool, poor embedded fit for the Next.js/Node flow. |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | MIT Python runtime with word timing and VAD, CPU/GPU deployment options. | Future self-hosted transcription candidate if operating costs justify it. |
| [WhisperX](https://github.com/m-bain/whisperX) | BSD-2-Clause pipeline with forced alignment, language-specific models and substantial ML dependencies. | Consider only after measuring a word-timing problem. Alignment has documented limitations. |

Remotion's main renderer has separate commercial licensing; do not infer its license from the MIT caption package. Sources: [caption manifest](https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/captions/package.json), [renderer license](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).

The `createTikTokStyleCaptions` helper is whitespace-sensitive and can extend page display across pauses. Own the width-aware wrapping and explicit speech-end rules even if reusing it. [API documentation](https://www.remotion.dev/docs/captions/create-tiktok-style-captions). ASS styling and fonts are documented by [FFmpeg](https://ffmpeg.org/ffmpeg-filters.html#subtitles).

## Proposed implementation boundary

Suggested new files are `components/subtitles/subtitle-generator-dialog.tsx`, `lib/subtitles/` for contracts/persistence/client logic, and `worker/src/jobs/generate-subtitles.ts` plus `worker/src/lib/subtitle-renderer.ts`. These paths do not currently implement the proposal.

Use authenticated `POST /api/subtitles` to resolve an asset and enqueue generation, owner-scoped status/transcript reads, and a correction/rerender endpoint. The browser supplies an asset ID and permitted settings, not an arbitrary remote download URL. Keep provider IDs and raw error details out of public responses.

Persist a reusable transcript record and a subtitle output/version record referencing the durable job and original media asset. Fields should include the owner, immutable source identity, language/model, provider transcript ID, timed words, transcript revision, preset/render version and derived asset ID. Two small records/tables are enough; a general video timeline schema is unnecessary. Use access controls matching the existing Firebase-to-database identity model; enable RLS where exposed and keep service-key access server-only. [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api).

Add a distinct `generate_subtitles` implementation job routed through the existing video-render execution path. Update the complete contract: app/worker type unions, executable-handler registry, canonical public-job mapping, queue routing, worker job allowlists, database job checks/render execution-slot admission and failure reconciliation. A new enum in the UI alone would strand jobs. Keep checkpoints inside this job for v1; independent transcription/render jobs can be introduced if load later warrants separation.

Add a derived media source such as `subtitle_render`, with parent linkage, and explicitly update all intended Library, editing, download and scheduling eligibility rules. Do not blindly mark derivatives editable if reopening the original draft would silently discard captions. Store the subtitle revision needed to reopen/edit them or initially treat captioned outputs as export-ready videos.

Use job-specific temp directories, server-generated filenames, escaped ASS text and FFmpeg argument arrays without a shell. Subtitle text must not introduce ASS override commands. Stream or bound downloads to avoid loading arbitrarily large files into worker memory. Store transcripts and temporary extracted audio with the intended access/retention policy; clean up temporary local files on success and failure.

## Validation and release order

1. **Real-video evaluation:** Compare the two hosted candidates on approximately 20–30 permissioned clips: clean generated voices, accents, fast speech, background music, names/prices, silence/music only, and intended languages/code switching. Include short and 120-second clips. Score word correctness, timing, false speech, latency, completion rate and correction effort. Neither provider was called during this research, so speech accuracy and throughput remain unmeasured.
2. **Small vertical slice:** Build generation and preview for one owner-scoped ready video in Library/AI results, behind a server feature flag. Validate retry/checkpoint behavior and all presets in the actual Linux image. Verify missing audio, bad timestamps, Unicode, extreme aspect ratios and existing text collisions.
3. **Regression checks:** Double clicks cannot create duplicate app jobs; render retries reuse transcripts; an old completion cannot overwrite a newer revision; one user cannot read or caption another user's private asset; failures retain the original; cancellation prevents attaching late output. Regress existing render, scheduling, media-visibility and durable-job behavior.
4. **Production acceptance:** Test authenticated generate → preview → save → download → explicitly select for schedule on `https://www.getugcpilot.com`, including the exact derivative and audible speech. Localhost/synthetic testing is not final acceptance. Start with internal accounts, then extend the same modal to workflows and Trending after the audio/scheduling decision is handled. Existing schedules retain their saved media snapshot.

Do not require every caption to be perfect before providing a useful feature, but do require no fabricated no-speech output, readable layouts, preserved audible content, a reliable correction path and clear failure handling. Define measured launch thresholds after the evaluation, rather than promising a universal accuracy percentage from provider marketing.

## Initial research smoke test

The existing local `ffmpeg-static` binary reports working `ass` and `subtitles` filters. An isolated 3-second 720×1280 sample used job-like temp files, the existing Arial font assets and synthetic timestamps/tone audio. It rendered Clean, Bold Box and Active Word simultaneously for comparison. Visual inspection confirmed that the active highlight changed between frames and captions disappeared after their event ended. FFprobe confirmed a 3-second H.264/AAC MP4; hashes of the copied AAC packets matched the input. Mono 16 kHz audio extraction also completed.

Artifacts are in `C:/Users/chund/.codex/visualizations/2026/09/30/01a0f1cf-8f6a-7851-8998-e240b8973475/subtitle-research/`: `styles.mp4`, `styles-preview.png`, `styles-later.png`, `styles-pause.png`, `styles.ass` and `result.json`.

This initial smoke test validated local rendering mechanics, not transcription quality, language font coverage, deployed-container compatibility, production auth/storage/scheduling integration or production performance. No provider request, installation, migration, deployment or application-source change was made during that initial research. The later disconnected implementation and real OpenAI requests are recorded in [the subtitle lab report](subtitle-lab.md); its observed Whisper failures are a reason to retain the production-provider evaluation gate.
