# Starting-frame background and outfit choices — 2 November 2026

Status: implemented and locally verified for UI, persistence and request wiring. Generated-image fidelity, mobile visual acceptance and production NOT VERIFIED. No deployment.

## User contract
Both roles default to the source starting frame. Two independent controls in existing Your photos section: Use background from my photo; Use outfit from my photo. On uses the first selected owned influencer photo for that role. Other selected photos supply identity only. Empty/restoring/busy/historical-frame states disable controls. Existing Change photos picker is reused; no new upload, duplicate chooser or separate garment/background image selection. Source camera, pose, expression, timestamp, hands/props and light stay authoritative. Explicit UI choices override conflicting textual defaults. Caption/logo removal and harmonizer remain.

## Implementation and recovery
New browser-safe worker module defines strict role values, canonical field order and shared prompt instructions. Optional referenceOptions is added to draft, draft input key, API admission, saved receipt, preparation key and resulting aggregate/stage request fingerprints. Invalid/extra/unowned role fields rejected; image references continue through existing ownership checks. Existing absent-options keys stay byte-identical. Toggling a role invalidates old generated approval; saved jobs are recovered without rewriting preferences or submitting again. Source-frame byte/hash verification and exact reference order retained.

API freezes options and assembled prompt; Gemini scene and identity stages get the selected role instructions with cleanup that preserves the chosen background/garment. Google/Seedream/GPT image labels agree with role choices. Existing custom outfit text remains available, but explicit controls take priority once present. Prompt preview shows the assembled choices and model length checks include them. No extra generation stage, billing reservation, dependency, migration, config or global styling change.

The no-charge development fixture now returns current v5 receipt/preparation binding for its v4 browser draft; prior fixture returned incompatible historical metadata. Fixture output remains sample pixels, never real-image acceptance.

## Validation
Preflight: prior AGENTS/context/nonnegotiables and incident history retained, relevant source/contracts rechecked, Python preflight PASS; context-memory, immutable-contracts, starting-frame, video-prompt, opening-frame-prompt, ui-clarity and regression-gate procedures applied. Read installed Next use-client guide. Current caller paths/ownership/preparation/reservation/parser/storage examined. No broad context rewrite; user default clarification takes precedence over historical source-room-only policy.

- npm run worker:build PASS.
- 88 worker tests PASS: durable stages, OpenRouter both-stage choices in all four combinations, harmonizer, worker dispatch, original-frame contracts, provider operations and historical receipts. `.tmp/reference-options-worker-tests.txt`.
- 156 API/draft/client/prompt/UI/credit/UTF8 tests PASS: all four combinations, invalid values, request collision protection, restore/old-frame invalidation, real-component checkbox defaults and submission, existing recovery/credits/UI. `.tmp/reference-options-regression.txt`.
- npx tsc --noEmit --incremental false PASS; `.tmp/reference-options-types.txt`.
- Scoped ESLint0errors/1pre-existing unused-variable warning in API test; `.tmp/reference-options-lint.txt`.
- Scoped git diff check PASS (Git line-ending advisory).

Desktop browser fixture at1440×1000: both initiallyoff; independent outfit selection; bothon survive reload; mock generation reaches completed sample, accessible through previous generations; changing outfit off while backgroundon displays Inputs changed and disables Use selected frame. Screenshot `.tmp/starting-frame-reference-options/desktop.jpg` reviewed: established dark palette/three-column desktop layout retained, controls in person column, footer accessible. No approved before screenshot captured; original DOM inspected before edit. No claim of pixel-identical layout after adding requested controls.

Mobile viewport check could not run: browser use became disabled after desktop verification. Browser viewport reset likewise unavailable at that point. Mobile responsive overflow/touch and full signed-in/production acceptance remain NOT TESTED. Automated component tests do not replace those checks.

Real paid trial using approved existing source and main/support images, configured inference credential only in memory, actual compiled worker helper/durable runner with local file-backed ledger/storage. Background=photo, outfit=source, canonical source t=0. Harness initial import failed before submission and was corrected. One actual provider request returnedHTTP200 but no usable image, usagecost0; runner marked uncertain and stopped without retry. No Stage2/final image or success. Artifacts `.tmp/starting-frame-reference-options/real-background/`. Do not infer image-quality success or that options caused upstream failure; exact provider cause UNKNOWN. Prior outfit-only trial remains separate evidence, not proof of every new role combination. No customer jobs, hosted persistence/billing or deployments modified.

## Files changed in this feature
- components/explore/hook-starting-frame-workspace.tsx
- app/e2e/hook-keyframe-preview/preview.tsx
- lib/explore/hook-keyframe-draft.ts and hook-keyframe-draft.test.ts
- lib/explore/hook-keyframe-generation-api.ts and hook-keyframe-generation-api.test.mjs
- lib/explore/hook-keyframe-prompt-preview.ts
- worker/src/lib/starting-frame-reference-options.ts (new)
- worker/src/lib/hook-keyframe-generation-contract.ts
- worker/src/lib/hook-keyframe-image-labels.ts
- worker/src/lib/gemini-image.ts
- worker/src/lib/openrouter-gemini-image.ts and openrouter-gemini-image.test.ts
- worker/src/jobs/generate-image.ts and generate-image.test.mjs
- scripts/hook-starting-frame-ui.test.mjs
- EXPLORE_CONTEXT.md; docs/ai-context/nonnegotiables.md; append-only docs/ai-context/clear.md; this report
- Local test harness/receipts/source/screenshot under .tmp/starting-frame-reference-options/.

Earlier uncommitted user changes preserved. Rollback only this optional referenceOptions/role-aware prompt/UI path, maintaining previously accepted job fingerprints and earlier durable/caption/outfit work. Website and worker must both release before production supports new role inputs. Protected status: original timestamp/order/ownership/defaults/retries VERIFIED by local tests; palette/styles and standalone Face Swap/harmonizer UNCHANGED. UGC-VID-051 local option wiring verified; UGC-VID-049 image-fidelity issues remainOPEN.
