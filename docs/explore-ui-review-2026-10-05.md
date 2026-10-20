# Explore UI verification — 5 October 2026

Baseline: `53e70c8071019757f8b7a6ba1dc9c443565d2e3b`.
Branch: `codex/explore-duration-demo-polish` in the safe reconciliation checkout.
This update is not yet committed, pushed, or deployed. Unrelated changes in the original desktop checkout were preserved.

## Implemented

- Create Hook and Creator Phone share presets 5/10/15/20/30 seconds, filtered by each model's existing API contract, plus a validated Custom dialog. Cancel preserves the confirmed value. Kling's discrete supported values are preserved.
- Both workflows label section 2 **Edited demo**, without changing section identity, original sound, demo-only background audio, or combined subtitles.
- Instagram and YouTube can remain selected together. Each needs an explicit connected account with existing publishing permissions. The existing confirmation editor receives both targets. Exact-request recovery remains intact and partial acknowledgements are rejected.
- Landing **Start Posting** points to Explore. The signed-out hero carries an allowlisted Explore sign-in continuation; paid checkout intent still takes precedence.
- Recreate browsing no longer has a subscription gate. Catalogue authentication and generation access/credit checks remain intact. Settings are compact inline pills with a scrolling chevron. The composer is shorter and first-use guidance explains reference selection and recreation. Existing format order, category mixing, selection, and draggable splitter are preserved.

## Media repair

The imported catalogue was `staged`, so the authenticated API correctly excluded it. Removing the free-user UI gate alone would not restore slideshows.

The existing guarded importer uploaded/verified 342 approved assets under `gs://ugcsaas-media/explore/recreate/v1/`, then marked the catalogue `published`. It checks existing size/type, refuses incompatible overwrites, and verifies every upload. No objects were deleted or bucket permissions changed.

A public HEAD check covered 494 distinct media URLs used by the catalogue: **494 accessible; zero failures**. Cloud assets are ready, but the updated catalogue and UI still require an app deployment.

## Verification

- Application TypeScript (`--noEmit --incremental false`): passed.
- ESLint across changed TS/TSX and new components/helpers (`--max-warnings=0`): passed.
- `git diff --check`: passed.
- Full offline Explore regression suite, serial with the repository test loader/module mocks: **345 passed; zero failed**.
- Four new tests exercise the actual Custom control, including Apply/Enter validation, Cancel, accessible confirmed seconds, and discrete model limits: **4 passed**.
- Final targeted rerun after the duration accessibility refinement: **47 passed**. These overlap the above tests, not additional unique coverage.
- After refining the return chevron to restore the first pill rather than trapping navigation mid-rail, **23 related tests passed** and lint remained clean. Browser geometry confirmed a return to `scrollLeft: 0`.
- An earlier concurrent run had a native video-finishing test-process failure. All eight isolated media-finishing tests and the full serial suite passed. No worker/rendering code was changed to mask it.
- Browser preview: menus, Edited demo and simultaneous platform selection verified for workflows 1 and 3. Recreate's three formats populated; chevron and reference/slide selection verified. Narrow-screen layout had no horizontal page overflow or broken visible images. Recreate and Creator Phone browser error logs were empty.

No database migrations, worker changes, production credential/access changes, paid generation calls, or social posts were made. This new update has not had authenticated production acceptance or real publication testing. Local previews intentionally disable spending.

Review screenshots: `C:/Users/chund/OneDrive/Desktop/UGC/.tmp/explore-ui-review-20261005/` (`duration.jpg`, `schedule.jpg`, `phone-duration.jpg`, `phone-edited-demo.jpg`, `phone-schedule.jpg`, `recreate.jpg`, `recreate-mobile.jpg`). These are generated review artifacts, not application assets.

## Follow-up: balanced Recreate layout

- The editor now defaults to 32% of available desktop space, bounded to 320–420px. Manual resizing retains its existing 220–560px limits and gallery-space protection.
- The Recreate gallery is capped at three columns, switching to two when its own container is narrower than 660px. Other workflows' grids are unchanged.
- Gallery posters and hover videos fill their cards with `object-cover`, without stretching. This can crop the thumbnail edges. Opened previews retain `object-contain`, original dimensions, and the complete source image/video. No source assets were edited.
- Browser measurements at a 1280px viewport: editor 347px (previously 220px), three columns. At 1920px: editor 420px, still three columns. Mobile 390px: two columns, hidden splitter, no horizontal page overflow. Temporary viewport overrides were reset.
- Dragging, keyboard limits, and Enter reset verified. Selected reference and typed prompt survived resizing. Full preview proportions matched the original. Test selection/prompt were cleared after verification; no generation was submitted.
- 30 related offline tests passed. TypeScript, ESLint and whitespace checks passed. The optimized production build passed with the existing public Firebase client configuration supplied to the build process only. An initial build without that configuration compiled but failed Firebase prerender initialization; no application workaround or private environment-file copy was made.
- Browser error log was empty. Screenshot: `recreate-balanced.jpg` in the review directory above.

These follow-up changes are local and uncommitted; they have not been pushed or deployed. Authenticated production acceptance remains pending deployment.

## Follow-up: compact Recreate composer

- The chat box is inset by 8px on each side of its existing space and capped at 340px. When the desktop editor is narrowed below 300px, it uses the full available inner width instead.
- Compact prompts now grow from 40px to 72px. Standard and non-compact unified generators retain their previous sizing. Selected-reference context still expands normally.
- The footer uses one row for the reference control, scrollable setting pills, chevron, and Generate button. Below a 300px editor width it stacks instead of squeezing the controls.
- Setting pills are 24px high; Generate and attachment buttons are 28px high. Labels, focus treatment, settings handlers, validation, and paid-generation locking are retained. Panel balance and the three-column gallery are unchanged.
- 59 targeted tests passed, including three tests executing the real composer with isolated React/textarea mocks. TypeScript, ESLint, the optimized production build, and read-only Git whitespace checks passed.
- Two pre-existing static assertions were outdated before this change: the old compact height and an assumption that quantity `disabled` immediately followed its label. Assertions now check the requested sizing and the actual quantity control's unchanged disabling condition.
- Browser binding was blocked by the browser safety policy. No alternate browser, indirect browser command, or synthetic screenshot was used. Visual layout acceptance and a new screenshot remain unverified; `recreate-balanced.jpg` shows the preceding layout, not this compact-composer update.

The user requested an image of this latest update. A fresh browser capture still requires access to a user-opened preview tab. No commit, push, deployment, media generation, or social publication occurred.

## Follow-up: chat box follows divider resizing

This follow-up starts from `8207241` on `codex/deploy-trending-explore-audio-20261005`. Earlier sections above record earlier verification stages.

- Root cause: the compact composer had `max-width: 340px`. The splitter changed the editor width correctly, but the chat box stopped expanding at that cap and stayed centered inside a wider editor.
- Removed only that width cap. The composer retains its percentage-based width and 8px side insets, so it expands/contracts with the editor. The narrow-pane full-width override, short prompt height, small buttons/pills, and three-column gallery are unchanged. The shared selector covers both Image and Video mode.
- Added tests executing the actual splitter and width helper with isolated React/browser mocks. Left/right drag updates, release, cancellation, keyboard limits/reset, container-size bounds, and stable child identity passed. A CSS regression assertion failed against the old fixed cap and passed after the correction.
- 61 targeted tests, TypeScript, ESLint on the changed tests, and Git whitespace checks passed. These are code/event-state checks, not fresh rendered browser measurements. Browser visual verification remains pending; the earlier browser-policy block was not bypassed.

This resize correction is local and uncommitted, not pushed or deployed. No source files in the original desktop checkout, backend jobs, generation access, database, cloud configuration, or social publishing behavior were changed.

## Follow-up: remove Recreate History button

- Both Image and Video mode now hide History in the normal Recreate screen, not just local preview. The History drawers also stay closed in Recreate. Stored results, history loading/recovery, and History controls outside Recreate are unchanged.
- An empty Recreate screen has no leftover toolbar row. Existing New session actions remain available after a completed result; prompt/settings/resize controls are unchanged.
- Four tests evaluate the actual toolbar and drawer visibility expressions for both modes, checking Recreate, preview, generation in progress, completed results, and standalone History access. The combined related suite passed 71 tests; TypeScript, ESLint, and whitespace checks passed. React review found no new effects, requests, component remounts, or access-control changes.
- This removal and the preceding resize correction remain local and uncommitted. No push/deployment or fresh browser screenshot was performed; rendered visual acceptance remains pending.

## Follow-up: intermittent Explore workflow navigation investigation

- Inspected the live `8207241` baseline's Explore workflow cards, AI character card, quick starts, destination pages, shared route/auth boundaries and navigation handlers. The cards already use valid Next links; no card click cancellation, disabled state or global navigation lock was found. The existing workflow unsaved-change guards are scoped to their own back links and clean up their unload listeners.
- Verified a loading-feedback gap: Explore had no `loading.tsx` boundary or link-pending indicator. Its destination pages await runtime search parameters. Local development logs showed compilation taking several seconds, without a navigation error in the inspected log tail. This supports a slow-loading explanation, but does not prove the cause of the user's intermittent production clicks.
- Production deployment `dpl_86ukASYKZHcGY8FU1nG6dqcaXxaR` was READY on `8207241`. The grouped runtime-error report found no errors for the five Explore routes in the preceding 24 hours. Two detailed runtime-log queries timed out and provided no evidence. Server-error absence does not rule out client-side errors, stalled requests or click interception.
- Added the existing accessible workspace loading skeleton at the Explore route boundary, and a fixed-size pending indicator inside each workflow, AI character and quick-start link. Next owns the pending/cancellation state; there are no timers, forced reloads, custom click handlers or disabled links. Decorative video/poster covers now pass pointer input to their enclosing links.
- Six new tests execute the actual presentation components with isolated Next/React contexts. They verify pending/idle feedback, unchanged live/preview destinations and duration parameters, link placement, and the accessible loading boundary; CSS coverage verifies decorative media are click-through. The related regression selection passed **21 tests**, TypeScript and changed-file ESLint passed, and Git whitespace checks passed. The React review found no new effects, duplicate requests or workflow-state resets.
- The production browser reached sign-in. The user confirmed sign-in was not possible for this check, so authenticated click reproduction and rendered acceptance remain unverified. The exact intermittent failure is not established as solved. No alternate browser was used to bypass the preceding local-preview policy block.

This navigation correction is local and uncommitted, not pushed or deployed. Auth, generation, scheduling, databases and cloud configuration are unchanged; earlier Recreate resize/History edits are preserved.

## Follow-up: named Quick start presets

- Root cause: Quick start encoded destinations and Kling's duration only. Create Hook ignored a requested model, and Recreate always initialized its Image tab even though its existing Video panel already reads the URL model.
- Seedance now opens workflow 1 with `seedance_2_5`; OmniFlash opens workflow 2 in Video mode with `google_omni`; Kling opens workflow 1 with `kling_3_0` and 10 seconds. Trending stays `/dashboard`, Audio stays `/audio-generation`, and Create app demo stays workflow 3 (`/explore/creator-phone`). A shared link builder keeps live and non-spending preview behavior aligned.
- Model values are allowlisted. Hook passes the preset into its existing lazy settings initializer, retaining model availability/rollout rules and normal defaults for ordinary or malformed links. Users can still change settings; rerenders/tab changes do not force the preset back. Launch keys distinguish different requested models without keying on selected gallery references or recovered job IDs. Recreate's ordinary entry still starts in Image mode.
- Eight new preset tests execute the link builder, destination pages, real settings hook and actual Recreate Video initializer with isolated dependencies. One additional parent-layout test verifies Hook forwards both preset values to the settings owner. The navigation tests now cover model query parameters as well. The combined related suite passed **122 tests**, TypeScript, changed-file ESLint and Git whitespace checks passed. React review confirmed no new effects, provider requests or query-driven settings-overwrite loop.
- This is local code verification, not authenticated production/browser acceptance. The user's preceding sign-in limitation remains; no paid generation, social publishing, migration, backend/cloud change, push or deployment occurred. Previous navigation, Recreate resize and History changes are preserved.
