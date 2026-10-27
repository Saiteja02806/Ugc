# Five-minute final-submission timing and Demo wording

Date: 27 October 2026. Status: locally verified behavioral/browser checks; hosted acceptance NOT VERIFIED. No deployment or live publishing.

## Requested scope and behavior

Only the `5 mins` shortcut changes timing semantics: remember the relative intent until the final submit action, then use the existing server-owned configured lead calculation (default five minutes, rounded up to supported whole-minute precision). Caption editing delays no longer expire the shortcut's original preview. This applies to Explore's shared form, main Scheduling, the Trending Hook drawer and shared platform publishing modal.

Exact manual date/time remains exact. Editing either field clears relative intent; choosing 1 hour, 3 hours or Tomorrow also clears it and retains those presets' existing selection-time semantics. Captions/account selections preserve the intent. Explore's versioned unsent draft serializer retains it across reload. Old drafts without the marker remain absolute. The marker is client draft state only, not a new API field.

The final request uses the existing `useDefaultScheduleTime` flag. Accepted schedules still use existing server ownership, configured lead, timezone normalization, atomic targets/jobs, queue handoff and idempotency. A retry recovers the stored request and first accepted slot rather than generating another post. Existing Post now behavior is retained. A field populated by the shortcut remains its initial preview until submission; no live-updating time display, new control, stylesheet, or button-label change was added.

Demo empty copy becomes: `No ready demos yet. Upload a video on the Demo screen, then choose it here.` The existing upload flow remains on the surrounding Demo screen.

## Files touched by this task

These files already include substantial unrelated user work. This inventory describes this task's additions, not all differences against HEAD. No existing work was reset or staged.

Runtime:

- `components/scheduling/schedule-quick-actions.tsx`: provide preset as the existing callback's second argument.
- `components/scheduling/schedule-editor.tsx`: keep five-minute intent, resolve on submit, clear on manual/other preset/next-available selection; preserve labels and clock-help geometry.
- `components/social/platform-selection-modal.tsx`: carry intent, validate a fresh relative slot, resolve on final submit; clear on manual edits/reset/other presets.
- `components/trending/hook-video-schedule-drawer.tsx`: carry intent through review, resolve once at final confirmation, preserve manual preview and labels.
- `components/explore/workflow-scheduling-panel.tsx`: set/clear relative draft flag through existing controls.
- `components/explore/workflow-video-asset-picker.tsx`: Demo empty copy only.
- `lib/explore/workflow-scheduling-draft.ts`: optional `fiveMinutesFromSubmit` unsent draft field.
- `lib/explore/format-schedule-draft.ts`: validate and round-trip that flag without changing old drafts.
- `lib/explore/simple-workflow-schedule.ts`: route flagged drafts through the existing automatic-time submission path.

Tests:

- `scripts/explore-format-schedule-draft.test.mjs`: shortcut callbacks, manual overrides, malformed marker rejection, reload and exact lost-reply request reuse.
- `scripts/simple-workflow-schedule.test.mjs`: 20-minute delay, exact manual override, preserved caption/accounts and account rejection.
- `scripts/schedule-editor-inline.test.mjs`: actual editor handlers with delayed final click, date/time/other-preset overrides and unchanged final label.
- `scripts/workflow-source-video-ui.test.mjs`: actual empty Demo picker copy and absence of new upload controls.
- `scripts/explore-pending-schedule-ui.test.mjs`: stale preview, background preparation, durable request and lost-reply recovery without repost.
- `scripts/explore-schedule-review.browser.cjs`: delayed five-minute click at every existing tested width; existing exact-time and UI checks retained.
- `scripts/trending-publishing-preferences.browser.cjs`: both popups, desktop/mobile, delayed final submit and exact manual override.
- `lib/trending/trending-platform-scheduling-ui.test.mjs`: callback fixtures updated for new intent; repaired pre-existing missing quick-action/time-picker/default-mode fixture dependencies while retaining behavioral assertions.
- `lib/scheduling/scheduling-database-contract.test.ts`: directly affected submit-function extraction uses current return boundary; assertion covers both ASAP and relative five-minute branch.

Documentation:

- `EXPLORE_CONTEXT.md`: append explicit new shortcut decision, superseding selection-time behavior for five minutes only.
- `docs/ai-context/scheduling-contract.md`: append confirmation semantics and manual/retry safeguards.
- `docs/ai-context/clear.md`: append UGC-SCH-010, UGC-UI-016 and verification evidence; preserve historical entries.
- `docs/five-minute-submit-fix-2026-10-27.md`: this receipt.

## Preflight and review

Reviewed root AGENTS.md, Explore context and mistake-ledger entries, nonnegotiables, scheduling contract, current status/diffs, all four quick-action consumers, manual handlers, draft/session parsing, direct/pending request receipts and service normalization. Read installed Next `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`. Repository preflight command passed discovery/readability checks:

`python tools/preflight.py --repo . --task "Fix 5 mins quick schedule to resolve at final submit, preserve manual date/time and UI, correct Demo picker empty wording"`

Skills read: `.agents/skills/ugc-context-memory/SKILL.md`, `ugc-immutable-contracts/SKILL.md`, `ugc-ui-clarity/SKILL.md`, `ugc-scheduling/SKILL.md`, `ugc-regression-gate/SKILL.md`. Also reviewed the installed React best-practices checklist: event-driven state, unconditional hooks, memo dependencies, serializable draft state, no additional effects/listeners or fetching. Supabase skill read for local database verification context; no Supabase implementation/schema/hosted changes were made.

Relevant history: UGC-SCH-001/008 preserve interactive device-format time controls; UGC-SCH-002/003 preserve durable scheduling/idempotency; UGC-SCH-007/009 preserve Post now and explicit quick choices; UGC-UI-013/015 forbid extra mode sections and preserve the existing label/pill layout.

## Verification

All test counts below overlap and must not be added together.

| Check | Result | Evidence |
| --- | --- | --- |
| Final focused real-handler/time/draft/Demo/pending recovery tests | PASS 124/124 | `.tmp/five-minute-focused-final.log` |
| Direct service/client/local atomic database, pending service/route/UI and section checks | PASS 63/63 | `.tmp/five-minute-backend-focused.log` |
| Additional final draft/pending lost-reply checks | PASS 40/40 | `.tmp/five-minute-recovery.log` |
| Full Explore suite including worker build and media rendering | PASS 1,287/1,287, zero skips | `.tmp/five-minute-explore.log` |
| Directly affected submission source contract | PASS 1/1 | `.tmp/five-minute-submit-contract.log` |
| TypeScript `npx tsc --noEmit` | PASS | `.tmp/five-minute-types.log` |
| Scoped `npx eslint` over touched implementation/tests | PASS | `.tmp/five-minute-lint.log` |
| Main Scheduling browser suite | PASS at 1536/1366/1280/390/320 widths; delayed five-minute calculation and all other presets | `.tmp/five-minute-after-browser.log` |
| Publishing modal/Hook drawer browser suite | PASS; delay/manual override at 1366/390, plus existing preference/failure/locale checks | `.tmp/five-minute-trending-browser.log` |
| Explore repeat/recovery browser suite | PASS Hook/Wall/slideshow/pending and Talking Head confirmation; desktop/mobile, reload/repeat/double-click/lost reply | `.tmp/five-minute-explore-browser.log` |
| Diff whitespace check over touched implementation/tests | PASS; Git reports existing LF/CRLF normalization notices | command output |
| Production webpack build and native traced-route bundle checks | PASS, exit 0 | `.tmp/five-minute-build-webpack.log` |

The main browser fixture initially could not launch Chromium inside the sandbox; approved outside-sandbox invocation passed. A new popup test initially tried to fill a caption on the separate schedule screen; the fixture was corrected to fill it on the existing details screen. Neither required product UI changes.

The initial sandboxed default Turbopack build stalled during compilation and was stopped. The approved outside-sandbox `npm run build -- --webpack` completed compilation, TypeScript, all 230 static pages, tracing and native bundle checks with exit 0. Build success is local evidence, not hosted acceptance.

The separate wider scheduling source-contract suite was not green: initial combined run 112 tests, 108 pass, 4 fail (`.tmp/five-minute-backend.log`). One failure was an outdated extraction end marker for the changed submit function; repaired and passes targeted 1/1. Three remaining assertions expect removed now/later cards/native time input/forced 24-hour helper text. Those expectations conflict with current user-approved UI documented before this task. Product UI was not changed to satisfy them; the entire wider scheduling suite is NOT claimed passing.

## Protected behavior and visual evidence

| Contract | Status |
| --- | --- |
| Five-minute confirmation uses fresh configured server lead | VERIFIED locally with helper/handler/transport/service tests and popup browser submissions |
| Exact manual wall-clock/timezone and other preset behavior | VERIFIED locally |
| Same caption, source and selected accounts; invalid accounts blocked | VERIFIED locally |
| No request on shortcut/render; saved receipt replay/idempotency unchanged | VERIFIED locally |
| Existing date/time controls, button labels, pill geometry and responsive layout | VERIFIED locally in browser and inspected before/after screenshots |
| Demo copy correction without new controls | VERIFIED in actual component test |
| Create/Demo/Schedule state and unrelated generation contracts | VERIFIED by broad Explore suite; no generation runtime edits |
| Hosted schedule/target/job creation, browser-independent worker and provider publication | NOT TESTED / NOT VERIFIED in production |

Inspected mobile before/after: `.tmp/five-minute-submit/before/quick-pills-390.png`, `.tmp/five-minute-submit/after/quick-pills-390.png`; desktop after `.tmp/five-minute-submit/after/quick-pills-1366.png` with matching baseline saved alongside. Same controls, row geometry and Schedule post label remain. Times differ because tests deliberately advance the clock. Screenshots are local fixtures, not approved production acceptance.

## Limits and rollback

UGC-SCH-010 and UGC-UI-016 are locally verified, production acceptance OPEN. No live schedule ID, target ID, hosted queue job or provider post receipt was created. No deployment, schema/migration, worker, dependency, credential, global CSS or architecture change.

Rollback only this task's five-minute marker/callback/handler and Demo-copy hunks and their tests/documentation additions. Do not reset these files wholesale: their earlier Post now, locale, quick-pill, Talking Head and other user changes must remain.
