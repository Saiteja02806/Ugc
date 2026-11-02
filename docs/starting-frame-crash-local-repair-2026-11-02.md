# Starting-frame crash and UTF-8 repair receipt — 2 November 2026

Status: application repair verified by local behavioral tests and HTTP; visual acceptance PARTIAL / BLOCKED by browser availability.

## Scope
Fixture now loads the original t=0 frame through the existing extraction endpoint and shared verified reader. Workspace handles incompatible extraction data within the existing source error/retry UI; generation, approval, and autosave are blocked while invalid. Saved draft/photo inputs survive and valid input recovery is tested. No CSS, layout, provider payload, schema, or billing changes were made by this repair.

UTF-8: the source file reported previously changed before repair began and already decoded successfully. No encoding rewrite was necessary. New strict UTF-8 regression scans tracked application source. Do not attribute the earlier correction to this repair.

## Files changed by this repair
- app/e2e/hook-keyframe-preview/preview.tsx
- components/explore/hook-starting-frame-workspace.tsx (validation/recovery only; concurrent white-action edits in the same file are separate work and preserved)
- scripts/hook-starting-frame-ui.test.mjs
- scripts/source-utf8.test.mjs (new)
- EXPLORE_CONTEXT.md (appended repair note)
- docs/ai-context/clear.md (appended evidence for starting-frame UGC-UI-099 and encoding UGC-UI-101; historical IDs have collisions, so titles disambiguate)
- docs/starting-frame-crash-local-repair-2026-11-02.md (this receipt)
Temporary test outputs under .tmp/starting-frame-fix-* and .tmp/verify-local-fix.mjs.

## Preflight
Read project AGENTS.md engineering preflight section, Explore context and incident ledger via full-file reads (tool output truncated), protected nonnegotiables, relevant code/callers/draft parser/client/fixture/tests. Skills read: ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-starting-frame, ugc-video-prompt (prior audit), ugc-regression-gate, ugc-scheduling. Next installed docs: use-client and error-handling. Python preflight PASS. Existing user work preserved. The latest original-opening-only contract takes precedence over historical middle-frame skill suggestions.

## Validation
- node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/hook-starting-frame-ui.test.mjs scripts/starting-image-status-recovery.test.mjs scripts/source-utf8.test.mjs: 69 PASS, 0 FAIL.
- node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/hook-starting-frame-client.test.mjs scripts/explore-format-demo-state.test.mjs scripts/explore-format-source-workspace.test.mjs scripts/explore-navigation-ui.test.mjs scripts/workflow-clip-source-actions.test.mjs lib/theme.test.ts: 180 PASS, 0 FAIL.
- node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/scheduling/account-timezone.test.ts lib/scheduling/schedule-form-persistence.test.ts scripts/explore-format-schedule-draft.test.mjs: 34 PASS, 0 FAIL.
- npx tsc --noEmit --incremental false: exit 0.
- npx eslint components/explore/hook-starting-frame-workspace.tsx app/e2e/hook-keyframe-preview/preview.tsx scripts/hook-starting-frame-ui.test.mjs scripts/source-utf8.test.mjs: exit 0, no output.
- Scoped git diff --check: exit 0.
- Read-only local HTTP checks: Hook, Wall, Slideshow, Talking Head fixtures, influencer studio, Explore catalog, schedule inline fixture, starting-frame fixture all 200 with no source parsing error. This verifies route compilation, not hydration or click behavior.
- Opening extraction endpoint: HTTP200, PNG 720x1280, frame index0/time0. Downloaded SHA256 equals receipt d5dfcbb4e9bcf3eedcdc1dec6766825498892aea82fe338f5922dc6e41253451. Original source hash 928ee9942d157b5e22797ca819bf01e8087b9e3f6285f0f27ad26d64a6484df0.

## Protected contracts
VERIFIED by tests: invalid-frame rejection, recovery, saved photo order, no duplicate POST, retained historical-job recovery, source hash/timestamp reader validation, workflow source transitions, theme contract, schedule timezone/draft behavior.
UNCHANGED BY THIS PATCH: CSS and layout definitions, palette, 24-hour picker implementation, auth/provider/billing APIs. Concurrent user work modifies other UI files; this receipt does not certify those changes.
NOT VERIFIED: new desktop/mobile screenshots and click-through after repair, picker interactions and remaining sidebar visual audit, browser hydration, real generation/save, durable schedule/targets and provider publication, production deployment. No production build requested/run; TypeScript and development route compilation verified.

## Browser blocker
The user reports browser use is On. Repeated cua calls and a fresh kernel inventory still report Local browser use is disabled in Work settings and expose no browsers. Browser troubleshooting documentation access is blocked by the same response. No alternate automation attempted to bypass it. Earlier audit screenshots remain before evidence only; no after screenshot fabricated.

## Remaining observations
Studio 4K/mobile left-dock copy, Slideshow singular wording, and subjective workflow consistency findings remain outside this repair. UGC-VID-045 hosted generation report remains open. No commit, push, deployment, paid generation, or publishing performed.
