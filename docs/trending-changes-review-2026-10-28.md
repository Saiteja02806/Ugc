# Trending changes review — 28 October 2026

Verdict: **not fully correct yet**. Existing regression suites pass, but two additional settings-update tests reproduce defects. This review covers this chat's rounded Automation controls/mobile layout, CTA screenshot and collection backgrounds, saved styles, fixed slide positions, storage migration, automatic scheduling/checkpoints, generation mix, provider interruption recovery and heading/reservation repair. It does not certify unrelated changes from other work in the shared checkout.

## Findings

1. **P1 — An in-flight settings save can undo Pause.** `saveAutomationDraftOrSettings` reads `existing.status` into `nextStatus`, awaits collection lookup and later unconditionally updates status/revision through `updateAutomationRowInStorage`. The update filters only user_id. If Pause commits between the read and this update, the stale save writes `active` again. The SQL execution fence correctly blocks paused rows, but this write makes the row active again, allowing a later sweep to post against the user's newer intent. Reproduced by pausing during the collection lookup: status is confirmed paused, then the save returns and stored status becomes active. Relevant lines: service568,577,609; storage helper256. Fix should preserve concurrent status/revision intent using an atomic conditional settings update, and activation must remain explicit.

2. **P2 — Active settings edits bypass mixed-structure entitlement validation.** `activateSlideshowAutomation` rejects mixed structures for dailyLimit<10 because the generator reserves whole batches of five. `saveAutomationDraftOrSettings` validates only the saved daily counts and collection health, then keeps active status. Starting with an active single-structure setup on a single-batch plan, saving1Educational/2Product returns active instead of rejecting the unsupported combination. The new generation mix supplies50/50, but a single whole batch cannot provide both structures. One format can remain waiting. Reproduced with the same service harness; the expected rejection fails. Relevant lines: service532,568,609 versus664. Apply the same active-state validation to edits; drafts can remain editable.

Reproduction artifact: `.tmp/trending-backend/review-edge.test.mjs`, created from the existing service test harness with absolute imports plus only two added tests and a controlled pause during collection lookup. Both safety assertions **FAIL** for the current implementation; `.tmp/trending-backend/review-edge.log`. The first attempt had a fixture import-path error, corrected before reproduction; that error is not counted as a product defect.

## Checks rerun

| Check | Outcome |
| --- | --- |
| Automation service/schema/database/UI contracts, generation mix, replenishment/reconciliation and direct scheduling/real PGlite SQL |72/72 PASS, `review-app.log` |
| Compiled worker planner, content grammar, scoped repair, Structure2 story/render, generation/edit jobs plus provider/reservation/durable retry tests |104/104 PASS, `review-worker.log` |
| New adversarial settings-update tests |0/2 PASS; both defects above reproduced, `review-edge.log` |
| `npm run worker:build` |PASS, `review-worker-build.log` |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` |PASS, `review-types.log` |
| Scoped ESLint across Automation UI/renderer/service, daily feed, scheduler and changed worker modules |Zero errors; two existing unused-variable warnings (`hasGenericCopy`, `_id`), `review-lint.log` |
| Actual Automation component browser fixture at1440/390 widths |PASS, `review-ui-unsandboxed.log` |

All logs above are under `.tmp/trending-backend/`. Browser rerun required execution outside the sandbox because sandboxed Edge exited during startup. The successful fixture covers pill radii, bounded recovery controls, empty collection, failed load, and no implicit activation. Current desktop/mobile Appearance PNGs were manually inspected: `.tmp/trending-followup/ui-after/appearance-1440.png` and `appearance-390.png`. Fixtures substitute authentication/accounts/backend writes and are not hosted acceptance. CTA render tests exercise actual glyph rendering and image pixels, with provider/storage/scheduling mocked.

Review sources: root AGENTS.md; context-memory, immutable-contracts, scheduling and regression-gate SKILL.md; nonnegotiables; scheduling contract; relevant Carousel/Explore context and incident sections; the two earlier completion receipts; source/diffs and callers across Automation, derived rendering, Library save resolution, daily feed generation, atomic scheduler SQL and worker retry/planning. Supabase skill consulted for the read-only production check. Large context histories were consulted by relevant sections; this receipt does not claim a full reread. Repository preflight passed prerequisite discoverability/readability.

## Production evidence and limits

Read-only hosted SQL confirms the two migrations remain recorded as20261027194354 and20261027194405. There is still exactly one draft/revision9, no execution lease and zero automation slots. Therefore no real automatic schedule or publication can be declared working from this account state. Website/worker rollout and browser-independent provider delivery remain **NOT VERIFIED**. No activation, publishing, paid model request, migration, deployment or application-code change occurred during this review.

Protected behavior: CTA screenshot/collection fallback, original source isolation, exact slide-position decoding, ordinary manual scheduling, pause-at-SQL-handoff and durable replay are **VERIFIED locally** by rerun tests. Concurrent settings-save/Pause ordering and active mixed-settings validation are **FAILED**. Hosted UI, real new model quality, actual object-storage delivery and automatic publication are **NOT TESTED**.

Incident: UGC-TREND-003, linked to UGC-TREND-002/UGC-SCH-011. Existing passing tests do not supersede these failures. Release acceptance should remain open until both findings are repaired and production execution is checked.
