# Custom starting-frame outfit — 2 November 2026

Scope: complete explicit wardrobe instructions through the existing Starting image prompt on Gemini/OpenRouter starting-frame jobs. Source wardrobe stays default. No UI/layout/palette/dependency/schema/provider/billing/harmonizer change; no deployment.

## Implementation
API freezes new customImagePrompt as startingFrameOutfitPrompt in saved job input; worker requires it to equal the verified receipt custom prompt and includes it in request fingerprint. Scene and identity helpers receive the complete instructions with explicit wardrobe precedence and source-scene/background/light/pose separation. Caption cleanup preserves the chosen garment, removing its lettering rather than restoring source clothing. Without a new outfit field the previous prompt bytes remain unchanged, protecting old reservations/stage retries. Existing recovered/completed jobs are never rewritten. No extra provider stage or credit reservation.

User can select the supplied influencer image and edit the existing prompt, for example: “Use the gray shirt from Image 2. Keep the source room, lighting and pose.” No outfit chooser added. This does not introduce a separate garment-image upload role. Other model routes still use their existing single-stage custom-prompt mechanisms and were not changed or visually certified by this Gemini trial.

## Verification
- Python preflight PASS. Mandatory context/immutable-contract/starting-frame/video-prompt/opening/regression procedures applied using prior context reads and current relevant source/incident reinspection. AGENTS, Explore context and protected nonnegotiables retained; user-authorized wardrobe exception appended to nonnegotiables. Read installed Next route-handler guide in preceding API patch; no route convention changes.
- `npm run worker:build`: PASS.
- Worker durable/OpenRouter/harmonizer/dispatch/input/provider suites:81PASS/0FAIL. Log `.tmp/outfit-worker-tests.txt`.
- API/slideshow face swap/credit retry/starting-frame UI/UTF8 suites:103PASS/0FAIL. Log `.tmp/outfit-api-tests.txt`.
- `npx tsc --noEmit --incremental false`: PASS. Log `.tmp/outfit-types.txt`.
- Scoped eslint six files:0errors/1pre-existing unused-variable warning in API test. Log `.tmp/outfit-lint.txt`.
- Scoped diff check PASS (Git line-ending advisory only).
- Regression cases: custom outfit reaches both stages, source-outfit default, clothing-aware cleanup, no identity-room override, exact API persistence, historical job recovery, worker field equality/tamper rejection, unchanged standalone behavior, strict stage failure and saved-stage reuse. Requests are tested; these assertions do not prove generative fidelity.

## Real trial
Actual current worker helper and durable runner executed locally with file-backed operation/storage adapters and existing Secret Manager inference key in memory. One new custom-input attempt, at most two provider calls, no retries of the prior uncertain caption attempt. Scene: verified Hook original frame0/time0 from earlier receipt. Identity: existing main/support photos. Frozen custom instructions requested the gray top from Image2, source purple room/keyboard/pose/light, and caption cleanup.

Scene request `gen-1793599148-Q0LT5lZLVrYlviME6Plh`, identity request `gen-1793599182-0lPSnczPVGCgzmWuSLKk`, bothHTTP200, total provider-reported costUSD0.286310. All three stages finished in68.7s. Repeat returned byte-identical final SHA2565ae371a619cc1346ad3219d2d8391ba61cdb178559b3765c0131124884fd623e in0.20s with0newprovidercalls. Input hashes, prompt, usage, ledgers and stage PNGs: `.tmp/starting-frame-outfit-2026-11-02/`.

Viewed scene and final: gray long-sleeve top persists; source purple shelving/toys/curtain/keyboard room stays instead of neutral identity room; main white creator caption removed. This one sample supports wardrobe propagation, not exact clothing reconstruction across every garment/reference.

Full frame NOT APPROVED: Stage2 changes crop to928x1152 and introduces a microphone absent from Stage1/source; some physical lettering persists. UGC-VID-049 remainsOPEN. These defects are distinct from the requested outfit propagation and were not silently fixed or hidden. No quality-chasing paid retries.

## Files changed by this outfit patch
lib/explore/hook-keyframe-generation-api.ts; lib/explore/hook-keyframe-generation-api.test.mjs; worker/src/jobs/generate-image.ts; worker/src/jobs/generate-image.test.mjs; worker/src/lib/openrouter-gemini-image.ts; worker/src/lib/openrouter-gemini-image.test.ts; EXPLORE_CONTEXT.md; docs/ai-context/clear.md; docs/ai-context/nonnegotiables.md; this report. Local harness/artifacts in `.tmp/starting-frame-outfit-2026-11-02/`. Earlier user work preserved; diff also contains preceding pipeline/caption work.

Protected: source timestamp/order, original input key/custom text, historical job recovery, standalone swaps, stage-count/billing and harmonizer VERIFIED by tests or unchanged source. UI palette/layout UNCHANGED; browser mobile/desktop NOT TESTED for this worker-only patch. Production end-to-end, hosted stage persistence/billing and broad garment fidelity NOT VERIFIED. API and worker both require release. Rollback only outfit admission/validation/fingerprint/pass-through/prompt additions; preserve preceding durable/caption changes and do not replay accepted jobs with modified inputs.
