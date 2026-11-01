# Talking Head photo dialog — local verification

Follow-up: the user subsequently required complete source-section parity. The layout-only boundary below is superseded by `talking-head-complete-photo-picker-2026-10-30.md`; the current local patch includes My Influencers and verified Starting frames.

The user's screenshots showed Hook's large centered chooser and Talking Head + Demo's narrow anchored image popover. `WorkflowCreationForm` used the latter in its ordinary image-reference path. This is separate from the already corrected approved-starting-frame picker.

## Change

Talking Head's ordinary Choose image action now opens one modal Dialog, reusing Hook's existing `format-person-image-picker.module.css` dimensions, header/body/footer layout, photo grid and responsive scrolling. Selected photos appear on the left and the library on the right; on mobile they stack inside the scrollable body. Done remains in the footer. Selected photos have direct remove buttons without another nested hover preview.

This is a presentation change. Existing Uploaded photos and UGC Pilot images sources, upload timing, selected image order, owned-asset resolution, callbacks and model-provided limits remain. It does not add or rename data-source tabs, introduce reference roles or change generation requests. The shared Hook-style composer's ordinary chooser receives the dialog; an explicitly supplied approved-starting-frame control still takes precedence. Creator Phone retains the original `CreatorPicker` function verbatim and the compact library's default styles. Hook's existing approved-frame Dialog/CSS are unchanged.

## Verification

- `python tools/preflight.py --repo . --task ...`: PASS. Clean worktree at entry, release baseline49869f19.
-180 focused app checks PASS across workflow-creation-form, starting-frame-animation-references, explore-format-generation-ui, workflow-generation-client and workflow-generation-api-contract.
- Actual-component Edge fixture with project CSS: PASS at1366x768 and390x844. One centered modal, no intermediate image popover, bounds/large width, library and selected-photo area, multiple selection, Done/reopen, Escape/focus restoration, upload, catalogue choice, selected-photo removal, clearing, deselection at a full six-image limit, and thirty-image limit with atomic rejection of an extra23 when8 are selected. User instructions remain unchanged. These are isolated local API fixtures, not authenticated hosted media acceptance.
- Existing audio-name browser regression PASS at1366/1536/390px: Sound location/toggling, selected audio filename, no plus overlap, removal.
- Original committed Creator Phone picker function compared against current source: exact match. Explicit unit coverage preserves its Popover and supplied starting-frame controls.
- TypeScript noEmit PASS; scoped ESLint PASS with no output. `git diff --check` PASS.
- Final source change affects picker presentation only; no dependencies, migrations, API/worker/prompt/scheduling changes. No full production build was run for this local UI-only patch; types, lint and actual-component browser compilation were checked.

## Visual evidence

Actual original committed form was loaded through a fixture alias for baseline captures. Before: `.tmp/talking-reference-browser/photo-popover-before-1366.png` and `photo-popover-before-390.png`. After: `photo-dialog-empty-1366.png`, `photo-dialog-selected-1366.png`, `photo-dialog-empty-390.png` and `photo-dialog-selected-390.png` in the same directory. Desktop/mobile changed regions were visually inspected. Fixture uses sample images; it does not inspect or generate a user's real video.

## Protected behavior and limits

VERIFIED locally: selected image callbacks/limits, instructions, supplied starting-frame controls, Creator Phone implementation, audio controls and generation-client/API regression checks. NOT VERIFIED: authenticated production interaction and real generated output. No deployment, provider generation, publication or production data mutation occurred. Existing selection persistence implementation is unchanged; close/reopen was tested, not a new cross-reload persistence guarantee.

## Files

- `components/explore/workflow-creation-form.tsx`
- `components/explore/workflow-image-library.tsx`
- `scripts/workflow-creation-form.test.mjs`
- `scripts/talking-head-references.browser.cjs`
- `EXPLORE_CONTEXT.md`
- `docs/ai-context/clear.md` (append-only UGC-UI-068)
- This receipt.

Preflight sources: user-supplied AGENTS.md; unchanged nonnegotiables read in this session; relevant Explore chooser/context entries and ledger058/068 under the existing scoped-context authorization; full ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity and ugc-regression-gate skills; installed Next use-client guide; actual component callers, library/upload hook and existing tests. Rollback boundary is the four application/test paths above, retaining incident history. No new approval or release is implied.
