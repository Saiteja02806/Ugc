# Editable starting-frame prompt — local implementation receipt

Scope: visible full prompt editor; save/use/default in this browser per user; application reset; exact custom prompt through server admission, receipt and recovery. Limits: editable text up to 6,000 characters, complete Seedream prompt including labels up to 4,000 and other routes 8,000. These are current application limits, not verified provider maxima. Additional legacy instructions remain bounded at 2,000. Old accepted receipts remain unchanged. No database or deployment change.

Files changed for this implementation:
- components/explore/hook-starting-frame-workspace.tsx
- lib/explore/hook-keyframe-draft.ts
- lib/explore/hook-keyframe-client.ts
- lib/explore/hook-keyframe-variations.ts
- lib/explore/hook-keyframe-prompt-preview.ts
- lib/explore/hook-keyframe-generation-api.ts
- worker/src/lib/hook-keyframe-generation-contract.ts
- worker/src/lib/hook-keyframe-image-labels.ts (pure shared labels extracted unchanged)
- lib/explore/hook-keyframe-draft.test.ts
- lib/explore/hook-keyframe-generation-api.test.mjs
- scripts/hook-starting-frame-ui.test.mjs
- EXPLORE_CONTEXT.md
- docs/ai-context/clear.md
- this receipt

Preflight: AGENTS.md, EXPLORE_CONTEXT.md, docs/ai-context/clear.md and nonnegotiables.md; context-memory, immutable-contracts, starting-frame, video-prompt, ui-clarity and regression-gate SKILL.md; bundled Next use-client guide. Existing unrelated working changes retained.

Verification: 99 draft/API/UI/client/variation tests passed. Added negative custom-prompt tests then API suite passed 28/28. Worker source/identity/model suites passed 82/82 (included in a combined 167-check run). TypeScript --noEmit and scoped ESLint passed; diff check passed. Test command uses next-server-only-test-loader, experimental-test-module-mocks and experimental-transform-types. Initial test-runner and mock-import failures were corrected and rerun.

VERIFIED locally: source/photo roles, exact accepted custom text and changed-prompt replay rejection, >2,000-character custom input, legacy restoration, browser-owner preference isolation, explicit application reset, no generation on selection/default changes, model-limit admission before billing. Source roles are appended/interleaved by provider adapter, not editable role metadata.

NOT VERIFIED: desktop/mobile browser visual comparison, authenticated production UI, real generation from the new application UI, production model availability. No paid call or deployment. Saved defaults are localStorage only and do not sync devices. Generation-latency investigation remains open; no latency improvement claimed. UGC-UI-063 is locally implemented with browser/production acceptance pending.
