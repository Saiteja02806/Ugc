# Hook reference decisions — 29 October 2026

Status: locally verified catalog/product decisions; no deployment or paid generation.

User explicitly approves original-opening recreation for Hooks39,51,57,64,72,83 and removes only airplane Hook19. Existing source-frame-zero, source lighting/composition/props, influencer identity and source text/logo cleanup contracts apply. Keep51's original cut,83's intentional facial crop,72's purple bottle/repeated movement,39/57's offscreen prop exits and64's camera movement. Approval resolves the product decision; generated-media quality remains NOT VERIFIED.

## Scope and files

- `worker/src/lib/explore-hook-reference-release.json`: adds only19 to the existing exclusion list. All media items remain intact for archive/saved-job resolution. Gallery106.
- `lib/explore/hook-keyframe-motion-plans-b.json`: resolves39/51/57/64 static review decisions and removes obsolete pending-decision constraints.
- `lib/explore/hook-keyframe-motion-plans-c.json`: resolves72/83 static review decisions. Existing opening states, beats and durations retained.
- `lib/explore/hook-user-decisions.test.ts`: new catalog/archive, six preview/cleanup and all-active decision tests.
- `lib/explore/hook-keyframe-generation-api.test.mjs`: retains generic unresolved-decision rejection test via injected review state; adds six real-catalog admission, exact frame0, ordered identity photos and same-request recovery cases.
- `lib/explore/hook-motion-rewrite-contract.test.ts`: updated resolved and historical decision inventory. Corrects pre-existing stale inventory expectation: baseline already approved22; current unresolved history19/28/84 is not gallery admission.
- `scripts/hook-reference-release.test.mjs`, `scripts/hook-reference-prompts-release.test.mjs`, `scripts/explore-reference-audio-job.test.mjs`: update gallery/source-text counts after removal of19.
- `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`, this receipt: record explicit current decisions, incident and verification.

Rollback boundary: restore these three JSON data files from `.tmp/hook-decisions-20261029/baseline` and corresponding task test expectations. Preserve the rest of the dirty worktree. No application component, provider payload shape, scheduling code, dependency, schema or configuration changed.

## Preflight and evidence

Applied repository context-memory, immutable-contracts, UI-clarity, starting-frame, video-prompt, opening-frame-prompt and regression-gate procedures; frame-analysis skill read earlier in this conversation. Repository AGENTS/context/nonnegotiables and existing incident history were available from preceding work; current Explore/clear tail entries and relevant code/callers were inspected again. Read installed Next `use-client.md`. Ran `python tools/preflight.py --repo . --task ...` successfully. No fresh frame-by-frame inspection or generated-image quality review claimed. User's explicit decisions and existing source-bound plans are the basis for approval.

## Validation

Logs: `.tmp/hook-decisions-20261029/`.

- Node test loader + experimental module mocks/type transform, eight Hook/catalog/UI/API/result files, `--test-skip-pattern="opening actions"`:121PASS. `verified-tests.log`.
- Rebuilt worker then `scripts/explore-reference-audio-job.test.mjs`:6PASS. `audio-tests.log`.
- Unfiltered combined run:121PASS/1FAIL. Existing `opening actions continue...` test expects `already-joined palms`; unchanged Hook22 plan says `already-interlaced grip ... joined palms`. Baseline runner loads pre-change JSON backups and reproduces exactly the same failure; `baseline-stale-test.log`. No unrelated motion or assertion changed to mask this gap.
- `npx tsc --noEmit --incremental false`:exit0. `types.log`.
- `npm --prefix worker run build`:exit0. `worker-build.log`.
- Scoped ESLint:exit0, zero errors; pre-existing unused test-variable warning remains. `lint.log`.
- `.tmp/hook-decisions-20261029/verify-data.py`:PASS; all other entries identical, all opening states/beat timelines/source hashes/sampled evidence and release media items retained; only19 newly excluded.

Protected behavior: original frame0/identity/cleanup/silent motion and archive recovery VERIFIED by local tests; no Creator Phone, schedule, layout or component edits. Real desktop/mobile visuals and authenticated production persistence/provider output NOT TESTED in this task. Full application production build not rerun for this data-only adjustment. No deployment, publishing or paid media calls. Prior full build is historical evidence only.

Incident `UGC-VID-029-HOOK-DECISIONS` records explicit approval locally verified, production/generation acceptance open. Existing `UGC-UI-054-EXPLORE-SIX` gate remains: any future unresolved motion decision still blocks new paid image admission while accepted requests recover without rebilling.
