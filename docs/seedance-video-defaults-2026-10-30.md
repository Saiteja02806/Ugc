# Seedance video defaults

New video sessions prefer Seedance 2.5 when its existing feature gate is enabled. Existing saved drafts and explicit selections are preserved. Disabled-model fallback behavior remains. Image and audio generation use their own models.

Files changed for this request:
- lib/ai-studio/generation-settings.ts: shared availability-aware default helper.
- lib/explore/workflow-generation-settings.ts: reuse helper for Talking Head and Creator Phone settings.
- components/video/video-generation-workspace.tsx: Seedance defaults for Hook, Wall and ordinary video generation.
- components/viral/viral-workspace.tsx: Seedance initial reference selector.
- lib/ai-studio/generation-settings.test.ts and scripts/explore-quick-start-presets.test.mjs: regression coverage.
- EXPLORE_CONTEXT.md and docs/ai-context/clear.md: policy and UGC-UI-070 receipt.
- This report.

Checks: 38 model/settings/quick-start/workflow tests PASS, including explicit model retention and disabled Seedance safety. Preflight script PASS; same-session UI clarity, immutable contracts, context-memory and regression procedures applied. Existing unrelated work retained. Prompt templates, source/identity handoffs, generation handlers and scheduling unchanged by diff inspection. Browser desktop/mobile, hosted acceptance and paid model output NOT VERIFIED; no deployment or provider call. Rollback is limited to the default helper and selector initializers.
