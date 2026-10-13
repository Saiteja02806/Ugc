# Explore scheduling and button consistency — 13 October 2026

The scheduling actions previously lived in a separate full-width strip beneath both panels. Review schedule opened the app's general scheduling editor as an overlay. That editor contained important provider settings and final confirmation, but its presentation made the workflow feel like it restarted on another screen.

## Result

- Hook, Wall of Text, Slideshow and Talking Head + Demo keep their scheduling actions inside the right-hand settings card. There is no external footer portal or full-width schedule action strip.
- Review schedule displays the existing editor in the same panel. The finished-media preview stays in the workflow. Inline review omits a duplicate media preview, the modal checklist, body-scroll locking and the global focus trap. General Scheduling and other existing callers retain the default modal presentation.
- Schedule post remains an explicit confirmation. Authentication, account eligibility, provider publishing options, TikTok capability/privacy checks, caption limits, timezone/date/lead validation, exact media/account checks, saved request recovery and duplicate prevention are retained.
- Back retains edited caption, date, time and timezone. Confirmation updates the parent draft so the summary reflects confirmed values. The earlier summary is hidden while review fields are being edited.
- Format reviews remain tied to their exact finished output. Talking Head also pins the reviewed output; replacing that output cannot reuse its inline review.
- Saved Slideshow library items now validate as carousel sources even when there is no editing schedule or secondary video. Submission uses a safe slideshow title instead of dereferencing a null video.

## Button coverage

All four workflows already use the shared Button for their ordinary actions. Removed local overrides for disabled Generate/action-footer/upload actions and workflow-only corner/focus styling. Filter, Clear filters, Try again, slideshow preview Previous/Next and View plans now use that same treatment. Existing click handlers and navigation destinations remain intact.

The Explore landing workflow cards and Quick start cards are navigation links. Their decorative arrows, media controls, thumbnails, switches, selected reference states and stage tabs retain their appropriate navigation/selection presentation. The shared primary and outline Button variants are the baseline for ordinary actions across the application; this change does not migrate unrelated legacy screens.

## Verification and limits

- Final results: 203 workflow/editor checks and 44 scheduling guard checks passed (247 total). TypeScript, scoped ESLint and diff whitespace checks passed.
- Workflow/editor integration and regression checks exercise actual component handlers and effects with isolated browser/network fixtures. Coverage includes action placement, inline presentation, all three format review transitions, Back/reopen retention, changed-output dismissal, exact video/library submission, confirmed-summary values, explicit final submission, no automatic POST, durable request storage, retry and existing modal behavior.
- Separate scheduling guard checks cover time, target requirements, account picking, publishing preferences/settings and finished-video policy.
- Validation logs: `.tmp/explore-inline-final-tests.log`, `.tmp/explore-inline-guards-final.log`, `.tmp/explore-inline-types-final.log` and `.tmp/explore-inline-lint.log`.
- Earlier local browser interaction confirmed that inline review retained the URL, mounted zero dialogs and left body scrolling unlocked. Editing caption and timezone then using Back retained both values, along with date/time. Those checks used the development-only non-publishing fixture at `/e2e/explore-schedule-inline-preview`.
- A later follow-up recovered screenshot access. Fresh shared-panel screenshots show settings and confirmation inside the same workflow frame, with no dialog or navigation. The local preview uses sample media and a non-publishing callback. Older scheduling screenshots predate the action-strip removal and should not be used as proof of this result. Complete authenticated production desktop/mobile acceptance remains pending deployment.
- The fixture is blocked outside development and uses a non-publishing save callback. No production scheduling submission, paid generation or deployment was performed. These presentation changes do not establish a production render-time guarantee.

The implementation agents completed the scheduling and button changes. Additional independent review agents later hit the account usage limit; the main task completed the remaining source review and validation.

Talking Head now also exposes its guarded Prepare final video action directly in Schedule when the publishing output is missing. Progress, refresh, cancellation, errors and explicit retry remain in that card. See `docs/explore-render-delay-audit-2026-10-13.md` for the production timing diagnosis and the follow-up checks.
