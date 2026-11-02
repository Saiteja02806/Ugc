# Combined release — 2 November 2026

Release scope: all intentional dirty source, styles, public font, encrypted creator reviews, scripts/tests and documentation. Complete path/hash inventory: docs/combined-release-inventory-2026-11-02.json. User authorized audit and deployment of all current work; no smaller fix intentionally omitted. No new dependencies, lockfile/config/schema/migration changes. Existing production is website5ef7ff789c4b17c93d46d65641b85cdb01155d81 and generation worker17fe15f2. Production domain vidmake.io; getugcpilot.com retained with migration behavior.

## Deployment order and rollback
1. Freeze reviewed source commit and build generation-worker image from that exact commit's worker tree. Existing Cloud Run secrets/settings remain.
2. Deploy AI generation worker candidate without traffic, inspect readiness/release metadata/logs, then route100% to verified candidate. It understands absent historical and new optional starting-frame contracts. No image-generation smoke is submitted during deployment.
3. Release website/API after worker acceptance. Verify Vercel READY and exact Git SHA, domains/redirect/pricing/auth boundaries/read-only APIs.
4. Verify remote refs include all intended files; review runtime errors. Retain old deployment/revision for rollback. Never roll the worker back ahead of website while new flagged jobs are admitted; revert website first and retain staged-job compatibility. Do not replay potentially accepted jobs across providers.

Only generation worker runtime changes are involved. Other render/publish/Carousel services and Cloud Run job definitions do not require this change. No database write/migration, IAM, secret rotation, queue purge or production billing setting change. Character images now use OpenRouter for new Gemini admissions; historical accepted requests preserve provider. Stage-level image persistence uses existing provider ledger/storage schema.

## Changes reviewed
Explore/workflow dark palette, neutral actions/scrubbers, source/demo controls and navigation; AI influencer selections/references; slideshow per-slide Version1 face swaps and recovery/affordability UI; original starting-frame crash, UTF8, caption/wardrobe and explicit background/outfit options in collapsed disclosure; strict durable scene/identity/harmonizer stages; creator/private opening timing; pricing palette/wordmark/allowance presentation; canonical metadata and permanent legacy-domain redirect. Generation quality limitations recorded in prior real test receipts remain; a successful deployment does not certify perfect pixels.

Release audit corrected two stale tests only: billing policy expected map lacked already-shipped Startup allowance; schedule-editor harness lacked already-shipped SocialAccountAvatar mock. Application billing/scheduling semantics not changed by those corrections.

## Verification before deployment
- Fresh isolated Next webpack production build PASS; application source byte-matched to build snapshot (later test-harness correction only). Direct checkout build first hit WindowsEPERM and then cacheENOSPC. No local source deleted; fresh ignored snapshot used instead.
- Native decoder/automation/lightweight-MCP trace checks PASS after required filesystem access for hardlinks.
- Worker TypeScript build PASS; targeted workflow/creator/starting-frame/pricing/component suites342PASS; image-generation package suitesPASS; durable image stages33PASS; pricing20PASS; scheduling114PASS after mock correction. Individual counts overlap; not claimed as unique total.
- Base npm test/lifecycle initially failed pre-existing alias-loader issue and stale Startup assertion; loader and corrected expectation pass those sections. A later unchanged walltext native subprocess crashed under combined load; isolated full47walltext suitePASS. Full npm lifecycle is NOT claimed entirely green from that rerun.
- Full lint4errors/103warnings in existing unchanged format-schedule-panel, hook-workflow-preview, face-swap-dialog and post-caption-field. Compared bytes toHEAD: identical. Changed TS/JS paths lint0errors/12warnings. No suppression or broad refactor.
- SourceUTF8 and new private-source/role/idempotency tests pass. Previous bounded realOpenRouter character tests succeed (including13383characters); caption/background image-quality caveats remain. No extra paid request used as deployment health check.

## Cost/operations guard
Applied vercel-cost-guardian PR guard, read actual dirty config/manifests/workflows and project topology. No build trigger/config/lockfile changed. Main projectugc must deploy; trending-release-web-3f35202 currently cancels Git builds and is preserved; MCP/staging projects not modified. Avoid duplicate manual production build if Git integration already builds desiredSHA. Actual billableCPUminutes/dollarimpact UNKNOWN. Required build/native checks and preview path retained.

## Exclusions
No intentional path visible in git status excluded. Existing ignored .env*, private plaintext creator files, .git/, node_modules/, worker/node_modules/, .next/, worker/dist/, .tmp/, .release-worktrees/, outputs/, output/, local screenshots/media/logs, caches and CLI state are not release source. Encrypted private review package and requested font ARE included. Website upload's existing.vercelignore also excludes separately hosted tinder/, design/, design artifacts and local-only Try UGC Pilot media. No ignored environment/credential file staged. Exact tracked/untracked inventory generated before staging; secret-pattern scan found0suspiciouspaths in130dirtyfiles.

## Procedure and remaining acceptance
AGENTS/relevant Explore/incident/nonnegotiable context and context-memory/immutable/ui/generation/regression skills retained from implementation; current release preflight and vercel-cost-guardian consulted. Large historical files were not fully reread in this release turn; no full-history claim. Build guide/Next route/client docs consulted in preceding tasks. No skill-imposed permission pause: user explicitly authorized deployment.

Protected defaults/owned references/old job fingerprints/strict failure/no duplicated paid stage/scheduling picker verified locally by relevant tests or unchanged code. UI screenshot receipts from individual changes included. Browser/mobile current release acceptance and signed-in production generation/scheduling still require actual deployed checks; do not claim those from builds or mocked tests. Release outcome and IDs will be added after operations.
