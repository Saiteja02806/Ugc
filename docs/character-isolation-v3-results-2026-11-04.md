# Character stage2 isolation v3, historical recovery and live comparison — 4 November 2026

Status: scoped code/recovery/isolation changes implemented locally and non-build checks PASS. Ten real diagnostic generations completed. General primary-identity fidelity remains OPEN. Localized compositing is promising experimental work, not the production route.

## Latest user observation: haircut-reference face in the output

The user identifies apparent foreign facial traits in A1/C2 and asks whether hair-reference identity is leaking. Verified input mapping: A/C received the original full haircut portrait; B/D received that exact portrait with its face suppressed. Main identity bytes were identical in every condition. A1 and C2 visibly show heavier/furrowed brows, stubble and a broader lower face resembling the haircut wearer. C2 had the scene face suppressed, while the haircut face remained visible. This supports unwanted reference identity as a contributor. It does not prove an exact face copy, the model's internal attention path or a sole cause: C1 differs, two repetitions/condition are limited, and some drift persists in B/D. Keep the conclusion as supported visual evidence, not a universal causal diagnosis.

A photo labelled “hair” is still a full visual input; the role text does not remove its facial pixels. The current v3 preprocessing suppresses this face before stage2. Stage1 remains intentionally unchanged and still sees the original portrait, so face influence can already enter the scene. These observations do not establish that all leakage has been eliminated. Other portrait-bearing accessory/ethnicity/body references also need role-specific acceptance coverage; their isolation is not claimed fixed by a hairstyle-only patch.

## Scope implemented and all tracked files changed in this task

- worker/src/lib/character-image-pipeline.ts: new explicit version3/referenceProcessingVersion1; reviewed SHA-bound face suppression for hairstyle references; no silent original-portrait fallback on new jobs. Original v1 and pre-crop v2 prompts/inputs reconstructed exactly. The briefly used unversioned crop-v2 variant is selected only when its reconstructed input exactly matches an existing provider operation fingerprint. Unknown recorded inputs refuse re-submission. A v2 job with no identity-stage receipt defaults to the original canonical v2 behavior; its previously unrecorded crop intent cannot be recovered with certainty.
- New worker/src/lib/character-hair-masks.json: reviewed normalized face regions for all23 offered catalog hairstyles, bound to original source and canonical prepared JPEG hashes. Full reference frame/long strands/fringe retained rather than percentage-cropped. These are face-suppressed references, not pixel-perfect hair-only segmentation; body/clothing/forehead content may remain and is explicitly excluded by prompt roles. The immutable version1 map must not be edited for accepted jobs; future changes require another processing revision.
- worker/src/jobs/generate-image.ts: reads an existing identity fingerprint only for legacy v2 reconstruction; existing Hook/standalone Face Swap/other routes unchanged.
- lib/characters/generation-service.ts: new admitted character jobs freeze v3, processing revision and canonical trait IDs. Historical jobs retain their frozen input.
- lib/characters/studio-selection.ts: restores selected eyelid/skin-tone instructions with a precise restriction to preserve other primary facial proportions. Does not drop explicit user choices to improve apparent similarity.
- lib/characters/generation.test.mjs and identity-stages.test.mjs updated for the new admission and retained legacy semantics.
- New lib/characters/identity-isolation.test.mjs: catalog completeness/source hashes, mask pixel/geometry behavior, malformed/changed/unreviewed-image refusal before provider stages, both legacy-v2 reconstructions, selected overrides.
- New docs/character-isolation-v3-test-inputs-2026-11-04.md and docs/character-localized-benchmark-inputs-2026-11-04.md contain every actual input image, complete prompt/negatives and settings disclosed before calls.
- This report; append-only EXPLORE_CONTEXT.md and docs/ai-context/clear.md.

Ignored diagnostic scripts/images/receipts confined to .tmp/character-isolation-v3-20261104 and .tmp/character-localized-benchmark-20261104. No application UI/CSS, dependency, migration, provider/model switch, billing price, queue config, harmonizer, new stage1 behavior, push or deployment. Preserve all other dirty work. Rollback only these task edits, never reset the worktree.

## Preflight and protected contracts

Skills read/applied: context-memory, immutable-contracts, regression-gate, video-prompt. Sources: current AGENTS protected/preflight/no-build/production rules, nonnegotiables, relevant Explore/clear historical entries and earlier receipts, installed Next use-client guide, actual admission/callers/provider/worker/durable recovery/store/tests. Very large context reads were partly truncated; no claim of a fresh full-line reread. Existing context/constraints retained. Read-only preflight discoverability PASS. No source-video/timestamps exist in this character workflow; none invented.

Protected status: stage1 input reference order and bytes, existing harmonizer, historical stage replay, generic/scratch/other model behavior and character UI contracts VERIFIED by focused source/tests and recorded-input checks. UI implementation not edited; new desktop/mobile/production browser acceptance NOT TESTED. New pipeline not deployed. Identity visual acceptance is distinct from provider completion.

## Non-build verification

- 227 character/component tests PASS.
- 73 worker/image/provider/harmonizer/durable-recovery tests PASS.
- Application and worker TypeScript --noEmit --incremental false PASS; scoped ESLint PASS; scoped git diff --check PASS.
- All23 real immutable catalog images fetched read-only, decoded, prepared with expected JPEG hashes, masked and visually reviewed; original full image dimensions retained. Exact hair silhouette fidelity is not an automatic segmentation guarantee.
- Recorded real v1 job cc0e48c6-0422-41f9-8933-ce5ce3a1a0a1 and original v2 eb15d5d4-5e0d-4548-aecc-a8b4c4b358ce identity-stage fingerprints reconstructed exactly. Fresh live receipt read for crop-v2 cdd2b0d3-2d6c-4aeb-850b-f5df1fbd10d5 also matches the selected historical candidate exactly. No DB mutation/provider call for these checks.
- Nonpaid integration invoked actual generateCharacterIdentityImage using saved stage fixtures and the real harmonizer. Captured v3 identity payload exactly matches the paid B1/B2 request payload; stage1 still receives all original refs. This is source-pipeline verification, not hosted worker/queue acceptance.

Logs/receipts: .tmp/character-isolation-v3-20261104/{tests,worker-tests,types,worker-types,lint}.log, historical-recovery.json, historical-crop-recovery.json, manifest.json, summary.json. No builds/dev server/bundling.

## Controlled same-failed-scene experiment

Source scene is the exact saved failed scene from job eb15d5d4-5e0d-4548-aecc-a8b4c4b358ce. Primary reference is unchanged. Same complete v3 prompt, same negative constraints, Gemini3Pro Image/OpenRouter, 9:16/2K, no seed/temperature supplied, no harmonizer/new stage1. Preregistered A1/B1/C1/D1/D2/C2/B2/A2; two samples per condition. Scene-mask region manually reviewed for this one scene, not an automatic production detector.

| Arm | Scene face | Hair-reference face | Result |
|---|---|---|---|
| A | Visible | Visible | Identity not accepted; A2 also changes framing/pose/background markedly. |
| B | Visible | Suppressed | B2 visibly closer; B1 still partial. Not repeatable acceptance. |
| C | Suppressed | Visible | Mixed moustached interpretations; C2 shows haircut-like brows/stubble/jaw. |
| D | Suppressed | Suppressed | Cleaner isolation but still generative facial interpretation; exact identity not established. |

Eight calls completed, zero retries, eight unique provider IDs and output hashes. Reported provider cost1.15264. All request body/image hashes asserted before submission. All eight original outputs, face crops and full-frame comparison retained, including A2 failure. Broad blue eyes/platinum/no visible accessories visible, while exact textured-crop resemblance remains partial. Age/height/ethnicity/skin accuracy cannot be certified from appearance alone. Seven preserve broad scene/framing; no pixel-identical guarantee claimed.

![All eight faces](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-isolation-v3-20261104/results-comparison.png)
![All eight full outputs](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-isolation-v3-20261104/full-results.png)

This controlled test supports reference interference as a concern, but two repetitions are not a statistical failure-rate estimate or proof of the model's internal causal mechanism. Production scene-face suppression was not adopted from this result.

## Localized benchmark after full-frame results remained unreliable

Two additional real diagnostic calls L1/L2: same failed scene, manually selected512x512 context crop, wrong face suppressed, unchanged primary identity as sole other input; Gemini3Pro/2K square. No haircut portrait input. Both full prompts/input images/settings disclosed beforehand. Framing exclusions were omitted only for this intentionally localized patch; final framing is fixed by deterministic compositing. This differs in localization, input references and prompt, so it is a route benchmark, not a one-factor explanation of improvement.

Returned face regions resized and composited with a feathered face-region mask into the original scene. Both images have **zero changed decoded RGB channels outside the finite512x512 crop**, verified by full pixel comparison. Body, outfit and room remain the original scene. Primary nose/brow/sparse moustache/chin-patch pattern looks closer in both samples than most full-frame results. Blue eyes, platinum scene hair and bare ears visible. No calibrated identity percentage or final user approval is claimed. Exact desired haircut is inherited from the already-partial scene and is not fixed by a face-only patch. Face/neck lighting/seam quality needs broader review.

Two calls completed, zero retries; reported provider cost0.282716. Combined diagnostic usage cost1.435356 for ten calls. No application jobs/history/billing mutations by these direct diagnostic harnesses. Model usage is still billable at the provider.

![Source and localized results](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/character-localized-benchmark-20261104/source-comparison.png)

No localized route integrated into ordinary jobs: automatic region selection, turned faces, hands/props/occlusion, accessories, other identities and broader repeatability NOT VERIFIED. This is localized generative replacement with deterministic compositing, not a dedicated biometric swapper. Higgsfield connector catalog lookup required reauthentication; treg credential lookup was also unauthenticated and catalog searches did not provide an exact applicable identity endpoint. No substitute video/generic generation was misrepresented as an identity model. The available same-provider localized route supplied the requested spatial benchmark instead.

## Outcome and remaining work

Versioning/recovery and reviewed hair face-suppression changes implemented and locally VERIFIED. General identity issue remains OPEN: full-frame reference editing is still inconsistent. Localized replacement is a promising candidate deserving a multi-scene/pose/occlusion validation set before production integration. A trained identity remains a future option only with an approved same-person dataset and suitable service/model rights. No “95% exact identity”, “100% harmonized” or hosted production-ready claim.

Incidents linked: UGC-GEN-20261104-CHARACTER-ISOLATION-V3, IDENTITY-STAGES, STAGE2-CORRECTION-REVIEW, STAGE2-LEAKAGE. This records the latest user report separately from verified causes; it does not erase prior overconfident historical entries.
