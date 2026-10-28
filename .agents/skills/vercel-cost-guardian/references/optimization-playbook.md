# Vercel build-cost optimization playbook

## Tier 1: Reduce number of unnecessary builds
1. Map every Git-linked project. Distinguish active production, backend, MCP/API, previews/staging, historical release experiments.
2. Inspect deployed domains and real dependencies before disconnecting any project.
3. Investigate failed builds first. Fix the error or disable a truly obsolete configuration, *not blindly remove the project*.
4. PR workflow alone isn't a cost optimization: Vercel Git integration often makes preview deployments for branch pushes and production deployments for merges.
5. For GitHub workspaces meeting requirements, use built-in **Skip deployment for unaffected projects**; Vercel evaluates source, internal dependencies, impacted lockfile changes. Work outside declared workspaces may still cause all apps to deploy.
6. Ignored Build Step is alternative when native skip doesn't apply. In this hook **exit 0 means SKIP, nonzero means BUILD**. Prefer UI's supported setting instead of fragile hand-written shell unless custom logic is needed. Test `main`, feature, critical hotfix, docs-only and shared-package changes. This feature may still consume concurrency/deployment resources.
7. Avoid duplicate native-Git and GitHub Actions `vercel deploy` pipelines for the same target. Preserve CI checks as needed.

## Tier 2: Reduce billed work per necessary build
- Measure **build + post-build billable duration** and **reported CPU minutes**; CPU minutes depends on vCPU/machine tier, not just elapsed seconds.
- Try smaller Basic vs default Elastic where app fits, but require benchmark across several representative builds and check reliability. Never claim faster = cheaper by default.
- Vercel build cache keys depend on project/team, framework, root, Node, package manager, branch. Avoid unnecessary churn and global force-cache bypasses.
- Inspect `next build` phases, static prerender fanout and expensive build-time API requests. Consider moving appropriate expensive content work to runtime/on-demand revalidation, after checking SEO and correctness.
- Audit `postinstall`, Playwright browser downloads, native dependencies, build time video processing, and data scraping. Heavy media rendering should not run during web deploy if it belongs to a separate worker.
- Monorepo filtered installs may help (e.g. `pnpm install --filter <workspace>...`) but ensure shared dependencies and lockfile integrity. No speculative dependency deletion.
- Cache/turbo configuration only when repo actually uses it. Check hashes, environment variables, shared deps and outputs before enabling remote caching.

## Tier 3: Financial controls
- Review Usage dashboard by project and metric, billed CPU minutes vs other charges, included-credit usage and overage.
- Configure Spend Management notifications after user agreement. **Production pause causes downtime/503**, may be an emergency-only option, not a routine optimization.
- Watch 7/30-day trends and ratio of errors, CPU minutes/deployment, build frequency/commit, and project fanout.

## Dangerous anti-patterns
- `exit 0` unconditional ignored-build script on production: deploy is silently skipped.
- `git diff HEAD^ HEAD` against shallow clones or merge commits without checking workspace dependencies: missed changes.
- Skipping tests or typechecks solely to reduce Vercel charges: quality regressions. Move validation to trusted CI if justified.
- Forcing production builds every PR or scheduling repeated deploys to 'keep cache warm': wasted money.
- Deleting a staging backend or MCP project because its name looks redundant: breaks integrations.
- Assuming local-build-only is identical to Vercel production: platform, environment, and remote services differ.
- Confusing faster build on high-vCPU machine with lower Build CPU Minutes.
- Reporting negative customer invoice charges because credits offset resource usage.
