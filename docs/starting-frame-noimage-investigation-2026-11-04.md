# Stage 1 no-image investigation — prepared inputs

Status: OPEN. No new real generation submitted. No application/UI/prompt changes or builds in this continuation.

Recovered exact owned failed job `2125cebf-9e4a-4e19-9140-0fac97b5d8e1` by read-only owner-bound database query. Downloaded all four saved references, decoded their dimensions and verified source SHA against its frozen receipt. Cloud Run logs for this job and `7ca4d814-d03c-4421-948a-e1a51e84a40c` retain only the generic submission-uncertain exception; no raw provider response was recovered. The upstream reason remains UNKNOWN. An image-only modality request or response parsing mismatch is an investigation hypothesis, not a proven defect. Current official OpenRouter documentation describes a dedicated Image API; that alone does not prove the existing chat endpoint caused these failures or justify changing all existing callers.

All proposed tests use Gemini 3 Pro via the existing OpenRouter worker helper, source background/outfit/hairstyle, empty custom instructions, original decoded t=0 and the same three identity photos. Negative instructions are embedded in the saved prompt; there is no separately supplied negative-prompt field in this request. Stage 1 must run before stage 2; failed stage 1 cannot be reported as a completed starting frame.

Prepared inputs (absolute paths below are local evidence):

| Workflow | Source | Dimensions | Prompt |
| --- | --- | --- | --- |
| Hook, exact failed scene | explore-paired-hook-ef59f4b5e69bc9e125f8ada7 | 720×1280 | [Saved prompt](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-noimage-20261104/hook-prompt.txt) |
| Wall of Text | explore-wall-text-03 | 720×1280 | [Prepared prompt](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-noimage-20261104/wall_text-prompt.txt) |
| Talking Head | talking-car-story | 576×1024 | [Prepared prompt](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-noimage-20261104/talking_head-prompt.txt) |

![Hook original t=0](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-noimage-20261104/hook-source.png)

![Wall original t=0](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-noimage-20261104/wall_text-source.png)

![Talking Head original t=0](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-noimage-20261104/talking_head-source.png)

![Primary identity](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-noimage-20261104/input-1.png)

![Supporting identity 1](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-noimage-20261104/input-2.png)

![Supporting identity 2](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-noimage-20261104/input-3.png)

[Full case settings/source hashes](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-noimage-20261104/test-cases.json) and [image checksum/dimension manifest](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-noimage-20261104/input-manifest.json).

Source observation: Hook shows a reclining person with added captions and shirt lettering. Wall shows a person eating on a bed with a laptop and large text overlay; the face is angled down. Talking Head shows a person in a car holding a drink. These are original still observations, not claims of full video-motion analysis. Caption/physical-letter cleanup, source pose and face consistency require separate generated-output review; no later clarity frame is substituted.

Automatic approval review rejected the planned diagnostic POST because it would send private source/identity images and prompts to OpenRouter without destination-specific consent. The process did not start; no submitted receipt or provider result exists. Explicit approval of these assets/destination and provider costs was requested. Do not bypass the rejection, replay old jobs or invent results. New testing is a direct-provider diagnostic using current source helpers, not proof of deployed UI/API/queue/billing acceptance. Full hosted acceptance remains distinct under the no-build rule.

Application fix boundary, after evidence: provider adapter and focused tests only if the captured response establishes a defect; preserve historical job fingerprints, source/identity roles, duplicate-payment protection, prompts, UI, billing and scheduling. First compare the unchanged failed scene; then test each workflow with disclosed references. A blocked test is not evidence for changing modalities, adding automatic retries or rewriting prompts.

Files changed in this continuation: this receipt and appended incident memory in `docs/ai-context/clear.md`; ignored diagnostic helpers/inputs under `.tmp/starting-frame-noimage-20261104/`. Preflight/skills: context-memory, immutable-contracts, starting-frame, video-prompt, UI-clarity, regression-gate and Supabase guidance consulted; preflight discoverability PASS. No fresh end-to-end success or root-cause fix claimed.

## Local-only decision and verification

User explicitly selected **Continue with local checks only**. This supersedes the planned real-provider tests: no image/prompt submission is authorized by this continuation. Do not resume the prepared probe without a new explicit instruction.

Current-source worker regression suite rerun: 84 tests PASS, zero failures/skips. Command: node --import ./scripts/worker-source-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test worker/src/lib/openrouter-gemini-image.test.ts worker/src/lib/generation-provider.test.ts worker/src/lib/durable-image-stages.test.ts worker/src/jobs/generate-image.test.mjs worker/src/jobs/generate-character-image.test.mjs worker/src/lib/image-harmonizer.test.ts. Log: .tmp/starting-frame-noimage-20261104/local-worker-tests.log.

Three additional controlled local scenarios call the actual current pipeline with a local mock transport and synthetic response bytes. Hook/Wall/Talking all PASS: source checksum and t=0, scene→identity→harmonize order, four Stage1 images, Stage2 scene-result plus primary and two supporting identity images in original order. The actual assembled stage prompts were saved separately for each scenario as <workflow>-scene-actual-prompt.txt and <workflow>-identity-actual-prompt.txt. No external transport occurred; fixtures are NOT generated output and do not establish quality. Receipt .tmp/starting-frame-noimage-20261104/local-checks.json. Diagnostic helper syntax checks PASS; baseline-submitted.json absent.

No additional application code fix made because the original missing-image cause remains unproven. Existing diagnostic/recovery changes remain tested locally. UI, prompts, models and stage wiring unchanged in this continuation. No builds, deployments or paid generation. Files changed: appended this report and docs/ai-context/clear.md; ignored local diagnostic artifacts only. Upstream root cause and successful provider output in all workflows remain NOT VERIFIED.
