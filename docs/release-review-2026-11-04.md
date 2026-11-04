# Combined release review — 4 November 2026

Release preparation is partially verified. Build authorization is pending under the user's explicit 3 November no-build instruction. This deployment approval does not override that instruction. No push, build, deployment, promotion or CI trigger was performed during this review.

## Reviewed scope

113 tracked/untracked candidate paths captured in .tmp/release-review-paths-20261104.txt with SHA256 snapshot .tmp/release-review-manifest-20261104.json. Include all intentional source, scripts, tests, documentation, registry data and five new opening-poster WebP assets. Existing worktree starts at597f54cc on codex/hook-workspace-slideshow-release-20261022. Do not reset or silently omit the smaller changes.

The combined release includes checkout read optimization, Hook/Text on screen blue Generate actions, reference-count badges/registries, pilot-only Trending screen and Carousel generation exception, character selection/reference/prompt contracts and new version4 two-image identity stage, thumbnail/catalog/UI changes, Explore opening posters, compressed Hook preview hash and marketing library preview. Application admission freezes new character pipeline version4. Worker retains versions1–3 for historical recovery.

## Completed non-build checks

- Application combined targeted suite344/344 PASS.
- Worker processor/image/durable-recovery suite84/84 PASS.
- Application npx tsc --noEmit --incremental false PASS.
- Worker npx tsc -p worker/tsconfig.json --noEmit --incremental false PASS.
- ESLint of every changed/untracked TS/TSX/MJS file returned zero errors and13 warnings, primarily unused bindings and one img warning.
- Full git diff --check PASS.
- Vercel cost guardian PR scan found no committed difference between origin/main and HEAD. This scanner does not inspect dirty files. Separate worktree review found no package/lockfile/Next/Vercel/workflow configuration changes. Actual build CPU/cost and current deployment fanout remain UNKNOWN because hosting connector access is unavailable in this turn.

Logs under .tmp/release-review-{main,worker,types,worker-types,lint,whitespace}-20261104.log. These are targeted checks, not a passing full repository test suite. Earlier broad workflow harness checks still have obsolete mocks/model expectations. Fresh built desktop/mobile acceptance and authenticated checkout timing remain pending.

## Deployment order after explicit build approval

1. Freeze the complete intended release and record commit/manifest. Audit secret exclusions before staging. A push can trigger builds and therefore also awaits build authorization.
2. Build compatible worker image with its release SHA and verify new character parser/stages and pilot owner fence. Release worker targets that execute these job types before admitting new website requests. Inspect actual current target inventory before mutation.
3. Build/release website/API from the same complete source. Determine whether linked MCP deployment consumes changed character/billing/Carousel modules and release it if required. Do not assume unrelated projects need rebuilding or change project settings.
4. Verify target release SHA/image digests and domains, then authenticated Trending pilot/other-owner isolation, character/reference and generation UI, blue actions on mobile/desktop, badges and gallery actions, checkout exact Growth49/Startup99 monthly and runtime logs. Stop before payment. Rollback website admission first if worker compatibility fails.

No migration was added in this worktree. Previously corrected Vercel product variables must be verified in the new serving deployment. Prior existing compiled localhost page predates these worktree changes and cannot establish fresh source acceptance.

## Material acceptance gaps

- Counts are static local registry entries. All106Hook and63publicSlideshow references resolve badges, but source count accuracy and freshness are unverified. Registry descriptions claiming authority are not independent measurement evidence.
- Version4 character pipeline real sample completed, but identity adherence remains partial and its fresh scene cropped feet. Do not claim reliable perfect identity/full-body output.
- Real starting-frame stage acceptance and all-workflow visual/publishing tests remain partial as detailed in earlier audit receipts.

No intentional candidate path is currently excluded from the proposed source release. Exclusion classes are local secrets/environment files (.env* except releasable .env.example), credentials/private plaintext creator material, node_modules, .next, worker/dist, .vercel, .tmp, .playwright-mcp, caches and generated diagnostic media under output/outputs/artifacts. These are not source release omissions. No push-complete/deploy-complete claim is made.

Preflight/procedure sources applied from current session include AGENTS, nonnegotiables, Explore/Carousel and incident context, ugc-context-memory, immutable-contracts, UI-clarity, scheduling, regression-gate and vercel-cost-guardian. Read current cost skill/data collection guide, package/deployment scripts, worker Dockerfile/cloudbuild, actual diff/callers/new pipeline and results receipts. Large historical ledgers were not freshly reread in full. Current task adds this review only and ignored evidence logs/manifests, preserving application changes.
