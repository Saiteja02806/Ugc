# Hook 100 pilot verification — 26 October 2026

Status: PARTIALLY VERIFIED locally. UGC-VID-010 remains OPEN.

## Scope and behavior

Only new requests for `explore-paired-hook-fc44f6214b6e17413600ec13`
use the full-recreation pilot. Original source frame 0 supplies opening scene
and posture; reviewed frame 70 at elapsed 2.333333 seconds supplies later
continuity evidence; ordered user photos supply identity. Receipt v4 binds both
source-frame roles and the browser preparation. The generated opening output
is the image approved for animation. The motion plan covers original t=0 to
the ending, including the opening glasses removal exactly once.

The UI implementation is unchanged. Existing v1–v3 receipts remain supported.
No schema, dependencies, scheduling behavior or other reference prompts changed.
Rollback boundary: restore the prior pilot routing, API/receipt and provider
changes together; preserve accepted receipt parsers when existing v4 jobs exist.

## Preflight sources actually read

- `AGENTS.md`, `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`, and
  `docs/ai-context/nonnegotiables.md`.
- `.agents/skills/ugc-context-memory/SKILL.md`,
  `ugc-immutable-contracts/SKILL.md`, `ugc-ui-clarity/SKILL.md`,
  `ugc-frame-analysis/SKILL.md`, `ugc-starting-frame/SKILL.md`,
  `ugc-video-prompt/SKILL.md` and its temporal-recreation reference,
  and `ugc-regression-gate/SKILL.md`.
- Installed Next.js 16.4.2 route-handler and server/client component guides.
- Repository preflight script passed before implementation.

## Files changed for this pilot

- `lib/explore/hook-full-recreation-pilot.ts`
- `lib/explore/hook-full-recreation-pilot.test.ts`
- `lib/explore/hook-curated-motion.ts`
- `lib/explore/hook-curated-frames.test.ts`
- `lib/explore/hook-source-frame.ts`
- `lib/explore/hook-source-frame.test.ts`
- `lib/explore/hook-keyframe-image-prompt.ts`
- `lib/explore/hook-keyframe-generation-api.ts`
- `lib/explore/hook-keyframe-generation-api.test.mjs`
- `lib/explore/hook-keyframe-client.ts`
- `lib/explore/hook-keyframe-client.test.ts`
- `lib/explore/hook-keyframe-draft.ts`
- `lib/explore/hook-keyframe-result.test.mjs`
- `lib/explore/hook-starting-frame-history.ts`
- `scripts/prepare-hook-source-frames.mjs`
- `scripts/prepare-published-hook-frames.mjs`
- `worker/src/lib/hook-full-recreation-pilot.ts`
- `worker/src/lib/hook-keyframe-generation-contract.ts`
- `worker/src/lib/hook-keyframe-image-model.ts`
- `worker/src/lib/gemini-image.ts`
- `worker/src/lib/gemini-image-context.test.mjs`
- `worker/src/jobs/generate-image.ts`
- `worker/src/jobs/generate-hook-video.test.mjs`
- `EXPLORE_CONTEXT.md`
- `docs/ai-context/clear.md`
- `docs/hook-full-recreation-identity-anchor-plan-2026-10-25.md`
- This verification receipt.

Other dirty worktree paths belong to separate work and were preserved.

## Verification evidence

| Check | Result and boundary |
|---|---|
| `npm run worker:build` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS: zero errors, 53 repository warnings |
| Targeted Hook API/frame/prompt/draft/history suite | PASS: 101 tests before final client-recovery addition |
| Worker Gemini image unit tests | PASS: 11 tests |
| Actual Gemini adapter with mocked external call | PASS: 8 tests, including v4 ordered roles and rejection of wrong anchor bytes |
| Hook video worker with mocked provider | PASS: 23 tests, including generated-opening-only FIRST_FRAME |
| Client recovery + starting-frame UI + local source preview + split pane | PASS: 52 tests, including added v4 preparation/model rejection |
| `node scripts/hook-recreate-layout.browser.cjs` | PASS outside sandbox: Hook, Wall and Talking Head at 1440×900, 1280×720, 390×844 and 320×568; no horizontal overflow |
| `git diff --check` | PASS; line-ending notices only |
| `npm run test:explore` | FAILED in broad existing workflow harnesses/expectations; examples include missing lazy-component mocks, missing job-read mock exports and old gallery playback-source expectations. No clean baseline run was available, so pre-existence of every failure is NOT VERIFIED. These failures prevent treating the combined worktree as release-ready. |
| `npm run build` | PASS outside sandbox: production compilation, TypeScript, all 239 static pages and native Hook decoder route-bundle verification completed |
| Final pilot/client/curated tests | PASS: 10 tests after the final test and documentation changes |
| Storage preparation script syntax | PASS: both preparation scripts pass `node --check` |

Browser screenshots are under `.tmp/hook-recreate-layout/`. Desktop
`1440-results.png` and phone `hook-320-results.png` were visually inspected:
result selection, review actions and bounded phone layout remain visible. This
fixture uses existing sample media and is not a generated Hook 100 quality trial.
No approved golden screenshot comparison was available.

## Protected contracts

- VERIFIED locally: exact source identity/hash, frame timestamps, ordered user
  photos, separately validated opening and clarity bytes, full motion chronology,
  rejection of changed preparation, recoverable legacy receipts, and generated
  output as the sole approved video opening.
- VERIFIED in focused UI tests: existing preview/Change entry, loading/error
  recovery, selected result approval and responsive layout.
- NOT TESTED: authenticated production navigation and backend execution; this
  implementation has not been deployed.
- NOT TESTED: live stored Hook 100 frame-zero object availability.
- NOT TESTED: real generated identity, opening occlusion, hand/object fidelity,
  scene preservation or full-video action timing.

## Next acceptance gate

Prepare/verify the pilot's original frame-zero storage, then run one controlled
still request with a reviewed influencer photo selection. Review the still before
animation. If it matches source t=0, animate once and inspect every decoded frame
against the source timeline. Record model, prompt hash, request/asset IDs, cost,
duration and independent identity/scene/hands/timing results. Keep other references
on their current path until this pilot has visual acceptance.

No paid generation, production storage write, deployment or automatic retry was
performed during the local pilot implementation.

## Subsequent real image trial

The user then authorized one real Hook 100 trial. One image completed and failed
visual acceptance because it retained the original caption, although the t=0
glasses/hand pose and source setting broadly survived. The retained Google input
confirms both frame roles, the chosen portrait and full cleanup prompt. Video
generation was not started after this failure; no broader reference change or
deployment followed. See `docs/hook100-real-trial-2026-10-26.md` for the completed
operation, hashes, usage, visual review and next correction.

## Authorized caption correction and video retest

The next authorized trial targeted the exact caption text/region in Hook 100's
pilot prompt. One new image passed caption/pose/scene review and was used for
one real four-second Omni video. All 96 decoded frames were reviewed. Caption
removal and original opening-action coverage pass for this trial, but the video
cuts to the portrait's bedroom scene at 3.75 seconds and has central-expression
and timing deviations. Overall recreation FAILED acceptance. No other references
were changed or deployed. Correct provider role/input delivery was independently
read back; raw/silent pictures are identical. Evidence, changed files, tests and
new UGC-VID-011: `docs/hook100-caption-retest-2026-10-26.md`.
