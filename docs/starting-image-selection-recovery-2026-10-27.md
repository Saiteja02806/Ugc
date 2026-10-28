# Starting image selection and safe status recovery

Local correction for UGC-UI-041. Not deployed. No generation, credit reservation, refund, queue dispatch or production data write was performed during this investigation.

## Verified findings

The saved-influencer callback replaced the entire photo array. The library also marked only the first array item as selected. Uploads and the selected-photo strip already supported multiple photos; a layout redesign was unnecessary.

Production read-only inspection found Seedream job `03125acf-9f8c-45d5-9016-2c8344580319` for `creator-account-1-02`, created at 15:53:37 UTC on 27 October. It failed before dispatch with `PRE_DISPATCH_PERSISTENCE_FAILED` and the screenshot's verification message. There is no worker assignment, worker start or output. The receipt has one identity photo and three total references: original opening, later clarity anchor and identity. The screenshot has no job ID, so this is a matching reference/model failure, not a reconstruction of the user's browser storage.

The original one-credit billing reservation is already `released`, with settlement at 15:53:38 UTC. This was observed, not changed by this task.

The exact stored receipt fails the pre-change parser and passes the corrected parser. The full stored input, including prompt hash, model, aspect ratio and reference URL roles, also passes the corrected verifier. JSONB reorders object properties. Version-four verification serialized the opening frame and preparation source frame using insertion order, so an unchanged database round trip invalidated the frozen input key. A regression failed before the correction and passes afterward.

## Changes

- Saved influencer thumbnails toggle independently. Selecting adds to the ordered list; clicking a selected photo removes only that item. Every selected photo receives its checkmark. At the selected model's cap, unselected thumbnails are disabled while selected photos remain removable.
- Retained the existing wrapping photo strip, Change photos, uploads, Clear selection and Done. Choices persist through reopening. The prior single-selection reset rule is superseded by this explicit user request. Users still choose photos of the same person; the application does not infer identity from the pixels.
- Canonicalize frame field order when rebuilding receipt keys. Owner, source digest, exact frame timestamps/digests, image IDs/order, model, prompt hash and preparation key checks remain strict. No schema or receipt-version migration.
- Show a job's error once in the result panel. Remove the duplicate submission error from settings when a recoverable result exists. Pre-submission errors still appear when no result panel is available.
- Rename the existing status action to **Refresh status**. It refetches unresolved saved query records, skips verified terminal records and never calls generation. Recovery may move from the original request ID to its verified job ID; that is the same job, not a replacement.
- Keep automatic polling, uncertain-request duplicate protection, deliberate Generate, explicit frame approval, and existing terminal-failure retry behavior. A verified failed job stays failed; recovery does not restart it.

## Files changed by this task

1. `components/explore/hook-starting-frame-workspace.tsx`
2. `components/explore/format-generation-references.tsx`
3. `worker/src/lib/hook-keyframe-generation-contract.ts`
4. `scripts/hook-starting-frame-ui.test.mjs`
5. `scripts/explore-format-reference-upload.test.mjs`
6. `lib/explore/hook-full-recreation-pilot.test.ts`
7. `lib/explore/hook-keyframe-generation-api.test.mjs`
8. `EXPLORE_CONTEXT.md` (append)
9. `docs/ai-context/clear.md` (append UGC-UI-041)
10. This receipt.

These files include unrelated pre-existing work. Rollback only this task's hunks; do not restore entire files. Before-state copies are in ignored `outputs/starting-image-selection-recovery-20261027/`. Exact private job input is in ignored `.tmp/`; the shareable diagnostic receipts contain no prompt prose or credentials.

## Verification

- 150 focused tests pass across nine test files. Command: `node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --experimental-test-module-mocks --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/hook-starting-frame-ui.test.mjs lib/explore/hook-full-recreation-pilot.test.ts lib/explore/hook-keyframe-generation-api.test.mjs scripts/starting-image-status-recovery.test.mjs scripts/starting-frame-animation-references.test.mjs scripts/explore-format-reference-upload.test.mjs scripts/hook-starting-frame-variations.test.mjs scripts/hook-starting-frame-client.test.mjs lib/explore/hook-keyframe-result.test.mjs`.
- API harness includes all twelve private references across three image models, now with database-style object-key reordering before dispatch. Failed-job status reads return the same terminal job, without another reservation or dispatch. Providers, auth and billing in the harness are mocked; this does not establish live provider behavior.
- Exact production receipt replay: before rejected, after accepted. Exact persisted full-input verification passes locally. Production SQL operations were SELECT only.
- `npx tsc --noEmit --incremental false`: PASS. `npm --prefix worker run build`: PASS. Scoped ESLint and scoped `git diff --check`: PASS.
- Actual React preparation, photo chooser, query state, styles and Chrome at 1440 and 390 pixels: before/after selection and duplicate-error reproduction; cap/deselection; reopen; four selected IDs passed to submission; Refresh status; request-ID-to-job-ID recovery; confirmed failure; close/reopen without extra submission; no horizontal overflow or page errors. Before: one selected photo and two error alerts. After: four selected photos and one error alert. Screenshots inspected at desktop and mobile.
- The browser fixture substitutes auth, owned assets, source media, image job transport, image-optimizer response and the surrounding app shell. Its sample photos test interaction/layout, not identity accuracy. Initial fixture iterations corrected an accessible-label selector, accepted the legitimate request-ID-to-job-ID transition, excluded hidden tab images from loading assertions and served fixture thumbnails/UTF-8 correctly. These were fixture repairs, not production thumbnail fixes.

Artifacts: `outputs/starting-image-selection-recovery-20261027/` contains logs and sanitized exact-job receipts. Browser fixture and before/after PNGs: `.tmp/starting-image-selection-recovery-20261027/`.

## Protected behavior and limits

VERIFIED locally: ownership/source/frame/prompt binding checks; ordered multiple identity-photo handoff; unchanged source-versus-identity roles; no recovery generation/credit dispatch; saved-request preservation; model caps; uploads/removal; approval gate; existing layout geometry at the tested sizes. Scheduling, Remix and video prompts were not changed.

NOT VERIFIED: authenticated hosted UI after deployment, a newly generated image, provider output quality, the exact screenshot's browser checkpoint, and full cross-feature live navigation. No deployment was made; preserve the user's pre-deployment notification requirement.

Preflight used the provided AGENTS instructions and repository preflight tool; read context-memory, immutable-contracts, UI-clarity, starting-frame and regression skills, nonnegotiables, relevant Explore/ledger sections, current callers/tests/persistence, the installed Next use-client guide and Supabase skill. The full large context/ledger output exceeded the tool limit; do not represent that truncated output as a complete historical reread. No prompt-writing, model or schema changes were needed.
