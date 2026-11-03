# Starting-frame hair and role-option audit — 2 November2026

**Hair preservation has no dedicated option yet. Background and outfit choices are implemented and locally wired.** This was an inspection/test task; no application code or UI was changed and no deployment/paid generation occurred.

## Current implementation

- `components/explore/hook-starting-frame-workspace.tsx` exposes two checkboxes inside the collapsed Background and outfit disclosure. Off maps to `source`; on maps to `photo`. The first selected influencer photo supplies an enabled photo role. Supporting photos remain identity-only.
- `worker/src/lib/starting-frame-reference-options.ts` accepts exactly `background` and `outfit`. There is no hair field. Its role instructions explicitly select source versus main-photo environment/wardrobe.
- `lib/explore/hook-keyframe-draft.ts` persists those choices, includes them in the input key and invalidates a generated-image/approval binding when inputs change.
- The workspace freezes the options into the submission. `lib/explore/hook-keyframe-generation-api.ts` validates them, binds them into the durable receipt/request identity and rejects reusing a paid request with different options.
- `worker/src/lib/openrouter-gemini-image.ts` applies the selected roles to both scene and identity stages. The identity instruction explicitly preserves the influencer's **hairline**, but does not establish an explicit primary-photo authority for hairstyle, color, length or texture. Older prompt labels can preserve source hairstyle. Hairline preservation is not equivalent to a selectable full-hairstyle policy.
- `lib/explore/hook-keyframe-prompt-preview.ts` shows role-adjusted image instructions. Changing a checkbox does **not** edit existing pixels or silently run a paid request. The user must generate a new starting frame and review it; changed inputs cannot approve the old result.

## Local tests actually run

1. Existing targeted UI/draft/API tests, selected by `background and outfit|source defaults|independent background|invalid image-role` — **4passed**. Coverage: default source choices; independent photo choice; draft restore; old-frame invalidation; API frozen-role admission and409for changed paid-request inputs; invalid roles rejected before billing.
2. Compiled provider test `independent background and outfit roles` — **1passed**, exercising allfour source/photo combinations in both paid-stage request bodies with caption cleanup retained. External provider transport is mocked.
3. Temporary extension of the existing real UI-component harness — **1passed**. It toggles outfit on then off, background on then off, checks independent checkbox/draft states and asserts no additional submission. The temporary file was removed after execution; evidence log retained.

Commands used the existing Next server-only loader, experimental module mocks/type transform for application tests; provider test used `node --test` against the existing compiled worker test. Logs: `.tmp/starting-frame-hair-audit/options-tests.log`, `provider-options-test.log`, `deselect-test.log`.

**VERIFIED locally:** UI state/persistence, request role fields, changed-input rejection/invalidation and both-stage role instructions. **NOT VERIFIED:** new real generated pixels, hair fidelity, production UI/state and live provider compliance. These test fixtures are not visual generation acceptance.

## Recommended addition

Reuse the existing collapsed disclosure, named **Background and appearance**, with three independent options:

- Use background from my photo.
- Use outfit from my photo.
- Use hairstyle from my photo.

Keep them independent so a user can preserve the influencer's hairstyle with the source outfit, or choose any other permitted combination. A future hairstyle role should explicitly cover style, color, length and texture from the main photo, while preserving source camera, pose and lighting. It must reach draft restoration, API validation, immutable request/receipt fingerprints, preview/image labels, both image stages and reviewed-result approval. Existing accepted jobs must retain their historical instructions. A default change beyond existing source-conservative behavior requires a product decision; no new default was silently introduced in this audit.

Preflight sources applied: repository AGENTS, relevant Explore/incident/protected history, and session-read context-memory, immutable-contracts, UI clarity, starting-frame, video-prompt and regression-gate skills. No reference video was analyzed and no motion prompt was rewritten. Only tracked changes for this audit: this receipt and append-only `docs/ai-context/clear.md` entry **UGC-UI-117**. All prior worktree changes preserved.
