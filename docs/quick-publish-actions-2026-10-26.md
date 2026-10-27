# Quick publish time actions - 26 October2026

Status: initial two-button implementation locally verified; preset/layout superseded by the four-pill clarification below. No deployment or live post.

## Scope

User could not find In1hour/In3hours. Screenshot shows them partially behind an open picker in the shared platform modal; main local review and other independent scheduling forms did not include them. Added a compact shared button row near date/time in main Scheduling, Explore shared form (Hook/TalkingHead/Wall/Slideshow) and Trending Hook drawer. Existing platform modal keeps its row. No new mode-selection sections or duplicate Post now action.

Explicit quick clicks fill date/time in the selected timezone, rounded up to supported minute precision. They use the clock at click time, not at page load; one and three hours are absolute offsets even across DST/midnight. Existing modal's quick actions now also use Date.now. Main form switches from automatic to manual scheduling only after quick selection. Captions/accounts/media remain unchanged. Invalid timezone shows a recoverable error rather than submitting. Post now's five-minute preparation lead and browser-locale display remain unchanged. No API, worker, render, schema, account mapping, queue or provider changes.

## Preflight and protection

Actually inspected current callers/source, existing quick actions, saved contract/history, latest clear/Explore context and applicable mandatory skill procedures already loaded in this continuous task: context-memory, immutable-contracts, UI-clarity, scheduling and regression-gate. New UGC-SCH-009 recorded before implementation. Existing uncommitted user work preserved. User authorizes quick controls; broader redesign and publishing are outside scope.

## Verification

- Focused56/56 PASS: source form/main editor/draft checks plus actual quick-time utility midnight/selected-zone/DST conversion. .tmp/quick-time-focused.log.
- TypeScript/scoped runtime lint/diff checks PASS. .tmp/quick-time-types.log, quick-time-lint.log, quick-time-diff.log.
- Actual main review browser PASS at1366px/390px for both buttons: visible, no request on click, final submission has exact click-relative UTC instant and manual flag, no horizontal overflow. Full existing locale/media/account settings regressions pass too. .tmp/quick-time-browser.log.
- Fresh screenshot .tmp/explore-schedule-review-browser/quick-times-390-1.png inspected: both buttons visible directly above date/time, no additional mode sections, final action remains distinct. Other desktop/mobile captures alongside. User screenshot is problem evidence; no approved golden pixel baseline/physical touch or zoom acceptance.
- Broad Explore and production build currently pending final append.
- Local ready-video preview restarted at http://127.0.0.1:3107/?automatic=1&review=quick-actions. Sample media/accounts, no publishing. Main Next dev restarts after build.

VERIFIED locally: click-time calculation, timezone rollover/DST, form callbacks, no auto-submit, manual selection transport, source/media/account/default settings regressions. NOT VERIFIED: signed-in production roundtrip, provider output, hosted browser-independent publication, actual devices/zoom. No live target/job/provider mutation.

## Files changed

- lib/scheduling/quick-time.ts (new pure click-time utility)
- lib/scheduling/quick-time.test.ts
- components/scheduling/schedule-quick-actions.tsx (new shared two-button row)
- components/scheduling/schedule-editor.tsx
- components/explore/workflow-scheduling-panel.tsx
- components/trending/hook-video-schedule-drawer.tsx
- components/social/platform-selection-modal.tsx (existing quick slots use click clock)
- scripts/schedule-editor-inline.test.mjs
- scripts/workflow-sections.test.mjs
- scripts/explore-format-schedule-draft.test.mjs
- scripts/explore-schedule-review.browser.cjs
- EXPLORE_CONTEXT.md, CAROUSEL_CONTEXT.md, docs/ai-context/clear.md (append-only) and this receipt.

Incident UGC-SCH-009. Rollback only the above quick-action hunks/tests/new shared helper/component; preserve prior device-time and Post now/heading/TalkingHead fixes and all other concurrent work.


## Final user clarification - four single-row pills

User requested5mins (supersedes interrupted30mins request),1hour,3hours,Tomorrow9AM. ScheduleQuickActions now supplies these exact four presets everywhere: Explore shared form, main Scheduling, Trending Hook and shared platform publishing modal. Existing Tomorrow noon/evening chips replaced by the requested four to keep the row compact. Labels follow locale: Tomorrow9:00AM or Tomorrow09:00. Buttons are rounded pills,32px high, nonwrapping flex row with internal horizontal overflow at widths too small for the full labels. No second row and no page overflow.

Presets resolve at click time. Tomorrow means next calendar date in the selected timezone at09:00, not24hours after clicking; year rollover and different local dates across zones are tested. Numeric presets round up to form minute precision. They fill the draft only; final posting remains explicit. The existing Post now five-minute rendering lead is untouched. Five-minute manual selection can still require correction if the user leaves it open until the chosen time becomes too close, consistent with existing lead validation; no silent rescheduling or backend-policy change.

Final changed scope adds shared modal reuse of ScheduleQuickActions and removes its redundant QuickSlot/helper/extra presets; lib/scheduling/quick-time.ts gains quickSchedulePreset; quick-time.test.ts covers exact presets/year/local-date rollover. Existing onDate/onTime callbacks are not called separately with stale captured fields: a single onQuickTime callback updates both date and time atomically. Other runtime integration files unchanged from the two-button implementation.

Focused106/106 PASS, final TypeScript/scoped lint PASS. Main review browser passes every preset at1536/1366/1280/390/320 widths, asserts equal button top coordinates, nowrap/pill shape, no page overflow/no automatic submit, exact UTC requests and selected-zone tomorrow. Shared modal/Hook drawer full browser suite passes with the same exact four labels, one-row geometry and both clock formats. Logs .tmp/quick-pills-focused.log, -types.log, -lint.log, -browser.log and -trending-browser.log. Final build/native bundle checks and broad Explore1,285/1,285 PASS. Prior quick-time broad run passed1,285/1,285.

Images inspected: .tmp/explore-schedule-review-browser/quick-pills-1280.png and quick-pills-320.png. Laptop view shows all four chips; narrow mobile shows internal horizontal scrolling for the final chip, with no wrapping/page overflow. Other widths saved alongside.

Local ready-video fixture refreshed at http://127.0.0.1:3107/?automatic=1&review=quick-pills. No live publication/deployment. User clarified pill layout under UGC-SCH-009; earlier two-chip receipt is historical and superseded.


### Final acceptance receipt
Final four-pill implementation:106/106 focused checks,1,285/1,285 broad Explore checks, TypeScript/scoped lint/diff checks, production build/native route bundle checks and both browser suites PASS. Local live DOM confirms5mins/1hour/3hours/Tomorrow9:00AM, flex-nowrap, identical top coordinates and zero page overflow. Local preview remains running on3107; main Next app3000. No deployment or live social post.


### Small purpose label
User-approved Quick schedule label added above row in components/scheduling/schedule-quick-actions.tsx. Only visual text addition; original four pills/click handlers untouched. Scoped lint, TypeScript, diff checks and actual local DOM verify label above the nonwrapping group. EXPLORE_CONTEXT and clear.md updated (UGC-UI-015). Preview3107 refreshed. Earlier106/1,285/full-build/browser evidence applies to the unchanged behavior; broad tests not repeated for this text-only change.
