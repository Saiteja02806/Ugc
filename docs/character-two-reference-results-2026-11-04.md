# Character stage 2 with exactly two references — 4 November 2026

Status: requested two-reference contract implemented in the worktree and VERIFIED through one real complete source-worker generation plus one controlled stage2 request. Overall visual quality remains PARTIALLY VERIFIED; primary identity is closer but not an established exact match, and the fresh stage1 scene cropped the feet. Not deployed. No builds or UI changes.

## Scope and every project file changed in this task

- `worker/src/lib/character-image-pipeline.ts`: new pipeline version4; exactly stage1 PNG followed by unchanged primary image. New prompt restricts correction to the visible face and explicit facial overrides, preserving scene appearance/occlusion. New version rejects traitReferences/referenceProcessingVersion metadata. Versions1–3, including historicalv2 fingerprint reconstruction, retain their original behavior.
- `lib/characters/generation-service.ts`: new supported Gemini studio admissions freeze version4 and face-only instructions, without extra stage2 trait references. Stage1 references/compiled prompt, selection snapshot, negative prompt, owned reference bindings and receipt remain intact. Recovered admitted jobs keep their original pipeline.
- `lib/characters/studio-selection.ts`: new `characterFaceOnlyInstructions`; keeps explicit eye colour, head/eyelid/skin overrides, all selected scene setting labels, accessories/no-accessories and scene-hair preservation. Old instruction helper retained unchanged for historical tests/callers.
- `lib/characters/generation.test.mjs`: admission assertion updated to new version, no extra reference metadata, selected accessories retained.
- New `lib/characters/identity-two-reference.test.mjs`: actual stage orchestration checks scene/primary order and bytes, no additional portraits, intact stage1, exact effective negatives, selected settings/accessories/facial overrides, malformed version metadata and missing primary refusal before spending.
- New `docs/character-two-reference-inputs-2026-11-04.md`: every individual input image, all selected settings, complete stage1/stage2 prompt/negatives/settings, controlled-scene provenance and fresh scene disclosed before stage2 submission.
- This results receipt; append-only `EXPLORE_CONTEXT.md` and `docs/ai-context/clear.md`.

Ignored diagnostic scripts/images/receipts/logs are under `.tmp/character-two-reference-20261104`. No dependencies, migration, UI/CSS, harmonizer, generic model route, queue/billing policy, push or deployment changes. Preserve all unrelated dirty work; rollback boundary is this task's scoped edits only.

## Preflight and protected contracts

Read: AGENTS.md relevant project instructions, docs/ai-context/nonnegotiables.md, relevant Explore/clear character history, prior character audit/results, current admission/worker/provider/persistence/recovery sources and tests, installed Next use-client guide. Very large Explore/clear output was partly truncated; no fresh full-line reread is claimed. Read-only `python tools/preflight.py --repo . --task ...` prerequisite discoverability passed.

Skills read/applied: ugc-context-memory, ugc-immutable-contracts, ugc-regression-gate, ugc-video-prompt and ugc-starting-frame identity-role principles. Character still generation has no source video or timestamp; no timeline is invented. UGC Pilot connect skill used to verify account, 710 available credits/zero reserved and current connector capabilities. Its generic generation tool supports only one reference, so it cannot exercise this multi-reference staged path; current application source was used instead. No connector generation confirmation was bypassed or supplied.

Protected contracts:

| Behavior | Evidence / status |
|---|---|
| Stage1 input order/bytes and complete prompt | VERIFIED: nine real backend references match disclosed hashes; actual provider body SHA matches the compiled request; stage1 application code unchanged. |
| Exactly two stage2 references | VERIFIED: actual POST has two images, scene then unchanged primary; payload hash and durable operation fingerprint match disclosed images/text. |
| Selected settings and negatives persist | VERIFIED: actual job selection equals requested selection, effective negatives in both submitted prompt strings; stage2 settings retained as preservation constraints. Not proof every visual choice was satisfied. |
| UI and harmonizer source unchanged | VERIFIED: pre/post SHA256 for dock, canvas, CSS and harmonizer identical; no UI source edited by this task. |
| Legacy recovery | VERIFIED: focused historical tests and actual savedv1/v2 fingerprints match; existingv3 request exactly matches prior B1/B2 diagnostic body. |
| Billing/storage | VERIFIED: one reservation committed for one complete generation; owned ready result and all stage outputs durable. |
| Fresh browser desktop/mobile/hosted worker acceptance | NOT TESTED: no new build/deployment. Source-worker test is distinct from deployed browser/queue execution. |
| Exact primary identity/repeated reliability | NOT VERIFIED: limited qualitative evidence, not a calibrated percentage. |

## Real test inputs and provider evidence

All inputs disclosed before calls in the input report and chat. Same assistant-selected Extreme/Male/Adult25/MiddleEastern/LightOlive/KeepHead/VibrantOpen/IceBlue/TexturedCrop/PlatinumAsh/RedLeatherJacket/NaturalAthleticNeck/Tall/NaturalCasual/NoAccessories/full selection as earlier diagnostics. These are not newly captured user UI selections.

Provider: `google/gemini-3-pro-image` through OpenRouter, provider returned Google; 9:16, image_size2K, no explicit seed/temperature/model face mask. Three paid requests, no diagnostic retries:

| Test/stage | Provider request ID | Reported usage cost |
|---|---|---|
| Controlled stage2 on saved failed scene | gen-1793785080-VeCRWLbSVFAJkvgqgzW1 | 0.141196 |
| New complete generation: scene | gen-1793785130-9mj6zkuMr4rBS3rMMryq | 0.1435094 |
| New complete generation: identity | gen-1793785349-k4sKZ2dKbYAhybO3ge97 | 0.141232 |

Total provider-reported cost0.4259374. Application credits710→709; exactly one committed image-credit reservation for the complete application test. Controlled direct diagnostic has provider usage but does not create an app job/credit mutation.

New request ID `ef61dd27-498f-4917-b93b-266a04d7eab2`; job `2edb72ab-31fe-4f58-ad77-787d73cbf5a7`; owned ready output asset `e5764104-dea5-499a-9052-a1eb954a4a8d`. Authenticated production connector `get_asset` independently returned this generated_image in influencer collection,720x1280. Actual model stages1536x2752. Four provider-operation records (scene, identity, local harmonize, aggregate) all output_persisted; aggregate is not an extra paid model call. Source execution used the real admission, current worker processor, provider, DB, storage and existing credits; hosted dispatch/browser acceptance not claimed.

Stage1 request body SHA256 `ab47ed40efe0d923237b75ae0cc9adbeca9e491a53b8c81066778d83d09fee2c`.
Fresh stage2 body SHA256 `81e2cb1b28c71c3f024cbce974ca786202216294cea13c3ea1cdc6cf687c9bf4`.
Primary JPEG SHA256 `720991b8ab157033b6dc0aec6a18f6894ed5bc311cf20bece71569bccf5b4cb1`.
The test paused after durable scene persistence, displayed the fresh scene and primary, then released stage2. Hash guards checked the exact actual provider bodies. Worker stage fingerprints and all3stage output hashes matched stored backend receipts; provider source equals saved harmonized PNG.

## Actual visual results

![Primary, new scene, stage2, harmonized output](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-two-reference-20261104/face-comparison.png)

Fresh scene already carries the expressive primary-like face, so final improvement cannot be assigned entirely to stage2. Stage2 moves nose, lips, facial-hair and cheek appearance toward the primary and visibly changes irises to blue. Selected short platinum hair remains; it does not reproduce the primary's large black/white hair. Neither stage is an exact match for the reference's textured crop silhouette. No visible accessories. Primary distinctive proportions remain a generative interpretation; no exact identity approval or numerical similarity is claimed.

![Complete stage outputs](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-two-reference-20261104/full-results.png)

Room/red leather jacket/jeans/body pose and broad framing are retained. **Full-body selection FAILED visually:** stage1 cropped the shoes/feet, and stage2 preserved that frame. All instructions were forwarded; delivery is not proof of visual compliance. The unchanged harmonizer visibly darkens the face and adds grain across the image; colour/light quality needs separate review. No harmonizer correction included here.

![Controlled failed-scene comparison](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-two-reference-20261104/controlled-comparison.png)

Controlled input is the exact earlier failed scene from jobeb15d5d4-5e0d-4548-aecc-a8b4c4b358ce. No other trait portraits or face suppression supplied. Result retains broad room/outfit/full framing and selected platinum/blue/bare-ear appearance, and shows more primary-like brows/chin-hair configuration, but remains a partial likeness. One sample with a new prompt and fewer references is not a one-factor causal proof that reference removal alone fixes identity.

## Verification commands and outcomes

- `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/characters/*.test.mjs lib/characters/*.test.ts components/characters/*.test.mjs`:230PASS.
- `node --import ./scripts/worker-source-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test worker/src/jobs/generate-image.test.mjs worker/src/jobs/generate-character-image.test.mjs worker/src/lib/durable-image-stages.test.ts worker/src/lib/openrouter-gemini-image.test.ts worker/src/lib/image-harmonizer.test.ts`:73PASS.
- App `npx tsc --noEmit --incremental false` and worker `npx tsc -p worker/tsconfig.json --noEmit --incremental false`:PASS.
- Scoped ESLint across five touched code/test files:PASS; scoped `git diff --check`:PASS.
- Nonpaid existingv3 payload verification and historical catalog/v1/v2 fingerprint scripts:PASS.
- `verify-and-compare.mjs`:PASS scene+identity durable fingerprints, actual POST SHA, image counts/order, allstage hashes, owned ready asset, one committed credit, unchanged protected source hashes. Produces summary.json and allcomparison PNGs.
- Live scripts `run-controlled.mjs` and `run.mjs prepare/generate/status`:completed as above. Warnings from existing GCS PassThrough listener count and experimental TS loader did not fail requests. No build, bundler, dev server, push, deployment or automatic extra generation.

## Decision and remaining work

Two-reference stage2 is an appropriate narrower identity stage and is implemented for new jobs. It removes the haircut/accessory wearer's separate image from this stage; it does not remove competing identity already embedded in stage1 or guarantee identity repair from two images. Stage1 still receives raw trait portraits and must own hairstyle correctness. Selected shape/skin/eye changes intentionally constrain identity preservation.

Gemini can perform image edits, including hair changes; stage2 uses the same generative model, not a model inherently restricted to faces. The new contract intentionally asks it to preserve hair, so this run does not measure its ability to recolour/restructure hair on demand. Previous tests showed appearance changes but no repeatable exact haircut-plus-identity acceptance. Google documents prompt-based image editing/semantic masking, not a deterministic identity lock: https://ai.google.dev/gemini-api/docs/image-generation.

No selected-accessory positive live case, uploaded-primary live case, multi-identity/pose/occlusion matrix or repeated reliability benchmark. Future authorized quality work should separately address stage1 trait isolation/framing and validate face-only correction/localization rather than restoring extra portrait identities to stage2. Incident `UGC-GEN-20261104-CHARACTER-TWO-REFERENCE-STAGE2`: wiring VERIFIED; broader visual fidelity OPEN.
