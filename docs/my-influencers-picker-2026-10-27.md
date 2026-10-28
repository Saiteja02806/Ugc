# My Influencers in both photo pickers

Implemented locally for UGC-UI-043-PICKER. Not deployed.

The larger picker now has **Person photos / My Influencers** in the existing header controls, replacing **Other images**. My Influencers opens the owner's Build AI Influencer history. The compact starting-frame picker uses the same name for its existing influencer section. UGC Pilot images remains separate. No four-tab redesign or catalogue merge.

The former Other images control changed input purpose, so a label-only change would have been misleading. The new controls navigate library sources. Explicitly choosing either person section sets the person role; existing general-purpose draft values are not rewritten on render.

## Implementation

- Reuse the supplied influencer library where present. Otherwise read the existing authenticated `/api/characters/history` endpoint only when My Influencers is opened. Query keys include owner ID; pagination, loading, error, retry and empty states remain.
- Resolve selected history assets through the existing authenticated media API. Validate ID, readiness, generated-image type, collection, MIME type and configured size limit. Discard late results after owner/unmount cleanup.
- Preserve ordered multi-selection, checkmarks, deselection at the cap, existing model limits, uploads, Clear selection, Done and wrapping previews. No automatic same-person filtering is claimed.
- Refresh reloads the active influencer source, uploaded images or existing starting-frame source. Catalogue remains a separate link with return navigation.
- Keep existing dialog/compact geometry and generation controls. No prompts, models, pricing, scheduling, schema or dependencies changed. Selecting or refreshing never generates media.

## Files changed

1. `components/explore/format-generation-references.tsx`
2. `lib/characters/photo-library-client.ts` (new)
3. `lib/characters/photo-library-client.test.mjs` (new)
4. `scripts/explore-format-reference-upload.test.mjs`
5. `EXPLORE_CONTEXT.md` (append)
6. `docs/ai-context/clear.md` (append)
7. This receipt.

Preserve pre-existing changes in these files. Rollback only this task's hunks and new files. Before-state copy: `outputs/my-influencers-picker-20261027/references.before.txt`.

## Verification

**115 tests PASS:** `node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/characters/photo-library-client.test.mjs scripts/explore-format-reference-upload.test.mjs scripts/starting-frame-animation-references.test.mjs scripts/hook-starting-frame-ui.test.mjs scripts/explore-reference-images.test.mjs scripts/hook-starting-frame-navigation.test.mjs scripts/hook-starting-frame-client.test.mjs`.

Coverage includes owner-bound history GETs, encoded cursor, missing auth, invalid asset roles, history errors, source switching, refresh, owned asset resolution, ordered selection/caps, uploads and existing preparation recovery. Client tests substitute auth and transport; they do not independently establish hosted authorization.

Application TypeScript (`npx tsc --noEmit --incremental false`), scoped ESLint and scoped diff check PASS. Intermediate compact Change-label regression was caught and fixed. A lint-rejected ref-capturing callback was moved into the event handler without disabling rules.

Actual shared-component Chrome fixtures at **1440 and 390 pixels**, full dialog and compact picker, pass source selection, multi-select, deselection at cap, active refresh, catalogue return, close/reopen with selected checks, person role, no horizontal overflow and no page errors. Intercepted API calls were GET only. Before/after screenshots were inspected; existing selection-color transitions were allowed to finish before capture.

Fixtures substitute authentication, API responses, thumbnail optimizer response and surrounding app shell. Sample photos test interaction/layout, not identity quality. Reopening follows the established source reset; tests reopen My Influencers to verify preserved selections. No paid generation, production write or deployment occurred.

Evidence: `outputs/my-influencers-picker-20261027/` logs and `.tmp/my-influencers-picker-20261027/receipt.json`. Before/after PNGs and repeatable fixture are in the latter folder, including `after-dialog-1440.png`, `after-dialog-390.png` and `after-inline-390.png`.

## Context and limits

Used context-memory, immutable-contracts, UI-clarity and regression-gate skills. Inspected supplied/root AGENTS guidance, nonnegotiables, applicable Explore/incident history, existing callers/history/asset APIs and tests, installed Next use-client guide. Repository preflight PASS. Full large historical context was not reread in this follow-up; no complete-history reread is claimed.

VERIFIED locally: both picker sections, selection persistence and limits, owned-history wiring, active refresh, source separation, compact controls and tested responsive geometry. NOT VERIFIED: authenticated deployed behavior and user visual acceptance. UGC-UI-043-PICKER is locally corrected; production acceptance stays OPEN. Retain the user's pre-deployment notification requirement.

The initial attempt to write this completion receipt and append context was not executed because automatic approval review reached its usage limit. Those documentation actions were completed on the subsequent user-authorized continuation.
