# Hook Video Library preview — 3 November 2026

Status: local implementation prepared; public upload BLOCKED pending specific authorization. Not deployed or visually accepted.

## Scope and boundary

The supplied screenshot requests moving standalone library details left and adding the supplied library recording on the right. At mobile widths source order is details, video, then download. The page uses existing type/color tokens and a restrained 20px media frame; video is the main new visual element. No global styling or dependency changes.

The supplied MP4 is 2,806,731 bytes, H.264/AAC, 512x550, 9.21 seconds. ffprobe inspected metadata; ffmpeg extracted the 1-second poster, which was visually inspected. The video is not cropped, edited or replaced. Native controls, reserved aspect ratio, playsInline and preload=none keep playback deliberate. Preview failure/retry is independent from download state and makes no API claim.

Implementation files changed:
- `components/marketing/hook-video-bundle.tsx`: standalone grid/player and isolated preview failure recovery; compact child wrappers use display:contents to retain existing flex layout.
- `scripts/hook-bundle-preview.test.mjs`: direct actual-component execution for standalone/compact behavior, preview-error isolation and download gates.
- `docs/ai-context/clear.md`: appended OPEN incident UGC-UI-20261103-HOOK-BUNDLE-PREVIEW; no historical entries rewritten.
- `EXPLORE_CONTEXT.md`: appended current public-resource preview decision and pending-upload status.
- This receipt.

Ignored task artifacts: `.tmp/hook-bundle-preview/poster.jpg` and `upload.mjs`. Upload script uses existing Google Cloud login, existing bucket, create-only content-addressed objects and public hash/range readback. No IAM/config changes, overwrite or build step. Rollback is only the scoped component diff and new test/docs; preserve unrelated character edits and durable bundle counter.

## Preflight evidence

Read applicable AGENTS rules, global no-build rule, nonnegotiables, relevant indexed Explore/incident entries, original bundle/free-tools receipts, current component/callers, existing bundle tests and installed Next video/client-component guidance. The large historical Explore/incident documents were searched and relevant sections reviewed; a full historical reread is not claimed. Read ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-regression-gate and frontend-design skills. `python tools/preflight.py` found required context readable. Relevant protections: UGC-UI-037 compact geometry, UGC-UI-114 public resource versus authenticated Hook route, local versus hosted acceptance distinction.

## Upload status and safety boundary

The script failed initially because gcloud's PowerShell shim is disallowed, then because the sandbox cannot update gcloud's credential/log files. The explicit escalation was rejected by automatic approval review: general backend-upload authorization did not explicitly cover public exposure in this external bucket. Do not work around this rejection. User approval of this exact public hosting destination is needed before retrying.

Prepared destination is `gs://ugcsaas-media/marketing/hook-video-library/v1/`. Anyone with the HTTPS URL can view these public marketing files. This is consistent with the intended public preview but NOT authorized by the reviewer yet. No upload succeeded and the implementation URLs are pending assets, not verified live links:
- MP4 key `preview-2a3c843428fa3763.mp4`, SHA256 `2a3c843428fa3763a3e39ddbe3187f4dd8ef2df5510ff8aeff4c25cbfea031ee`.
- Poster key `preview-5c570227cee989d7.jpg`, SHA256 `5c570227cee989d747c1825928b95d07c26a323e16f80a025185ca67eaa1d6a7`.

## Verification

- VERIFIED: focused direct Node suite 21/21 passed: bundle manifest/admission/store/ZIP/access plus 3 preview tests. Covers 110 concurrent requests/100 admissions, replay, counter corruption, no GET counting, missing source, cancellation, independent ZIP validation; preview failure/retry does not call download API or change admission gates.
- VERIFIED: scoped ESLint passed on component and new test.
- VERIFIED: `node node_modules/typescript/bin/tsc --noEmit --incremental false` completed with exit 0; scoped component `git diff --check` passed. These are non-build checks.
- VERIFIED by diff: API, durable counter, manifest, native POST/request ID, notification consent and route guards untouched. Existing compact sizes/classes retained; no video on compact caller.
- NOT TESTED: actual desktop/mobile screenshots, real browser playback/error/retry, compact visual alignment, public GCS hash/range readback and deployed page. These are not implied by static tests. No authenticated generation/scheduling checks are relevant to this public marketing-only change.
- No build, dev server, browser bundle, push or deployment run. Production cannot include this local change yet. No real download slot consumed.
