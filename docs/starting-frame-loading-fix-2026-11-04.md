# Starting-frame loading and generation recovery — 4 November 2026

Status: **PARTIALLY VERIFIED. Implemented locally; public frame storage verified live. Not deployed. Fresh hosted generation acceptance remains open.**

This receipt covers faster source-frame loading for Hook, Wall of Text/Text on screen and Talking Head, plus the two generation errors in the supplied 18:40 screenshots. It does not claim that a diagnostic improvement fixes the provider's underlying failure to return an image.

## Scope and protected boundary

Requested behavior: prepare each immutable public video's original frame zero once, store it in the backend, and reuse it when Recreate opens. No interactive MP4 extraction. Start bounded image preparation on the existing Recreate button's pointer/keyboard/touch intent. Preserve current UI, generation prompts, stage/reference roles, billing policy and old saved requests. No build, dev server, bundling, push, deployment or promotion was performed.

The screenshot follow-up authorizes auditing recurring generation errors. Two narrow corrections were made: suppress status polling while the initial admission POST is still pending, and distinguish a completed provider response containing no image from an unconfirmed response. No automatic paid retries were added.

Preflight sources consulted: `AGENTS.md`, `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`, `docs/ai-context/nonnegotiables.md`; context-memory, immutable-contracts, UI-clarity, starting-frame, video-prompt and regression-gate skills. Supabase skill was consulted for the read-only job/credit audit. Installed Next.js client-component guidance was consulted. The large Explore/history reads included truncated output; this receipt does not claim a new exhaustive reread of their entire history. `python tools/preflight.py --repo . --task "Audit and safely improve prepared source starting-frame loading for Hook, Wall of Text and Talking Head; diagnose recurring request-unconfirmed and empty-provider-image failures; preserve UI/prompts; no builds or deployments"` passed prerequisite discoverability. Existing unrelated and concurrent worktree changes were preserved.

## What changed

New public opening-frame requests use the existing immutable backend PNG/index store unconditionally. Both the preview API and generation admission use this same validated frame-zero reader. A fresh server no longer downloads or decodes a public MP4 on this path. Missing preparation returns 503 and corrupt/mismatched data fails validation rather than silently extracting or replacing a frame.

Historical retained/curated-frame resolution remains on its existing reader. Private creator sources remain behind their existing owner/access checks and private preparation; none were published into the public store. The source SHA, extractor version, frame SHA, dimensions and exact t=0 receipt remain authoritative.

The browser shares an eight-entry, 24 MiB, five-minute cache keyed by owner, reference, source version and full retained-frame provenance. Authentication is checked before every cache read. In-flight reads are deduplicated, one consumer's cancellation cannot cancel another consumer, failures are not cached, and speculative reads are capped at two. No mount-time catalogue fanout or new visible controls were added.

Public preparation now includes original frame zero even for Hook references that also have a reviewed later clarity frame. Existing Hook publication calls prepare before activation. The explicit verification/preparation command accepts `--all` for all three workflows, or `--wall` for Wall of Text. Future Wall/Talking Head imports must run the all-workflow preparation/readback gate before catalogue activation; no new automatic ingestion scheduler was introduced.

## Live backend evidence

| Public catalogued source workflow | Verified backend PNGs | Newly prepared in this task | Missing/corrupt |
| --- | ---: | ---: | ---: |
| Hook | 106 | 0 | 0 |
| Wall of Text / Text on screen | 101 | 101 | 0 |
| Talking Head | 25 | 25 | 0 |
| Total | 232 | 126 | 0 |

Counts include public catalogued/archived sources, not only cards currently visible in a gallery. All 232 PNGs were downloaded, decoded with Sharp, matched against their SHA/dimensions, and read through the actual new opening-service factory with MP4 download/decoding forbidden. The store uses the existing `ugcsaas-media` backend and immutable `explore/hook-starting-frames/` objects. PNG creation precedes index publication and uses create-only writes. Already valid objects were not overwritten. Private creator IDs are excluded.

Diagnostic-host cold service median/p95 read times were Hook 858/3536 ms, Wall 537/6087 ms and Talking Head 425/1002 ms. Process-cache reads were 0–13 ms. These are not signed-in browser click-to-render measurements or a controlled before/after comparison; network tails remain measurable, and the UI must still fetch/decode a PNG when uncached.

Ignored local evidence: `.tmp/starting-frame-loading-20261104/prepare-receipt.json`, `backend-final.log`, `frames/` and `protected-audit.json`. An initial offline preparation run used four workers against a two-decode limit and reported 429s; the local preparation script's concurrency was aligned and every unfinished source was successfully resumed. Final result: expected232/verified232/missing0/failed0. This was an offline preparation issue, not evidence of an interactive provider failure.

## What the screenshot jobs actually did

Read-only production database inspection found these owned jobs for the same Hook reference and scene-input fingerprint:

| Created, Asia/Calcutta | Job ID | Verified result |
| --- | --- | --- |
| 18:40:05 | `7ca4d814-d03c-4421-948a-e1a51e84a40c` | Scene operation submission uncertain; no image |
| 18:40:55 | `7cc10b12-c01f-4f5b-b1ed-c6d5286a47c2` | Scene operation submission uncertain; no image |
| 18:46:25 | `2125cebf-9e4a-4e19-9140-0fac97b5d8e1` | Scene operation submission uncertain; no image |

All used Gemini 3 Pro through OpenRouter. The persisted underlying message is `OpenRouter Gemini returned no images in response.` No identity-stage operation exists for these jobs: stage 2 never started. Each one-credit application reservation was released. This does not establish whether the upstream provider charged for its completed work.

The provider's original finish reason, refusal information and request ID were not persisted. **The reason it returned no image is UNKNOWN.** Content filtering, a model constraint or a particular prompt defect cannot honestly be asserted from this evidence. No old request was rewritten or resubmitted.

The new response diagnostic saves a sanitized finish reason/request ID when available. A no-image response with a normalized terminal finish (`stop`, `content_filter`, `length` or `error`) becomes an explicit terminal `provider_image_missing` failure with automatic retry disabled. Unknown/incomplete responses remain submission-uncertain, preserving duplicate-payment protection. This classification follows the normalized completion reasons in the [OpenRouter response reference](https://openrouter.ai/docs/api_reference/overview); it does not interpret every no-image response as moderation.

Separately, the component could start status GETs by request key before the initial admission POST had created a job. That can produce the request-not-confirmed 404 while admission is still pending. Queries now wait until the POST settles and then recover by accepted job ID/request key without automatic resubmission. This race is code-confirmed and regression-tested; the exact browser/network trace for the screenshot was not captured, so it is not claimed as the proven cause of that specific screenshot.

## Cross-workflow audit and verification

Hook and Wall use `format-workspace.tsx`; Talking Head uses `hook-workflow-preview.tsx`. Each opens the shared `HookStartingFrameWorkspace`, then the same source-frame/admission APIs and image worker. The new loading, pending-POST polling and OpenRouter error handling therefore apply to all three. Workflow-specific source resolution/admission and Talking Head/Wall guidance are covered by the existing tests. The no-image jobs above belong to Hook; there is no new real generated-image acceptance for Wall or Talking Head in this task.

| Protected contract | Result |
| --- | --- |
| All three public workflows read stored original t=0; no request-time MP4 extraction | VERIFIED by production service factory and all 232 live objects |
| Source SHA/frame SHA/dimensions, missing/corrupt refusal | VERIFIED |
| Owner-bound cache, authentication on hits, in-flight cancellation/retry and bounds | VERIFIED in controlled client/service tests |
| Retained/curated/private source paths and historical recovery | VERIFIED in focused regression tests; new hosted acceptance NOT TESTED |
| No automatic submission during preload/open/restore; no duplicate paid retry | VERIFIED in controlled UI/worker tests |
| Initial POST is not raced by status polling | VERIFIED in actual-component handler test |
| Layout/labels/control tree and relevant CSS unchanged by this patch | VERIFIED by source/JSX comparison; fresh desktop/mobile visual acceptance NOT TESTED |
| Prompt builders, provider request payload builder, scene/identity/harmonization orchestration and character pipeline | VERIFIED unchanged by hashes/function comparison |
| Other workflows' publishing/scheduling behavior | Not modified; full hosted cross-feature navigation NOT TESTED |
| Actual signed-in click-to-render timing on deployed changes | NOT VERIFIED; changes not deployed |
| Successful fresh provider image, identity fidelity and image quality in each workflow | NOT VERIFIED |

Commands/checks run without building:

```text
node --import ./scripts/next-server-only-test-loader.mjs --import ./scripts/worker-source-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/explore/*source-frame*.test.* lib/explore/starting-frame-cache.test.ts lib/explore/public-starting-frame-sources.test.ts lib/explore/hook-keyframe-generation-api.test.mjs lib/explore/hook-keyframe-result.test.mjs lib/explore/hook-keyframe-draft.test.ts lib/explore/hook-keyframe-variations.test.ts scripts/hook-starting-frame-client.test.mjs scripts/hook-starting-frame-ui.test.mjs scripts/starting-frame-preload.test.mjs scripts/explore-navigation-ui.test.mjs scripts/creator-preview-loading.test.mjs
180 passed; 0 failed/skipped.

node --import ./scripts/worker-source-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test worker/src/lib/openrouter-gemini-image.test.ts worker/src/lib/generation-provider.test.ts worker/src/lib/durable-image-stages.test.ts worker/src/jobs/generate-image.test.mjs worker/src/jobs/generate-character-image.test.mjs worker/src/lib/image-harmonizer.test.ts
84 passed; 0 failed/skipped.

node node_modules/typescript/bin/tsc --noEmit --incremental false
PASS (exit 0).
node node_modules/typescript/bin/tsc -p worker/tsconfig.json --noEmit --incremental false
PASS (exit 0).
Scoped ESLint on all 20 changed application/script/test files: PASS (exit 0).
Scoped git diff --check: PASS.
Protected hash/function/JSX audit: PASS.
```

The latest two test groups total **264**, without adding earlier overlapping runs. Logs: `loading-tests-final.log`, `worker-tests-final.log`, `types-final.log`, `worker-types.log`, `lint-final.log` under the ignored evidence directory. Browser fixtures that bundle were not run because builds were forbidden. No new image-generation inputs/results exist to present; no paid generation was submitted by this task.

## Files changed by this task

Application/scripts:

- `lib/explore/hook-source-frame.ts`
- `lib/explore/public-starting-frame-sources.ts` (new)
- `lib/explore/starting-frame-cache.ts` (new)
- `lib/explore/hook-starting-frame-client.ts`
- `components/explore/use-starting-frame-preload.ts` (new)
- `components/explore/recreate-workspace.tsx` (only preload additions; other existing changes preserved)
- `components/explore/talking-head-references.tsx`
- `components/explore/hook-starting-frame-workspace.tsx` (one polling-enable condition)
- `scripts/prepare-hook-source-frames.mjs`
- `scripts/prepare-published-hook-frames.mjs`
- `worker/src/lib/generation-provider.ts`
- `worker/src/lib/openrouter-gemini-image.ts` (response diagnostics only)

Tests:

- `lib/explore/hook-source-frame-store.test.ts`
- `lib/explore/public-starting-frame-sources.test.ts` (new)
- `lib/explore/starting-frame-cache.test.ts` (new)
- `scripts/hook-starting-frame-client.test.mjs`
- `scripts/hook-starting-frame-ui.test.mjs`
- `scripts/starting-frame-preload.test.mjs` (new)
- `worker/src/lib/generation-provider.test.ts`
- `worker/src/lib/openrouter-gemini-image.test.ts`

Documentation: this receipt, appended entries in `EXPLORE_CONTEXT.md` and `docs/ai-context/clear.md`. Local diagnostic scripts/logs/PNGs under `.tmp/starting-frame-loading-20261104/` are ignored artifacts, not release source. No other dirty paths are attributed to this task.

## Open items and rollback

Incidents `UGC-UI-20261104-STARTING-FRAME-WAIT` and `UGC-GEN-20261104-STARTING-FRAME-EMPTY-RESPONSE` remain open for production acceptance. The storage/read-path and recovery defects have local verification; the upstream no-image cause and successful output in all workflows do not.

After an explicitly build-authorized release, verify signed-in cold/warm Recreate in each workflow on the production domain, inspect preserved request/job/provider-operation receipts, then submit a disclosed real generation per workflow and review output/source/identity separately. Until then, do not label all starting-frame generation issues solved. No deployment/build permission was requested as a prerequisite to this local work.

Rollback is limited to this task's scoped source/test additions and appended documentation. Preserve concurrent edits. Backend additions are create-only, immutable and source-addressed; leaving them in place is harmless if the application patch is reverted. Future public additions require preparation before activation; the interactive path intentionally does not conceal a missing preparation by extracting MP4s.
