# Runtime assignment of31 middle-frame prompt pairs — 26 October 2026

**Status: locally wired and tested; not deployed. Generated-output fidelity NOT TESTED.**

## Behavior

New preparation selects the video-specific opening-image prompt and full-source motion plan by stable reference ID, exact source SHA and selected clarity frame index/hash/time. The source opening and later clarity frame are distinct inputs; the selected influencer photos control identity. The generated original-opening image must be reviewed before animation.

The motion timeline is stored as normalized source phases and mapped at final prompt assembly to the actual chosen video duration. Every plan includes original t=0, actions/holds and the ending. Explicit edits—including an empty edit—are retained. Saved old images retain selected-pose continuation suggestions; a full-source normalized timeline is rejected before billing when paired with a pre-v4 image receipt. Existing frozen jobs are recovered without recompiling or charging again.

Private original-opening and clarity stills use distinct canonical private URLs. Both are freshly signed before provider submission across ordinary and durable worker branches. Neither source still is written to public storage. Public data contains only21 public entries; private prose is read only in authenticated server catalogue paths.

## Assignment map

| Current video | Stable ID | Runtime assignment |
|---|---|---|
| Hook 12 | `explore-paired-hook-03d314d5268b8c31ec390bf1` | Public source-bound catalogue |
| Hook 15 | `explore-paired-hook-43cc1dae0a6cfcb03e0a9333` | Public source-bound catalogue |
| Hook 19 | `explore-paired-hook-e683292d4cd22b2a8b5a9cd8` | Public source-bound catalogue |
| Hook 20 | `explore-paired-hook-f1afdb3229e127c8b6563087` | Public source-bound catalogue |
| Hook 26 | `explore-paired-hook-09c4e9b5de6a85f0f4c371da` | Public source-bound catalogue |
| Hook 30 | `explore-paired-hook-9309a041061ae5abc6970d52` | Public source-bound catalogue |
| Hook 35 | `explore-paired-hook-bdc5af5aedfac3ddb93b4348` | Public source-bound catalogue |
| Hook 39 | `explore-paired-hook-99ff813ebc24c61f1c92828e` | Public source-bound catalogue |
| Hook 46 | `explore-paired-hook-4aa27111a23b04a6dd27717b` | Public source-bound catalogue |
| Hook 47 | `explore-paired-hook-892b0f65083c8cf03270a7c9` | Public source-bound catalogue |
| Hook 50 | `explore-paired-hook-c8b971f4cea086703e106c92` | Public source-bound catalogue |
| Hook 52 | `explore-paired-hook-114b58d5c22018e273a346de` | Public source-bound catalogue |
| Hook 64 | `explore-paired-hook-775bf4f0fc41f253d04663e2` | Public source-bound catalogue |
| Hook 71 | `explore-paired-hook-8d49391ade6ddf5261d43d2a` | Public source-bound catalogue |
| Hook 85 | `explore-paired-hook-bee95bd7a34b5d2a72775282` | Public source-bound catalogue |
| Hook 93 | `explore-paired-hook-61eb29067f56267684b7cfe6` | Public source-bound catalogue |
| Hook 94 | `explore-paired-hook-f12c90a72871c0cdaf3503db` | Public source-bound catalogue |
| Hook 96 | `explore-paired-hook-50dd086ef9d1c758d5ae3bb5` | Public source-bound catalogue |
| Hook 100 | `explore-paired-hook-fc44f6214b6e17413600ec13` | Public source-bound catalogue |
| Hook 101 | `explore-paired-hook-ddcfb2950d40f37771058b73` | Public source-bound catalogue |
| Hook 104 | `explore-paired-hook-185ed6ac17073e3bc1b8f6b5` | Public source-bound catalogue |
| creator-account-1-01 | `creator-account-1-01` | Private server package |
| creator-account-1-02 | `creator-account-1-02` | Private server package |
| creator-account-1-03 | `creator-account-1-03` | Private server package |
| creator-account-1-06 | `creator-account-1-06` | Private server package |
| creator-account-2-01 | `creator-account-2-01` | Private server package |
| creator-account-2-02 | `creator-account-2-02` | Private server package |
| creator-account-2-03 | `creator-account-2-03` | Private server package |
| creator-account-2-04 | `creator-account-2-04` | Private server package |
| creator-account-2-05 | `creator-account-2-05` | Private server package |
| creator-account-2-06 | `creator-account-2-06` | Private server package |

Public data: `lib/explore/hook-middle-frame-public.json`. Private local input: `lib/explore/creator-middle-frame-prompts.json` (ignored plaintext; never release this file). Private release asset: `lib/explore/creator-middle-frame-prompts.json.enc` (not generated here: existing package key unavailable locally). Detailed evidence remains in the31 reviewed source draft entries.

## Minimal change contract / rollback

Scope: assign31 reviewed prompt pairs; extend original-opening preparation and v4 role validation to those sources; remap motion at actual duration; retain manual edits/history and private delivery. No migration, dependency, layout/style, scheduling, provider-model default, credit policy or automatic generation/deployment change. Roll back only the assignment data/resolvers and associated new role paths, preserving existing user work and accepted receipts.

## Preflight sources and skills actually read

Continuing project sources: AGENTS.md, EXPLORE_CONTEXT.md, docs/ai-context/clear.md and nonnegotiables.md;31-case audit/inventory and source-reviewed draft files; actual API, preview, history, image/motion builders, worker delivery and tests. Ran tools/preflight.py with this runtime-assignment request; prerequisites passed. Read installed Next16 route-handler guidance before API work. Skills: ugc-context-memory, ugc-immutable-contracts, ugc-video-prompt, ugc-starting-frame, ugc-middle-frame-recreation-prompt, ugc-opening-frame-prompt, ugc-frame-analysis, ugc-ui-clarity and ugc-regression-gate. This phase reuses the prior source-frame review; it does not claim fresh full-video review or inference.

## Files changed in this assignment phase

The worktree already contains substantial unrelated changes; they were preserved. Assignment edits/new files:

- `.gitignore` — exclude new private plaintext input.
- `lib/explore/hook-middle-frame-public.json` —21 public source-specific entries.
- `lib/explore/creator-middle-frame-prompts.json` —10 local private entries, ignored.
- `lib/explore/hook-middle-frame-motion.ts` and `.test.ts` — provenance lookup, source phases, actual-duration remapping and all31 integration tests.
- `lib/explore/hook-curated-motion.ts` — new defaults and preserved legacy continuations.
- `lib/explore/hook-keyframe-motion.ts` — phase remapping during actual animation prompt construction.
- `lib/explore/hook-keyframe-image-prompt.ts` — per-source original-opening prompts; original Hook100 prompt/receipt compatibility retained.
- `lib/explore/hook-keyframe-generation-api.ts` and `.test.mjs` — two source roles, private-safe preparation and recovery tests.
- `lib/explore/hook-source-frame.ts` — private original opening resolves stored frame-zero poster.
- `lib/explore/creator-accounts.ts` — private assignments, image preview and legacy directions.
- `lib/explore/creator-private-files.ts` — encrypted package allowlist and safe absence handling for older packages.
- `lib/explore/recreate-types.ts` — authenticated preview/legacy direction fields.
- `lib/explore/hook-keyframe-prompt-preview.ts` — assigned defaults, correct image prompt and explicit-edit/legacy-image handling.
- `lib/explore/hook-starting-frame-history.ts` — recover verified prompt version and legacy directions.
- `components/explore/hook-starting-frame-workspace.tsx` — pass private preview/legacy data; no markup or style change.
- `lib/explore/hook-full-recreation-pilot.ts` — keep historical Hook100-only helper constrained.
- `lib/explore/hook-full-recreation-pilot.test.ts` and `hook-curated-frames.test.ts` — verify newly assigned full chronology.
- `lib/ai-studio/video-generation-api.ts` and `.test.mjs` — reject full timeline with older image; verify actual job text and duration.
- `worker/src/lib/hook-full-recreation-pilot.ts` —31 source/anchor identities for v4 admission, historical Hook100 constant unchanged.
- `worker/src/lib/creator-scene-delivery.ts` — explicit opening/anchor private capabilities.
- `worker/src/lib/hook-keyframe-generation-contract.ts` —31 v4 receipts and role-specific private URL validation.
- `worker/src/jobs/generate-image.ts` and `.hook-keyframe.test.mjs` — sign both private source inputs in every provider branch.
- `scripts/encrypt-creator-package.mjs` — include new private prompt input in existing encrypted release process.
- `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`, this receipt — current authorization, evidence and outstanding gates.

The existing public storage preparation scripts already call the expanded full-recreation lookup, so all21 sources become eligible without another script edit in this phase.

## Tests and evidence

- Preparation/history/source/receipt group:84/84 PASS; all12 private sources ×3 models exercised through actual API code with isolated auth/billing/persistence fixtures. No network/provider calls.
- Additional motion/component/model group:69/69 PASS (overlaps the new all31 test group; do not add these as unique totals).
- New all31 assignment/receipt/identity/edit/private-package group after final additions:4/4 PASS.
- Video admission:40/40 PASS; ordinary and atomic paths freeze correctly duration-mapped action text; pre-v4 image rejection occurs before reservation.
- Worker Hook image plus Gemini image-context checks:17/17 PASS, including fresh signatures for both private source roles in Flash/Pro branches.
- Authoring compiler:10/10 PASS.
- Worker `npm run build --prefix worker`:PASS.
- Application `npx tsc --noEmit --pretty false`:PASS.
- Scoped ESLint on edited runtime files:PASS.
- `git diff --check`:PASS.
- Actual-component `node scripts/hook-recreate-layout.browser.cjs`:PASS for Hook/TalkingHead/Wall at1440×900,1280×720,390×844,320×568; selection/approval/loading/dismissal/enlargement and no horizontal overflow. Sandbox initially could not launch Edge; rerun outside sandbox passed.
- Reviewed current desktop/mobile fixture screenshots `.tmp/hook-recreate-layout/hook-1440-settings.png` and `hook-390-settings.png`. No approved before/after pixel baseline is claimed; screenshot results are local fixture acceptance, not production or generated fidelity.

## Build and production prerequisites

The first Turbopack build stalled and was stopped. Webpack then hit ENOSPC with only~40MB free and a sandbox output-directory error. Cleared only verified project `.next/cache/webpack` and `.next/cache/turbopack` disposable build caches, freeing~3.2GB; no source or user media was removed. Retried the production webpack build; final outcome is recorded below.

Before deployment: use the existing CREATOR_PRIVATE_PACKAGE_KEY to encrypt the new10-entry private input using the updated package script; only ciphertext is releasable. Neither local environment file has that key, so no ciphertext was invented or unrelated package keys changed. Prepare and verify the21 public original-t0 stored frames via existing preparation scripts. Deploy matching website/worker code together, then verify authenticated workflows on https://www.getugcpilot.com. No production mutation or deployment was performed.

If an older private package lacks only the new file, unrelated routes/catalogues remain loadable. New full-recreation preparation with missing per-source data fails before billing rather than silently using a later pose with a t=0 timeline.

## Protected behaviors

| Contract | Status |
|---|---|
|31 source/prompt/anchor identities and full t=0-to-end mapping | VERIFIED locally |
|Explicit edits, old selected-pose image suggestions and frozen job recovery | VERIFIED locally |
|Two private source roles remain protected; no public source-image writes | VERIFIED with API/worker fixtures |
|UI controls/layout, loading/selection and sibling workflows | VERIFIED with local component journeys; production NOT TESTED |
|Scheduling execution/timezone/picker | Unchanged by this patch; live scheduling NOT TESTED |
|Generated image identity/pose/caption cleanup | NOT TESTED |
|Generated video emotion, anatomy, chronology and final frames | NOT TESTED |
|Production storage, encrypted package and deployed generation | NOT VERIFIED |

UGC-VID-010/011/012 remain open for real generated-output acceptance. Appending local wiring evidence does not close fidelity incidents. No paid generation request was submitted.


## Final build outcome

`npx next build --webpack` completed successfully (exit0): compilation, TypeScript, static-page generation and route tracing passed. Log: `.tmp/middle-frame-assignment-build-final.log`. Earlier stalled/disk/type-test failures remain documented above; none is presented as a successful check. No production deployment or inference occurred. Afterward the missing-private-package test was made independent of whether a real ciphertext file exists by using an isolated empty fixture directory;4/4 assignment tests still pass.
