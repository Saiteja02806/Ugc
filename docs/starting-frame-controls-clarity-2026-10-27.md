# Starting-frame controls clarity

Local implementation, not deployed. User evidence: Downloads/download (1).png and download.png.

## Changes

- `components/video/video-generation-workspace.tsx`: use existing compact preview/Change control, moving the existing scene/photo selectors inside its popover; remove persistent animation guidance; initialize new starting-frame/model selections with requested duration defaults.
- `components/explore/hook-workflow-preview.tsx`: use the same duration policy on a newly approved frame and model changes. Preserve unrelated concurrent changes in this file.
- `worker/src/lib/hook-starting-frame-video.ts`: initial-duration helper: google_omni3, wan_3_0 3, seedance_2_5 4. No supported-range or provider change.
- `scripts/explore-format-generation-ui.test.mjs`: assert compact handoff,3second initial request, all model defaults and custom-duration preservation; load existing slideshow recovery dependency in fixture.
- `scripts/starting-frame-animation-references.test.mjs`: verify model default/range contract and absence of redundant guidance.
- `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`: append decision and UGC-UI-023 recurrence. This receipt.

## Preserved behavior

VERIFIED by focused component/payload tests: existing Change retains scene and person selectors; photos survive frame changes; removing photos does not clear the starting frame; unsupported model/photo combinations remain blocked; stale reads do not modify selections; generation payload keeps scene and person roles separate. Custom durations remain editable and survive rerender. No generation is automatically submitted by selecting a frame. No prompt, saved editor text, scheduling or authentication changes made in this patch.

## Validation

-12focused tests PASS: `node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --test-name-pattern='starting.frame|approved Hook|approved starting|scene history|unsupported models|stale influencer|compact approved|model-specific|payload keeps' scripts/starting-frame-animation-references.test.mjs scripts/explore-format-generation-ui.test.mjs`.
- Broader suite:99/100PASS across starting-frame selectors, generation UI and workflow source UI. Failure: slideshow neighboring-slide grouping expects one card and gets zero (`scripts/explore-format-generation-ui.test.mjs`, around415); separate from this starting-frame patch, not counted as pass.
- TypeScript `npx tsc --noEmit --incremental false`: PASS.
- Scoped ESLint: PASS for the two components, shared duration policy and changed tests.
- Initial test invocation used strip-only mode and failed on an existing TypeScript parameter property; reran using required transform-types mode.
- Browser access now works. Actual production Hook page opened, but these local changes are not deployed and no post-fix screenshots/interaction acceptance are claimed.

Read actual selector/caller/duration-policy code, context-memory/protected-contract/UI-clarity/regression skills, relevant Explore context and nonnegotiables; appended incident before implementation. Full large historical context was not reread in this follow-up. No database writes, provider generation, deployment or publishing performed.

Rollback only this patch's hunks; preserve concurrent release, UI and recovery work. Overall status PARTIALLY VERIFIED pending visual/hosted checks.
