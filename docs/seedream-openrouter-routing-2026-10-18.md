# Seedream 5.0 Pro through OpenRouter — October 18, 2026

Implemented locally; not deployed in this task.

## Admission and provider contract

New AI Studio and Build AI influencer requests for `seedream_5_pro` store
`provider: "openrouter"` in every admitted durable image job. The client cannot
choose the provider. The worker calls `POST https://openrouter.ai/api/v1/images`
with `model: "bytedance-seed/seedream-5-0-pro"`, `resolution: "1K"`, `n: 1`, the
chosen aspect ratio, the intact trimmed prompt and ordered image references via
`input_references`. There is no model fallback or prompt rewrite.

The app's existing Seedream description limit is 4,000 characters; influencer
reference selection remains capped at ten. OpenRouter's image capability API
lists one output per call, 1K/2K, all four app ratios and up to fourteen inputs.
The app continues to normalize outputs to its existing dimensions and PNG.
Application image-credit policy and atomic batch reservations do not change.
Returned provider cost is retained in the durable operation metadata.

The adapter uses the existing worker-only `OPENROUTER_API_KEY`. A read-only key
check rejects management keys and insufficient configured spending allowance
before the paid POST. The 1K estimate is $0.045 plus $0.003 per reference, based
on the official endpoint pricing read on October 18. No new secret or package
dependency is required. Keep Runway credentials for older operations and video.

## Recovery and failure behavior

Old image jobs have no provider field and continue to reserve `runway-image`
using their unchanged request fingerprint. Their original Runway task IDs and
staged source images remain recoverable. New jobs reserve `openrouter-image`
and include the explicit provider in the fingerprint. Replaying an old request
returns its existing jobs and does not move them to another provider or reserve
additional application credits.

OpenRouter's image endpoint returns bytes synchronously, rather than a video-like
pollable task ID. Source bytes are staged in app storage and recovered from the
saved staging pointer if final processing/upload needs a retry. Ambiguous paid
POST responses are recorded as uncertain; they are never automatically submitted
again or sent to Runway. The adapter does not retry POSTs, follow redirects with
credentials, accept remote result URLs or log its credential. Response size,
base64 data, image count and raster signatures are bounded and validated before
normalization. Known pre-submission access failures can retry safely.

## Deployment and verification

Deploy the generation worker before the website/API admission change. Older
workers ignore the new provider field and would otherwise still call Runway.
Verify the deployed worker retains its existing OpenRouter secret reference.
The already required OpenRouter provider database constraint accepts these
operations; this change introduces no migration.

Local verification covers the exact HTTP body, ratios, zero/multiple references,
credential boundaries, key failures, byte validation, ambiguous submissions,
staged recovery, unchanged Runway recovery, API routing, replay and credit
reservations. `npm run test:image-generation` passes all 141 tests. Worker
compilation, application TypeScript and targeted ESLint checks pass. The image
test command now includes the OpenRouter adapter and character admission checks;
an outdated character test mock was updated to expose the existing Flare export.
No paid live generation is submitted by the automated tests.
Final production acceptance is separate: after deployment, generate a Seedream
image on `https://www.getugcpilot.com`, confirm its operation uses OpenRouter and
the output is saved/downloadable, then verify an owned reference-image request.

Official sources:

- https://openrouter.ai/docs/guides/overview/multimodal/image-generation
- https://openrouter.ai/api/v1/images/models/bytedance-seed/seedream-5-0-pro/endpoints
- https://openrouter.ai/bytedance-seed/seedream-5-0-pro
