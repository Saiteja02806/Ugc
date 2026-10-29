# Schedule confirmation and fresh-tab Hook generation — 29 October 2026

## Changes
1. PendingSchedulePanel replaces the long confirmed-preparing sentence with Post scheduled and moves its single View in Scheduling link into that same status row, above the existing actions. Link text is 12px, arrow 14px, with compact spacing and a larger coarse-pointer hit area. Back to Edit/Schedule post size, callbacks and form remain unchanged. Preparing/scheduled receipts retain the link; failed/cancelled/unconfirmed messages retain their actual status. No success link without a confirmed receipt.
2. VideoGenerationStudioPanel previously derived workflow busy state from all durable jobs found through shared browser hints. A fresh tab therefore saw another tab's job as active and propagated busy to Recreate. Busy/loading/error/automatic foreground ownership now use the tab's explicit URL job or current submissions for workflow composers. Other jobs stay in shared recovery/history and billing refresh; standalone Studio retains its previous job behavior. No request, model, provider, limit, ownership, idempotency, source-image, text, timestamp or saved-edit changes.

## Exact files for this task
components/explore/pending-schedule-panel.tsx
components/explore/workflow-schedule-review.module.css
components/video/video-generation-workspace.tsx
scripts/explore-pending-schedule-ui.test.mjs
scripts/explore-format-generation-ui.test.mjs
scripts/schedule-confirmation.browser.cjs
EXPLORE_CONTEXT.md
docs/ai-context/clear.md
docs/schedule-confirmation-and-tab-isolation-2026-10-29.md
Prior uncommitted direct photo-dialog and account-avatar changes are preserved, not reset.

## Preflight and protection
Existing AGENTS, relevant Explore/incident sections under the user's relevant-sections authorization, nonnegotiables, scheduling contract and context-memory/immutable-contracts/UI-clarity/regression/scheduling skills read in this session. Next use-client guide read. Read-only preflight passed for this actual task; current tree inspected before changes. UGC-UI-060 and UGC-UI-061 added before editing. Components, current busy/foreground/history/pending request paths and existing tests inspected.

Minimal rollback boundary is the three application files listed above. No production or database operation. Scheduling/account selection, caption, quick presets, device time format/timezone, actions, saved receipts, pending recovery and server jobs remain unchanged.

## Tests and status
- PASS 113/113 actual-component VM generation + pending scheduling tests: explicit running job remains busy; another fresh Hook composer with the same shared job hints stays usable and submits its own starting-frame input; the first composer remains busy. Confirmed preparing/scheduled states contain one compact inline link before buttons; unconfirmed states have none. Existing schedule recovery/repeat-post and stale poll tests pass.
- PASS 22/22 pending-generation/discovery/schedule-draft recovery tests. Exact idempotent uncertain request recovery remains protected.
- PASS local desktop/mobile footer browser using actual PendingSchedulePanel output from the same isolated read-only fixture: status and link centered on one row, link before buttons, 12px text and mobile bounds. Shared Button/Link/icon nodes serialized for the footer geometry fixture; this is not authenticated full-page browser acceptance.
- PASS TypeScript --noEmit, scoped ESLint, browser script lint, git diff --check. Initial local script loader/encoding errors were corrected; no application runtime failure was inferred from those test setup errors.

VERIFIED locally: status/link layout, existing schedule actions/state, new fresh-composer independence, shared history retained, original-job active state, backend/pending request semantics unchanged.
NOT TESTED: two authenticated production tabs, real simultaneous paid submissions, generated outputs, server publication, full hosted page or production build. No deployment or media generation.

## Limits
An explicit URL pointing at a running job is still an intentional resume and remains active. This patch does not give duplicated same-job URLs different job identities. Existing owner/kind/scope pending-submission locks and uncertain-request recovery remain shared and conservative; simultaneous unconfirmed submissions may still ask the user to recover the saved request. Changing that boundary safely requires separate per-draft recovery design, not disabling idempotency. The identified shared-history processing blocker is addressed; full concurrency under ambiguous network outcomes is not claimed.

## Artifacts
.tmp/workflow-status-tabs-tests.log
.tmp/workflow-status-recovery.log
.tmp/workflow-status-tabs-types.log
.tmp/workflow-status-tabs-lint.log
.tmp/schedule-confirmation-browser.log
.tmp/schedule-confirmation/confirmed-1280.png
.tmp/schedule-confirmation/confirmed-390.png
