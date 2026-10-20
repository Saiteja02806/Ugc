# Workflow performance release — 14 October 2026

The user authorized checking and deploying current intentional changes in the recorded order, while explicitly deferring MCP and SEO changes. The release starts from remote `main` at `b19009d344837aac8a6c12ee8578a32d1edbcc41` and preserves its already merged source. The original working checkout is untouched.

## Scope

- Batch exact Serif box and Editorial ink measurements to reduce final-video preparation time. On the same local 12-second fixture, Serif changed from 16.160 to 5.462 seconds and Editorial from 22.721 to 8.566 seconds. Subtitle files and sampled exported frames match the prior output exactly. These local numbers do not guarantee production latency.
- Use one source action with hover/click/tap options on workflow clip cards. Upload and Creative Assets are available directly from the opening and Demo cards, retaining owned-media checks and existing upload destinations.
- Recover accepted scheduling requests before time-dependent validation. An explicit rejected-time response lets users confirm corrected values without replaying an obsolete visible time. Uncertain requests, browser locks and accepted posts retain their existing protections.
- Reconcile the already deployed Carousel partial-reservation reuse migration and its tests/documentation into Git. The database fix is already active; this release does not replay it.

The source inventory and every excluded working path are recorded in `workflow-performance-release-inventory-2026-10-14.json` and `workflow-performance-release-exclusions-2026-10-14.md`. MCP and SEO files are excluded at the user's request. Generated media, diagnostics, environments, secrets and build/dependency caches are excluded. There are no new runtime gates, permission changes or increased worker capacity.

## Deployment order and targets

1. Commit and push the validated source to production `main`, with website Git builds temporarily held during the database parity step.
2. Compare local migration versions to the live Supabase ledger. Read-only verification confirmed no missing versions (137 total), partial-reuse migration `20261014034706`, exactly two updated allocator predicates, security invoker, empty search path and unchanged `postgres`/`service_role` execution grants. No migration apply or ledger repair is needed.
3. Restore the website build setting. Stage a production deployment of that exact commit to Vercel website `ugc` (`prj_mVOxt7AUko5egMAESaxjGyC60Kvu`, team `team_ECnoFm5XPu3r2f0qWjLs6Lrk`), verify READY/source identity, and promote it. The separate `ugc-mcp` project remains on its existing deployment.
4. Build an immutable Cloud Run worker image from the same reviewed source commit in project `ugcsaas`, region `us-central1`. Deploy it to the six active UGC worker services and the two jobs using that source: AI generation, Carousel generation/edit, reaction, social publishing, interactive video finishing; video render and Carousel replenishment jobs. Preserve all existing resources, secrets, IAM, ingress, scaling, timeouts and job-type routing. The separate `ugc-tinder-deck` service is outside this worker release.
5. Verify main/deployment/image SHA parity, READY revisions and service traffic. Inspect the real production workflow, including source actions and final video behavior. Do not publish or schedule a customer post as a release smoke test.

The existing warm interactive video service stays at two vCPUs, 4 GiB, minimum/maximum one instance and concurrency one. The compatibility API remains safe with the old worker during the ordered website-before-worker interval because these changes do not add a worker input contract or job type.

## Validation and receipts

The caption change passed 269 original-workspace subtitle/finishing regressions, seven exact-render measurement checks, TypeScript, worker build and lint. Exact isolated release validation passed **609 tests** (269 caption/finishing, 330 workflow/scheduling, 10 Carousel database), scoped ESLint, root TypeScript and worker compilation. The optimized production Webpack build passed. Existing actual-component desktop/mobile source-menu verification also passed against the same included UI files; hosted production controls remain the final acceptance surface. A fresh isolated Next checkout requires `next typegen` before standalone TypeScript validation; generated files remain ignored. The initial Windows sandbox build failed to create one output folder with EPERM; the unchanged build passed outside the sandbox.

Deployment IDs, immutable image digest, final remote SHA, validation counts, preserved settings and production acceptance are appended only after the corresponding checks succeed. Raw private runtime snapshots and local test/browser outputs stay in ignored `.tmp/workflow-release-evidence/`.

Rollback restores the preceding website deployment and worker image/revisions; the additive, already applied migration and historical media remain in place. This source plan alone is not a deployment success receipt.
