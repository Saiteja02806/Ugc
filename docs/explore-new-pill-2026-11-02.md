# Explore New pill refinement — local receipt

Replaced the plain white reference status tag with a compact dark-glass pill: off-white New text, a decorative blue dot, a fine blue-tinted border and restrained shadow. The24px pill retains the existing12px top/left anchor. It remains a noninteractive status span with pointer pass-through; existing `reference.isNew` eligibility is unchanged. No animation or new action.

## Scope and files

- `components/explore/recreate-workspace.tsx`: badge markup uses scoped styles and decorative dot.
- `components/explore/workflow-studio.module.css`: pill/dot styles only for this task.
- `scripts/recreate-actions.browser.mjs`: optional `--badges` review uses separate baselines and verifies new status treatment while retaining existing action tests. Saves close-up card screenshots.
- `EXPLORE_CONTEXT.md`: product decision.
- `docs/ai-context/clear.md`: UGC-UI-116 observed preference and local verification.
- This receipt.

All other existing worktree edits are preserved. Rollback only these task-specific hunks, not whole files containing earlier work. No dependencies, API/provider, authentication, billing, generation or scheduling changes. No push/deployment.

## Preflight sources and contract

Applied repository AGENTS instructions, relevant Explore context and ledger history, nonnegotiables, ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-regression-gate and frontend-design skills. The skill files were read in this session; this receipt does not claim a fresh full reread of all extensive context history. Python repository preflight passed. Caller/render condition and existing worktree diffs inspected. Scope: status appearance only; preserve card/media geometry, status eligibility, separate preview/Recreate/source controls and darker palette elsewhere. Design uses existing typography and blue family without changing global tokens.

## Verification

- `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test scripts/slideshow-card-ui.test.mjs scripts/explore-reference-preview.test.mjs scripts/source-utf8.test.mjs` — **12 passed**.
- `npx eslint components/explore/recreate-workspace.tsx scripts/recreate-actions.browser.mjs` — **passed**.
- `npx tsc --noEmit` — **passed**.
- `node scripts/recreate-actions.browser.mjs --badges --before` and `node scripts/recreate-actions.browser.mjs --badges` — **passed at1440,390,320px**. Actual reference-card component/CSS rendered with isolated authentication/media dependencies. Checks exact badge anchor,24px height, foreground color, pointer-events:none and non-button semantics. Existing callback, repeat action, keyboard, touch, disabled, unavailable preview, source separation and card geometry assertions also pass. Non-new Talking Head fixture cards retain no badge. No paid calls.
- Scoped `git diff --check` — **passed**, line-ending advisories only.

Before/after artifacts: `.tmp/new-pill/{before,after}/recreate-{1440,390,320}.png`; close-ups `.tmp/new-pill/after/new-pill-card-{1440,390,320}.png`. Desktop render visually inspected. Logs `.tmp/new-pill/baseline.log`, `browser-final.log`. User's attached screenshot provides the reported existing treatment; isolated same-fixture before/after screenshots support geometry comparison, not full authenticated acceptance.

| Contract | Status |
| --- | --- |
| New eligibility remains driven by existing data | VERIFIED by unchanged condition and new/non-new fixture |
| Noninteractive status and pointer pass-through | VERIFIED locally |
| Card geometry, Recreate, source and preview controls | VERIFIED locally |
| Desktop/mobile clipping and viewport bounds | VERIFIED locally |
| Generation, scheduling and authenticated hosted flows | NOT TESTED; unchanged |
| Production appearance | NOT VERIFIED; not deployed |

UGC-UI-116 has local evidence; visual acceptance remains the user's decision. Previously recorded unrelated broader-suite failures remain outside this styling task.
