# Talking Head + Demo: Prepare final video latency

Audit date: 14 October 2026, Asia/Calcutta. Production timestamps below use UTC.

Implementation update: the largest measured caption-layout bottleneck now has a local fix. Serif and Editorial use bounded batches of up to 16 exact libass raster measurements per FFmpeg invocation. The existing font, stroke, canvas, clipping and ink threshold remain in use. See `docs/talking-head-caption-measurement-fix-2026-10-14.md` for measured results and verification. Worker deployment and authenticated production acceptance remain pending.

The user reported a 10–30 second wait for a video below 15 seconds long. There are measurable opportunities to reduce that wait. Caption layout can dominate Serif and Editorial exports, while repeated video encoding adds a separate cost when both clips have edits. Video duration alone does not determine preparation time.

The initial audit traced the local implementation, inspected completed production receipts and actual Cloud Run request logs, and profiled existing footage offline. It added a benchmark script without changing the renderer or cloud configuration at that stage. The subsequent local implementation is described in the update above. The user's exact slow request has not been identified, and caption style, footage resolution, local upload status and clip edits remain unknown.

## Measured short-video results

The offline fixture contains an eight-second talking head followed by a four-second demo. Both inputs have audio. The saved transcript was mapped to that exact 12-second timeline; no new transcription or generation request was made. Fixture preparation occurs outside the timed section.

### Same footage, different captions, 478 × 850

| Caption setting | Total worker pipeline time | Video encodes | FFmpeg text measurement calls | Time inside text measurement commands |
| --- | ---: | ---: | ---: | ---: |
| Off | 1.242 s | 1 | 0 | 0 |
| Clean | 4.383 s | 2 | 0 | 0 |
| Serif box | 16.160 s | 2 | 216 | 12.711 s |
| Editorial | 22.721 s | 2 | 276 | 18.405 s |

FFmpeg text measurement command time accounts for approximately 79% of the Serif pipeline and 81% of Editorial. This excludes subsequent image decoding and ink-bound scanning, which add further layout overhead. A preceding run measured Serif at 19.876 seconds and Editorial at 21.972 seconds; these are observed local measurements, not a production latency guarantee.

Clean uses the existing Sharp/Pango measurement path. Its first font preparation and validation in this local process contributed to the difference between the first Clean test and subsequent font checks.

### Both clips have saved text and volume edits

These scenarios apply a text overlay throughout each clip and set its original audio volume to 0.9. They preserve the 8 + 4 second timeline and exercise the existing immutable clip composition path.

| Resolution | Caption setting | Total worker pipeline time | Video encodes | Time inside video encode operations |
| --- | --- | ---: | ---: | ---: |
| 478 × 850 | Off | 2.559 s | 3 | 1.856 s |
| 478 × 850 | Clean | 5.286 s | 4 | 2.426 s |
| 1080 × 1920 | Off | 8.482 s | 3 | 7.317 s |
| 1080 × 1920 | Clean | 13.040 s | 4 | 8.791 s |

The 1080p inputs were derived from the existing fixture to isolate resolution cost. They are not a claim about the user's original files. The higher-resolution Clean case already takes 13 seconds locally before queue time, transfers, any fresh transcription, upload, database finalization and browser notification.

All offline timings use this Windows machine, sequential scenarios, the installed FFmpeg runtime, and the bundled fonts. They exclude network and UI time. The production worker has two vCPUs, so local timings must not be presented as expected production completion times. Encodes are timed around their operation boundaries; caption encode timing includes its internal output validation. Some probes performed inside renderer functions are therefore included in the enclosing encode rather than separately counted.

## Current production evidence

Read-only inspection confirmed that the interactive Cloud Run service is already warm:

- Region: `us-central1`; CPU: 2 vCPUs; memory: 4 GiB.
- Minimum instances: 1; maximum instances: 1; request concurrency: 1.
- Dedicated interactive `render_demo_video` finishing handler; longer background work has a separate job runtime.

Recent completed Explore receipts had queue/start delays of 0.650–0.968 seconds. Older receipts in the previous launcher path had 100–214 second startup delays, but those older measurements do not describe the current warm service. Keeping the current service warm is already implemented.

Two completed Serif box final exports used a 9.6-second, 478 × 850 source and finished in 37.012 and 37.263 seconds from job creation. Their output duration was approximately 9.567 seconds. Both included a clip composition snapshot and no demo. These are relevant short-video examples from the same finishing pipeline, not proof that either was the user's Talking Head + Demo request.

For the export created at `2026-10-13T22:25:01.627161Z`:

| Production interval | Elapsed time |
| --- | ---: |
| Job creation to processing start | 0.650 s |
| Processing start to composition stage, including ownership/download checkpoints | 0.723 s |
| Composition/clip preparation to transcription checkpoint | 4.844 s |
| Transcription/check checkpoint to subtitle rendering checkpoint | 0.188 s |
| Subtitle rendering checkpoint to output upload checkpoint | 29.850 s |
| Output upload, asset save and completion | 0.757 s |
| **Job creation to completion** | **37.012 s** |

These intervals are differences between persisted stage timestamps. The subtitle interval includes layout, encoding and checks after the checkpoint; it is not a font-only production measurement. The short transcription interval indicates it was not the dominant cost in this example. The implementation supports an owner-scoped durable transcript cache.

Cloud Run HTTP logs independently confirm actual service requests at the corresponding times, with 36.817 seconds for the above request and 7.501, 8.236 and 10.931 seconds for three recent caption-preview requests. Caption previews return speech data and do not represent completed final videos. They must not be compared to final exports as equivalent work.

The production website was inspected through its live deployment at `www.getugcpilot.com`. The available browser required sign-in, so this audit did not replay an authenticated Prepare final video click. Production receipts and Cloud Run logs establish server timing; they do not measure click-to-first-request, a local file upload or final playback display. No recent matching Vercel API logs were available in the queried retention window.

## Where the time goes in the code

1. `components/explore/use-workflow-finishing.ts` builds the draft, resolves existing owned assets, optionally uploads local demo/audio, and submits a durable finishing request. Default background music preparation can also happen here. The demo and demo-audio upload awaits currently occur sequentially.
2. `worker/src/jobs/finish-explore-video.ts` validates owned inputs, downloads source files in parallel, composes the result, obtains or recovers speech data, then uploads and finalizes an owned output asset. Downloads already use a bounded, abortable parallel path.
3. `worker/src/lib/explore-video-finishing.ts` prepares an opening edit and then a demo edit when present in `clipComposition`. It then combines the prepared files. A captioned final export encodes the composed video again to burn subtitles. Both edited clips plus captions therefore produce four encodes in the benchmark.
4. New subtitle drafts prepare the exact mixed speech audio before video encoding. Existing speech identities are saved durably and recovered for subsequent caption work. A single edited clip without captions already has a merged render pass; this optimization does not cover the complete two-clip captioned sequence.
5. `worker/src/subtitles/phrases.ts` evaluates multiple candidate phrases and line breaks. Serif and Editorial call their exact font measurers for those candidates. `serif-box.ts` and `editorial-media.ts` deduplicate within each measurer, but each new candidate starts a sequential FFmpeg process that renders a PNG. The PNG is then scanned for actual ink bounds.
6. Talking Head already opts into a one-second visible-page status poll in `hook-workflow-preview.tsx` / `use-workflow-finishing.ts`, with overlapping refreshes prevented. A completion response still needs the owned output lookup before display. Polling can add notification latency, but cannot explain the measured 29.85-second subtitle stage.

Paired reference soundtracks can introduce further audio mixing and a clean captioned base export. Those outputs preserve later editing behavior and must remain supported during any render consolidation.

## Recommended implementation order

### 1. Batch exact Serif and Editorial measurements

Precompute the phrase candidates needed by the layout algorithm, deduplicate them, and measure them in bounded batches through the same libass renderer and bundled fonts. Retain a bounded cache keyed by font identity/version, size, stroke settings, canvas geometry and text. Editorial hero/support sizes need the same treatment; unseen layout requests can use a bounded fallback.

This targets the largest measured cost: 216–276 individual process launches for a 12-second sequence. Merely adding another per-job string cache will not address it because the existing code already caches identical requests. A rough width estimator is insufficient: Pango and libass font sizing differ, and changing measurements can change phrase boundaries, box widths or clipping.

Verify matching ink bounds, ASS output, phrase boundaries and representative rendered frames against the current renderer; cover long words, punctuation, missing glyph failures, stroke geometry, all placements and cancellation. The 12.7–18.4 seconds of measured process time identifies an opportunity, not a promise that all of it disappears after batching.

### 2. Consolidate clip preparation, composition and subtitle encoding

Build the final filter graph from the immutable opening/demo edit snapshots, their trim and volume settings, text overlays, crop/pan and audio playback settings. Prepare the exact speech timeline for the existing durable transcript cache, then apply final ASS captions in the same video encode where possible.

This targets the three/four encode path. The 1080p benchmark shows it matters even with Clean captions. Preserve the current resolution, quality settings, audio offsets, trim rounding and clean reference-soundtrack base behavior. Use a fallback for cases that cannot yet be consolidated safely. Validate audio/video duration, join timing, text, demo framing, speech identity and publication provenance before replacing the existing path.

### 3. Overlap independent uploads and measure waiting under load

Resolve already-owned asset IDs first, then upload independent local demo/audio inputs concurrently with bounded cancellation and the existing deduplication behavior. This helps only requests that actually upload at click time. Retain the owner-scoped receipt and recovery rules.

The warm service's current maximum of one concurrent request can create queueing when multiple exports arrive. The sampled jobs do not show significant queueing; raise capacity only after measuring concurrent-user demand and reviewing cost. Faster polling or a larger worker cannot replace the renderer optimizations above.

## Reproduction and validation

The intentional addition from this analysis is `scripts/talking-head-prepare-latency.benchmark.mjs`. It uses the existing ignored audit inputs under `.tmp/talking-head-subtitle-audit/`: `speaking-opening.mp4`, `speaking-demo.mp4` and `production-transcript.json`. These local inputs are required and are not checked into Git. The script never calls an external provider, writes the database, uploads media or publishes a post.

```powershell
npm run worker:build
node --experimental-test-module-mocks scripts/talking-head-prepare-latency.benchmark.mjs
node --experimental-test-module-mocks scripts/talking-head-prepare-latency.benchmark.mjs --edited-only
node --experimental-test-module-mocks scripts/talking-head-prepare-latency.benchmark.mjs --edited-only --high-resolution
node node_modules/eslint/bin/eslint.js scripts/talking-head-prepare-latency.benchmark.mjs
```

Worker TypeScript compilation succeeded. All eight benchmark scenarios completed and their outputs measured 12 seconds. ESLint validation of the benchmark succeeded. Full JSON evidence is retained locally in `.tmp/talking-head-prepare-latency.json`, `.tmp/talking-head-prepare-edit-latency.json`, `.tmp/talking-head-prepare-edit-1080p-latency.json` and `.tmp/talking-head-runtime-audit.json`.

Production acceptance of a future optimization requires an authenticated click on the live site, production server stage timings, the returned playable owned output, and visual/audio parity. This audit identifies and measures the bottlenecks; it does not declare them fixed.
