# Copy/paste to Codex — read-only audit first

Perform a READ-ONLY UGCPilot regression and generation-pipeline audit. DO NOT MODIFY APPLICATION CODE YET.

You MUST follow the root `AGENTS.md` and read the actual repository's `explore context.md` in full, `docs/ai-context/clear.md`, `docs/ai-context/nonnegotiables.md` and the `ugc-context-memory`, `ugc-immutable-contracts` and `ugc-regression-gate` skills. Then read all feature skills relevant to this audit (`ugc-ui-clarity`, `ugc-frame-analysis`, `ugc-starting-frame`, `ugc-video-prompt`, `ugc-scheduling`). Do not just list these paths; actually inspect content.

Audit:
1. Why a separate Choose Photos tile appears under the loaded starting frame when Change already provides the chooser. Trace the render conditions and selected frame/reference state. Audit the `Restoring your starting frame...` state and loading layout stability.
2. Account/reference selection -> source video -> frame extraction/selection -> influencer identity references -> image-generation prompt -> generated starting frame -> video-generation prompt -> output. Identify why a selected source frame with an occluded face is used, and whether mid-frame anchors preserve their true source timestamp and produce correct post-anchor motion prompts. Investigate full-video reconstruction feasibility with currently used model.
3. Previous interactive 24-hour time picker vs present `HH:mm` field. Check actual schedule validation, selected social targets, timezone conversion, durable persistence, scheduler/queue, worker, retries, failure statuses, idempotency, browser-closed execution.
4. UI changes to the adjacent tabs and shared components. Determine missing regression coverage.

Deliver:
- Paths actually read and relevant context incidents.
- Each issue: screenshot-observed vs user-reported vs code-confirmed, severity, file/function references, reproduction steps, root cause (UNKNOWN if not proven), minimal repair, acceptance and regression test.
- A BEFORE/AFTER baseline capture plan from a known-good approved design; marked-up broken screenshots are not approved baselines.
- Three isolated implementation phases (UI; frame/prompt; scheduler) and rollback boundaries.
- Exact missing inputs needed for a reliable audit, such as real video assets and API/scheduler access.

Do NOT claim the scheduling pipeline or AI prompts are fixed merely because the UI builds. STOP after producing the audit; no application-code edits until the next scoped task.
