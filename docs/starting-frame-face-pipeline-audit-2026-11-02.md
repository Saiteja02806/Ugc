# Starting-frame and Face Swap pipeline audit — 2 November 2026

Read-only application-code audit. No paid submission, retry, provider change, palette change, layout change or deployment.

## Conclusion
New Gemini 3 Pro starting-frame requests are wired into Stage 1 -> Stage 2 -> harmonizer, but full-pipeline success is not guaranteed or durably evidenced. Standalone Face Swap reuses Stage 2 + harmonizer on an existing base image. Other supported starting-image models do not use this three-stage helper.

## Actual route
1. lib/explore/hook-keyframe-generation-api.ts: owned person-photo IDs resolved in supplied order; original frame0 decoded, source hash checked, prompt/model/input key frozen; referenceImageUrls = [sceneSnapshot, ...personPhotos]; receipt version5/promptVersion7. Gemini Pro and Seedream explicitly set provider=openrouter.
2. worker/src/jobs/generate-image.ts: verified hook receipt -> provider=openrouter/Gemini -> generateOpenRouterGeminiHookKeyframe. Default still model is gemini_3_pro. Provider-less legacy Gemini jobs retain durable Google route; Nano Banana uses Google; GPT uses OpenAI; Seedream uses its own generator.
3. worker/src/lib/openrouter-gemini-image.ts: Stage1 receives source scene + person photos and scene-cleanup prompt. Stage2 receives generated Stage1 image + first person photo + same-person support photos. No automatic facial-recognition/identity-quality score exists; these are generative instructions.
4. worker/src/lib/image-harmonizer.ts: CIE LAB lightness adjustment, bounded +/-12 with 70% median gap, then deterministic Gaussian grain sigma1.2 L. Face region is fixed normalized rectangles; skin uses LAB thresholds. No detected face mask/landmarks. With insufficient eligible skin in either region only grain is applied. Scene pixels also receive grain.
5. worker prepares app-sized PNG, stages/uploads and returns asset + receipt. New job completion does not include distinct Stage1/Stage2/harmonizer status or intermediate artifacts.

## Confirmed gaps
- Stage2 exception silently degrades to Stage1 success. Fault injection confirms returnedSuccess=true after simulated Stage2 timeout. Cannot truthfully certify all-stage execution from completed job.
- Harmonizer exception degrades to raw generated buffer in both helpers, with warning only.
- Stage1 and Stage2 provider request IDs/intermediates are not separately checkpointed. A single operation reservation prevents blind repeated submission but cannot provide independent stage resumption/evidence.
- Historical receipt v4 uses opening + clarity + person images. OpenRouter helper blindly treats second image as influencer. New v5 uses scene + person and has correct offset. No claim that old Google receipts are changed or broken.
- Fixed skin/face region can miss off-center or occluded faces, misclassify warm scenery, and exclude skin outside thresholds; synthetic test success does not establish portrait quality.
- Slideshow face dispatch is client driven. Existing source-face mapping persists locally and resumes when reopened; closing the browser can delay swaps not yet admitted. That is separate from worker execution of an accepted face-swap job.

## Face Swap call path
Composer face selector and selected-source plan -> completed generated-slide callback -> executeFaceSwap -> POST /api/ai-studio/images/face-swap -> owned target/influencer reads + credit reservation -> mode=face_swap, Gemini Pro/OpenRouter, [target, influencer] -> performOpenRouterFaceSwap -> Stage2 prompt + harmonizer -> uploaded result -> target replacement.
Standalone FaceSwapDialog and ImageGenerationCard's optional callback exist, but this does not establish that every image card mounts that action; slideshow composer placement is the current recorded design. No claim of universal per-image UI availability.

## Existing real output reviewed
MCP list_operations/get_operation recovered owned completed starting-frame job 02707612-221e-4ae1-b17c-c23f560a0dd7; get_asset recovered output 00d04801-7f3f-4713-97bf-884a59c28b19, generated 2026-11-01T20:15:50Z (2 November 01:45:50 India time). PNG720x1280. Saved `.tmp/starting-frame-pipeline-audit/latest-starting-frame.png` and viewed.
Observed: portrait with glasses, hand/can and warm orange scene; lettering remains on a background object. Lip texture warrants close review, not a proven defect without identity/source comparison. Safe media tools do not expose frozen input references or stage receipts. Therefore identity fidelity, source pose/light matching, cleanup success and all-stage execution for this actual result remain NOT VERIFIED. No stage attribution inferred from elapsed time or the word completed.

## Checks run
- npm run worker:build: PASS.
- node --experimental-test-module-mocks --test worker/dist/lib/openrouter-gemini-image.test.js worker/dist/lib/image-harmonizer.test.js worker/src/jobs/generate-image.test.mjs worker/src/jobs/generate-image.hook-keyframe.test.mjs: 55 PASS.
- node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/explore/hook-keyframe-generation-api.test.mjs scripts/slideshow-face-swap-ui.test.mjs: 32 PASS.
- No-network Stage2 fault injection using compiled helper: two mock provider calls, second throws; helper returns Stage1 success. Evidence .tmp/starting-frame-fallback-evidence.txt.
These verify mocked boundaries and synthetic harmonization, not hosted provider quality.

## Follow-up needed
Persist and expose stage-level status/intermediate IDs; prevent partial results from masquerading as full completion; keep safe no-double-spend recovery; handle old receipt roles explicitly; review matching source/identity/output triplets. No implementation of these changes was authorized by this check request or performed here. UGC-VID-046 records confirmed findings; UGC-VID-045 stays open for affected hosted request acceptance.
