# Background and outfit disclosure — 2 November 2026

User asks to hide both role controls until clicking Background and outfit. Wrapped the existing fieldset in native details/summary, collapsed by default, preserving current location, neutral palette, role state/handlers and disabled/busy guards. Browser handles pointer/keyboard expand/collapse without custom state. Closing the disclosure does not reset choices. No backend/prompt/schema/config changes or deployment.

Application files: components/explore/hook-starting-frame-workspace.tsx; scripts/hook-starting-frame-ui.test.mjs. Documentation: EXPLORE_CONTEXT.md; docs/ai-context/clear.md (append-only UGC-VID-051 UI clarification); this receipt. Preserve all prior unrelated work.

Preflight: prior required context/history retained; relevant source, UI-clarity/immutable-contract procedures reread, Python preflight PASS; existing native Starting image prompt disclosure used as pattern. Changes limited to disclosure wrapper, accessible labels and a regression assertion. Original user screenshot is before evidence; no approved after screenshot available.

Verification:63 starting-frame component/UTF8 tests PASS including both choices under collapsed disclosure and unchanged submission/persistence. Log .tmp/background-outfit-disclosure-tests.txt. TypeScript/scoped lint/diff checks recorded separately in .tmp/background-outfit-disclosure-types.txt and tool results. No real generation needed for this presentation-only change. Source defaults/option selection/provider behavior unchanged by patch.

Browser inventory rechecked: no browser surface, reports local browser use disabled in Work settings. Desktop/mobile visual/click/keyboard acceptance NOT TESTED in browser; native disclosure/component structure verified. No attempt to bypass the disabled browser setting. Production NOT VERIFIED, not deployed. Rollback boundary: details/summary wrapper and its test only.
