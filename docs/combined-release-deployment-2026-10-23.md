# Combined release audit — 2026-10-23

Deployment resumed at the user's explicit request to check and deploy all current changes in the documented order. This supersedes earlier deployment-pause entries. No paid generation or unrelated migration is included.

## Scope and validation

All intentional source, configuration, migration, script, test, documentation and versioned media changes are included. Scope includes Hook/Wall/Talking Head starting-frame preparation and selection/history, supported animation models, schedule/preview layout fixes, slideshow named input planning and private execution contracts, new reference batches and reviewed captions/motion directions, workflow-specific New badges and platform mixing, polling/auth deadlines and recovery, Settings/MCP lazy loading, and homepage assets/performance/copy. The v4 scene-recreation prompt already on main is retained.

- Combined focused suite: 1,099 passing tests across 83 files.
- Worker suite: 346 passing tests. MCP suite: 324 passing tests. Counts overlap with the focused suite.
- Scoped lint: zero errors or warnings; production Next build and TypeScript pass.
- Native decoder packages resolve and execute in all four isolated route traces; lightweight MCP discovery/health routes exclude native media packages.
- Four stale test contracts were corrected: new catalogue size, supported Wall animation, reviewed performance wording, and a factored Trending progress variable. Unsupported worker requests still reject before provider reservation; its error now describes the supported model/provider contract accurately.
- The first hosted preview exposed an upload exclusion: unanchored `build/` also removed the versioned `lib/build` native tracing helper. The Vercel exclusion is now root-anchored as `/build/`; production traffic was unchanged while correcting this packaging issue.
- GitHub's MCP test step passed, but its required production dependency audit then reported published Next.js advisories. Next.js and eslint-config-next are pinned to 16.4.2; the flagged root ip-address transitive dependency is refreshed. The worker lock is reconciled with its existing `--legacy-peer-deps` install contract, removing unused Next/React peer packages brought in by the font package. Root and worker production audits now report zero vulnerabilities. Advisory references: [image optimizer](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [cache typed arrays](https://github.com/advisories/GHSA-673q-mjm6-r5xr), [Server Actions](https://github.com/advisories/GHSA-p3m5-59mp-jv5r). Build/runtime checks are repeated on the patched version before promotion.
- Read-only production database verification confirms migration 20261022092140 is present, RLS is enabled, public table/function access is denied, and service-only access remains. No database write or bulk migration is required. Historical migration drift remains documented in the earlier release report.
- Existing source/media review and local browser receipts are retained separately. Source review, fixture passes and a successful build do not establish generated-media fidelity or authenticated production acceptance.

## Deployment order

1. Verify the existing database prerequisite (complete).
2. Commit the complete reviewed inventory and reconcile remote main.
3. Build the generation worker from the frozen commit; deploy a pinned image and verify the baked/runtime commit before moving traffic.
4. Merge/release the website and MCP from the same source tree, after the worker is active.
5. Record remote commit, worker revision/digest and hosted deployment identities; verify production serving and report authenticated acceptance limits.

Runtime identity and hosted acceptance receipts are added after deployment. Local evidence is under .tmp/deployment-20261023 and is intentionally ignored. The unused sibling Vercel project, deferred billing recovery/default-mix migrations and previously deferred public image catalogue upload are outside this release.

## Excluded paths and reasons

The following are the complete ignored path entries reported by Git at the release audit. Directory entries exclude their ignored descendants. No intentional unignored source path is omitted. Secrets/local environments, dependencies, caches/build output and local diagnostic or design artifacts are excluded; public/brand and public/marketing/previews versioned assets are included.

| Path | Reason |
| --- | --- |
| `.agents/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.chrome-carousel-upgrade-check/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-artifacts/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-audits/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-auth-check-stderr.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-auth-check-stdout.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-dev-4173.err.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-dev-4173.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-dev-4173.out.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-dev-4300.err.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-dev-4300.out.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-dev-error.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-dev-output.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-dev-shell.err.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-dev-shell.out.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-dev-stderr.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-dev-stdout.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-library-dev-4173.err.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-library-dev-4173.out.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-next-dev.err.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex-next-dev.out.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.codex/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.env.development.local` | Local environment or credentials |
| `.env.local` | Local environment or credentials |
| `.mcp-audit-app-tests.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.mcp-audit-lint.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.mcp-audit-typecheck.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.mcp-audit-worker-tests.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.next-dev-4300.err.log` | Dependencies, build output or tool cache |
| `.next-dev-4300.out.log` | Dependencies, build output or tool cache |
| `.next-dev.err.log` | Dependencies, build output or tool cache |
| `.next-dev.out.log` | Dependencies, build output or tool cache |
| `.next-server-4300-direct.err.log` | Dependencies, build output or tool cache |
| `.next-server-4300-direct.out.log` | Dependencies, build output or tool cache |
| `.next-server-4300.err.log` | Dependencies, build output or tool cache |
| `.next-server-4300.out.log` | Dependencies, build output or tool cache |
| `.next-start-4300.err.log` | Dependencies, build output or tool cache |
| `.next-start-4300.out.log` | Dependencies, build output or tool cache |
| `.next/` | Dependencies, build output or tool cache |
| `.playwright-mcp/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-all-app-tests.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-app-tests.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-build.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-cloud-build.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-copy-validation.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-env-names.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-final-app.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-final-next.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-final-targeted.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-final-worker.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-merged-types.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-merged-worker.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-next-build.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-production-ai-smoke.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-production-render-smoke-final.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-production-render-smoke.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-production-smoke-final.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-production-smoke.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-reconcile-test.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-validation-recheck.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-validation.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-vercel-errors.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-vercel.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-wall-simulation.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-worker-identity.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-worker-image.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-worker-rollout.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-worker-tests.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.release-worktrees/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.tmp-release-app-tests.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.tmp-release-build.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.tmp-release-carousel-tests.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.tmp-release-extra.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.tmp-release-final-extra.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.tmp-release-targeted.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.tmp-release-worker-tests.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.tmp/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.tools/` | Dependencies, build output or tool cache |
| `.trigger-dev.err.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.trigger-dev.out.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `.vercel/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `ai-studio-images-desktop.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `artifacts/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `auth-desktop.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `carousel-candidate1-slide1.webp` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `carousel-candidate1-slide5.webp` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `carousel-candidate2-slide1.webp` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `carousel-final-generated-deck.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `carousel-final-polished-deck-styled.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `carousel-final-polished-deck.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `carousel-final-single-deck.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `carousel-final-slide3-fixed.webp` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `carousel-final-slide3-polished.webp` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `carousel-final-slide5-fixed.webp` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `carousel-final-slide5-polished.webp` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `carousel-ui-check-ready.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `carousel-upgrade-check.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design-qa-onboarding-flow-v3-comparison.jpg` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design-qa-onboarding-step1-comparison.jpg` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design-qa-onboarding-step1-desktop-v3.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design-qa-onboarding-step1-desktop.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design-qa-onboarding-step1-mobile-form.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design-qa-onboarding-step1-mobile-viewport-v3.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design-qa-onboarding-step1-mobile-viewport.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design-qa-onboarding-step2-desktop-v3.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design-qa-onboarding-step2-desktop.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design-qa-onboarding-step2-mobile-v3.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design-qa-onboarding-step2-mobile.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design-qa-onboarding-step3-desktop-v3.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design-qa-onboarding-step3-mobile-grid-v3.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design-qa-onboarding-step3-mobile-v3.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design-qa-onboarding-step3-selected-v3.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design-qa.md` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `"design/explore-character-motion/Auto-Save/Explore AI Character \342\200\224 Build Use Grow v2 auto-save 1.aep"` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `"design/explore-character-motion/Auto-Save/Explore AI Character \342\200\224 Build Use Grow v2 auto-save 2.aep"` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `"design/explore-character-motion/Auto-Save/Explore AI Character \342\200\224 Create Yours v4 auto-save 1.aep"` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `"design/explore-character-motion/Auto-Save/Explore AI Character \342\200\224 Create Yours v4 auto-save 2.aep"` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `"design/explore-character-motion/Auto-Save/Explore AI Character \342\200\224 Create Yours v4 auto-save 3.aep"` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `"design/explore-character-motion/Auto-Save/Explore AI Character \342\200\224 Create Yours v4 auto-save 4.aep"` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-00.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-01.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-02.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-03.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-04.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-05.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-06.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-07.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-08.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-09.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-10.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-11.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-12.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-13.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-14.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-15.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-16.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-17.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-18.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-19.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-20.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-21.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-22.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/review-frame-23.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/storyboard-v2.jpg` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v2-review-0.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v2-review-1.4.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v2-review-10.7.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v2-review-4.8.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v2-review-7.8.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/layout-study.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/native-0.000.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/native-1.600.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/native-10.350.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/native-11.958.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/native-3.650.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/native-5.300.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/native-8.150.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/qa-long-copy-flat-depth.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-00.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-01.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-02.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-03.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-04.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-05.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-06.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-07.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-08.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-09.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-10.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-11.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-12.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-13.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-14.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-15.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-16.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-17.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-18.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-19.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-20.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-21.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-22.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/review-frame-23.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v3/storyboard-v3.jpg` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/explore-desktop.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/explore-mobile.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/native-0.000.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/native-11.100.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/native-13.700.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/native-15.958.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/native-3.400.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/native-5.600.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/native-6.700.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/native-9.000.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/native-final-centered.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-00.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-01.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-02.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-03.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-04.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-05.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-06.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-07.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-08.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-09.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-10.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-11.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-12.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-13.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-14.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-15.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-16.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-17.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-18.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-19.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-20.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-21.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-22.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-23.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-24.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-25.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-26.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-27.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-28.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-29.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-30.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-31.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-32.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-33.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-34.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-35.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/review-36.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v4/storyboard-v4.jpg` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/explore-desktop.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/explore-mobile.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/native-business.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/native-examples.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/native-final-aligned.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/native-final.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/native-initial-reveal.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/native-opening.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/native-subject.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/native-transition-10.1.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/native-transition-2.4.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-00.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-01.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-02.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-03.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-04.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-05.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-06.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-07.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-08.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-09.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-10.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-11.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-12.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-13.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-14.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-15.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-16.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-17.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-18.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-19.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-20.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-21.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-22.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-23.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-24.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-25.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-26.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-27.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-28.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-29.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-30.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-31.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-32.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-33.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-34.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-35.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-36.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-37.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/review-38.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `design/explore-character-motion/Preview/v5/storyboard-v5.jpg` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `"design/explore-hook-motion/Auto-Save/Explore Hook Cover \342\200\224 Editorial Motion v4 auto-save 1.aep"` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `"design/explore-hook-motion/Auto-Save/Explore Hook Cover \342\200\224 Editorial Motion v5 auto-save 1.aep"` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `"design/explore-hook-motion/Auto-Save/Explore Hook Cover \342\200\224 Editorial Motion v6 auto-save 1.aep"` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `"design/explore-phone-motion/Auto-Save/Explore Phone Cover \342\200\224 Clean Loop v6 auto-save 1.aep"` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `"design/explore-phone-motion/Auto-Save/Explore Phone Cover \342\200\224 Screen to Creator v4 auto-save 1.aep"` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `"design/explore-phone-motion/Auto-Save/Explore Phone Cover \342\200\224 Screen to Creator v4 auto-save 2.aep"` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `"design/explore-phone-motion/Auto-Save/Explore Phone Cover \342\200\224 Screen to Creator v4 auto-save 3.aep"` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `"design/explore-phone-motion/Auto-Save/Explore Phone Cover \342\200\224 iPhone Motion v5 auto-save 1.aep"` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `desktop.ini` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `dev-header-preview-4174-error.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `dev-header-preview-4174.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `dev-header-preview-error.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `dev-header-preview.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `dev-header-test-error.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `dev-header-test.log` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `edit-screen-audit/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `folderico-QfzIGG.ico` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `hatch-pet-runs/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/ai-generation-worker/.terraform/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/ai-generation-worker/ai-generation-worker.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/ai-generation-worker/recovery-canary-fix.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/ai-generation-worker/release-214c1ad.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/ai-generation-worker/release-397b5c9.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/ai-generation-worker/release-5200bcc.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/ai-generation-worker/release-b5e81a3.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/ai-generation-worker/release.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/ai-generation-worker/terraform.tfvars` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/bootstrap/.terraform/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/bootstrap/terraform.tfstate` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/carousel-scheduler/.terraform/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/carousel-scheduler/release-5200bcc.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/carousel-scheduler/release.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/carousel-scheduler/terraform.tfvars` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/carousel-worker/.terraform/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/carousel-worker/release-5200bcc.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/carousel-worker/release-b5e81a3.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/carousel-worker/release-bb83ce3-edit-service.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/carousel-worker/release.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/carousel-worker/terraform.tfvars` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/foundation/.terraform/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/foundation/foundation-final-cutover.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/foundation/foundation-postcutover.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/foundation/foundation-queues-release.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/foundation/foundation-release.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/foundation/release-bb83ce3-queues.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/foundation/slideshow-queue-recovery.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/foundation/terraform.tfvars` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/reaction-render-worker/.terraform/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/reaction-render-worker/release-5200bcc.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/reaction-render-worker/terraform.tfvars` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/social-publish-worker/.terraform/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/social-publish-worker/release-5200bcc.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/social-publish-worker/release-f74a3431dfce.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/social-publish-worker/release.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/social-publish-worker/terraform.tfvars` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/video-render-worker/.terraform/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/video-render-worker/hook_composition_audio.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/video-render-worker/release-214c1ad.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/video-render-worker/release-397b5c9.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/video-render-worker/release-5200bcc.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/video-render-worker/release-564af8d.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/video-render-worker/release-8b946e6.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/video-render-worker/release-f5cfe10.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/video-render-worker/release.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/video-render-worker/terraform.tfvars` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/video-render-worker/video-render-worker.tfplan` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `infra/gcp/worker-canary/.terraform/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-all.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-bottom-preview.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-cards-peek-refined.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-cards-under-clean.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-cards-under-section.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-centered-badges.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-comparison-cards.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-comparison-clean-outline.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-comparison-emojis.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-comparison-explore-lib.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-comparison-focus.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-comparison-refined.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-complete.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-cta-closeup.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-cta-scrolled.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-flow-clean.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-formats-full.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-formats-shelf.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-full-buttons.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-full-page.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-hero-aurora-preview.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-hero-clean-full.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-hero-clean.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-hero-dark.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-hero-fixed-white.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-hero-padding-fixed.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-hero-scrolled-header.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-multi-account-detail.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-multi-account-flow.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-multi-account-verified.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-pill-clean.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-redesign-preview.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-screenshot-mobile.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-screenshot-tablet.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-screenshot.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-sections-2-and-3.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-swipe-buttons-zoom.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-swipe-deck-compact.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-swipe-deck-preview.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-swipe-focus.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-swipe-like-dislike.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-swipe-posted.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-trust-badges-moved.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-updated-hooks.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-updated-order-preview.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing-updated-videos.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `landing_page/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `local-landing-page.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `local-run-logs/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `next-env.d.ts` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `node-compile-cache/` | Dependencies, build output or tool cache |
| `node_modules/` | Dependencies, build output or tool cache |
| `onboarding-flow-audit/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `output/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `outputs/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `public/try-ugcpilot/media/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `scripts/__pycache__/` | Dependencies, build output or tool cache |
| `supabase/.temp/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `supabase/supabase/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `tinder/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `tmp-logs/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `tmp/` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `tsconfig.tsbuildinfo` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `ugc-home-desktop.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `ugc-home-header-updated-mobile.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `ugc-home-mobile.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `ugcpilot_logo__1.png` | Generated local evidence, diagnostics, scratch data or ignored artifacts |
| `worker/dist/` | Dependencies, build output or tool cache |
| `worker/node_modules/` | Dependencies, build output or tool cache |
