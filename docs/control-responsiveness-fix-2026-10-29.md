# Preview and save control fix — 29 October 2026

Status: **LOCALLY VERIFIED / PRODUCTION OPEN**. Handles UGC-UI-048-CONTROLS. No deployment, publication, paid generation, dependency, migration, configuration or global-style change.

## Result

- Hook, Wall and shared Talking Head previews distinguish a playback blocker from an export/draft warning. Text-fit and unsaved-draft warnings stay visible while playable footage runs. Invalid timelines/crops, missing owned media and required audio still prevent inaccurate playback. Export/composition readiness retains its existing validation.
- Both clip-save actions now have an explicit nearby status and accessible description for their disabled state: authentication/access, pending media, audio, draft loading, structural validation or saving. Failed draft loading keeps the existing reload action. A text-fit warning no longer prevents saving a structurally valid demo draft; exact words, line breaks, geometry, trim and audio are retained.
- Draft loading/saving has a 15-second deadline covering authentication, fetch and response parsing. A token resolving after timeout cannot send a late mutation. Opening/Wall/Talking Head source and soundtrack queries now use the existing bounded, cancellable read helper as well.
- Storage denial/quota failure gives a specific recovery message. The client still requires a durable request identity before sending a save; it does not silently bypass storage safety. Allowing storage and retrying is supported. Retrying an initial failed read preserves current typing; explicit reload of an already loaded draft still performs revision/conflict recovery. Late saves from another selected source cannot replace the current saved state or error.
- The existing action row wraps within its existing mobile header. At 320px all three actions stack; at 360/390px they wrap without horizontal overflow. Desktop action placement, preview/tools split, borders, padding and the 44px toolbar are unchanged when ready.

## Files changed for this fix

Application:

- `components/explore/format-video-editor.tsx`
- `components/explore/format-demo-section.tsx`
- `components/explore/workflow-sequence-preview.tsx`
- `components/explore/wall-schedule-preview.tsx`
- `components/explore/workflow-edit-workspace.tsx`
- `components/explore/hook-workflow-preview.tsx`
- `components/explore/use-clip-draft-save.ts`
- `components/explore/format-video-editor.module.css`
- `components/explore/format-workspace.module.css`
- `lib/explore/clip-draft-client.ts`

Tests:

- `lib/explore/clip-draft.test.mjs`
- `scripts/clip-draft-recovery.test.mjs` (new)
- `scripts/automatic-hook-text-editor.test.mjs` (new assertions; existing concurrent useId fixture addition retained)
- `scripts/explore-format-common-editor.test.mjs`
- `scripts/explore-format-demo-state.test.mjs`
- `scripts/explore-sequence-preview.test.mjs`
- `scripts/talking-head-schedule-preview.test.mjs`
- `scripts/explore-demo-loading.browser.cjs`

Documentation: this receipt, appended entries in `EXPLORE_CONTEXT.md` and `docs/ai-context/clear.md`. The earlier `docs/control-responsiveness-audit-2026-10-29.md` is retained unchanged as the diagnosis record.

Other concurrent changes in Wall profiles/text rendering, Trending automation, business-context handling and sidebar diagnostics were left in place. This receipt does not claim their implementation or complete release acceptance. No staging, commit, push or deployment was performed.

## Preflight and scope

Read the root AGENTS.md, project Explore context, mistake ledger and nonnegotiables; mandatory files were loaded from disk in full and applicable workflow/history sections were reviewed. Relevant historical families: UGC-UI-004 (hidden/unreachable controls), UGC-UI-005 (stale asynchronous media state), UGC-VID-003 (preview recovery), and the current UGC-UI-048-CONTROLS. No historical root cause was assumed from its ledger description alone.

Full skill reads: `.agents/skills/ugc-context-memory/SKILL.md`, `ugc-immutable-contracts/SKILL.md`, `ugc-ui-clarity/SKILL.md`, `ugc-regression-gate/SKILL.md`. `ugc-scheduling/SKILL.md` was also read to confirm the boundary: only preview presentation changes; schedule records, target selection, picker/time conversion, queues and provider execution are outside this patch. Read installed Next.js `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md` before application edits.

Ran `python tools/preflight.py --repo . --task "Fix preview/export gating, explicit blocked-save reasons, draft recovery and mobile action visibility while preserving workflows"`: PASS prerequisites. Existing audit documentation was already modified at entry. The scoped change contract and initial failure evidence were recorded before application edits; no application refactor or new control was introduced.

## Verification

**Final combined behavioral/API/persistence suite: 193/193 PASS.**

```powershell
node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/explore-sequence-preview.test.mjs lib/explore/sequence-preview.test.ts lib/explore/clip-draft.test.mjs scripts/automatic-hook-text-editor.test.mjs scripts/explore-format-common-editor.test.mjs lib/explore/clip-draft-api.test.mjs scripts/clip-draft-recovery.test.mjs scripts/explore-format-demo-state.test.mjs scripts/talking-head-schedule-preview.test.mjs scripts/explore-format-demo.test.mjs scripts/explore-clip-live-controls.test.mjs scripts/workflow-schedule-preparation.test.mjs
```

Log: `.tmp/control-audit/final-regression.log`. Covers exact text/trim/audio, ready and blocked controls, source/audio auth timeouts and cancellation, storage failure/recovery, ambiguous save replay, ownership, revision conflict, stale source responses, reference isolation, media errors, keyboard/touch editing callbacks and export safety. Includes the actual PGlite draft migration contract and an offline video renderer test. No live production mutation is implied.

**Browser: PASS** `node scripts/explore-demo-loading.browser.cjs` outside the sandbox (Edge cannot reliably launch inside it). Uses the actual components, styles, draft-save hook and draft client, with fixture authentication/upload/storage server/provider boundaries. Cases:

- Laptop 1280x720 and 1536x864: edit while uploading, explanatory loading state, save enablement after owned-upload confirmation, actual draft HTTP receipt, Save & return and reopen with retained exact text/trim. Ready toolbar remains 44px and no horizontal overflow.
- Actual final-video playback advances with overflowing text and a visible warning; its exact overflowing draft is saved without rendering. The export warning remains active.
- Dense demo tools at 320/360/390x844: all three actions are fully inside the viewport while tools scroll; no horizontal overflow.
- Shared Talking Head and Wall editors at 1280x720, 390x844 and 320x844: actions and their blocked explanation remain visible and within bounds.
- Hook opening at 1366x768 and 390x844: repeated trim/expand, end-of-clip text, exact sequence timing, local reload and independent timed blocks. Replacement menus/cancel and the separate Demo inventory remain working.

Artifacts under `.tmp/explore-demo-loading-browser/`: `mobile-actions.json`, `dense-edit-mobile-320.png`, `dense-edit-mobile-360.png`, `dense-edit-mobile-390.png`, `confirmed-edit-1280.png`, `confirmed-edit-1536.png`, `overflow-warning-playing-1280.png`, `talking-head-footer-320.png`, `wall-footer-320.png` and corresponding larger-width captures. Before baseline: `.tmp/control-audit/browser/confirmed-edit-1280.png` and `mobile-diagnostics.png`. Visually inspected the desktop before/after pair and final/mobile after images. The desktop pair retains the same geometry; mobile fixes the previously measured right edge at 418.92px on a 390px screen. These are controlled component baselines, not an approved full-production golden screenshot.

**Static:** scoped ESLint PASS; `npx tsc --noEmit` PASS after `npx next typegen` generated the project's route types; `git diff --check` PASS. No package/build configuration changed.

**Production build:** `npm run build -- --webpack` PASS outside the sandbox: compilation, TypeScript, 296 static pages, postbuild native Hook route bundle checks and isolated traced-package startup checks. The initial sandbox build failed on an EPERM mkdir under `.next/server/app/api/jobs/enqueue`; it was retried without changing configuration. The final compiled editor chunk contains the current disabled-save wording.

Test development caught fixture gaps rather than weakening product contracts: useId needed adding to component mocks; the first overflow fixture exceeded the parser's allowed font size and was corrected to the allowed 84px; the added media-read fixture needed a browser window to restore its soundtrack; exact-text browser lookup initially matched hidden duplicate warnings and was scoped to its visible region. The final commands above pass. Intermediate temporary script encoding/newline issues were normalized; no application behavior was altered to satisfy an obsolete test expectation.

## Protected behavior receipt

| Behavior | Status | Evidence / limit |
| --- | --- | --- |
| Exact selected clip, text/newlines, trim, timing, volume and audio roles | VERIFIED locally | Behavioral/editor/sequence suites; browser save/return/reopen |
| Save requires an owned source and confirmed server receipt | VERIFIED locally | API ownership checks, PGlite CAS/replay contract, real client HTTP fixture |
| Ambiguous saves reuse their request; no unsafe storage bypass | VERIFIED locally | Draft transport/session/hook regression tests |
| Invalid media/trim/crop/required-audio blockers and recovery retained | VERIFIED locally | Sequence, clip-control, demo-state and Talking Head suites |
| Text overflow still blocks final export/composition | VERIFIED locally | Actual editor finishing options and existing demo composition tests; preview/draft save remain usable |
| Desktop geometry and established controls | VERIFIED in controlled fixture | Matching before/after images, same 44px ready toolbar, original source actions retained |
| Mobile toolbar visibility and tools scrolling | VERIFIED in controlled fixture | 320/360/390px button bounding boxes; actual browser screenshots |
| Prompt/model/identity/timestamp selection | No implementation change; unrelated generation NOT TESTED | No prompt, model, provider or generation source edit in this fix |
| Schedule picker, timezone, durable jobs/targets and publication | No implementation change; live execution NOT TESTED | Readiness checks retained; no live scheduling/provider calls |
| Authenticated production UI/persistence and full application navigation | NOT VERIFIED | Earlier production browser redirected to sign-in; this local patch is not deployed |

UGC-UI-048-CONTROLS remains production-open. Local fixture success and the build are not claimed as hosted acceptance. Rollback is restricted to this fix's exact source/test hunks; preserve prior audit/history and all concurrent work.
