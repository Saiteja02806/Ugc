# Stage 2 trait correction — 4 November 2026

Status: implemented locally; live generation inspection pending.

## Scope
New character jobs freeze version 2 stage instructions and validated indices for selected hairstyle/accessory references. Stage 2 receives scene, primary face, then selected trait references with explicit roles. It may correct hair/accessories; the primary photo remains the only facial identity authority. Keep-existing hair uses primary identity hair; independent hair colour remains authoritative. No automatic crop is used because a generic crop could remove hairstyle geometry. Historical version 1 stage prompts and reference lists retain their original behavior.

Changed files in this task:
- lib/characters/studio-selection.ts
- lib/characters/generation-service.ts
- worker/src/lib/character-image-pipeline.ts
- lib/characters/identity-stages.test.mjs
- lib/characters/generation.test.mjs
- components/characters/influencer-studio.test.mjs (correct existing nondeterministic assertion that incorrectly required a nonempty accessory selection)
- docs/ai-context/clear.md
- EXPLORE_CONTEXT.md
- this report

Stage 1 generation inputs/provider, harmonizer, UI implementation/CSS, pricing, queue, storage catalog and other workflows unchanged. No build, development server, push or deployment. Rollback only these task changes; preserve other dirty work.

## Evidence
Context-memory, immutable-contracts, video-prompt and regression-gate skills applied. AGENTS, nonnegotiables, relevant Explore/incident history, prior stage report, actual saved prompt/images and current admission/worker/tests inspected. Large context-file tool output was truncated; no claim of a new complete read of those files. Prior session context retained. Preflight read-only command passed in the preceding audit.

221 character/component tests PASS. 70 worker/provider/harmonizer/recovery tests PASS. App and worker TypeScript noEmit PASS; scoped ESLint PASS; scoped diff whitespace check PASS. Test logs under .tmp/character-stage2-traits-20261104.

New tests verify stage 1 retains all original references; stage 2 forwards only face plus selected hair/accessory images in labelled order; missing/out-of-range/duplicate/invalid-role references fail before a paid stage; keep-existing and none rules remain explicit; admission freezes exact indices. Existing recovery tests passed. These tests do not prove model pixel adherence.

Protected UI implementation unchanged VERIFIED by scope; fresh desktop/mobile and authenticated hosted click-through NOT TESTED. Selected-accessory real-output acceptance NOT VERIFIED by the no-accessory canary. New stage route remains local source only until a separately authorized compatible-worker-first deployment.

Incident UGC-GEN-20261104-CHARACTER-STAGE2-TRAITS linked to CHARACTER-IDENTITY-STAGES and CHARACTER-VISUAL-ADHERENCE.

## Real generation result
Job eb15d5d4-5e0d-4548-aecc-a8b4c4b358ce completed; asset 93e0f973-e57f-4ebb-9c36-af2aeeda7c9e. Current source admission/processor exercised real backend/provider/storage; not a hosted-browser deployment test. Reserved about 02:45:58 IST, completed 02:48:46 IST on 4 November 2026. One application credit committed, balance 712 to 711; two provider stages plus local harmonizer, all four aggregate/stage operations output_persisted. Frozen stage-2 fingerprint independently reconstructed from the exact prompt + saved scene + primary face + selected haircut bytes MATCHES the backend receipt. UI selection and negative-prompt snapshots match. No extra paid retries.

Actual full image and original-resolution identity crop inspected: blue eyes, bare ears/no visible accessories, platinum short hair, red jacket, bedroom and full-body shoes present. Hair is short and no longer the earlier tight curls, but its swept top is not an exact match to the choppy reference. Stage 1 already generated short hair in this sample; therefore this test does not establish that stage 2 corrected a bad curly input. Primary face resemblance remains partial: moustache is present, but exaggerated primary facial proportions/goatee are not faithfully reproduced. Do NOT label exact identity or hairstyle fidelity fixed. No-accessory visual result PASS in this sample; selected-accessory image adherence NOT TESTED live.

Artifacts: .tmp/character-stage2-traits-20261104/output.png, identity-face.png, openrouter-image-{scene,identity,harmonize}-v1.png, identity-prompt.txt, receipt.json. No production deployment. Overall PARTIALLY VERIFIED; stage wiring and real completion verified, exact fidelity and repeated reliability remain open.
