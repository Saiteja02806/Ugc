# Device-default time display - 26 October2026

Status: LOCALLY VERIFIED (broad/focused/browser/build/static checks). No deployment or live generation/publishing.

## Scope

User explicitly approves device/browser time format by default while retaining Post now's5-minute rendering lead and simple UI. This supersedes earlier protected24-hour-only presentation. There is no new format toggle, setting or posting-mode section.

Both shared WorkflowTimePicker and main Scheduling rail picker resolve12/24-hour format from navigator language preferences and Intl after hydration.12-hour locales show hours01-12 with AM/PM;24-hour locales retain00-23. Canonical controlled draft/hidden values remain HH:mm. Hour/period changes explicitly convert noon and midnight, never parse local display strings. Display formatting uses a neutral UTC date only to format already-selected clock components, not to convert the post timezone. Language-change events refresh presentation without editing the saved draft.

Applies across shared Explore Hook/TalkingHead/Wall/Slideshow and Trending Carousel/Wall/Reaction/Hook publishing controls plus main Scheduling. Quick slots, manual review summaries and main clock hints use the same formatter. Removed forced24-hour badge/range text from the shared form. All60 minute choices remain available. Existing loading/error/ownership/validation and explicit Post now actions unchanged.

Post now keeps the existing server-owned useDefaultScheduleTime path and configured lead (repository default5minutes), rounded to minute resolution as before. No changes to server lead configuration, render workers, durable targets/jobs, queue registration, UTC conversion or idempotency. Server receipt remains authoritative. Provider publication is not claimed before evidence.

Browser limitation: websites can read browser-exposed locale preferences, not an OS-only12/24-hour override hidden by the browser. No new user preference control was requested or added to work around that limitation.

## Preflight/protected behavior

Actually consulted: AGENTS/user instructions, Explore context and clear history with latest entries, nonnegotiables/scheduling contract, relevant Carousel publishing context, context-memory/immutable-contracts/UI-clarity/scheduling/regression-gate skills and installed Next guides from the preceding work. Existing user/concurrent work preserved. UGC-SCH-008 opened before implementation. Explicit user instruction overrides older skill/contract preference for24-hour UI; exact wall-clock/timezone/backend invariants still apply.

VERIFIED locally: en-US12-hour/en-GB24-hour detection, noon/midnight and21:30 conversions,60-minute precision, no mutation/submission on format detection, no duplicate mode controls, manual validation/account settings, same default-time receipt on retry and local atomic schedule/target/job contracts. NOT VERIFIED: real hosted browser-closed queue/provider execution, production receipts, physical-device clock overrides not exposed to the browser, zoom/physical touch and approved pixel-diff baseline. No production acceptance/deployment claim.

## Verification

- Focused119/119: real main editor callbacks, format draft/summary, formatting functions, direct schedule service/atomic local DB and scheduling contracts. .tmp/device-time-focused.log. Includes midnight/noon, period switches, canonical restoration and existing first-slot replay.
- Main Scheduling browser: en-GB existing full suite plus en-US at1366/390 widths;12AM=00,12PM=12,9:30PM=21:30, no automatic POST, correct selected source/settings and no overflow. .tmp/device-time-editor-browser.log.
- Shared Trending modal/Hook picker browser: existing default/caption/account/visibility/failure/retry regressions; en-GB24-hour controls plus en-US12-hour controls at1366/390; canonical values/no unsolicited submit/no overflow. .tmp/device-time-trending-browser.log. Same shared picker covers Explore workflows.
- Both broad Explore runs PASS1,285/1,285; final run includes localized summary integration. Logs .tmp/device-time-explore.log and device-time-explore-final.log. Groups overlap.
- Production build and final rerun after summary integration PASS, including native route bundle checks. .tmp/device-time-build.log and device-time-build-final.log.
- Final TypeScript/scoped lint/diff checks PASS after summary integration.

Fresh inspected images: .tmp/trending-publishing-preferences-browser/modal-device-12-hour-390.png, .tmp/explore-schedule-review-browser/device-12-hour-390.png. Both have explicit PM controls/time display, stable mobile width and no format-mode section. Corresponding1366px captures and drawer captures saved alongside. Original24-hour en-GB fixtures also pass. Approved before/after pixel baseline unavailable.

Local review fixture refreshed at http://127.0.0.1:3107/?automatic=1 with sample final media/accounts. It does not publish. Main local Next server restarted successfully at http://127.0.0.1:3000. Ready-video fixture refreshed after final changes. Live local inspection confirms en-US browser,12-hour preference, exactly one Post now button and zero Publishing time groups. No credentials extracted or authenticated live post submitted.

## Files changed in this follow-up

Runtime:
- lib/scheduling/time-display.ts
- components/scheduling/use-device-time-format.ts
- components/scheduling/workflow-time-picker.tsx
- components/scheduling/schedule-editor.tsx
- components/explore/workflow-scheduling-panel.tsx
- components/explore/format-schedule-panel.tsx
- components/explore/talking-head-schedule-review.tsx
- components/social/platform-selection-modal.tsx
- components/trending/hook-video-schedule-drawer.tsx

Tests/browser fixtures:
- lib/scheduling/time-display.test.ts
- lib/scheduling/scheduling-database-contract.test.ts
- scripts/schedule-editor-inline.test.mjs
- scripts/explore-format-schedule-draft.test.mjs
- scripts/talking-head-schedule-review.test.mjs
- scripts/explore-schedule-review.browser.cjs
- scripts/trending-publishing-preferences.browser.cjs
- scripts/simple-repeat-scheduling.browser.cjs
- scripts/talking-head-workspace.browser.cjs

Documentation: EXPLORE_CONTEXT.md, CAROUSEL_CONTEXT.md, docs/ai-context/clear.md, scheduling-contract.md and this receipt. Existing unrelated changes in these files preserved; ledger append-only.

Rollback boundary: only device-format helper/hook, picker/label integration and associated tests. Retain prior heading removal, simplified Post now, five-minute delay and shared Talking Head fixes. No new dependency, migration, deployment configuration or worker change.
