# Local Recreate button standardization — 2 November 2026

Hook Video, Wall of Text, Slideshow and Talking Head now share one lower-right native button with a rotate icon and visible **Recreate** label. The shared control retains the existing dark translucent treatment, adds consistent border/focus states and supports 44px touch targets. Selection does not remove the repeatable action. Unavailable Talking Head sources display **Preview only** and retain preview-only behavior.

## Scope and files

- `components/explore/recreate-workspace.tsx`: shared labelled control, source-link separation; independent media preview retained.
- `components/explore/talking-head-references.tsx`: same action style, accurate unavailable label, existing callbacks/prewarming/disabled semantics.
- `components/explore/workflow-studio.module.css`: scoped shared button and narrow-screen source positioning.
- `components/explore/talking-head-references.module.css`: remove superseded icon-control styles.
- `components/explore/workflow-video-layout.module.css`: remove superseded footer/control overrides, retain source touch target rules.
- `scripts/slideshow-card-ui.test.mjs`, `scripts/explore-reference-preview.test.mjs`, `scripts/talking-head-references.test.mjs`: assert new standard while retaining callback, metadata, preview and prewarming contracts.
- `scripts/recreate-actions.browser.mjs`: isolated browser regression fixture using real source components and styles.
- `EXPLORE_CONTEXT.md`, `docs/ai-context/nonnegotiables.md`, `docs/ai-context/clear.md`: product decision, explicit user exception and append-only incident evidence.
- This receipt.

All other existing worktree changes are outside this task and remain untouched. Rollback boundary is the changes above, preserving other edits already present in shared files. No dependency, API, provider, billing, persistence, scheduling or deployment changes.

## Preflight

Applied repository AGENTS instructions, relevant Explore context and incident entries, nonnegotiables, and mandatory skills: ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity and ugc-regression-gate. Context/incident files contain extensive history; relevant task entries were inspected, not a new claim of reading every historical line. Repository Python preflight passed. Source/callers and existing tests established the minimal scope. The user's explicit standardization request authorizes extending the previously slideshow-only rounded action treatment; the contract clarification records that narrow exception.

## Verification

- Focused tests: `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test scripts/slideshow-card-ui.test.mjs scripts/explore-reference-preview.test.mjs scripts/talking-head-references.test.mjs scripts/hook-saved-influencer-picker.test.mjs scripts/source-utf8.test.mjs` — **28 passed, 0 failed**.
- Scoped ESLint covering changed TSX/test/browser-script files — **passed**.
- `npx tsc --noEmit --incremental false` — **passed**.
- `node scripts/recreate-actions.browser.mjs --before` and `node scripts/recreate-actions.browser.mjs` — **passed at 1440, 390 and 320px**. Assertions cover exact callbacks, Enter activation, selected repeat action, independent preview, unavailable preview without selection, native disabled action, white text, label fit, 44px coarse-pointer height, source-link nonoverlap, viewport bounds and before/after thumbnail dimensions.
- Scoped `git diff --check` — **passed** (line-ending advisories only).

Logs: `.tmp/recreate-standard/tests-final.log`, `lint-final.log`, `types.log`, `browser-baseline-valid.log`, `browser-final.log`.
Before/after screenshots: `.tmp/recreate-standard/{before,after}/recreate-{1440,390,320}.png`. Final desktop and 320px screenshots visually inspected; browser assertions cover all three sizes.

## Protected behavior receipt

| Behavior | Result |
| --- | --- |
| One visible, consistently labelled action per card | VERIFIED locally |
| Separate preview/source actions and unavailable preview-only behavior | VERIFIED locally |
| Repeat selection, keyboard, native disabled and prewarming callbacks | VERIFIED locally |
| Dark palette and thumbnail dimensions | VERIFIED locally |
| Desktop/mobile control bounds and touch target sizes | VERIFIED locally |
| Provider requests, identity/timestamp mapping and schedule execution | NOT TESTED; no implementation changes |
| Full authenticated production workflows | NOT TESTED |

The browser fixture uses actual reference components/CSS with isolated authentication, provider reads, playback and modal contents. It does not prove full-page hosted integration or real generation. No paid calls, push or deployment occurred. Previously recorded unrelated broad Explore-suite failures remain unresolved; this focused result does not imply the entire repository suite is green. Incident **UGC-UI-113** has local verification evidence; production acceptance remains unverified.
