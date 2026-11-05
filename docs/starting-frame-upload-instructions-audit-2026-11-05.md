# Starting-frame upload and instructions-only local audit

Date: 5 November 2026. Status: IMPLEMENTED / LOCALLY VERIFIED; live UI and output acceptance OPEN. No build, deployment, production configuration change or paid generation performed. ReAPI routing retained.

## Scope and behavior

- Hook Video, Talking Head and Text on screen: Starting frames picker now offers Upload starting frame, accepts one PNG/JPEG/WebP, saves it through the existing authenticated media pipeline and selects it as the opening image. Previously uploaded starting frames are reusable from this tab.
- Generated frames retain their actual generated-job/source receipts. Uploaded frames use a distinct owned asset identity; they never invent source timestamps, source references or image-generation receipts.
- Owner-scoped restoration resolves saved asset IDs rather than trusting saved URLs. Explicit extra person-photo selections remain a separate role. Unsupported model combinations fail before billing and retain selections.
- Hook Video and Text on screen: after leaving Recreate without approving a frame, Use instructions alone replaces the old Create starting frame action in that prerequisite card. It copies the current selected source's exact generation prompt into Your instructions and clears hidden image/video/audio and source declarations. Editing and normal prompt-only submission remain available. Missing prompts and pending accepted submissions are guarded. Talking Head uses its separate script/preparation UI and does not render this shared prerequisite card.
- Rollback boundary: these upload and explicit handoff paths only. Preserve unrelated dirty-worktree changes. Before any future release, roll out the worker upload consumer before API admission of the new job shape.

## Evidence and protected behavior

| Boundary | Local evidence | Status |
|---|---|---|
| Starting-frame tab action | Actual shared library and upload hook invoked; exact project/owner selection verified | VERIFIED locally |
| Existing person-photo upload and generated library | Shared picker/component regressions retained; frame and identity roles tested separately | VERIFIED locally |
| Async failures and stale completion | Failed upload blocks replacement, account changes ignore late result, owned library IDs reusable | VERIFIED locally |
| Restore and person-photo state | Generated legacy v1 retained; uploaded v2 resolves ID; no-job photo restore finishes; explicit empty/edited choices survive | VERIFIED locally |
| Upload serialization and admission | All three workflows through both admission paths; owner/project/readiness/type/dimension/size checks reject invalid inputs | VERIFIED locally |
| Worker consumption | Real current worker handler and ReAPI adapter tests verify canonical uploaded asset becomes first-frame argument, with no fabricated job receipt | VERIFIED locally with external services substituted |
| Instructions-only | Actual parent/composer handlers, source A-to-B, exact editable prompt and real request serializer; no old media/source references | VERIFIED locally |
| Generated frame path and pending recovery | Existing source receipt, source/identity roles, request identity and recovery checks retained | VERIFIED locally |
| Neighboring scheduling | Existing mounted footer target, saved slideshow output and return-to-edit regression verified; no scheduling implementation change here | VERIFIED locally |
| Desktop/mobile browser and real signed-in upload | Browser control unavailable; no fresh before/after screenshot or live storage upload | NOT TESTED |
| Real provider/output | No paid generation, real queue or final clip QA | NOT TESTED |

## Validation

360/360 PASS, zero skips, using current sources (no build):

```powershell
node --import ./scripts/next-server-only-test-loader.mjs --import ./scripts/worker-source-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --test-concurrency=2 scripts/hook-starting-frame-navigation.test.mjs scripts/starting-frame-upload-library.test.mjs scripts/explore-reference-images.test.mjs scripts/explore-format-reference-upload.test.mjs scripts/hook-composer-selection.test.mjs scripts/starting-frame-animation-references.test.mjs scripts/starting-frame-photo-carryover.test.mjs scripts/explore-format-generation-ui.test.mjs scripts/explore-format-source-workspace.test.mjs scripts/workflow-generation-api-contract.test.mjs scripts/workflow-generation-atomic-api.test.mjs lib/ai-studio/video-generation-api.test.mjs worker/src/jobs/generate-hook-video.test.mjs worker/src/lib/reapi.test.mjs
```

Additional 25/25 PASS: `node --test scripts/workflow-creation-form.test.mjs`.

App and worker TypeScript PASS: `node node_modules/typescript/bin/tsc --noEmit --incremental false` and `node node_modules/typescript/bin/tsc -p worker/tsconfig.json --noEmit --incremental false`. Targeted ESLint PASS; `git diff --check` PASS with existing line-ending advisories.

Logs: `.tmp/starting-frame-upload-combined-final.log`, `.tmp/starting-frame-creation-form-final.log`, `.tmp/starting-frame-final-types.log`, `.tmp/starting-frame-final-worker-types.log`, `.tmp/starting-frame-upload-final-lint.log`.

Initial combined run hit Node EPERM at process startup in the atomic API suite; isolated 10/10 and final bounded-concurrency combined run passed. Expanded tests exposed an obsolete undefined Schedule action target expectation; test now mounts the actual existing target. Generated navigation fixture now includes its required real-job identity, with a separate uploaded-frame case. Three baseline creation-form expectations now match existing Omni duration/default and Kling 4 contracts. No runtime model or scheduling behavior was changed to satisfy these tests.

## Files changed for this task

Shared UI and state:

- `components/explore/use-starting-frame-uploads.tsx` (new)
- `components/explore/format-generation-references.tsx`
- `components/explore/talking-head-photo-library.tsx`
- `components/explore/workflow-creation-form.tsx`
- `components/explore/hook-workflow-preview.tsx`
- `components/explore/format-workspace.tsx`
- `components/explore/recreate-generation-view.ts`
- `components/explore/starting-frame-animation-references.tsx`
- `components/explore/use-hook-composer-selection.ts`
- `components/explore/use-starting-frame-photos.ts`
- `components/video/video-generation-workspace.tsx`
- `app/e2e/hook-keyframe-preview/preview.tsx` (type compatibility only)

Contracts, client, backend and worker:

- `lib/explore/uploaded-starting-frame.ts` (new)
- `lib/explore/format-reference-images.ts`
- `lib/explore/hook-composer-selection.ts`
- `lib/explore/starting-frame-photo-selection.ts`
- `lib/explore/starting-frame-animation-input.ts`
- `lib/explore/workflow-generation-client.ts`
- `lib/ai-studio/reference-media-upload.ts`
- `lib/ai-studio/video-generation-api.ts`
- `worker/src/jobs/generate-hook-video.ts`

Tests:

- `scripts/starting-frame-upload-library.test.mjs` (new)
- `scripts/explore-format-reference-upload.test.mjs`
- `scripts/hook-composer-selection.test.mjs`
- `scripts/explore-reference-images.test.mjs`
- `scripts/starting-frame-photo-carryover.test.mjs`
- `scripts/hook-starting-frame-navigation.test.mjs`
- `scripts/explore-format-generation-ui.test.mjs`
- `scripts/explore-format-source-workspace.test.mjs`
- `scripts/workflow-creation-form.test.mjs`
- `lib/ai-studio/video-generation-api.test.mjs`
- `worker/src/jobs/generate-hook-video.test.mjs`

Memory/receipt: append-only `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`, this report, and `C:/Users/chund/.codex/mistakes.md`. Existing unrelated changes in shared files were preserved.

## Preflight and incidents

Read AGENTS.md, global mistakes, relevant complete Explore context/incident sections under the user's existing full-read exception, full protected contracts, local Next client guidance; applied full ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-starting-frame, ugc-regression-gate and verify-feature-wiring instructions. Ran `python tools/preflight.py --repo . --task "Add an owned upload as literal Starting frames in Hook, Talking Head and Text on screen"`.

Project incidents: UGC-UI-20261105-STARTING-FRAME-UPLOAD and UGC-UI-20261105-REFERENCE-INSTRUCTIONS-ALONE. Reusable global lesson: GLOBAL-20261105-UPLOADED-FRAME-AND-INSTRUCTIONS-HANDOFF. These remain open for live acceptance, not declared completely solved from local tests.

## Exact remaining acceptance

When browser control is available, sign in and upload/reselect/reload a starting frame in each of the three workflows; compare desktop/mobile geometry and existing Change/person-photo controls. Exercise source A-to-B and Use instructions alone in Hook/Text on screen and inspect the real serialized request. A separately authorized real provider run must prove uploaded frame adherence and person-photo consumption on supported ReAPI combinations. Neither local adapter payload checks nor a completed job proves final output quality.
