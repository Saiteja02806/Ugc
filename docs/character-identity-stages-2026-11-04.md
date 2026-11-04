# Character scene → identity → harmonization — 4 November 2026

Status: implemented in worktree; real current-source execution VERIFIED; hosted deployment NOT VERIFIED. Identity visibly improved in one real canary, with remaining hairstyle/identity limitations.

## Scope and files

- `lib/characters/studio-selection.ts`: freezes a character-specific identity instruction block from validated selections. Primary identity supplies facial geometry and facial hair; independent eye/head/skin/hair/accessory selections override its incidental appearance.
- `lib/characters/generation-service.ts`: new Gemini studio requests with a primary face receive version 1 `characterIdentityPipeline`. Generic free-text, scratch characters without a face, other models and already-admitted jobs retain prior behavior. Old requests recover their original frozen jobs.
- New `worker/src/lib/character-image-pipeline.ts`: scene stage uses the ordered studio references; identity stage uses exactly the saved scene plus first/primary face photo; harmonization reuses the existing LAB luminance/grain implementation. Selected eye colour and no-accessory rules survive stage 2. Other reference people's faces cannot enter stage 2.
- `worker/src/jobs/generate-image.ts`: validates the explicit pipeline marker, binds it into the operation fingerprint, routes through the existing durable stage runner and persists final output only after all stages complete. Existing Hook and face-swap branches remain separate.
- Tests: new `lib/characters/identity-stages.test.mjs`; extended `lib/characters/generation.test.mjs`; `worker/src/jobs/generate-image.test.mjs` supplies the image-ratio export in its existing mocked module.
- Documentation: this report and append-only `EXPLORE_CONTEXT.md` / `docs/ai-context/clear.md`.

No UI component/CSS/labels, catalog bytes/URLs, schema migration, dependency, queue configuration, billing price, worker deployment or other workflow implementation changed in this task. Other intentional/concurrent worktree changes preserved. Rollback boundary is these scoped edits, not a reset of dirty files.

New path performs **two paid provider image calls plus one local harmonization** for one image result. Existing application reservation remains one image credit; provider spend is therefore higher than the old one-call path. No billing-price change was made.

## Preflight and verification

Sources used: `AGENTS.md`, `EXPLORE_CONTEXT.md` character contracts/history, `docs/ai-context/clear.md`, `docs/ai-context/nonnegotiables.md`, prior character audit/repair receipts, current compiler/selection/schema/admission/reference/worker/provider/harmonizer/stage-runner/store/processor and callers. Skills read/applied: context-memory, immutable-contracts, regression-gate and video-prompt; starting-frame role guidance consulted. Actual character workflow has no source video/timestamp, so no video-frame chronology was invented or changed. Read-only `tools/preflight.py` for this request PASS.

- Character/component suite **220/220 PASS**. Same direct Node command as earlier character receipts, no build wrappers.
- Worker image routing, provider pipeline and harmonizer suites **64/64 PASS** using `--import ./scripts/worker-source-test-loader.mjs` against current TS source.
- Durable stage recovery **9/9 PASS**: rejected stage 2 retains stage 1; harmonizer failures reuse paid stages; ambiguous calls never silently resubmit; lost writes/receipts recover; checksum/input changes and concurrent delivery covered.
- Final focused admission rerun **41/41 PASS**, including generic requests omit the new pipeline marker.
- App `npx tsc --noEmit --incremental false` and worker `npx tsc -p worker/tsconfig.json --noEmit --incremental false`: PASS.
- Scoped ESLint of seven changed source/test files: PASS. `git diff --check`: PASS.
- Logs `.tmp/character-thumbnails/stages-{tests,worker,recovery,admission,types,worker-types,lint}.log`.

VERIFIED: explicit primary-reference isolation, stage order, selected overrides, legacy generic path, persisted stage recovery, existing accessory/UI/component contracts and image-route tests. UI implementation/CSS unchanged by this task; fresh desktop/mobile screenshot comparison and deployed browser click-through NOT TESTED under the no-build restriction.

## Real test and evidence

One initial local-worker attempt failed at the first provider request with HTTP 401 because the local OpenRouter credential was stale. Job `57b2e27b-1174-4cb0-a0de-c139323926d4` produced no image; its 1-credit reservation was confirmed **released**, not committed. The existing production worker's secret binding was read without changing it; the working credential was loaded in memory only. It was never printed or saved in receipts. No successful paid stage from that attempt was replayed.

Corrected real test:

- Job **`cc0e48c6-0422-41f9-8933-ce5ce3a1a0a1`**, request `03db82e4-aa94-447a-b685-a640b0830b30`, output asset **`f83e1e41-6970-4726-b104-69e653cdc019`**.
- Used current local source application admission and actual source worker processor with real DB claims/checkpoints/stores, real OpenRouter/Gemini requests and real GCS output. No provider/storage/DB mocks; no hosted queue task for this source-worker test, build or deployment.
- Same selections and nine catalog references as prior tests. Scene received nine references. Identity received only scene + primary character face. Harmonizer used stage-2 bytes.
- Four real operation receipts: aggregate, scene, identity and harmonize; **all output_persisted**. These are two provider calls, one local operation and one aggregate tracking record, not four paid calls.
- Reconstructed exact input fingerprints for **scene, identity and harmonize all match** their real database receipts. Stored structured selection matches the submitted request. Each stage image downloaded and visually inspected.
- Admission **4 November 2026 02:22:10.253 IST**, completion **02:24:15.951 IST**; **125.699 seconds**. One committed application image credit, balance **713 → 712**.
- Provider/intermediate images 1536×2752, delivered image 720×1280. Generated result is real owned backend media.

## What changed visually

Stage 1 resembled one of the supporting portraits and included a silver hoop. Stage 2 visibly changes facial proportions, nose, brow structure and moustache/goatee toward the primary Extreme reference, removes the hoop and renders bright blue irises. Harmonization preserves that structure and adds its existing luminance/grain processing.

Verified in this sample: blue eyes, bare ears/no visible unwanted accessories, moustache, full-body framing with both shoes, red leather jacket, platinum hair colour and selected bedroom composition. This is observable improvement, **not proof of exact biometric identity preservation or consistent results across generations**.

Remaining visible issue: hairstyle is distinctly curlier than the selected textured crop. Stage 1 generated that mismatch and stage 2 retained the scene hairstyle. The face is still a generative interpretation rather than an exact reconstruction of the exaggerated primary face. No additional paid image was submitted to hide these limitations.

Artifacts: `.tmp/character-stages-live-20261104/{receipt.json,prompt.txt,identity-prompt.txt,scene.png,identity.png,harmonize.png,scene-face.png,identity-face.png,harmonize-face.png,output.png,live-run.log}`. Initial rejection preserved separately under `.tmp/character-stages-20261104/`.

## Release boundary

No builds, dev server, browser bundling, pushes or deployments were run. The staged route exists in the worktree and passed real source-worker execution. It is **not yet active on the hosted website** from this task. A future authorized rollout must deploy the compatible worker before the application admits the new pipeline-marked jobs, then perform a real authenticated browser test. Harmonizer uses an approximate skin region; it does not detect or repair identity. Repeated visual reliability, exact identity and hairstyle fidelity remain unverified/open.

Incident `UGC-GEN-20261104-CHARACTER-IDENTITY-STAGES`: worktree implementation/one real execution verified, hosted acceptance pending. Linked `UGC-GEN-20261104-CHARACTER-VISUAL-ADHERENCE` remains open for broader fidelity.
