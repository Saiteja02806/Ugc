# Explore Wall automatic placement — local implementation and verification

28 October 2026. No deployment, paid generation, production settings change or hosted database write.

## Scope and constraints

Implement automatic editable Wall copy for the six reviewed Investing & Money references only, using source-ID/SHA-bound versioned layouts. Preserve full selected Wall duration, existing Hook behavior, saved/local/pending drafts and explicit empty text. Keep existing editing controls and use the existing automatic text checkbox, labeled for the active workflow. Unknown references and unsupported aspect ratios do not receive guessed layouts. Rollback boundary: keep the new Wall flags unset; accepted receipts continue recovery.

Preflight: AGENTS.md; applicable Explore/Wall context and incident ledger entries; docs/ai-context/nonnegotiables.md; ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-regression-gate, ugc-frame-analysis; REPEATABLE_SOURCE_PROMPT_REVIEW.md; installed Next use-client guide. Repository preflight passed prerequisite discovery. Existing dirty source/staged work was preserved. Context files are large and combined tool reads were truncated; this receipt does not claim a new full re-read of every historical line. Relevant current contracts were inspected separately. No new source-motion or image prompt was written.

## Measurements and refinements

Reviewed all six 720x1280 original opening frames. The earlier thumbnail estimates for 01 and 02 were wrong: both have six visible lines, not seven. These figures are candidate application container dimensions and canonical font sizes, not recovered source authoring settings. Exact source font identity is unknown. The existing app Proxima Nova A Semibold is used consistently.

| Source | Lines | Width | Equal side inset | Top | Size at 1080 width | Line-height multiplier | Outline at 1080 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 01 | 6 | 84% | 8% | 62% | 54 | 1.20 | 8 |
| 02 | 6 | 62% | 19% | 40% | 50 | 1.24 | 8 |
| 03 | 4 | 65% | 17.5% | 53% | 58 | 1.12 | 8 |
| 04 | 8 | 64% | 18% | 46% | 46 | 1.17 | 1 |
| 05 | 4 | 64% | 18% | 57% | 64 | 1.16 | 8 |
| 06 | 10 | 64% | 18% | 52.5% | 44 | 1.24 | 8 |

Initial larger candidates for 01/02 rewrapped authored lines. The measured renderer caught this; reduced sizes now preserve all original lines at 196/277/390/720/1080 widths. Added bounded optional lineHeight to the shared parser/layout because fixed 1.35 made dense blocks too tall. Absent fields keep exact old defaults and are omitted from historical JSON. No global font, layout, control or saved-style replacement.

## Runtime behavior

- New Wall admission needs BOTH server `EXPLORE_AUTOMATIC_WALL_TEXT_ENABLED=true` and browser `NEXT_PUBLIC_EXPLORE_AUTOMATIC_WALL_TEXT_ENABLED=true` for the UI, plus existing Remix prerequisites. No environment file or hosted flag was changed. Both flags default off when absent.
- Only verified six-reference 9:16 single-block sources are eligible. The source, business context, copy prompt and exact layout snapshot freeze before work. Worker validates source/layout roles before either provider call. Wall uses existing Wall copy instructions, not Hook's brevity rules. No paid outputs were evaluated in this step.
- Shared claim/recovery logic retains one durable text request; uncertain/failed calls are not automatically resubmitted. Internal `automaticHookText` receipt name remains for compatibility; its source format and output editing format explicitly distinguish Wall.
- Completed owned Wall output supplies initial content only for an untouched Wall scope. It requires matching request/reference/hash bindings and full actual output duration, and rejects any Hook timeline. It does not create a fake saved revision.
- Existing saved server drafts take priority; local changes, pending saves and deliberate empty text also take priority through the established draft hook/editor. Text remains separately editable. No Hook auto-cut, new Wall duration default or source-motion rewrite.
- Fit preserves exact copy and authored breaks; permits modest bounded size reduction, never truncation or Hook grow-to-fill. Unsafe fit returns review-needed output; the existing Wall editor requires the user to add/review text before saving.

## Verification

VERIFIED locally:

- 73 focused layout/automatic-plan/claim/draft/API/Remix/editor checks passed.
- 25 worker tests passed, including Wall full output duration and invalid-layout rejection before text/video providers.
- 87 integration checks passed covering generation admission, common editor/source binding and identity/starting-frame controls.
- App TypeScript, worker build, scoped ESLint and scoped diff whitespace check passed.
- Browser: actual FormatVideoTextFields, overlay, useClipDraftSave hook and transport compiled in a local fixture. Six initial source-word placements rendered; editable copy/font/width saved, then local overlay storage removed and server fixture receipt reopened correctly. Blank removal survived reload. No horizontal overflow at 390px. The backend is a local in-memory fixture, not Supabase/production. Full FormatVideoEditor restoration handlers additionally exercised by Node component tests.
- Actual renderExploreFormatEdit generated seven H.264/AAC MP4s on a neutral 720x1280 canvas: six source profiles plus the browser-saved custom edit. ffprobe confirmed 12 seconds for every output; opening and 11.9-second decoded frames contained text. All six source-versus-export opening comparisons visually inspected, plus dense and saved-edit ending frames and mobile screenshot. This is renderer acceptance, not generated-scene readability or animation acceptance.

Evidence: `outputs/wall-layout-pilot-20261028/{tests,worker-tests,integration-tests,typecheck,worker-build,lint,browser,export}.log`; `.tmp/wall-automatic-text-browser/reference-1-desktop.png` through `reference-6-desktop.png`, `saved-mobile.png`, `saved-export.json`; `outputs/wall-layout-pilot-20261028/export-1793187652550/receipt.json` and each case's `format-edited.mp4`, opening/ending PNGs and source-v-export.png.

NOT VERIFIED: authenticated hosted generation/save/reopen/export; real OpenAI Wall copy with these profiles; actual footage contrast/occlusion throughout motion; exact font matching; whole application sibling navigation and production acceptance. No deployment while the user's hold remains.

## Files changed in this step

- worker/src/lib/wall-initial-text-layout.ts (new profiles/initializer)
- worker/src/lib/wall-initial-text-layout.test.ts (new)
- worker/src/lib/explore-format-edit.ts (optional persisted spacing)
- worker/src/lib/automatic-hook-text.ts (Wall validation/output branch)
- worker/src/jobs/generate-hook-video.ts and .test.mjs (Wall receipt dispatch/full-duration check)
- lib/explore/automatic-hook-text-plan.ts and .test.mjs (separate admission flag and frozen profile)
- lib/explore/clip-draft-store.ts, clip-draft-client.ts, clip-initial-timing.test.mjs (owned initial Wall draft)
- lib/explore/remix-text-api.ts (Wall readiness)
- lib/ai-studio/video-generation-api.ts (portrait admission)
- components/video/video-generation-workspace.tsx (reuse existing automatic checkbox for eligible Wall references)
- scripts/automatic-hook-text-editor.test.mjs (Wall restoration/edit protection; explicit Hook fixture format)
- scripts/wall-automatic-text.browser.cjs and wall-automatic-text-export.mjs (new reproducible local verification)
- EXPLORE_CONTEXT.md, WALL_TEXT_CONTEXT.md, docs/ai-context/clear.md and this receipt (documentation)

Related incidents: UGC-VID-026 Wall duration/workflow protection; UGC-UI-044 Hook layout protection. UGC-UI-046-WALL-AUTO records this Wall gap and local verification, while hosted acceptance remains open. No staging, commit or push.
