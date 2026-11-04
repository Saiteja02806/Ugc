# Talking Head result review — 5 November 2026

Implemented locally; not deployed. Approved reference: **Review and continue**, with `Your talking-head clip`, `Review the expression, voice and framing` and the standalone `Video N selected` line removed.

## Scope and files

- `components/explore/talking-head-result-review.tsx` — focused real video preview, saved output facts, one Continue to Demo, version selection, collapsed exact prompt/Copy, and guarded unavailable-output recovery. No generation, upload, finishing, billing or scheduling API call is made by this component.
- `components/explore/talking-head-result-review.module.css` — scoped responsive layout only; inherits existing dark tokens and shared Button colors/hover/focus. Portrait preview is capped at435px on wider panels/320px on narrow panels, never cropped. Landscape remains landscape.
- `components/explore/hook-workflow-preview.tsx` — renders that review for generated results, including restored/History results; keeps the review visible when selecting versions and suppresses the detached duplicate Continue. The existing `changeSection("edit")` still opens Demo. Upload/Creative Assets keep their existing paths; all editor/demo work stays mounted. Existing unrelated script/starting-frame edits in this file were preserved.
- `scripts/talking-head-result-review.test.mjs` — seven focused component/wiring regressions using actual JSX callbacks and actual saved-metadata mapper.
- `scripts/talking-head-result-review.browser.cjs` — non-build isolated SSR/native-browser verification.
- `scripts/workflow-composition-panel.test.mjs` — updates the caller assertion to recognize the dedicated Talking Head component; shared Phone canvas assertions retained.
- `scripts/workflow-demo-audio-state.test.mjs` — new component stub and real parent-handler Continue→Demo→Create preservation regression.
- `scripts/workflow-source-video-ui.test.mjs` — new component stub so existing source/picker checks retain their isolation.
- `EXPLORE_CONTEXT.md`, `docs/ai-context/nonnegotiables.md`, `docs/ai-context/clear.md`, this receipt — appended approved contract/evidence.

Rollback only the new review files and this task's integration/test hunks. Shared files already contained substantial unrelated uncommitted work; do not revert them wholesale. Other dirty files, including provider/prompt/automation work, were not part of this patch.

## Preserved behavior and edge cases

| Contract | Result |
| --- | --- |
| Dark surfaces and existing blue button/hover/focus | VERIFIED by token-only scoped diff and browser primary background rgb(0,120,212) |
| Removed copy and standalone selected summary absent | VERIFIED in component and browser assertions |
| One review Continue, same Demo destination | VERIFIED in component callback and actual parent-handler tests |
| Exact selected asset/metadata/prompt; no current-form substitution | VERIFIED; choosing version2 previews/copies/continues with version2 |
| Explicit cleared/missing saved selection | VERIFIED; no silent candidate approval, Continue disabled until explicit choice |
| Ready clip during another pending/failed output | VERIFIED locally; feedback visible and valid clip still usable |
| No completed result | VERIFIED; existing placeholder/empty/error canvas retained; unavailable records never become playable results |
| Native controls/aspect and no autoplay | VERIFIED in source/props and controlled browser playback; 16:9 measured after metadata at all four widths |
| Prompt expansion and exact Copy | VERIFIED native disclosure/visible real Copy button and exact-value props; existing clipboard tests pass |
| History, source modes, script/demo/audio and exact saved recovery | VERIFIED in existing focused fixtures and parent round-trip; actual hosted requests NOT TESTED |
| Phone/shared canvas and shared result CSS | Unchanged by this task; existing generic result tests pass |
| Generation/provider/identity/credits/scheduler backend | No task edits; real paid generation, finishing and publication NOT TESTED |

Selection delegates to the existing generation boundary. It does not create work. Continue delegates to the existing section transition; it does not schedule or render. Output model/resolution use the existing saved-asset mapper; invalid/unknown facts are omitted. The owned-generation boundary's explicit-ID restoration and fail-closed behavior were not rewritten.

## Preflight

Sources inspected: AGENTS.md and the standing user no-build rule; EXPLORE_CONTEXT.md including Create→Demo/history/output layout rules; clear.md including UGC-UI-20261105-TALKING-HEAD-RESULT-ACTIONS; nonnegotiables.md; context-memory, immutable-contracts, ui-clarity and regression-gate skills; installed Next CSS Modules guide. Traced current preview, media player cleanup, generation selection, saved metadata and existing callers/tests. `python tools/preflight.py --repo . --task "Implement approved Talking Head Review and continue generated-result layout without removed copy or selected summary; preserve dark palette and existing selection/Demo/History; test locally, no build or deployment"` reported prerequisites discoverable/readable.

## Executed checks

- `npx tsc --noEmit --incremental false`: PASS.
- Scoped ESLint over both touched components and five changed/new test files: PASS.
- `node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/talking-head-result-review.test.mjs scripts/workflow-demo-audio-state.test.mjs scripts/workflow-source-video-ui.test.mjs scripts/workflow-session-ui.test.mjs scripts/hook-workflow-preview.test.mjs`: **59 PASS**.
- `node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/ai-studio/clipboard.test.mjs`: **5 PASS**.
- `node --test scripts/workflow-composition-panel.test.mjs`: **26 PASS, 3 FAIL**. The three failures are independently reproduced using the unmodified HEAD test file, restricted to the same test names; the inputs they assert are untouched by this patch. They expect a subtitle selected-border declaration, a12px reference-button radius, and voice-help copy without the existing five-second minimum. They were not weakened or repaired here. Logs `.tmp/talking-head-review-composition.log`, `talking-head-review-baseline.log`, `talking-head-review-unrelated.log`.
- `node scripts/talking-head-result-review.browser.cjs`: **128 assertions PASS, zero page errors**, at1440/900/390/320px. One/four results, portrait/landscape, ready/cleared/pending/failed/partial states, no horizontal overflow, one eligible CTA, blue background, keyboard prompt disclosure, full long prompt and visible Copy, real fixture playback with advancing time and decoded frames. Native playback is muted in the fixture only; product audio behavior is unchanged.
- Targeted `git diff --check`: PASS.

Initial test invocation omitted the repository's extension resolver for existing TS imports and failed before tests ran; corrected to the documented non-build loader command above. The first new unit helper also compared JSX whitespace literally; normalized test-label whitespace and reran the exact-selection check. Neither required a product behavior workaround.

## Visual evidence and limits

Before/after desktop/mobile and expanded-prompt captures: `.tmp/talking-head-result-review/before-1440.png`, `after-1440.png`, `after-900.png`, `after-390.png`, `after-320.png`, `prompt-320.png` and corresponding sizes; measurements/results in `results.json`. Desktop and narrow mobile output and long-prompt views were manually inspected against the approved first design. No removed labels, detached review CTA, altered palette or horizontal overflow observed.

The browser fixture server-renders the **actual** review, shared Button, Copy and MediaPlayer with current scoped CSS and already-existing compiled global CSS. It does not start Next, bundle or build. Saved records/provider responses are controlled; local archival portrait/cover MP4 bytes exercise native playback, not a newly generated customer output. Fixture metadata is for layout testing and is not proof of those clips' generation settings. Icons and base controls are real. Unrelated popover/upload imports and provider-only metadata helpers are stubbed where unused. Native disclosure/playback run in Chrome; React event callbacks and the parent transition run in separate real-source harnesses. Full hydrated signed-in application, real clipboard permission/History HTTP, integration across an actual reload, provider output and production acceptance remain **NOT VERIFIED** under the no-build/no-deploy boundary.

Incident UGC-UI-20261105-TALKING-HEAD-RESULT-ACTIONS: local component/layout/handler checks VERIFIED, authenticated integration/production acceptance OPEN. The broader existing test mismatches are logged separately as UGC-TEST-20261105-COMPOSITION-BASELINE. No app build, worker build, push, deployment, settings change, paid generation or payment.
