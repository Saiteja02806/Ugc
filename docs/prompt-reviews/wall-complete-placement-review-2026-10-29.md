# Complete local Wall placement review - 29 October 2026

All **97 selectable Wall references** have source-ID/hash-bound layouts in application code. No applicable layout is missing. The former 99-total/47-remaining count included already-retired Wall 08 and 09. Inventory: 103 sources minus retired/moved 06,08,09,21,28,59 =97. The actual recreation catalogue and source resolver are tested, including imported references.

## Connected behavior

Selected source text and saved business context go to Remix. New ordinary Wall requests use prompt version4 and preserve paragraph roles, lists and approximate density. Returned words receive that reference's position, width, size, spacing, color and outline. Separate regions and left alignment are retained. Bounded source text boxes use the same preview/persistence/outlined-render implementation.

Manual Remix retains existing measured layers and saved styles instead of collapsing them. Automatic initialization preserves saved and explicitly empty drafts. Save/reopen and export JSON retain full Wall duration; no Hook auto-trim. Invalid source hashes, incompatible paragraph structure, unsupported aspect ratios and overflow require review rather than truncation. Wall copy permits6000characters; Hook remains600 and Slideshow limits remain unchanged. The source-relative AI length budget still applies. Frozen accepted jobs recover their original prompts and layout fields.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Actual selectable gallery, source text and matching profile | 97/97 locally verified | scripts/wall-gallery-placement.test.mjs |
| Full catalogue, fit, hash mismatch, saved style, manual/automatic and recovery regressions | 227 focused checks PASS | outputs/wall-layout-batch-20261028/complete-tests.log |
| Source plus business context, request and receipt recovery, manual/automatic placement, saved edits, blanks and export handoff | 41 checks PASS with provider/database fixtures | connected-flow-tests.log |
| Neighboring editor, draft recovery, Demo and timed-text behavior | 136 checks PASS | cross-feature-tests.log |
| Actual editor controls, server-fixture save/reopen, desktop/mobile and full-duration export JSON | PASS for all97 profiles | scripts/wall-complete-layouts.browser.cjs; complete-browser.log |
| Source versus actual outlined renderer | 97 PNG comparisons generated and inspected | complete-review/manifest.json; sheet-01.png through sheet-17.png |
| Worker build, TypeScript, scoped ESLint and diff whitespace | PASS | complete-worker-build.log, complete-types.log, complete-lint.log |
| Hosted auth/persistence, live AI copy quality, generated-footage contrast and final video render | NOT VERIFIED | No deployment or video generation authorized |

Counts overlap where focused checks were rerun; do not sum these as unique tests. Fixtures prove wiring/recovery, not hosted provider behavior or AI writing quality. Existing application fonts approximate the source style; exact source fonts were not identified.

## Manual review

| Reference | Layout | Review needed |
| --- | --- | --- |
| Wall37 | Added/tested | Source sentence itself ends at 'how little is'. Missing words were not invented. |
| Wall53 | Added/tested | Source ending itself stops at 'You'll always'. Review source wording before publishing. |
| Other95 | Added/tested | No missing layout; each arbitrary new Remix still passes fit/structure validation. |

## Scope, preflight and protections

Minimal boundary: Wall placement and the optional alignment/box/region fields and dense-copy support needed by those sources. No new dependencies, migrations, permanent controls, scheduling/model route changes or deployment settings. Other worktree changes were preserved. Automatic Wall flags remain disabled. No paid calls, generated/exported videos or deployment occurred.

Preflight retained from this continuous task: AGENTS.md; user-approved relevant Wall/Explore sections and review evidence; clear.md and nonnegotiables contracts; ugc-context-memory, ugc-immutable-contracts, ugc-frame-analysis, ugc-ui-clarity and ugc-regression-gate skills. Next.js use-client.md was checked for the client components. The user explicitly authorized scoped relevant history instead of rereading the entire ledger per batch.

UGC-UI-046-WALL-AUTO continuation is recorded in clear.md. Tests caught manual multi-region collapse and the inherited Hook600-character ceiling; both repaired locally. Protected saved styles/words/empty drafts and full duration are VERIFIED locally. Hosted acceptance remains NOT VERIFIED.

## Files changed in this continuation

- [worker/src/lib/wall-initial-text-layout.ts](C:/Users/chund/OneDrive/Desktop/UGC/worker/src/lib/wall-initial-text-layout.ts)
- [worker/src/lib/explore-format-edit.ts](C:/Users/chund/OneDrive/Desktop/UGC/worker/src/lib/explore-format-edit.ts)
- [worker/src/lib/explore-text-outlines.ts](C:/Users/chund/OneDrive/Desktop/UGC/worker/src/lib/explore-text-outlines.ts)
- [worker/src/lib/automatic-hook-text.ts](C:/Users/chund/OneDrive/Desktop/UGC/worker/src/lib/automatic-hook-text.ts)
- [lib/explore/reference-text.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/reference-text.ts)
- [lib/explore/remix-text-api.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/remix-text-api.ts)
- [lib/explore/remix-text-edit.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/remix-text-edit.ts)
- [lib/explore/remix-text-prompt.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/remix-text-prompt.ts)
- [lib/explore/automatic-hook-text-plan.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/automatic-hook-text-plan.ts)
- [components/explore/format-text-overlays-editor.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/format-text-overlays-editor.tsx)
- [components/explore/format-video-text-overlay.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/format-video-text-overlay.tsx)
- [components/explore/remix-text-section.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/remix-text-section.tsx)
- [scripts/automatic-hook-text-editor.test.mjs](C:/Users/chund/OneDrive/Desktop/UGC/scripts/automatic-hook-text-editor.test.mjs)
- [worker/src/lib/wall-six-layouts.test.ts](C:/Users/chund/OneDrive/Desktop/UGC/worker/src/lib/wall-six-layouts.test.ts)
- [worker/src/lib/wall-initial-text-layout.test.ts](C:/Users/chund/OneDrive/Desktop/UGC/worker/src/lib/wall-initial-text-layout.test.ts)
- [lib/explore/automatic-hook-text-plan.test.mjs](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/automatic-hook-text-plan.test.mjs)
- [lib/explore/remix-text-api.test.mjs](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/remix-text-api.test.mjs)
- [lib/explore/remix-text.test.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/remix-text.test.ts)
- [scripts/wall-complete-catalogue.test.ts](C:/Users/chund/OneDrive/Desktop/UGC/scripts/wall-complete-catalogue.test.ts)
- [scripts/wall-alignment-length.test.ts](C:/Users/chund/OneDrive/Desktop/UGC/scripts/wall-alignment-length.test.ts)
- [scripts/wall-gallery-placement.test.mjs](C:/Users/chund/OneDrive/Desktop/UGC/scripts/wall-gallery-placement.test.mjs)
- [scripts/wall-complete-layouts.browser.cjs](C:/Users/chund/OneDrive/Desktop/UGC/scripts/wall-complete-layouts.browser.cjs)
- [scripts/wall-layout-static-review.mjs](C:/Users/chund/OneDrive/Desktop/UGC/scripts/wall-layout-static-review.mjs)
- [WALL_TEXT_CONTEXT.md](C:/Users/chund/OneDrive/Desktop/UGC/WALL_TEXT_CONTEXT.md)
- [EXPLORE_CONTEXT.md](C:/Users/chund/OneDrive/Desktop/UGC/EXPLORE_CONTEXT.md)
- [docs/ai-context/clear.md](C:/Users/chund/OneDrive/Desktop/UGC/docs/ai-context/clear.md)

This receipt is also new. Local outputs and .tmp browser evidence are not deployed assets. The earlier native-fetch repair in use-clip-draft-save.ts was retained.

## Repeatable checks

Use the repository next-server-only loader, module mocks and type transform for the test files above. Run node scripts/wall-complete-layouts.browser.cjs; npm run worker:build; npx tsc --noEmit --pretty false; scoped ESLint. Run node --experimental-strip-types scripts/wall-layout-static-review.mjs after the worker build for PNG comparisons only. Keep production flags off until separately authorized hosted acceptance.

## Complete per-reference record

| Reference | Editable regions | Full duration | Layout | Source-copy review | Comparison |
| --- | ---: | ---: | --- | --- | --- |
| explore-wall-text-652f166f3a7a7a8d | 1 | 8.194s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-652f166f3a7a7a8d.png) |
| explore-wall-text-e95ccc86a8f9ee96 | 1 | 9.935s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-e95ccc86a8f9ee96.png) |
| explore-wall-text-d496fde4808ff903 | 1 | 7.753s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-d496fde4808ff903.png) |
| explore-wall-text-2fe054f77b9d9549 | 1 | 8.589s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-2fe054f77b9d9549.png) |
| explore-wall-text-0d0039479ef4cca9 | 1 | 7.938s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-0d0039479ef4cca9.png) |
| explore-wall-text-f5bc390383e437fb | 1 | 8.937s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-f5bc390383e437fb.png) |
| explore-wall-text-c2fbebde7c4f9676 | 1 | 9.076s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-c2fbebde7c4f9676.png) |
| explore-wall-text-8ed8ad307341d9c3 | 3 | 12.466s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-8ed8ad307341d9c3.png) |
| explore-wall-text-ec359c870c62a893 | 1 | 11.212s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-ec359c870c62a893.png) |
| explore-wall-text-765ce326c924aaf6 | 1 | 12.350s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-765ce326c924aaf6.png) |
| explore-wall-text-242588ba1be47a25 | 2 | 6.452s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-242588ba1be47a25.png) |
| explore-wall-text-359cef4971f58d83 | 1 | 6.452s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-359cef4971f58d83.png) |
| explore-wall-text-dd3e344317913399 | 1 | 6.059s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-dd3e344317913399.png) |
| explore-wall-text-e1d5e39019c57edd | 1 | 5.780s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-e1d5e39019c57edd.png) |
| explore-wall-text-f02839f347ec57fe | 1 | 5.804s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-f02839f347ec57fe.png) |
| explore-wall-text-edcf31d415ad6095 | 1 | 11.421s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-edcf31d415ad6095.png) |
| explore-wall-text-186edbf9361266e6 | 1 | 8.124s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-186edbf9361266e6.png) |
| explore-wall-text-d5ac739cb19678ff | 1 | 9.517s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-d5ac739cb19678ff.png) |
| explore-wall-text-5cdc0bf33fa496f7 | 1 | 6.150s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-5cdc0bf33fa496f7.png) |
| explore-wall-text-5286682bcc6952ad | 1 | 6.127s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-5286682bcc6952ad.png) |
| explore-wall-text-a1616299d8dcc625 | 1 | 6.059s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-a1616299d8dcc625.png) |
| explore-wall-text-6ef884242109d8db | 1 | 10.051s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-6ef884242109d8db.png) |
| explore-wall-text-15c1344dbc9683f6 | 3 | 6.452s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-15c1344dbc9683f6.png) |
| explore-wall-text-952c9e951086145c | 1 | 7.428s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-952c9e951086145c.png) |
| explore-wall-text-0fad669fefb4c9e6 | 1 | 6.522s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-0fad669fefb4c9e6.png) |
| explore-wall-text-cf2340e8e4407dab | 1 | 5.409s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-cf2340e8e4407dab.png) |
| explore-wall-text-1a22e628bb1a4428 | 1 | 6.384s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-1a22e628bb1a4428.png) |
| explore-wall-text-8d69fa9e5c2f3c3b | 1 | 6.198s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-8d69fa9e5c2f3c3b.png) |
| explore-wall-text-02 | 1 | 8.287s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-02.png) |
| explore-wall-text-03 | 1 | 11.003s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-03.png) |
| explore-wall-text-04 | 2 | 7.265s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-04.png) |
| explore-wall-text-05 | 1 | 12.791s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-05.png) |
| explore-wall-text-07 | 1 | 7.335s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-07.png) |
| explore-wall-text-10 | 1 | 5.523s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-10.png) |
| explore-wall-text-11 | 1 | 5.129s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-11.png) |
| explore-wall-text-12 | 1 | 8.287s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-12.png) |
| explore-wall-text-13 | 1 | 10.121s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-13.png) |
| explore-wall-text-14 | 1 | 12.954s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-14.png) |
| explore-wall-text-15 | 1 | 7.822s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-15.png) |
| explore-wall-text-16 | 1 | 5.246s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-16.png) |
| explore-wall-text-17 | 1 | 10.167s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-17.png) |
| explore-wall-text-18 | 1 | 7.869s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-18.png) |
| explore-wall-text-19 | 1 | 6.058s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-19.png) |
| explore-wall-text-20 | 1 | 7.033s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-20.png) |
| explore-wall-text-22 | 1 | 5.293s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-22.png) |
| explore-wall-text-23 | 1 | 7.149s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-23.png) |
| explore-wall-text-24 | 1 | 5.484s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-24.png) |
| explore-wall-text-25 | 1 | 6.801s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-25.png) |
| explore-wall-text-26 | 1 | 6.452s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-26.png) |
| explore-wall-text-27 | 2 | 6.127s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-27.png) |
| explore-wall-text-29 | 1 | 5.438s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-29.png) |
| explore-wall-text-30 | 1 | 5.315s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-30.png) |
| explore-wall-text-31 | 1 | 6.013s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-31.png) |
| explore-wall-text-32 | 1 | 8.867s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-32.png) |
| explore-wall-text-33 | 1 | 5.198s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-33.png) |
| explore-wall-text-34 | 1 | 8.798s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-34.png) |
| explore-wall-text-35 | 1 | 6.220s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-35.png) |
| explore-wall-text-36 | 1 | 7.706s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-36.png) |
| explore-wall-text-37 | 1 | 6.691s | Added/tested | Incomplete source ending | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-37.png) |
| explore-wall-text-38 | 1 | 6.127s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-38.png) |
| explore-wall-text-39 | 1 | 6.622s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-39.png) |
| explore-wall-text-40 | 1 | 6.522s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-40.png) |
| explore-wall-text-41 | 1 | 6.384s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-41.png) |
| explore-wall-text-42 | 1 | 63.565s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-42.png) |
| explore-wall-text-43 | 1 | 6.359s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-43.png) |
| explore-wall-text-44 | 1 | 6.431s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-44.png) |
| explore-wall-text-45 | 1 | 12.770s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-45.png) |
| explore-wall-text-46 | 1 | 5.948s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-46.png) |
| explore-wall-text-47 | 1 | 6.127s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-47.png) |
| explore-wall-text-48 | 1 | 15.767s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-48.png) |
| explore-wall-text-49 | 1 | 6.361s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-49.png) |
| explore-wall-text-50 | 1 | 9.517s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-50.png) |
| explore-wall-text-51 | 1 | 6.917s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-51.png) |
| explore-wall-text-52 | 1 | 10.167s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-52.png) |
| explore-wall-text-53 | 1 | 6.754s | Added/tested | Incomplete source ending | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-53.png) |
| explore-wall-text-54 | 1 | 6.523s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-54.png) |
| explore-wall-text-55 | 1 | 7.869s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-55.png) |
| explore-wall-text-56 | 1 | 7.428s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-56.png) |
| explore-wall-text-57 | 1 | 6.519s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-57.png) |
| explore-wall-text-58 | 1 | 6.336s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-58.png) |
| explore-wall-text-60 | 1 | 8.240s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-60.png) |
| explore-wall-text-61 | 1 | 11.375s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-61.png) |
| explore-wall-text-62 | 1 | 9.912s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-62.png) |
| explore-wall-text-63 | 1 | 7.475s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-wall-text-63.png) |
| explore-paired-wall_text-d3259c1239762b2daa319893 | 1 | 6.197s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-paired-wall_text-d3259c1239762b2daa319893.png) |
| explore-paired-wall_text-1d9ddc3d4a768263d88460f0 | 1 | 7.126s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-paired-wall_text-1d9ddc3d4a768263d88460f0.png) |
| explore-paired-wall_text-a7691418a6df49c274c4d888 | 1 | 8.054s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-paired-wall_text-a7691418a6df49c274c4d888.png) |
| explore-paired-wall_text-499cd7912d85e60e54ac54be | 1 | 7.497s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-paired-wall_text-499cd7912d85e60e54ac54be.png) |
| explore-paired-wall_text-abb1480dfd075d5c7923b4d6 | 1 | 10.191s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-paired-wall_text-abb1480dfd075d5c7923b4d6.png) |
| explore-paired-wall_text-d2a11374187469b8f8baee61 | 1 | 14.185s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-paired-wall_text-d2a11374187469b8f8baee61.png) |
| explore-paired-wall_text-f056193f755c5158c5e8a7c4 | 1 | 8.426s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-paired-wall_text-f056193f755c5158c5e8a7c4.png) |
| explore-paired-wall_text-a2095596d4455693771d474d | 1 | 6.268s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-paired-wall_text-a2095596d4455693771d474d.png) |
| explore-paired-wall_text-8bcb0bf4213f07cc7c8449dc | 1 | 5.176s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-paired-wall_text-8bcb0bf4213f07cc7c8449dc.png) |
| explore-paired-wall_text-6862d30ad45084699b168503 | 1 | 6.918s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-paired-wall_text-6862d30ad45084699b168503.png) |
| explore-paired-wall_text-cad94a858b67a9f021e1f1d5 | 1 | 5.942s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-paired-wall_text-cad94a858b67a9f021e1f1d5.png) |
| explore-paired-wall_text-7a8441666cf28f6b5bcc37e8 | 1 | 7.080s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-paired-wall_text-7a8441666cf28f6b5bcc37e8.png) |
| explore-paired-wall_text-c2db42671f78f22cc195fbb3 | 1 | 5.333s | Added/tested | - | [PNG](C:/Users/chund/OneDrive/Desktop/UGC/outputs/wall-layout-batch-20261028/complete-review/explore-paired-wall_text-c2db42671f78f22cc195fbb3.png) |
