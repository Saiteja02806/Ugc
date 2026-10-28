# Wall timed Remix: progress and manual review queue

Local, disabled prototype; not deployed. `worker/src/lib/wall-timed-text.ts` builds an initial editable Wall edit from a frozen, source-ID/hash-bound set of timing/placement values. It checks caption count, ordered non-overlapping source intervals, matching source timestamps, valid duration and fit. It proportionally maps each interval to the output duration, preserves any ending after the final caption, and leaves the full video duration intact. It never reads or changes saved drafts. It is NOT connected to Remix planning, job execution, recovery or the editor and is NOT yet used by users.

| Item | What can be done now | Manual review / uncertainty | Status |
|---|---|---|---|
| Wall 21 | Ten source blocks and approximate per-shot positions exercised with 6s, 11.353s and 15s fixtures. | Confirm placement/size against source and review timing on actual output: proportional timing does not establish generated shot alignment. Original endpoint leaves a short caption-free tail. | Prototype tested; integration pending |
| Wall 28 | Source and reviewed text records available. | Inspect source, measure each caption position and verify boundaries and block styling. | Not reviewed |
| Wall 59 | Source and reviewed text records available. | Inspect source, measure each caption position and verify boundaries and block styling. | Not reviewed |
| Remaining single-block Wall records | Hash-matched sources and triage sheets available; 15 layouts already prepared locally. | Review each reference, contrast and representative Remix fit before adding a profile. | In progress |
| Existing saved edits | Prototype is pure and untouched saved edits remain outside its call. Existing feature tests cover precedence. | Browser save/reopen and late recovery of timed edits must be checked after integration. | Not tested for timed path |

Verification: `node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test worker/src/lib/wall-timed-text.test.ts worker/src/lib/wall-initial-text-layout.test.ts` 11/11 pass; worker build, TypeScript and scoped ESLint pass. Tests cover source mismatch, changed intervals, missing copy, overlap, overlong copy, 10 block values and positions, full duration and round-trip. No actual AI response, real generated footage, browser timed editor, renderer/export or hosted behavior tested. No video generation, paid calls or deployment. UGC-UI-046 remains open; no new incident.

Sources actually consulted: Wall 21 source-review receipt and sampled source frames from the preceding turn; current automatic plan, edit parser, source records, relevant tests, `nonnegotiables.md`, immutable contracts and preflight helper. Context-memory and regression-gate skills were read in the preceding turn; full Explore/incident files were not reread in this turn. Existing dirty worktree preserved.
