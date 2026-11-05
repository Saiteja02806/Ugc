# Starting-frame stage1 correction and exact-input test — 5 November 2026

**Implemented locally: version8 source-faithful prompt correction and versioned recovery compatibility. Real generation attempted with explicit user consent but blocked by OpenRouter HTTP402 before an image was returned. No visual improvement claim is established.**

Incident: `UGC-VID-20261105-STARTING-FRAME-SCENE-DRIFT`. The [exact-job audit](C:/Users/chund/OneDrive/Desktop/UGC/docs/starting-frame-scene-drift-audit-2026-11-05.md) matched the supplied source, identity and bad result to saved job `541e018a-69ad-4e62-a401-6526afb6c896`. It proved the main scene drift was already present in stage1, with the correct input bytes/reference order. Stage2 and post-processing were not the origin of that restaging.

## Scope implemented

New application default opening prompts use version8. The old version7 builder remains available explicitly and its text is unchanged. Version8:

- Removes youth/beautification, relaxed-eyelid/subtle-expression and identical-brightness requirements.
- Preserves source mouth opening, expression-related creases, camera, perspective, screen position, hand side, finger/contact positions and occlusion.
- Explicitly prohibits mirroring, recentering, straightening or substituting a portrait pose.
- Preserves physical source light/shadow variation while adapting the influencer naturally; skin regions may have different brightness due to orientation.
- Keeps the primary/supporting identity roles, caption/physical-letter cleanup and explicit independent background/outfit/hairstyle selections.
- Adds reviewed static constraints for this exact reference/source SHA: frame-left raised hand separated from mouth, screen-left gaze, wide mouth, tilted selfie, visible furniture and ceiling fixture. These constraints cannot apply to another reference ID or changed video bytes. Named appearance-role overrides still take precedence for their own role. No later-frame or motion description is introduced.

The API freezes the actual builder version into new receipts. Receipt parsing, client status validation, generated-image draft recovery, provider image labels, alternate-model label validation and source timelines now accept version8 for original-opening version5 receipts while continuing to accept historical7. Version8 is rejected on older receipt versions. Existing custom prompts/preferences remain explicitly user-authored; they are not silently rewritten by this patch. The user's existing Use application prompt action selects the new default when desired.

No component/CSS/layout/control change, source storage change, provider/model switch, limit increase, automatic retry or identity-stage/harmonizer change was made. The generic correction reaches Hook, Text on screen and Talking Head through their shared opening builder; the reviewed shot description is deliberately limited to this one source.

**A runtime automatic visual scene-fidelity gate was not implemented.** The prompt's final-check instruction is not such a gate. The real test harness has a manual checkpoint after stage1 before the paid identity stage; it will not continue without a saved review bound to the actual scene SHA. A robust production visual gate or localized edit route would require separate design and output validation. This report does not claim those mechanisms exist or that wording guarantees preserved geometry.

## Disclosed real-test inputs

Same files as the audited failed-quality request, unchanged:

| Image role | Source |
| --- | --- |
| Image1: original source t=0, 576×1024 | ![Original source](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-drift-20261105/source.png) |
| Image2: primary influencer, 720×1280 | ![Primary influencer](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-drift-20261105/identity-1.png) |
| Image3: same-person supporting portrait, 720×1280 | ![Supporting portrait](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-drift-20261105/identity-2.png) |

Model: `google/gemini-3-pro-image` via OpenRouter. Ratio9:16, imageSize2K, appearance background/outfit/hairstyle all source, custom instructions empty, caption cleanup enabled. No haircut/outfit-person reference was added. Stage2 would receive the reviewed stage1 image plus those same two portraits. Its existing identity prompt and harmonizer remain unchanged.

Full [input manifest and hashes](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-fix-20261105/inputs.json), [new base prompt with appearance roles](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-fix-20261105/base-prompt.txt), [actual assembled scene prompt including cleanup](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-fix-20261105/scene-prompt.txt), and [stage1 payload summary with image hashes/order and settings](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-fix-20261105/scene-input.json).

## Actual provider test result

The user initially had a local-only restriction. A concise clarification explicitly named the three images, OpenRouter/Gemini3Pro and charges; the user answered **Authorize this real OpenRouter generation**. One stage1 diagnostic POST was then sent using the actual current application pipeline/adapter helpers and corrected version8 prompt. It was a direct-provider diagnostic with local receipts, not a newly billed hosted application job or proof of deployed frontend/queue acceptance.

At **14:45:06.965 Asia/Calcutta**, OpenRouter returned:

```text
HTTP 402
This request requires at least $1.00 in balance for image or video output
limit_source: openrouter_credits
provider_name: null
```

No provider image/request ID or usage was returned. There is **no new stage1 PNG, no stage2 call and no final generated result**. The old bad output is not presented as a corrected result. The diagnostic was not retried. This balance rejection is distinct from the earlier completed request's scene-fidelity failure; it cannot demonstrate whether the new prompt fixes quality.

Read the [saved provider response](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/starting-frame-fix-20261105/scene-response.json). Credentials remain in memory and were not written into input/payload receipts. No provider-balance setting, model fallback, new key or billing policy was changed. Restoring the test account's required balance is necessary before a new authorized visual trial can complete; no automatic retry is queued.

## Verification

| Contract/check | Status |
| --- | --- |
| Default v8 has no youth/subtle-expression/equal-brightness conflict | VERIFIED locally |
| Reviewed hand/gaze/room constraints bound to exact source hash | VERIFIED locally |
| User directions, appearance choices and image order retained | VERIFIED locally |
| Historical v7 prompt with source roles matches original `062bd2f9…` SHA | VERIFIED |
| Audited old scene/identity/harmonizer input fingerprints still match exactly | VERIFIED by network-forbidden reconstruction |
| Both7/8 receipt parsing, client status verification, draft approval/reload and timeline parsing | VERIFIED locally |
| New8 is refused for incompatible historical receipt versions | VERIFIED locally |
| Hook/Wall/Talking admission, private access, recovery, custom prompt editing and existing UI handlers | VERIFIED in controlled regression tests |
| Stage2 inputs/orchestration, harmonizer and provider route/payload builder | Unchanged in this patch; worker regression suite passes |
| Actual new visual result, source-scene fidelity, face quality | NOT VERIFIED: upstream402 |
| Automated production scene-quality gate/localized edit route | NOT IMPLEMENTED |
| Deployed frontend/worker acceptance, fresh desktop/mobile visual comparison | NOT TESTED; no build/deployment |

Commands run without builds:

```text
node --import ./scripts/next-server-only-test-loader.mjs --import ./scripts/worker-source-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test lib/explore/hook-keyframe-draft.test.ts lib/explore/hook-keyframe-result.test.mjs lib/explore/hook-keyframe-generation-api.test.mjs lib/explore/hook-keyframe-image-prompt.test.ts lib/explore/starting-frame-scene-fidelity.test.ts lib/explore/starting-frame-appearance.test.ts lib/explore/starting-frame-reference-source.test.ts lib/explore/clip-initial-timing.test.mjs scripts/hook-starting-frame-ui.test.mjs scripts/hook-starting-frame-client.test.mjs
154 PASS, 0 failures/skips.

node --import ./scripts/next-server-only-test-loader.mjs --import ./scripts/worker-source-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test worker/src/lib/openrouter-gemini-image.test.ts worker/src/lib/generation-provider.test.ts worker/src/lib/durable-image-stages.test.ts worker/src/jobs/generate-image.test.mjs worker/src/jobs/generate-image.hook-keyframe.test.mjs worker/src/lib/hook-source-timeline.test.ts worker/src/lib/gemini-image.test.ts worker/src/lib/image-harmonizer.test.ts
105 PASS, 0 failures/skips.

node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/typescript/bin/tsc -p worker/tsconfig.json --noEmit --incremental false
Both PASS.

Scoped ESLint and git diff --check
No lint errors; one existing unused sourceFrame warning in the API test. Diff PASS.
```

The two final disjoint suites total259 tests. Earlier focused50 overlap and are not added again. Initial failures were old new-default wording assertions and an incomplete preparation-key fixture; fixtures were corrected, not validation weakened. The v7 text test explicitly selects7 and still verifies its original hash. Exact-input test/post-response artifacts and logs are under `.tmp/starting-frame-fix-20261105/`.

## Files changed, preflight and limits

Application:

- `lib/explore/hook-keyframe-image-prompt.ts`
- `lib/explore/hook-keyframe-generation-api.ts`
- `lib/explore/hook-keyframe-client.ts`
- `lib/explore/hook-keyframe-draft.ts`
- `worker/src/lib/starting-frame-reviewed-scene.ts` (new)
- `worker/src/lib/hook-keyframe-generation-contract.ts`
- `worker/src/lib/hook-keyframe-image-labels.ts`
- `worker/src/lib/gemini-image.ts` (version compatibility only; no route change)
- `worker/src/lib/hook-source-timeline.ts` (version compatibility only)

Tests: `lib/explore/starting-frame-scene-fidelity.test.ts` (new), `lib/explore/hook-keyframe-image-prompt.test.ts`, `lib/explore/hook-keyframe-generation-api.test.mjs`, `lib/explore/hook-keyframe-draft.test.ts`, `scripts/hook-starting-frame-ui.test.mjs` (prompt wording expectations only; existing concurrent test changes preserved).

Documentation: this receipt and appended Explore/clear entries. Ignored test helper/logs/receipts are local artifacts. No unrelated dirty path is attributed to this task.

Preflight: AGENTS, protected nonnegotiables, relevant actual Explore/clear history, prior exact-job audit, current sources/callers; context-memory, immutable-contracts, starting-frame, opening-frame-prompt, video-prompt and regression-gate instructions consulted. Large history output was partly truncated, so no fresh exhaustive reread is claimed. Read-only preflight discoverability PASS. Current source/identity stills were previously visually inspected in this same task flow; the new source constraints refer only to those observed stills, not an invented motion timeline.

No builds/dev server/bundling/push/deployment ran. Application and worker must both support new8 in any future coordinated release; that release is not authorized here. Rollback only this task's scoped prompt/version/test changes and appended documentation, preserving unrelated work. Historical jobs, provider operations and media were not rewritten/retried. Overall incident remains OPEN for real visual acceptance; prompt/compatibility correction is locally verified, not a guarantee of image quality.
