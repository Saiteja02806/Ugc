# Hook 02: exact-model diagnostics and controlled test preparation

## Result of this investigation

No new image or video generation was run. The failed pilot remains immutable. Preparation consists of official-documentation review, installed SDK/adapter inspection, one read-only model lookup and an offline synthetic-error check. The actual rejection cause remains UNKNOWN.

A confirmed local logging limitation is now identified: `.tmp/run-hook02-approved-pilot.mjs` retained `error.message` but not the structured provider response body or diagnostic headers. Those discarded fields cannot be recovered from its saved receipt. The failed request returned no operation ID, so there is no known interaction to retrieve. Do not repeat the paid request merely to recreate its error record.

## Exact model and request route

| Item | Evidence / status |
|---|---|
| Image model | `gemini-3-pro-image`; existing worker `buildGeminiImageRequest`; live GET reports `models/gemini-3-pro-image`, version `3.0`, Nano Banana Pro. |
| SDK | Installed `@google/genai` 2.10.0. |
| Generation endpoint | Offline SDK transport interception confirms POST `/v1beta/interactions`; no real POST occurred during this investigation. |
| Existing request format | Two inline PNG inputs, ordered scene then identity; `response_format={type:image,aspect_ratio:9:16,image_size:2K}`. |
| Settings retained | Model, endpoint, 2K, 9:16, no tools or conversation history, default sampling and default safety configuration. |
| Token limits | Live metadata: input131072/output32768. Official model page: input65536/output32768. This discrepancy is recorded, not silently reconciled. Live token counting against conservative limits is appropriate before a future submission. |
| Sampling metadata | Live lookup reports temperature1, topP0.95, topK64. These are metadata/defaults, not proof that every image parameter is adjustable through Interactions. |

Google's [model page](https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image) confirms image/text inputs and outputs. Its [image guide](https://ai.google.dev/gemini-api/docs/image-generation) documents multi-reference generation and high-resolution output. The two-input/2K design is within the documented capability; that does not mean a particular image request must pass safety review.

## Supported diagnostics versus unsupported assumptions

Google's [Interactions safety guide](https://ai.google.dev/gemini-api/docs/safety-settings) documents HTTP400 for blocked input **or response**, with an error code/message. Background failures can expose these in the interaction's `errors` list; streaming can expose an error event. The prior request was neither a saved background operation nor a stream with retained diagnostic events. Its message alone does not distinguish input from generated-output filtering or identify a specific harm category.

The [Interactions reference](https://ai.google.dev/api/interactions-api) defines `errors`, `safety_settings`, image formatting and general generation configuration. Its general seed option does not establish exact-model deterministic image output. No seed, sampling, background, streaming or API-version change will be introduced into the first controlled comparisons. Model support for new execution modes is NOT VERIFIED by schema availability alone.

Keep safety defaults unchanged. Changing thresholds while changing prompts/images would confound this diagnosis; built-in protections are not guaranteed adjustable. Do not transplant Imagen-specific `safetyFilterLevel`, `includeSafetyAttributes`, `personGeneration` or its image-safety scores into this Gemini Interactions request. Likewise, `promptFeedback`/candidate `safetyRatings` from another response schema are not guaranteed to exist here. No additional fields should be invented when the provider omits them.

The installed Interactions SDK's runtime error exposes `status`, `body`, `headers` and `error`. Its `error` wrapper can also contain `httpMeta` with a Request object. **Never serialize that wrapper wholesale**: request headers may include credentials. The offline check verified extraction of the response body's `error.code` and a synthetic request ID without any real network call. It establishes SDK behavior only, not the contents of Google's original rejection.

For a future authorized test, capture HTTP status; bounded/redacted response `error.code`, `error.message`, `error.status` and safe details; available request identifiers from an allowlist of response headers; returned interaction ID/status/errors; requested and returned model; timestamps; exact request/prompt/image hashes and image roles. Retain a bounded sanitized response body if useful. Never record API keys, Authorization, request headers, base64 media or signed URL query strings in a diagnostic log. If available fields are absent, record `not provided`.

## Prepared controlled comparisons

All tests below are **NOT RUN** and require a separate paid-test decision. No batch or automatic retry is prepared. Use the same account/model/endpoint/2K/9:16/default settings throughout. Keep input bytes exact. C1–C4 intentionally omit the per-image role-label text so prompt changes and label changes can be separated. They are diagnostic outputs, not acceptable recreation assets.

| Case | Image input | Text input | Comparison / limits |
|---|---|---|---|
| C0 | None | `Create one natural photograph of a silver laptop on a desk in a softly lit cream room, with no people or text.` | Basic image-generation route/account control. Not a causal comparison with the recreation request. If it fails, inspect the structured error before spending on other cases. |
| C1 | Original t=0 only | `Create one natural photograph based on the supplied reference imagery.` | Source-only condition. A block is evidence about this input/request combination, not proof of a forbidden source detail. |
| C2 | Influencer portrait only | Exactly C1 text | Identity-only condition. Compare with C1 while remembering both visible content and image bytes differ. |
| C3 | Original t=0 then identity | Exactly C1 text | Compare with both single-input controls; if singles pass but pair fails, pairing/output interaction becomes a hypothesis. It does not prove either image is individually unsuitable. |
| C4 | Same ordered pair as C3 | Frozen original full image prompt | Only the instruction text changes relative to C3. If C3 passes and C4 blocks, the recreation instruction/output interaction is implicated, without identifying a particular clause. |
| C5, only if needed | Same pair as C4 | Same full prompt plus original per-image role labels | Only role-label text changes relative to C4. This reconstructs the prior request body for a diagnostic repeat; not authorized by the prior exhausted one-attempt approval. |

The separate machine-readable manifest binds each condition to exact hashes and settings. It contains no credentials or embedded image bytes. It does not execute tests. C0 need not be repeated if recent suitable service evidence is accepted; a successful model GET alone does not prove image generation works.

## Interpretation and stopping rules

- Read structured diagnostics after each authorized condition. Missing code/category means unknown; do not guess from wardrobe, age, caption or prompt wording.
- Never auto-submit the next case or retry a blocked case. A budget/condition approval must precede new inference. Do not weaken safeguards or alter photos to suppress a filter.
- A single pass/fail contrast narrows hypotheses but is not causal proof: image generation and its outputs vary. Repetitions would need a separately agreed budget and balanced unchanged conditions.
- Stop diagnostic branching once the response identifies a concrete actionable API/config issue or sufficient evidence supports reporting to Google. Prefer provider support with sanitized model/time/request-ID/error evidence over speculative prompt changes.
- No diagnostic image goes directly to video. Only an approved recreation image matching source t=0, identity, caption removal and scene/contact requirements may enter a separately authorized three-second video test. Full frame-by-frame source/output comparison still applies.
- No normal/middle reference rollout, production configuration change, deploy or model substitution follows from these diagnostics alone.

## Verification and scope receipt

Read-only exact-model GET PASS; model metadata saved in `hook02-exact-model-metadata-2026-10-26.json`. Offline synthetic HTTP400 check PASS after correcting extraction for the SDK's nested response-body shape: one intercepted POST, zero real network requests, code and request ID recovered. Evidence: `hook02-offline-diagnostic-capture-2026-10-26.json`. This synthetic result is not a provider result. Prepared-case hash/condition validation PASS.

Files added: this report; exact-model metadata JSON; offline capture JSON; controlled-test manifest JSON. Ignored helpers: `.tmp/read-hook02-model-diagnostics.mjs`, `.tmp/check-hook02-diagnostic-capture.mjs`. Appended project context and UGC-VID-015 evidence in the mistake ledger. No application/worker source, original pilot prompts, original generation receipt or settings were changed. No broad build/UI run was needed or claimed for this documentation/diagnostic-only preparation.

Continuing-task preflight sources: user-supplied replacement AGENTS.md; actual EXPLORE_CONTEXT.md; clear.md; nonnegotiables.md. Relevant skills read: ugc-context-memory, ugc-immutable-contracts, ugc-video-prompt, ugc-starting-frame, ugc-opening-frame-prompt; earlier pilot ugc-frame-analysis and ugc-regression-gate remain applicable. Preserve exact t=0/source/identity binding, no paid retries and no unrelated UI/schedule changes. UGC-VID-015 and UGC-VID-013 remain OPEN.

VERIFIED: local SDK error shape, safe diagnostic extraction on synthetic data, frozen source/identity/prompt hashes, offline test conditions and absence of new generation. NOT VERIFIED: original structured error/category, exact model acceptance of optional safety/execution controls, actual cause, billing and generated-output quality.
