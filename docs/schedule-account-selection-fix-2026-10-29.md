# Schedule account-selection repair — 29 October 2026

Status: **LOCALLY VERIFIED / PRODUCTION OPEN**. Incident UGC-SCH-013-ACCOUNT-SELECTION. The user explicitly confirmed that one post should support several accounts per platform. This continues the preview/save repairs documented in `docs/control-responsiveness-fix-2026-10-29.md`.

## Findings and implemented behavior

1. `selectWorkflowAccount` always reassigned one platform ID. Clicking a selected account could not clear it, and selecting a second Instagram/TikTok account replaced the first. Independent `accountIds` groups now toggle each card, while legacy single-account fields remain readable and mirror the first selection for compatibility.
2. The account picker disabled all cards during every background refetch. A stalled authentication/read could leave them disabled indefinitely. Publishable cached cards remain interactive while refreshing; authenticated lookup now uses the existing bounded/cancellable read helper across token, fetch and parsing. Submission still revalidates current owner, permission and capability data.
3. Explicit empty choices were removed by form serialization and could be replaced by a fresh single-account suggestion after remount. Empty groups and legacy blank entries survive recovery, and auto-selection skips any explicitly present choice. Turning a platform off still removes its destinations under the established behavior; turning it on is a new platform choice.
4. A selected account that expired was shown unchecked and disabled, so it could not be removed directly. It now remains visibly selected and can be deselected; unavailable unselected accounts remain disabled with their actual reconnection/permission reason.
5. Scheduling receipts rejected more than three targets and duplicate platforms, even though the backend already accepts five distinct accounts. Receipt validation now accepts up to five distinct connection IDs with repeated platforms; owner/source/idempotency checks and exact reply target verification remain intact. Old receipts are not rewritten.
6. Summary counts and target building use every selected account. Missing destinations and the existing five-account server limit have explicit explanations. Unconfirmed requests remain immutable and the UI explains that Try again checks the original accounts; newer choices are retained for a subsequent post rather than silently changing a possibly accepted request.

No provider permissions, TikTok visibility/audit limits, account ownership, plan entitlement, scheduling lead time, date/time picker, timezone conversion, publishing queue or worker logic was bypassed. No styles, permanent controls, dependencies, migrations or production settings were added. No real post was submitted.

## Scope and changed files

Application source:

- `lib/explore/workflow-scheduling-draft.ts`
- `lib/explore/workflow-connected-accounts.ts`
- `lib/explore/format-schedule-draft.ts`
- `lib/explore/workflow-schedule-client.ts`
- `lib/explore/simple-workflow-schedule.ts`
- `components/explore/workflow-connected-accounts.tsx`
- `components/explore/format-schedule-panel.tsx`
- `components/explore/pending-schedule-panel.tsx`
- `components/explore/workflow-finishing-boundary.tsx`
- `components/explore/talking-head-schedule-review.tsx`
- `components/explore/hook-workflow-preview.tsx` (keeps the previous preview-warning repair)
- `components/explore/phone-workflow-preview.tsx` (retained shared caller)

Tests:

- `scripts/workflow-account-selection.test.mjs` (new)
- `scripts/workflow-account-selection.browser.cjs` (new)
- `scripts/workflow-connected-accounts.test.mjs`
- `scripts/direct-schedule-atomic-db.test.mjs`
- `lib/explore/workflow-session.test.mjs`

Documentation: this receipt; appended recurrence/product notes in `EXPLORE_CONTEXT.md` and `docs/ai-context/clear.md`. Existing preview/save work and all unrelated concurrent workspace changes were preserved. No commit, push or deployment was performed.

## Preflight and contracts

Read AGENTS.md, the Explore workflow/recovery/scheduling context, mistake ledger, nonnegotiables, `docs/ai-context/scheduling-contract.md`, installed Next.js use-client guidance, and the full context-memory, immutable-contracts, UI-clarity, regression-gate and scheduling skills in this conversation. The mandatory context files were loaded from disk; applicable incidents and implementation paths were inspected. Ran `tools/preflight.py` for this actual scheduling request: PASS prerequisite discovery. UGC-SCH-013-ACCOUNT-SELECTION was appended before implementation. Historical UGC-SCH-002/003 and current UGC-UI-048-CONTROLS remain separate evidence.

The change boundary was the existing account cards, draft/receipt mapping and posting explanations. Preserve layout, platform names, local time, authored caption/media, account ownership, server target/job persistence, exact retries and all prior working controls. The user then explicitly authorized several accounts on the same platform; the server's existing five-account limit remains the boundary.

## Existing scheduling trace and evidence

| Stage | Actual code / contract | Verification |
| --- | --- | --- |
| Cards and selections | `WorkflowConnectedAccounts` -> `selectWorkflowAccount` -> `workflowSelectedAccountIds` | Real browser: independent same-platform toggle, clear/reselect, background refresh, return/reload; unit tests for blocked and explicit-empty choices |
| Draft persistence | `serializeFormatScheduleDraft` / `readFormatScheduleDraft`; `serializeWorkflowSession` / `readWorkflowSession` | Owner/source-isolated round-trip with multiple IDs and empty groups; time/caption unchanged |
| Pre-submit settings | `workflowScheduleTargets` -> `prepareSimpleWorkflowSchedule` | Every selected ID retained; per-account TikTok capability reads; current owner/permission checks; exact 21:30 Asia/Kolkata ->16:00Z test |
| Prepared-file request | `FormatSchedulePanel` or `WorkflowFinishingBoundary` -> `requestWorkflowSchedule` -> POST `/api/schedules` -> `createUserSchedule` | Existing service/transport tests; stable saved request and exact-target reply verification; no automatic retry mutation |
| Background preparation | `PendingExploreSchedulePanel` -> POST `/api/explore/schedules` -> `reserveExplorePendingSchedule` / `reconcileExplorePendingSchedule` | Route/service/UI/PGlite tests; exact frozen composition and target snapshot; GET recovery does not publish |
| Durable direct creation | `insertDirectScheduledPost` database client -> `create_direct_scheduled_post` | Actual local Postgres/PGlite function: one post, five account targets and five publish jobs; replay creates no duplicates; foreign/duplicate destinations rejected |
| Durable dispatch | Existing `scheduleTargetRowsWithDependencies` / scheduled target jobs / due-time claims | Existing atomic DB and target-scheduling tests preserve target/job correlation, fallback/retry and due-time guards; no scheduler/worker code change |
| Publication and status | Existing `worker/src/jobs/publish-social-post.ts` and provider-specific publishing adapters; server target/provider ID is authority | No provider mutation in this task. Live browser-independent delivery and provider result are NOT VERIFIED |

The database test uses the real existing migrations in an isolated local PGlite database. It creates no hosted schedule and is not evidence that five real provider posts were published.

## Test results

- **156/156 scheduling regressions PASS**: account cards/model, simple scheduling, format draft recovery, Talking Head review, pending UI/route/service, direct schedule service/client/atomic Postgres, pending Postgres, transport deadlines, target scheduling, social-connection policy and schedule-time tests. Log: `.tmp/control-audit/schedule-regression.log`.
- **27/27 recovery regressions PASS**: `lib/explore/workflow-session.test.mjs`, `workflow-draft-lifecycle.test.mjs`, `scripts/workflow-session-ui.test.mjs`, `lib/explore/pending-schedule-client.test.ts`. Includes the new whole-session multi-account/empty-choice round-trip and owner isolation. Log: `.tmp/control-audit/schedule-recovery-tests.log`.
- **193/193 preview/editor regressions PASS again after the scheduling changes**, covering the prior fix, actual draft persistence/replay, exact text/trim/audio and an offline renderer. Log: `.tmp/control-audit/preview-after-schedule.log`.
- **Browser PASS** `node scripts/workflow-account-selection.browser.cjs`: actual account component, scheduling panel, React Query and draft helpers. Confirms same-platform multi-selection, clearing/reselecting, live background refresh without frozen cards, return to Demo/Schedule, reload with cleared choices, clear six-account rejection/recovery, exact four/five-account preflight payload and unchanged21:30; desktop1280 and mobile390/320 have no page overflow. Zero posting writes. Caption/time inputs, authentication, provider capability data and HTTP server are fixtures; actual production picker/provider behavior is not implied.
- **Scoped ESLint and `npx tsc --noEmit` PASS**. `git diff --check` PASS. Production build result is recorded in the final completion update below; earlier attempts safely refused to acquire a lock while another workspace build ran. No lock was removed and no unrelated process was interrupted.

Browser fixture development first exposed alias ordering that loaded real Firebase without fixture credentials; the alias order was corrected. CSS-loader escaping and the post-reload test receipt were corrected in the fixture. No production authentication, account permissions or provider restrictions were changed to satisfy tests.

Browser artifacts: `.tmp/schedule-account-selection/accounts-1280.png`, `accounts-390.png`, `accounts-320.png`, `receipt.json`. Desktop and390px images were visually inspected: existing card hierarchy, borders, selection styling and controls remain. No approved full-production golden baseline was available; no CSS/layout source changed in this scheduling phase.

## Protected behavior and remaining acceptance

- VERIFIED locally: all selected account IDs reach preflight/receipt contracts; repeated platforms are supported; five durable targets/jobs and replay behavior; deselection survives return/reload; current read cancellation; account/source ownership; exact caption and zoned time; meaningful zero-account/over-limit/reconnection states.
- VERIFIED locally: prior preview/save repairs continue to pass; original account-card layout is retained; shared Hook, Wall, slideshow scheduling and Talking Head callers use the same multi-account mapping.
- NOT VERIFIED: authenticated production flow, real provider permissions/capabilities for the screenshot's accounts, hosted post/target/job creation and eventual publication with the browser closed. No live post, schedule, paid generation, production setting or deployment was made.
- Preserve legitimate provider restrictions. A private-only TikTok capability or missing publish permission must remain blocked with its actual explanation rather than being called an application-selection bug.
- Rollback boundary: only these source/test hunks. New drafts retain legacy first-choice fields; older clients will not expose all additional unsent choices. Previously persisted server schedules and immutable request payloads must not be rewritten or automatically replayed as new posts.

UGC-SCH-013-ACCOUNT-SELECTION remains production-open. See the completion update for the final build result.

## Completion update — final build PASS

`npm run build -- --webpack` finished with exit0 after compilation, TypeScript, page generation and all postbuild Hook/native traced-route checks. The compiled Schedule chunks contain the new accountIds mapping and frozen-request explanation. Earlier build lock refusals did not delete locks or interrupt other workspace work. Final evidence is `.tmp/control-audit/schedule-build.log`.

Final local result: 376/376 regressions PASS (156 scheduling +27 recovery +193 preview/editor), desktop/mobile browser PASS, scoped lint/types/diff check PASS, production build/postbuild PASS. UGC-SCH-013-ACCOUNT-SELECTION and UGC-UI-048-CONTROLS remain production-open because this work was not deployed and no authenticated hosted posting test or provider publication was performed. All unrelated concurrent edits are retained.
