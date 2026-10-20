# Faster caption preparation for Talking Head + Demo

14 October 2026. Implemented locally; worker deployment and authenticated production acceptance remain pending.

The finishing audit found that Serif box and Editorial captions spent most of their preparation time starting a new FFmpeg process for each candidate phrase. A 12-second sequence triggered 216 Serif measurements and 276 Editorial measurements. The existing per-render cache already deduplicated repeated strings; new unique phrase candidates still caused separate process launches.

The local fix renders up to 16 independent, static text probes in one FFmpeg invocation. Each probe uses a separate frame with the same canvas, libass font selection, font size, stroke, padding, clipping rule and ink threshold as the prior single-frame measurement. Batches combine only compatible canvas dimensions and ASS headers. Different Editorial sizes retain their own canvas geometry.

## Measured result

The same saved eight-second talking head and four-second demo were used for the before/after measurements, at 478 × 850. The transcript was already available. No provider calls, uploads, database writes or publication occurred.

| Style | Before: total preparation | After: total preparation | FFmpeg measurement processes before → after | Time inside measurement commands before → after |
| --- | ---: | ---: | ---: | ---: |
| Serif box | 16.160 s | 5.462 s | 216 → 17 | 12.711 s → 1.979 s |
| Editorial | 22.721 s | 8.566 s | 276 → 31 | 18.405 s → 3.848 s |

The observed total reduction is approximately 66% for Serif and 62% for Editorial. The measurement-command reduction is approximately 84% and 79%, respectively. These are local observations on Windows, not production completion guarantees. Concurrent machine activity caused variance in unchanged probe/encode work during the after run; the independently verified process counts and output parity provide stronger evidence than a claim about fixed completion time.

The output stayed 12 seconds long. ASS, SRT and VTT files were byte-for-byte identical to the previous output for both styles. Decoded RGB frames at 0.5, 2.5, 5, 7.5, 8.5 and 10.5 seconds were pixel-for-pixel identical for both exports, including frames on each side of the opening/demo join.

## Changes

- `worker/src/subtitles/batched-ink.ts` owns a per-render queue, deduplicated promises, unique temporary names, a batch size limit of 16 and one active measurement command per measurer. It decodes one frame at a time, checks dimensions and deletes temporary ASS/PNG files. Font failures and cancellation reject queued work without starting further batches. Preloading settles all work before returning a failure.
- `serif-box.ts` and `editorial-media.ts` supply their existing exact font/header/body rules to the common measurer. Cache keys remain scoped to the selected style, render and font parameters; user transcripts are not shared across renders.
- `phrases.ts` optionally preloads the same bounded contiguous phrase candidates required by the existing planner. The cost model, phrase boundaries, punctuation/pauses, timing and line-break policy remain unchanged. Measurers without preloading keep their existing path.
- `explore-video-finishing.ts` connects Editorial's candidate preload to its width measurement. Serif supplies the preload through its existing phrase-grouping wrapper.
- `editorial.ts` plans independent pages concurrently so measurements from several pages can share a batch. Settled results preserve page order and prevent cleanup while another page still owns work.

No resolution, encoding quality, caption appearance, receipt fingerprint, speech cache, authentication or publishing contract changes are required. The existing number of video encodes is unchanged. A complete two-clip export with clip edits and captions still has the separate preparation/composition/caption passes identified by the audit; consolidating those remains an additional optimization.

## Verification

The new `scripts/subtitle-batch-measurements.test.mjs` exercises actual FFmpeg/libass and compares shaped ink bounds against the prior single-frame algorithm at 478 × 850, 720 × 1280, 1080 × 1920 and 1920 × 1080. Coverage includes serif stroke, italic overhang, hero/support sizes, punctuation, accented characters, escaped ASS commands, very long clipped text, duplicate requests, bounded batches, concurrent measurers, missing-font failures, pre-cancelled requests, cancellation during rasterization, invisible text and temporary-file cleanup.

`worker/src/subtitles/phrases.test.ts` compares preloaded and lazy planning results directly. The new real-render test is included in `npm run subtitles:test` with the existing caption, audio, ownership, receipt and finishing checks.

Validation completed: **269 subtitle and finishing regression tests passed**, including all seven new real-measurement tests. Root TypeScript, worker TypeScript compilation, scoped ESLint and whitespace checks passed. Existing tests confirmed visible captions in all placements, preserved mixed audio and source files, durable transcript reuse, output ownership and recovery behavior. The explicit benchmark comparison confirmed matching ASS/SRT/VTT content and 12 identical sampled export frames.

Reproduce:

```powershell
npm run worker:build
node --experimental-test-module-mocks --test --test-concurrency=1 scripts/subtitle-batch-measurements.test.mjs
npm run subtitles:test
node --experimental-test-module-mocks scripts/talking-head-prepare-latency.benchmark.mjs
```

The benchmark requires the existing local ignored media/transcript fixtures described in the analysis document. The regression tests generate their own offline fixtures. Diagnostic artifacts live under `.tmp`: `talking-head-prepare-before.json`, `talking-head-prepare-latency.json`, `caption-batch-output-parity.json`, `caption-batch-safety-tests.log` and `caption-batch-regression.log`.

## Release acceptance

Deploy the worker image containing these changes to the interactive finishing service and the matching background job runtime, using the project's normal release process. An app-only Vercel deployment does not replace the renderer image. Validate an authenticated Prepare final video action on `https://www.getugcpilot.com`, including its production receipt, stage durations and playable owned output. Compare short Serif, Editorial and Clean examples with edits, and confirm captions, sound and join timing. Existing completed media remains usable throughout rollout; rollback consists of restoring the preceding worker image.
