# Stage 2 corrections and supplied pipeline claims — review, 4 November 2026

**Verdict: stage 2 executes, but the current implementation does not enforce identity fidelity. The latest corrections are only partially sound and should not be approved as a complete fix.** Application source was inspected, not modified in this review. No paid generation/build/deployment.

## Verified structural gap versus model-level cause

The actual character stage2 calls generateOpenRouterGeminiImage with a complete scene PNG, the correct primary face JPEG, selected trait references and text instructions. It uses the same multimodal generation endpoint as stage1, not a separate biometric face-transfer implementation. There is no spatial restriction/identity embedding in this request and no facial-similarity acceptance gate before a decodable output is persisted as success. A dedicated mask/embedding is not itself a mandatory requirement for Gemini image editing; the specific gap is that the claimed identity guarantee has no enforced mechanism or measured acceptance criterion in this path.

This is the verified implementation/expectation mismatch: successful provider execution is counted as pipeline success even if the identity is wrong. The specific model-internal cause of each old bad face remains unisolated. Correct image supply is verified; it was not missing. The prior controlled experiment had four identity failures, and removing four suspected negative terms did not repair them. That does not establish model-only causality or prove any single reference caused the mismatch.

The words “Biometric Face Lock” and “exact biometric identity” appear in comments on the shared Hook/face-swap helpers, but those helpers also call generateOpenRouterGeminiImage. Their names/comments do not add a face-transfer model or a measured 95% guarantee. Character, Hook and standalone Face Swap use different prompts/roles, so a claimed result on one does not automatically validate another.

## Latest generation independently checked

Fresh live read for job cdd2b0d3-2d6c-4aeb-850b-f5df1fbd10d5: aggregate, scene, identity and harmonize all output_persisted. Reconstructed current exact stage2 fingerprint (saved scene + primary + actual prepared 35% hair crop + saved job instructions) matches the live operation record. No new provider call.

Source reference, stage1-scene.png/stage1-face.png, stage2-identity.png/stage2-face.png, output.png/output-face.png and the existing comparison were viewed. Latest output is visibly more expressive and closer in some features than previous failures. However the distinctive arched brows, open mouth and moustache already appear in stage1. Stage2 shows relatively small visible differences. Thus this new scene does not demonstrate recovery of a known bad stage1 identity. It is also not a controlled A/B comparison with the prior failed scene: both scene and instructions changed. Historical ledger statements that leakage was “successfully eliminated” are stronger than this evidence supports. No biometric similarity percentage was measured.

## Findings on the new corrections

### 1. Fixed top-35% crop is not a general hair-only isolation method

worker/src/lib/character-image-pipeline.ts:46-59 decodes the portrait, extracts the top 35%, and returns it as a hairstyle image. The latest Textured Crop produces a 768x358 crop without eyes/nose/mouth; that specific crop is useful. But actual public catalog checks show:

- Long Waves retains visible eye/eyebrow details and cuts off most long strands/length, contradicting the new prompt's “This reference shows hair only”.
- Natural Bob removes the chin-length ends that define the selected haircut.

This is a confirmed input-preparation bug, not a model hypothesis. It can both leave competing features and discard requested hair geometry. A reliable approach needs reviewed per-asset masks/regions or validated hair isolation preserving the complete silhouette, with explicit handling of failure. No specific dependency or segmentation implementation is approved by this review.

### 2. Crop errors silently reintroduce the original portrait

The helper catches every error and returns the full image. Direct unreadable-input check confirms the function silently returns its original data. It therefore does not guarantee face exclusion. Existing stage tests use invalid string stand-ins, so they pass through this fallback; the new crop test uses a uniform grey rectangle and checks only 100x70 dimensions. It does not test eyes removed, hair silhouette retained, malformed-input refusal or real catalog crops.

### 3. Existing version2 historical stage inputs changed

Both crop preparation and new hair prompt wording run under the existing version2 marker; generation admission still freezes version2. Reconstructing the older job eb15d5d4-5e0d-4548-aecc-a8b4c4b358ce now changes its identity-stage fingerprint:

- Saved: 367b81d4022e72569c0c5fe0106a912daa0d43c859ac7f3814cc908426736647
- Current: 23597907409a28cf68a1a897adf0fd3ee41c5cb19540f91adfb71abb69c10a3a

The durable runner reserves using the fingerprint before reading its saved stage, and Supabase store refuses a different fingerprint for the same job/operation. Thus older in-flight version2 jobs reaching/re-entering stage2 can fail recovery with “Provider generation reservation does not match this request.” Completed jobs whose final staging output can be reused need not enter that branch. New preprocessing/prompt semantics need a new frozen pipeline revision, while old revisions reconstruct their original stage inputs exactly.

### 4. Removing eye-shape/skin instructions changes selection priority

characterIdentityInstructions now omits the selected eye-shape and skin-tone snippets while retaining iris colour and optional head shape. This reduces competing facial edits but is a product tradeoff: those selections still exist, validate, persist and reach stage1, while stage2 now directs preservation of the primary face without repeating those overrides. They can be overwritten or weakened by identity replacement. No visual test establishes that this is correct for every selected trait. Define primary identity versus explicit overrides, rather than treating legitimate selected traits as accidental conflicts. Existing user contract asks that all selections apply.

## Supplied performance table does not match verified behavior

| Supplied claim | Actual evidence |
|---|---|
| 95%+ facial similarity | No defined metric, embedding/scoring implementation, threshold or benchmark. Four prior controlled samples failed qualitative primary-identity review. Google model card explicitly lists imperfect character consistency. |
| Hand/neck soft mask, +25 L* lift | Not implemented. Harmonizer uses fixed normalized upper-frame rectangles and skin-colour thresholds, compares skin inside versus outside, and shifts the inner region toward outside median with a maximum absolute 12 L* units. It does not locate hands/neck or apply a fixed +25 lift. |
| 100% harmonized, same camera | Existing deterministic Gaussian grain is 0.012 times the 0-100 L* range (1.2 L* standard deviation). Adding grain does not establish single-camera capture or physically consistent light. |
| 100% text/jewelry/props preservation | Prompt instructions and observed samples, not an enforced guarantee. Character No accessories deliberately removes jewelry; Hook source-preservation rules differ. No OCR/object preservation acceptance check was found in this character path. |
| Stage2 adds $0.008 | Prior real 2K diagnostic usage reported 0.143598-0.147496 per stage2 call. Different models/settings can have other costs, but the supplied number is not evidence for this tested configuration. Full pipeline also pays stage1. |
| Video identity locked throughout | A still-image stage does not prove downstream video identity. No such video experiment was performed here. |

Google primary source: https://storage.googleapis.com/deepmind-media/Model-Cards/Gemini-3-Pro-Image-Model-Card.pdf (page5, known limitations). L*=188 and135 from supplied explanation are not values on the normal 0-100 CIELAB L* scale used by this code; without a defined alternative scale, the numerical comparison is ambiguous.

### Nonpaid luminance direction check

Synthetic fixture: central skin RGB195/144/114, outside skin RGB130/92/70; existing harmonizer with grain disabled only for inspection. Output centre161/113/84, outside130/92/70. It darkened the bright central skin toward the darker outside skin; it did not lift the outside region. This confirms a concrete behavioral difference from the hand/neck-lift description. It does not mean every real image will darken or that all luminance matching should equalize regions with legitimate different lighting.

## Verification and completion receipt

- Scope: read-only review of latest source corrections and supplied claims, diagnostics/artifacts plus append-only incident clarification. No application fixes made.
- Sources: current admission/selection/compiler/provider/character pipeline/durable runner/Supabase fingerprint guard/harmonizer/tests; current AGENTS preflight/production and protected contracts; nonnegotiables and relevant Explore/clear history; prior real input/experiment receipts and latest images. Skills context-memory, immutable-contracts, video-prompt and regression-gate read. Read-only preflight PASS; no claim of newly reading every line of the large historical context files.
- Focused character/admission/trait tests 46/46 PASS; durable/harmonizer tests13/13 PASS. These are structural checks, not proof of visual identity or correct catalog isolation. New grayscale crop test's limits described above.
- Nonpaid diagnostics: actual short/long/bob crops visually inspected; historical input fingerprint mismatch reproduced; actual latest live job fingerprint MATCH; corruption fallback reproduced; luminance direction fixture verified.
- Application/UI implementation preserved; no build/server/push/deploy/new dependency/schema/provider generation. Deployed browser/mobile and new corrected real generation NOT TESTED.
- Files written by this review: this report and append-only docs/ai-context/clear.md; ignored .tmp/character-stage-review-20261104 diagnostics (tests.log, recovery-harmonizer.log, check.mjs, live-read.mjs, luminance.mjs and their JSON/image evidence).
- Incidents: new UGC-GEN-20261104-CHARACTER-STAGE2-CORRECTION-REVIEW OPEN; linked IDENTITY-STAGES/STAGE2-LEAKAGE. Clarifies earlier evidence without erasing prior entries.
- Acceptance: stage2 execution VERIFIED; exact identity guarantee NOT VERIFIED; generic crop isolation FAILED on real catalog examples; old-v2 recovery compatibility FAILED reconstruction check. No current correction should be labelled a complete validated identity fix.
