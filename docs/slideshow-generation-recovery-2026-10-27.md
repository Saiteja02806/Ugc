# Explore slideshow generation and return recovery — 27 October 2026

Status: **LOCALLY VERIFIED / NOT DEPLOYED**. Live planner output quality and authenticated production acceptance remain **NOT VERIFIED**.

## Request and scope

Remove the two marked permanent **Use my finished slides** buttons in Create and Your slides. Investigate failed generation and preserve progress/results when leaving the workflow and returning. Keep uploads inside Add slides, existing editing/saving, source selection, slide order, account isolation and neighboring workflows.

No dependency, database schema, deployment configuration, worker, provider adapter or publishing change. Rollback boundary is the component/recovery/planner patch listed below; do not revert unrelated worktree changes. The worktree already contained substantial changes and six unresolved merge-conflict paths, which were preserved.

## Production investigation

- Read production Supabase job/plan records through the connected Supabase tool. Runtime-log search on the website project for `slideshow` over the preceding 24 hours returned no records; that alone is not evidence of no request.
- Exact latest saved plan: `e4c021d8-3700-4318-8eb8-e0de3253b800`, created **27 October 2026 12:21:29 UTC / 17:51:29 IST**, updated 12:21:41 UTC. Six source targets, one influencer photo, one website screenshot; server-owned business profile snapshot is present, planner revision 2, model `gpt-5.6-luna`.
- The saved request describes replacing slide 5's phone with a laptop displaying the supplied image. Output contains **zero slides** and asks whether Upload B is a visible UI element or generic brand context, requesting a destination.
- The latest persisted slideshow image jobs are from **22 October**, with completed media assets. There are no new slideshow image jobs for today's clarified plan. A plan row marked `completed` means the planning response was saved, not that images were generated. The API clarification regression confirms 422 occurs before reserving image credits or dispatching image jobs; no live billing change was made.
- Actual production browser navigation to `https://www.getugcpilot.com/explore/slideshows` redirected to `https://getugcpilot.com/sign-in`. Authenticated browser acceptance was unavailable.

This attempt stopped at planning; it was not a running image batch wiped out by changing tabs. The navigation defects below are separate, code-confirmed gaps that can produce a similarly empty screen.

## Changes

1. Remove only the two permanent finished-slide buttons and the unused Create callback. Reference uploads remain under Upload reference slides. Finished images remain available through Add slides → Use my finished slides, using the same file input, limits and fitting.
2. Planner revision **3** explains contextual device replacements: a supplied screenshot linked to a named slide's replacement laptop belongs on that screen, even if the source shows a phone. Competing screenshots/destinations still require clarification. Existing role validation and per-slide execution remain authoritative. Revision participates in the durable hash; old plans are not rewritten or replayed automatically.
3. Previously, completed jobs restored solely from browser hints were reconciled into history without entering current visible results; initial workflow presentation also relied on a job URL parameter. Latest slideshow browser-hinted completions now return to generated results after a clean-route remount. Recovery opens the results view once without repeatedly overriding explicit navigation.
4. Preserve planning questions in a validated owner-scoped browser record, since clarification occurs before a job exists. If the source context changes, show the previous instructions beside the question rather than presenting it as a question about the new source. A subsequent accepted generation clears the obsolete feedback.
5. Recovered batches cannot automatically replace an edited sequence. A browser test caught cached processing receipts triggering auto-assembly after return; auto-assembly now additionally requires this mounted visit's explicit submitted IDs. Ordered recovered versions remain available for deliberate selection.
6. New session clears slideshow-specific browser hints and the slideshow job URL parameter, preserving standalone Studio history. Reload does not resurrect a deliberately cleared batch.

Accepted jobs already execute on the backend independently of the browser. This patch changes recovery/presentation, not worker execution. Completed selection recovery uses this browser's owner-scoped hints; if site storage is cleared, persisted images remain in History, but restoring the prior foreground selection is not guaranteed. Interrupted/unconfirmed submissions retain the existing explicit GET-first recovery mechanism.

## Files changed by this task

- `components/explore/format-slideshow-editor.tsx`
- `components/explore/format-workspace.tsx` — preserves the pre-existing Hook preload changes.
- `components/explore/slideshow-reference-picker.tsx`
- `components/explore/recreate-generation-view.ts`
- `components/workspace/ugc-chat-workspace.tsx`
- `lib/explore/slideshow-generation-recovery.ts` — new validated feedback record.
- `lib/explore/slideshow-generation-recovery.test.ts`
- `lib/explore/slideshow-plan-service.ts`
- `lib/explore/slideshow-plan-service.test.mjs`
- `lib/explore/slideshow-request-plan.ts`
- `scripts/slideshow-click-actions.test.mjs`
- `scripts/explore-slideshow-editor.test.mjs`
- `scripts/explore-format-source-workspace.test.mjs` — preserves prior changes.
- `scripts/slideshow-generation-recovery.browser.cjs` — new actual-panel/HTTP-client fixture.
- `scripts/slideshow-add-slides.browser.cjs` — current Review post/upload names and direct picker behavior; prior fixture selectors were stale.
- `scripts/slideshow-reference-picker-layout.browser.cjs` — current upload name and button-only locator, avoiding the identically labelled file input.
- `EXPLORE_CONTEXT.md`, `CAROUSEL_CONTEXT.md`, `docs/ai-context/clear.md` — appended decisions/evidence.
- This report.

Generated `.tmp/slideshow-*` bundles, logs, screenshots and the unexecuted diagnostic script are local artifacts, not release source. No secrets were written to the report or logs.

## Preflight sources actually consulted

- Root `AGENTS.md`; `EXPLORE_CONTEXT.md`, including current planner follow-up, 22 October automatic assembly, prior recovery/fidelity incidents, 25 October click-reduction and workflow contracts; relevant manual Explore/recovery sections in `CAROUSEL_CONTEXT.md`.
- `docs/ai-context/clear.md`, including UGC-UI-004/005/006/010 and UGC-VID-009 / UGC-OPS-003; `docs/ai-context/nonnegotiables.md`.
- `.agents/skills/ugc-context-memory/SKILL.md`, `ugc-immutable-contracts/SKILL.md`, `ugc-ui-clarity/SKILL.md`, `ugc-video-prompt/SKILL.md`, `ugc-regression-gate/SKILL.md`.
- Installed Supabase `skills/supabase/SKILL.md` for the read-only production investigation.
- Installed Next.js guides under `node_modules/next/dist/docs/01-app/01-getting-started/`: server/client component guide and native-history linking/navigation guidance.
- Actual callers, image panel, pending-submission protocol, background-job client, media-history mapping, slideshow draft/editor persistence, planner/plan compiler and existing tests.
- `python tools/preflight.py --repo . --task "Remove two circled Use my finished slides controls; investigate slideshow generation failures and recover progress/results across tab navigation"` — PASS prerequisite discovery; this is not runtime acceptance.

## Verification

Baseline: 139 existing scoped tests passed before the implementation. Final combined test run: **204/204 PASS**, using:

```powershell
node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/explore/slideshow-plan-service.test.mjs lib/explore/slideshow-request-plan.test.ts lib/explore/slideshow-generation-recovery.test.ts lib/explore/slideshow-generation-groups.test.ts lib/explore/slideshow-composer-draft.test.ts lib/ai-studio/image-generation-api.test.mjs lib/ai-studio/image-history.test.ts lib/ai-studio/pending-generation.test.ts scripts/slideshow-click-actions.test.mjs scripts/explore-slideshow-editor.test.mjs scripts/explore-slideshow-actions.test.mjs scripts/explore-format-source-workspace.test.mjs
```

- `npx tsc --noEmit --incremental false`: PASS on the implementation before final test-only changes; final rerun recorded in `.tmp/slideshow-types.log`.
- Scoped `npx eslint` over changed application, library and test files: PASS on implementation; final rerun recorded in `.tmp/slideshow-lint.log`.
- `git diff --check` over task application/tests: PASS.
- `node scripts/slideshow-generation-recovery.browser.cjs`: PASS. Uses the actual image panel, job/media clients and pending-request client with local fixture HTTP endpoints. Covers completion while unmounted, return without URL hints, reload, explicit draft navigation, cached processing receipts, owner isolation, persistent clarification, accepted-request cleanup, lost acknowledgement GET recovery, scoped New session and no duplicate generation POSTs. Auth and generation/provider responses are fixtures.
- `node scripts/slideshow-reference-picker-layout.browser.cjs`: PASS at 320/390/897/1024/1280/1440/1900px. Preview/remove, source toggles/keyboard, local uploads, long titles and no overflow.
- `node scripts/slideshow-add-slides.browser.cjs`: PASS. Original/generated/upload assembly, 10-slide capacity, failed imports, concurrent-click protection, owned uploads, real 4:5 fitting pixels, reorder/delete, keyboard/touch, text preservation, interrupted save/reload, Create preview save/review and responsive actions. Fixture save/HTTP responses are not real publication.
- No production build run: this patch adds no build/config/dependency changes; focused behavioral checks plus types/lint cover the change. Existing unrelated conflict paths remain unresolved.

Visual artifacts inspected:

- `.tmp/slideshow-add-slides-browser/create-overview-1366.png`
- `.tmp/slideshow-add-slides-browser/arrangement-mobile.png`
- `.tmp/slideshow-reference-picker-layout/selected-1280.png`
- `.tmp/slideshow-reference-picker-layout/selected-390.png`
- `.tmp/slideshow-generation-recovery/completed-desktop.png`
- `.tmp/slideshow-generation-recovery/clarification-mobile.png`

These are isolated real-component fixtures with substituted auth/media/services and fixture fonts/shell. The user's annotated screenshot establishes the two removals; no approved full-app golden baseline was supplied. Full-app before/after pixel parity remains NOT VERIFIED.

## Protected behavior receipt

| Behavior | Status / evidence |
|---|---|
| Two marked buttons absent; finished uploads reachable inside Add slides | VERIFIED locally: rendered control tests and browser upload tests |
| Reference selection/order, source vs person/screenshot roles | VERIFIED at API/compiler boundary; real provider fidelity NOT VERIFIED |
| Completed results on return/reload without a second generation | VERIFIED with actual clients/fixture HTTP; hosted acceptance NOT VERIFIED |
| Existing edits, text, order, saved revision and explicit selection preserved | VERIFIED locally by editor/component/browser regressions |
| Account isolation and corrupt feedback handling | VERIFIED locally; foreign records rejected and old assets hidden after owner change |
| Negative/loading/partial/unconfirmed request handling | VERIFIED in pending-request/API tests and browser lost-response recovery |
| Hook/Wall neighboring workflow contracts | VERIFIED in scoped workspace regression tests; live browser journeys NOT TESTED |
| Schedule picker, timezone, queue and publication | Unchanged by source scope; live scheduling NOT TESTED |
| Actual slideshow image quality and exact screenshot rendering | NOT VERIFIED; no paid image job was started |
| Production release | NOT DEPLOYED; no push/commit/deployment made |

## Incident and approval limits

- Added **UGC-UI-037** and **UGC-OPS-012** as OPEN before implementation; appended code/production evidence and local verification. Production/quality closure is deliberately pending.
- An attempted diagnostic execution was rejected by automatic approval review **before execution**: reading the exact saved private request/reference bytes and sending them to OpenAI for a single planner-only replay lacked explicit payload/destination permission. No replay result exists. The local `.tmp/slideshow-planner-probe.mjs` script was prepared but not run. No workaround was attempted. Explicit user approval is required for that replay.
- All provider outputs in the regression tests are fixtures. Planner prompt improvements are implemented and input/output handoff is tested, but a fresh real-model response is NOT VERIFIED.

Final gate receipt: final combined204/204tests exit0; final TypeScript exit0; final scoped ESLint exit0; final recovery browser including scoped New session exit0. Reference-picker and full slideshow editor browser suites exit0. Task-scoped diff whitespace check passes. No build/deployment, real-model replay or image generation occurred. Existing staged/unstaged user work and unresolved conflicts remain preserved.
