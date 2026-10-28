# Copy prompt in My influencers — 27 October 2026

Implemented locally, not deployed. Copy includes the full merged prompt with saved Skill instructions, matching the previous agreed behavior.

## Data prerequisite

Generation saves the exact model prompt in background_jobs.input_json.prompt. Generated media source_record_id and the influencer identity marker point to that source job. The existing owner-scoped library bulk-loads completed jobs and verifies each asset/job/output binding before serializing it. v2 userPrompt is therefore the image-specific complete saved prompt. This is confirmed by source inspection and database-response/provider-fixture tests, not by inspecting live production rows.

Added an optional prompt field to the authenticated serialized identity. It reuses the existing source-job read, requires no extra query or migration, and excludes legacy internal planner prompts. No influence from image name, current composer draft or today's preset instructions. Existing v1 public serialization/privacy tests still pass.

## UI and protected behavior

- Visible names removed from these cards; accessible selection labels and image alt text retained. Download and Copy Prompt are visibly labelled inside each card’s bordered footer. The selection mark sits on the image. No detached icon rows.
- Reuses the main screen's copy function, checkmark and two-second reset. Accessible per-image label and Prompt copied status.
- Missing/blank prompts omit the icon. Existing library filters remain; no manually uploaded assets are newly admitted.
- Clipboard failures display inside My influencers and allow retry. No success feedback on rejection.
- Copy leaves reference selection, modal visibility, generation requests and image downloads unchanged.
- Optional hover/long-press preview and shared preview-component extraction were not added.

## Files changed in this request

1. lib/characters/identity-service.ts — optional verified full prompt in serialization; preserve previous Skills/history work.
2. lib/characters/identity-list.test.mjs — verify per-image complete prompt, Skill instructions, bounded bulk reads and ownership.
3. components/characters/character-workspace.tsx — saved-card Copy and modal-local clipboard error; reuse existing copy handler/state.
4. components/characters/character-workspace.module.css — attached bordered footer, scoped labels/selection mark, and non-compressing max-content grid rows.
5. components/characters/character-reference.test.mjs — exact per-image copying, missing/blank prompt, no selection/generation side effects, clipboard rejection.
6. scripts/character-reference.browser.cjs — supplied saved-prompt fixture field and desktop/mobile Copy checks/screenshots, feedback expiry and failure/retry.
7. EXPLORE_CONTEXT.md — append product contract.
8. components/characters/image-download-button.tsx — optional visible label; other caller retains icon-only behavior.
9. docs/ai-context/clear.md — UGC-UI-042-INFLUENCER and concrete regression/verification evidence.
10. This receipt.

Rollback only this request's additions; retain prior horizontal rail/Skills changes and unrelated staged/unstaged work. UGC-UI-042-INFLUENCER records the subsequent user-reported footer clarity/clipboard issue. Existing UGC-UI-003 and UGC-UI-041-INFLUENCER safeguards also apply.

## Preflight sources

Read the user screenshot, AGENTS engineering guidance, nonnegotiables, full context-memory / immutable-contracts / UI-clarity / regression-gate skills, relevant Explore/ledger/influencer history and prior task context; installed Next.js CSS guidance. Long context/ledger outputs were truncated; no claim of exhaustive historical inspection. Ran tools/preflight.py for the actual request: prerequisites discoverable/readable. Inspected current diffs and serializer/caller/storage paths before edits. Prior tests/source confirm the persisted prompt prerequisite before UI work. No new database access or publishing behavior.

## Verification

- VERIFIED locally:45tests using node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test components/characters/character-reference.test.mjs lib/characters/identity-list.test.mjs lib/characters/identity.test.ts lib/characters/identity-routes.test.mjs.
- VERIFIED: npx tsc --noEmit --incremental false; scoped ESLint and git diff --check (line-ending warnings only).
- VERIFIED locally: node scripts/character-reference.browser.cjs. Real workspace, builder, shared Dialog and download controls; auth/API/storage/media responses substituted. Copy payload matches the saved Skill image's full merged prompt. Labelled Download then Copy Prompt actions share an attached footer inside the card, names are not visible, cards do not overlap, selection is unchanged, modal stays open, Copied/checkmark expires, denied clipboard is actionable and successful retry clears error. Existing uploads/mixed references/download/history/recovery/idle/rail/Skills checks pass.
- Before: .tmp/influencer-copy-baseline/ copied existing library screenshots. User screenshot is requested placement evidence, not an approved golden baseline.
- After: .tmp/character-reference-browser/library-copy-desktop.png, library-copy-mobile.png and library-copy-card-mobile.png and library-labelled-footer-desktop.png. Desktop/mobile manually reviewed. User’s reported desktop/mobile screenshots are preserved under .tmp/influencer-copy-baseline/reported-desktop.png and reported-mobile.png.
- NOT TESTED: neighboring hosted Hook/Demo/Schedule flows, live production stored-row coverage, full production build and authenticated production clipboard/download acceptance. This change is local; no deployed feature exists to accept yet.
- NOT VERIFIED: real hosted integration. No paid model request, schema migration, deployment or customer-data mutation occurred.

## Iteration and limits

Moving actions inside overflow-hidden cards initially allowed CSS grid auto rows to compress within the scroll region. Browser selection failed because a later card overlapped the first. Logged the failure before correcting grid-auto-rows:max-content; complete browser rerun then passed with an explicit all-card non-overlap assertion. No fixture force-click or weakened selection test was used.

The user reports Copy does not seem to copy. Actual local clipboard reads match the exact saved merged prompt; rejected writes remain visibly actionable inside the modal. This does not establish the cause or resolution of an authenticated production browser’s clipboard problem. No claim of live acceptance.
