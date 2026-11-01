# Slideshow controls and top actions — 30 October 2026

Implemented locally, not deployed. Incident UGC-UI-077-SLIDESHOW-TOOLBAR is locally verified; authenticated production acceptance remains open.

## Interaction concept and control audit

The slideshow is the main canvas. Its header holds the next step, while the sequence holds slide selection and assembly. Existing dark colors, typography, borders and orange primary treatment are retained; the hierarchy comes from grouping and removal of duplicate affordances.

| Existing control | Decision and resulting location |
| --- | --- |
| Review post / Save & review post | One primary action in the preview header in Create and Edit. It saves when necessary, then opens scheduling settings. It does not publish. |
| Save slideshow / Resume save | Retained under More for people who only want to save to Library. The primary recovery action is Resume & review post. |
| Generated slides | Retained under More in Create; its callback and selected results are unchanged. |
| Edit slides / Back to Create | Retained in the header. |
| Library backgrounds | Removed from the sequence as a duplicate. Edit slides → Slide image → Choose from library still opens the same background picker, including selected/all-slide application. Add slides also retains its library source for adding images. |
| Add slides | Retained as the sequence's main assembly action, with generated/reference/library/upload sources unchanged. |
| Earlier / Later | Retained inside collapsed Reorder slides. Pointer/touch dragging and keyboard reorder handles remain available. |
| Remove slide | Removed the duplicate text button. Every thumbnail retains its labeled bin button. |
| Previous / Next and thumbnails | Retained: these navigate the preview without changing order or invalidating the saved output. |
| Post now / Schedule post | Moved the existing slideshow Schedule action group below the Schedule heading, above the settings. One submission action only; its label, validation, confirmation/retry state, Back to Edit and View in Scheduling remain. Other workflows keep their current action position. |

More uses a native disclosure, closes after selecting an action or leaving focus, and supports Escape with focus returned to its summary. The existing empty slideshow Edit footer is hidden because actions now live in the preview header. Upload/restoration/save progress and errors appear just below the header. No new dependency, global design system, API or data migration was introduced.

## Scope and file receipt

Application files:

- `components/explore/format-slideshow-editor.tsx`: header action hierarchy, More, feedback, duplicate controls and collapsed reorder fallback. Save, ownership, library application and generation logic are unchanged.
- `components/explore/slideshow-editor.module.css`: local header/disclosure styling and compact grid row positions for feedback.
- `components/explore/format-workspace.tsx`: hide the now-empty slideshow Edit footer; preserve pre-existing unrelated changes.
- `components/explore/workflow-scheduling-panel.tsx`: opt-in top placement for the existing action node; default placement remains unchanged.
- `components/explore/format-schedule-panel.tsx`: slideshow-only opt-in to top placement; retain the earlier status/link grouping changes.
- `components/explore/workflow-schedule-review.module.css`: scoped top-action divider style.

Verification files:

- `scripts/explore-slideshow-editor.test.mjs`: update assertions to the new control locations, retain recovery/dirty-state tests, add library cancellation/replacement/text preservation regression.
- `scripts/explore-format-schedule-draft.test.mjs`: assert exactly one action node and opt-in order before caption settings.
- `scripts/slideshow-add-slides.browser.cjs`: exercise More and Escape/focus, header location, missing duplicates, desktop/mobile/320px and named workflow container; update interaction setup for relocated actions.
- `scripts/simple-repeat-scheduling.browser.cjs`: assert slideshow final submission precedes caption settings while retaining cross-workflow scheduling tests.

Documentation: `EXPLORE_CONTEXT.md`, `CAROUSEL_CONTEXT.md`, `docs/ai-context/clear.md`, and this report.

Rollback boundary: these rendering, scoped styling and regression assertions only. The worktree contains unrelated intentional changes, which were preserved. No branch, commit, push or deployment was made.

## Preflight context receipt

Consulted root AGENTS.md, Explore/Carousel context and relevant historical sections, clear.md and nonnegotiables.md, scheduling-contract.md, installed Next `use-client.md`, and the ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-scheduling, ugc-regression-gate and frontend-design skills. Large context output was truncated; targeted follow-up reads covered slideshow action, library, recovery and scheduling history. Relevant protections: UGC-UI-006 draft recovery, UGC-UI-037 duplicate controls, UGC-UI-075 clarification, UGC-UI-076 confirmation links, UGC-SCH-001/002 scheduling semantics. Current scheduling-contract device-default hour-cycle policy remains authoritative.

`python tools/preflight.py --repo . --task <slideshow toolbar request>` passed prerequisite discovery. Inspected git status, targeted existing diffs, editor state/persistence/callbacks, workflow callers, library picker and schedule form. Source confirms the removed background button called the same `openLibrary("background")` path retained in the image inspector. The new user request supersedes older guidance putting slideshow Save/Review below the sequence.

## Verification and protected behavior

- **VERIFIED, local:** 150 focused tests passed. Command: `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/explore-slideshow-editor.test.mjs scripts/explore-slideshow-actions.test.mjs scripts/explore-slideshow-reference-import.test.mjs scripts/workflow-image-collection.test.mjs scripts/explore-format-schedule-draft.test.mjs scripts/explore-pending-schedule-ui.test.mjs scripts/talking-head-schedule-review.test.mjs lib/explore/pending-schedule-client.test.ts lib/explore/workflow-schedule-transport.test.ts`.
- **VERIFIED, local:** TypeScript `npx tsc --noEmit --incremental false`, scoped ESLint on all changed TSX/scripts, and scoped `git diff --check` pass.
- **VERIFIED, fixture browser:** `node scripts/slideshow-add-slides.browser.cjs` passes before and after. Covers original/generated/uploaded sources; ten-slide capacity; import errors and double clicks; text and selected identity; pointer, touch and keyboard reorder; thumbnail removal; save/reload; fitted 9:16 and square uploads; More hiding, selection, Escape/focus; header placement and no overflow at 1366,1536,390,320 widths; actual named workflow CSS container at 1366/390/320.
- **VERIFIED, fixture browser:** `node scripts/simple-repeat-scheduling.browser.cjs` passes desktop/mobile pending, Hook, Wall and slideshow plus Talking Head presentation. Covers saved status/link grouping, new slideshow action placement, reload without POST, repeat an hour later, double clicks and lost acknowledgement reconciliation.
- **VERIFIED, local source/tests:** save-only and combined review retain exact pending request identity; stale saved actions cannot navigate after edits. Library cancellation preserves confirmed output; applying a background preserves words/order and invalidates saved output. Minimum-slide, busy, upload, generation and restoring guards remain. Other workflows retain default action placement and pass the fixture regression.
- **NOT TESTED in production:** authenticated workflow, durable hosted save/schedule/target/job records, browser-independent worker execution and provider publication. Fixture responses do not establish live acceptance or publication. No real save/post, private model replay or paid generation was performed. Generation prompts/model/timestamp mapping were not changed.

Save still runs through the existing locked request snapshot → `/api/explore/slideshows` → verified Library output → explicit navigation callback. Final scheduling still uses `prepareSimpleWorkflowSchedule` / `requestWorkflowSchedule` → authenticated `/api/schedules` → `verifySavedSchedule`; only action rendering moved. Backend claims require separate hosted evidence.

Initial browser launch required sandbox escalation for Edge. Intermediate browser failures were old selectors targeting controls now inside More, and a long-rail drag setup relying on the old footer's scroll position. Updated tests open More and explicitly scroll the drag handle into view; final runs pass. The browser fixture now declares UTF-8 to display its existing text correctly.

## Visual artifacts

Artifacts/logs are under `.tmp/slideshow-toolbar-20261030/`:

- `before-create-overview-1536.png`, `before-preview-save-390.png`: baseline captured before application changes.
- `after-preview-save-1536.png`, `after-preview-save-320.png`: preview header reviewed visually.
- `after-compact-header-320.png`: compact editor header/sequence reviewed visually.
- `before-schedule-mobile.png`, `after-schedule-mobile.png`: final action placement reviewed visually; `after-schedule-desktop.png` also captured.
- `baseline-browser.log`, `after-browser-final.log`, `schedule-browser.log`, `final-tests.log`, `final-types.log`, `final-lint.log`.

These show real components with local fixture APIs, rather than authenticated production screens. The user's marked screenshots are problem evidence, not approved final golden baselines.
