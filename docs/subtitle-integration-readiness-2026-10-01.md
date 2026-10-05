# Subtitle integration readiness — October 1, 2026

**Decision: proceed with controlled integration development; do not enable production users yet.** The local subtitle engine and UI work on the approved sample. The deployed-application adapter, runtime and persistence are not implemented. This review added documentation only; no feature was attached, migrated or deployed.

## Verified now

- Fresh application TypeScript check passed: `node node_modules/typescript/bin/tsc --noEmit --incremental false`.
- Fresh worker compilation passed: `npm run worker:build`.
- Fresh scoped subtitle, benchmark and existing render suite: 56 passed, zero failed. This includes real FFmpeg renders, local cost checkpoints, concurrent requests, cancellation, invalid-cache rejection and completed-only output.
- Prior browser runs of the supplied clip produced Clean, Bold box and Word highlight. The preserved input hash, AAC packet hash, 144 frames, 720×1280 dimensions and 6.016-second duration were verified. The user approved qualitative playback.
- Source search found no application/component/library imports of the subtitle pipeline. Production worker handlers do not call it. The app's current flows therefore remain disconnected.

These checks establish local compatibility and function, not authenticated production acceptance or general timing accuracy.

## Required integration work

| Area | Current evidence | Required before enabling users |
| --- | --- | --- |
| Linux runtime | `worker/Dockerfile` contains Node, FFmpeg and fonts, but no Python/Torch/WhisperX/model assets. It copies worker `dist` and assets, not the root `scripts` harness or `.tmp` runtime. `scripts/subtitle-pilot/pipeline.mjs` imports root static FFmpeg packages and uses repository-local paths. | Package a separate pinned alignment/rendering image, with helper, offline model/tokenizer assets, production binary/font paths and redistribution notices. Prove a clean image can start and render without this Windows venv or generation-time downloads. |
| User and asset access | `scripts/subtitle-pilot/server.mjs` is an unauthenticated loopback server. Its exact Host/Origin checks protect local use, not account ownership. `app/api/edit/render/route.ts` already uses Firebase authentication and `getMediaAssetForOwner`. | A new authenticated subtitle API must derive the user from Firebase, resolve an owned source asset server-side and check ownership on status, cancel and every download. Do not accept an arbitrary URL/path or trust a supplied user ID. Test access between two different accounts. |
| Durable jobs and cancellation | Local jobs are a `Map`; transcript locks/checkpoints are files. Worker/app job types, worker handlers and queue config contain no subtitle job. Production uses durable database jobs and GCP Cloud Tasks. | Add a dedicated job type/handler/queue target, required database constraint updates and owner-scoped persistent stage records. Store paid-request outcomes durably before alignment/rendering. Use an atomic owner-scoped claim across replicas and prevent resubmission after uncertain outcomes. Bridge cancellation into OpenAI, Python and FFmpeg; reconcile terminal state before publishing a derivative. |
| Persistent outputs and privacy | Results and caches live in ignored `.tmp/subtitle-pilot`. The worker storage helper builds public-media URLs and defaults to immutable public caching. | Persist the new derivative and exports with source/user/job identity. Preserve the original and publish a completed result atomically. Keep raw text, audio and alignment diagnostics private with retention/cleanup rules. Explicitly decide access for SRT/VTT instead of automatically treating speech files as public media. |
| Scope and timing | Pilot: English, 30 seconds, 50 MiB, zero-origin tracks. The aligner refuses lexical digits and non-ASCII text. Valid acoustic intervals do not prove that GPT's words are correct. No independent human boundary reference exists. | Keep explicit launch limits and clear failure behavior. Validate number/spelling normalization or retain an explicit restriction. Score text and timing separately on independent representative clips. Generate captions from the final audio/video after trimming, composition and audio replacement; later edits must invalidate or regenerate the captions. |
| Cost and failure UX | Local successful text is reused across styles and alignment failures. SDK retries are disabled; unknown outcomes block automatic payment retries. | Preserve these rules in durable production storage. Add a defined usage/quota policy, request bounds and rate limits. Test restart/retry/cancel after submission and after output upload, so existing queue retries do not repeat transcription or publish partial output. |
| Release acceptance | No subtitle endpoint, production image or hosted end-to-end test exists. | Enable only one entry point behind a disabled-by-default gate after the above checks. Verify signed-in upload/owned asset → generation → persisted preview/download/cancel on `https://www.getugcpilot.com`, and verify existing flows with the gate disabled. |

The existing repository already provides Firebase verification, owner-scoped media lookup, durable job claims/stages, cancellation records, Cloud Tasks dispatch and GCS storage. Reuse those patterns while preserving a separate subtitle derivative operation; a rewrite of existing workflows is unnecessary. Additive job/queue changes still need regression validation.

The pipeline's `onStage` callback is synchronous, whereas the production worker's `context.checkpoint` is asynchronous. Simply passing one into the other would discard persistence promises. The adapter must explicitly await durable checkpoints and connect cancellation to an `AbortSignal`.

Cloud Run requires service listeners on the configured port at `0.0.0.0`; the local pilot intentionally uses `127.0.0.1`. Its writable filesystem also loses data when an instance stops, so local locks/checkpoints cannot be the production cost-safety mechanism. These differences require a worker adapter, not a direct deployment of the local server. [Google Cloud container contract](https://docs.cloud.google.com/run/docs/container-contract).

## Safe next sequence

1. Package and validate the separate Linux subtitle runtime against the preserved sample and new fixtures, leaving existing worker images unchanged.
2. Implement authenticated, owner-scoped subtitle jobs and durable paid-response/result storage. Test duplicate delivery, replica concurrency, restart, cancellation, cross-user access and missing configuration before adding a product entry point.
3. Complete representative text/timing evaluation and the first supported normalization policy. The existing sample approval remains qualitative; do not report WER or millisecond error as zero without reference annotations.
4. Add one gated application entry point with the three existing styles, verify its hosted flow and existing-flow regressions, then expand to other workflows.

Docker CLI is installed locally, but its engine was unavailable during this review. No Linux image run was performed. No hosted environment, database schema or secret value was changed or verified live. The existing OpenAI key can support the recognition stage; its presence alone does not provision alignment or job persistence.

Detailed local setup and evidence: [pilot guide](subtitle-pilot.md), [sample and independent benchmark status](subtitle-video-test-2026-10-01.md).
