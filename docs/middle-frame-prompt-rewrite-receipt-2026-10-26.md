# Middle-frame prompt rewrite receipt — 26 October 2026

Status: **Drafting and offline validation complete; generated-output acceptance NOT VERIFIED. No activation.**

## Scope

Prepared31 source-specific prompt pairs (21 public Hook, ten private Recreate-the-account). Each preserves original t=0, observed movement/holds and the ending. The later frame is clarity evidence, not the animation opening. A reconstructed influencer t=0 image requires visual approval before animation.

The provider prompts use the Hook100 pattern: opening/camera, compact time intervals with observable actions, and ending/continuity. Source hashes and full source/generated timing evidence stay outside provider prose. Default draft durations are whole-second examples close to source length; they do not change product defaults. Hook12's separate trial is explicitly three seconds.

## Preflight and source review

Continuing preflight sources: AGENTS.md, EXPLORE_CONTEXT.md, docs/ai-context/clear.md and nonnegotiables.md; the existing31-case audit and exact frame inventory. Applicable project skills actually read in this continuing task: ugc-context-memory, ugc-immutable-contracts, ugc-frame-analysis, ugc-starting-frame, ugc-video-prompt, ugc-middle-frame-recreation-prompt, ugc-opening-frame-prompt and ugc-regression-gate. The connected create-ugc-media skill/capability contract was inspected; its single-reference limit cannot represent the three-role image preparation. No capability was bypassed through an MCP token.

`python tools/preflight.py --repo . --task <draft full-source middle-frame prompts; isolated pilot before rollout>` passed discovery/readability; this is not runtime acceptance. Existing unrelated dirty work was preserved.

Source review documents record118 native sheets/3,110 decoded frames reviewed across the team at sheet resolution, plus targeted full-resolution opening/anchor/transition images. All31 actual local video hashes were reconciled against manifests. Frame indexes, selected times and anchor hashes were reconciled by stable IDs. Hook71 has a documented nominal-clock/PTS discrepancy; some other beat boundaries are approximate. No claim of packet-accurate timing or individual full-resolution annotation of every decoded frame.

## Files produced or updated in this drafting phase

- docs/prompt-reviews/middle-frame-public-a-2026-10-26.json
- docs/prompt-reviews/middle-frame-public-b-2026-10-26.json
- docs/prompt-reviews/middle-frame-private-2026-10-26.json
- docs/prompt-reviews/middle-frame-full-recreation-drafts-2026-10-26.json
- docs/prompt-reviews/middle-frame-full-recreation-drafts-2026-10-26.md
- docs/hook12-opening-image-test-prompt-2026-10-26.txt
- docs/hook12-three-second-test-prompt-2026-10-26.txt
- scripts/compile-middle-frame-prompt-drafts.mjs
- scripts/compile-middle-frame-prompt-drafts.test.mjs
- scripts/run-hook12-middle-frame-image-trial.mjs
- scripts/run-hook12-middle-frame-video-trial.mjs
- docs/ai-context/clear.md (append-only incident)
- EXPLORE_CONTEXT.md (append-only drafting/rollout note)
- docs/middle-frame-prompt-rewrite-receipt-2026-10-26.md

Ignored local diagnostic inputs/receipt: outputs/hook12-middle-frame-trial-2026-10-26/. They contain source/identity pixels and are not production upload or queue evidence. Prior Hook100 trial scripts, prompts and receipts are unchanged.

## Pilot and authorization

Selected Hook12: source SHA0e261c745ea8a9957168683b5d7e5271a8f5e83884a58d53011149ea4ca03f57, original frame0, clarity frame36 at1.200seconds. Prepared three labeled inputs: original scene/opening, later clarity, and the same owned influencer portrait used for Hook100. Intended model candidates: gemini-3-pro-image at2K, then gemini-omni-1.1-flash for3seconds if the image passes. No model inference was run.

A provider model-read preflight failed sandbox DNS. Automatic approval review rejected escalation, citing local credentials, transmission of source/identity imagery and potential paid inference without specific Hook12 payload approval. The user then explicitly selected **Finish prompt drafts without paid generation**. The work therefore ends at offline drafting/validation: imagePaidPosts=0, videoPaidPosts=0, no provider operation IDs. Do not retry without a new user instruction.

## Verification

- `node --test scripts/compile-middle-frame-prompt-drafts.test.mjs`:10/10 PASS. Covers exact31-case coverage/provenance, complete contiguous source clocks, duration remapping, supported integer output durations3–10, opening/clarity/identity roles, invalid data, shared time boundaries and Hook12 sip/lower/trickle/ending.
- `node --import ./scripts/next-server-only-test-loader.mjs --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-transform-types scripts/run-hook12-middle-frame-image-trial.mjs --validate-inputs`:PASS, zero provider calls. Actual source, anchor and identity hashes validated; decoded original opening is720×1280 at index0/time0, anchor is index36/time1.2; three inputs remain distinct.
- `node --check` on all four authoring/trial scripts:PASS.
- Scoped `git diff --check`:PASS.
- Combined draft count31; motion prose968–1553characters, image prose1235–1538characters. These are for the application-provider authoring route, not a claim of compatibility with the connected MCP's smaller prompt/reference limits.
- No application build/browser verification run for this phase because only offline scripts and authoring documents changed. This does not qualify the existing worktree's unrelated pending application changes for release.

## Protected behaviors and remaining acceptance

| Behavior | Result |
|---|---|
| All31 IDs/source hashes/anchor selections retained | VERIFIED against inventory/manifests |
| Draft timelines cover original t=0 to ending | VERIFIED structurally and source-reviewed; timing approximations disclosed |
| Roles distinguish opening, later clarity and influencer identity | VERIFIED in draft assembly/offline pilot inputs |
| Active application prompts, saved edits and frozen requests unchanged | VERIFIED: no runtime integration or data writes in this phase |
| UI/scheduling/source manifests unchanged by this patch | VERIFIED by edit scope; browser regression NOT TESTED |
| Generated starting-image pose, identity and caption cleanup | NOT TESTED |
| Generated-video chronology, hands, emotion, scene and ending | NOT TESTED |
| Hosted queue, credits, storage and production workflows | NOT TESTED; no production mutation |

UGC-VID-012 remains OPEN: the initial thumbnail-level Hook12 candidate omitted the visible drink trickle; full-resolution source review corrected the draft. UGC-VID-010/011 remain open/partially qualified from prior Hook100 evidence. No new output can establish a fix.

Rollback boundary: only these offline authoring files and appended notes. None is imported by application generation code. The next real trial must approve the generated original-opening image first, then compare the full generated video with the explicitly retimed source before any wider application.
