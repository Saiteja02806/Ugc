# Schedule footer and viewport — 5 November 2026

IMPLEMENTED locally; targeted checks passed. Not built/deployed. Real signed-in screenshot reproduction and live scheduling/output acceptance remain OPEN.

## Confirmed cause and requested behavior

Slideshow explicitly passed `actionsPosition="top"` to WorkflowSchedulingPanel. That rendered the entire Schedule post/Back to Edit/confirmation block above platforms/accounts/caption/time, exactly matching the reported placement. The other shared callers used an inline bottom action but could put it inside long scrollable content.

The repair removes that top-placement path and portals the **same existing action JSX** into bottom footer slots. Settings and preview can scroll internally; document blank scrolling is constrained for the ordinary-height schedule workspace. Windows521pxand taller use viewport containment; the existing very-short/zoom accessibility fallback remains. No control is removed merely to eliminate scrolling.

The large desktop blank document extension in the user's first screenshot did **not** reproduce in the controlled before fixture. Its exact production cause therefore remains UNKNOWN. Added scoped grid row/height/overflow guards and tested normal/long content without claiming that they prove resolution of the original authenticated case.

## Every file changed in this patch

- `components/explore/workflow-scheduling-panel.tsx`: replace top-placement option with optional bottom `footerTarget`; render the same footer through createPortal when a target exists, otherwise retain inline bottom fallback.
- `components/explore/format-schedule-panel.tsx`: forward active bottom target and pass it through the background/pending branch. All scheduling functions/disabled rules/receipt handling untouched.
- `components/explore/pending-schedule-panel.tsx`: forward target only while active; same actions and guarded handlers.
- `components/explore/format-workspace.tsx`: existing action footer gets a schedule slot and remains visible in Schedule; other mounted action slots stay hidden by their stages.
- `components/explore/hook-workflow-preview.tsx`: Talking Head uses its existing footer's schedule slot for normal and pending branches; hidden normal branch cannot portal a duplicate over pending actions.
- `components/explore/workflow-schedule-review.module.css`: remove obsolete top-placement rule, retain existing palette, bound exceptionally long footer feedback to40dvh with internal overflow so settings remain accessible.
- `components/explore/format-workspace.module.css`: schedule-only viewport/grid constraints and internal settings/preview scrolling for normal-height screens. Existing mobile Controls/Preview visibility and short-window fallback retained.
- `scripts/explore-format-schedule-draft.test.mjs`: verify bottom-only default/portal, active target isolation, all format wiring and preserved actual schedule callbacks/request/recovery tests.
- `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`, this receipt: appended scope/evidence. Global lesson appended to `C:/Users/chund/.codex/mistakes.md` under GLOBAL-20261105-SCHEDULE-ACTION-PLACEMENT.

Format-workspace and Talking Head files already contain unrelated uncommitted changes. Rollback only this patch's schedule-target/footer hunks; do not reset entire files or overwrite concurrent starting-frame/planner/media/security work.

## Shared-caller audit

| Workflow/path | Presentation change | Evidence |
| --- | --- | --- |
| Slideshow Schedule | Top override removed; actions in bottom footer | Actual form/FormatPanel callback tests, desktop/mobile CSS fixture |
| Hook Video and Text on screen | Direct and pending scheduling use same bottom slot | All-format target tests and existing request/receipt tests |
| Talking Head | Normal/pending action JSX goes to existing action footer; inactive branch cannot duplicate | Parent source/wiring and existing state/preparation/action tests |
| Retained Phone | Already has existing bottom WorkflowCreationPanel schedule action; no new target needed | Existing Phone/source tests passed; no phone-specific CSS edit, real route not exercised |

## Functional path and scope

Normal format action remains `schedule()` in FormatSchedulePanel → `prepareSimpleWorkflowSchedule` (current exact source/accounts/time/caption) → `requestWorkflowSchedule` → authenticated `POST /api/schedules` → `createUserSchedule` in `lib/scheduling/service.ts` → existing durable target/job registration and provider publishing lifecycle. No transport/server/service/worker change. Pending actions still call their original `schedule()`/`startAnother()` with immutable recovery receipts; Talking Head still delegates to its existing finishing boundary action.

| Boundary | Status |
| --- | --- |
| Button placement / exactly one active footer / native button handlers preserved | LOCALLY VERIFIED in controlled component/wiring tests |
| Exact accounts/time/caption, changing selection, stale hydration, reload, rejection, uncertain request, repeat intent | LOCALLY VERIFIED by actual-source request/receipt fixtures |
| Portaling never submits merely on mount/tab switch | LOCALLY VERIFIED; zero external calls in target mount/reactivation test |
| Backend authoritative ownership/readiness/durable execution | Existing path inspected, unchanged; NOT live-tested for this presentation patch |
| Actual schedule/target persistence and provider publication | NOT TESTED; no production mutation authorized or performed |
| Palette | Existing action styles/blue retained; no color changes |
| Original signed-in whole-document blank extension | NOT VERIFIED; controlled before did not reproduce the desktop blank extension |

## Commands and results

- Preflight: `python tools/preflight.py --repo . --task "Restore Schedule post to bottom action footer across Explore workflows and contain desktop viewport scrolling; preserve all scheduling handlers/drafts and internal access, no build/deploy"`: prerequisite discovery PASS.
- Read global mistake rules/memory, verify-feature-wiring, scheduling skill/contract, context-memory, immutable-contracts, ui-clarity and regression-gate; refreshed relevant Explore, project ledger and protected contracts, actual callers and existing tests. Historical contradictory hour-format entries were not used to change current picker behavior; date/time conversion/format unchanged.
- `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/explore-format-schedule-draft.test.mjs scripts/explore-pending-schedule-ui.test.mjs scripts/talking-head-schedule-review.test.mjs scripts/workflow-schedule-preparation.test.mjs scripts/workflow-demo-audio-state.test.mjs scripts/workflow-source-video-ui.test.mjs`: **95 PASS**, no skips/failures.
- `npx tsc --noEmit --incremental false`: PASS.
- Scoped ESLint on WorkflowSchedulingPanel/Pending/FormatWorkspace/TalkingHead/test: PASS. Full touched-component lint additionally reports **one pre-existing react-hooks/refs error** at FormatSchedulePanel's render-time `draftRef.current` assignment. Reproduced with the unmodified HEAD file in a temporary same-folder fixture, then removed that fixture. No unrelated ref/state rewrite or suppression.
- Targeted `git diff --check`: PASS.
- `node .tmp/schedule-footer-layout.cjs`: **96 assertions /24 before-after cases PASS** across Slideshow/Hook/TextonScreen shells at1907×967,1440×900,1024×600,390×844. Uses actual current form markup and all relevant current/baseline CSS with controlled accounts/caption/time/slide boxes; portal action positioning is represented in the footer and separately verified in component tests. No bundle/build/server. Confirms exact viewport document height after, visible bottom button, long settings internally scroll to Time, long preview scrolls to last item without extending document, and mobile Controls/Preview switching fits. Zero real HTTP/backend/action submission. Mocked controls are not a full visual golden or authenticated hydrated acceptance.

Example Slideshow measurements after: document/viewport967/967at1907wide,900/900at1440,600/600at1024,844/844at390; button bottoms911/844/556/788respectively, all inside screen. Screenshots in `.tmp/schedule-footer-layout/` and measurements in `results.json`; desktop/mobile and narrow-height results manually inspected. Form fields use simplified local fixtures, not customer's private captions/accounts/media.

## Remaining acceptance / no deployment

Build/devserver/bundling/push/deploy/live post/payment/provider call: NONE. Candidate needs a separately authorized integrated app run to verify portal mounting through actual tab transitions, popovers, keyboard/zoom/short-window behavior, the user's exact blank-space case and native sidebar chrome. Real publish durability remains independent acceptance. Incident UGC-UI-20261105-SCHEDULE-FOOTER-VIEWPORT stays OPEN for those boundaries; local bottom placement is verified. Recording prevention does not guarantee no recurrence.

## Follow-up signed-in verification attempt — 5 November 2026

Actual authenticated local acceptance remains NOT VERIFIED. Read-only listener inventory found no listener on 3000/3001; Test-NetConnection localhost:3000 returned False. CUA initialization and the independent Computer Use node runtime both failed with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`. Playwright tab inventory failed because its browser profile was already in use. No existing browser was killed, profile changed, authentication copied, server started, build triggered, or post submitted. Explicit local compilation authorization requested under the user's standing global no-build rule. Earlier controlled fixture results are not substituted for this missing signed-in evidence.

## Local compilation authorization follow-up — 5 November 2026

User explicitly authorized local development compilation only. Started `npm run dev` (session 25526); Next.js 16.4.2 reported localhost:3000 Ready in 1000ms, and elevated listener inventory confirmed port 3000. Browser access remained unavailable: sidebar CUA still failed after reset (kernel assets os error 3); Playwright profile still in use; no Chrome remote-debugging-port was returned by read-only process inspection. Did not terminate a browser or change a profile. Local HTTP checks did not establish page availability (HTTP000; direct connection timeout), so startup Ready is not page compilation or UI evidence. Signed-in Slideshow/Hook/TextonScreen/TalkingHead bottom action and page-scroll verification remains OPEN. Server left running for user inspection; no new application code, post or deployment.
