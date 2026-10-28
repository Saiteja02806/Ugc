---
name: vercel-cost-guardian
description: Audit and prevent Vercel build-cost regressions in Next.js, JavaScript, and monorepo projects. Use when Vercel Build CPU Minutes or Build Minutes increase, deployments multiply, builds slow down, previews consume budget, a CI workflow changes, or before changing Vercel configuration. Produce evidence-backed findings, safe options, and measured before/after comparisons; never silently change production settings.
metadata:
  author: UGCPilot
  version: "1.0.0"
---

# Vercel Cost Guardian

## Mission
Reduce Vercel **Build CPU Minutes / Build Minutes** and avoid surprise charges while preserving reliable builds, previews required for UI QA, and production availability. Distinguish *number of deployments*, *billable resources per deployment*, and *per-minute rate*. A quicker build can consume more CPU minutes if it uses more vCPUs. Do not optimize just for wall-clock seconds.

Act as an evidence-led build and deployment cost auditor. Default mode is **read-only**. Never edit, delete, disconnect, redeploy, promote, pause, or change billing/build settings merely because a skill was invoked. Present a plan and obtain explicit authorization for operational changes. Do not fetch or print authentication secrets.

## Invoke when
- User asks to reduce Vercel cost, slow builds, Build CPU Minutes, wasted deployments, multiple Git-triggered builds, cache misses, or build failures.
- Agent edits `package.json`, lockfiles, build scripts, `next.config.*`, `vercel.json`, `turbo.json`, GitHub Actions, Docker/build-related config, or Vercel settings.
- Reviewing PRs likely to modify build time, number of prerendered pages, dependencies or install scripts.
- Requested periodic or on-demand build-cost audit.

## Modes
- **Full audit** (default): inspect recent deployment / billing history plus repo and build logs.
- **PR guard**: compare changed files and risks, do *not* create a Vercel deployment just to inspect a PR.
- **Regression triage**: compare last known good build(s) against slow/costly build(s).
- **Optimize**: propose narrowly scoped changes; apply only after authorization; demonstrate before/after proof.

## Mandatory process

### 1. Establish context and baseline (read-only)
1. Read root `AGENTS.md` and other engineering guardrails (`clear.md`, `nonnegotiables.md`) if present. Follow them. Do not bypass regression tests or existing workflow.
2. Identify Git repository, active branch, target production branch, app framework, package manager, workspace config, deployment architecture, Vercel team, and linked projects. Respect `git status`; do not overwrite local changes.
3. Inspect **7 days and 30 days**, if data exists, of builds and *actual* usage. Record time window/time zone, project, Git SHA, branch, target, status, trigger, build duration, post-build duration, billable duration, build CPU minutes, cache hit/miss, and billed cost where present.
4. Obtain the *current pricing model* from the project's Vercel billing page/documentation. Distinguish Vercel **Build CPU Minutes** from historic **Build Minutes** and separate costs for Functions, Storage, etc. Do not assume a fixed rate or treat included-credit consumption as an on-demand charge.
5. For builds that look expensive, read deployment Build Logs and Build Diagnostics. Inspect individual deployments (`vercel inspect <deployment-url-or-id>` when available) and identify install, compilation, static generation, post-build, and cache phases.
6. If account access is missing, say what is unknown and work from repository only. Request a redacted export or dashboard screenshot if necessary, not a token.

Use a connected Vercel tool for team/project inventory, read-only billing charges, deployments and build events if available. Do not request or reveal keys. See [data collection](references/data-collection.md).

### 2. Establish the cost equation, accurately
- Count **billable deployments** by project/target/status/commit and the Vercel usage metric(s). A Git SHA on different *necessary* services may legitimately produce multiple builds; flag for investigation, never automatically classify as waste.
- On applicable Vercel build machines, **billable duration = rounded-up (build + post-build duration)**; reported **CPU Minutes = billable duration × applicable vCPUs**. Check latest Vercel docs and actual deployment measurements; Elastic machines may report dynamic CPU usage, so prefer Vercel's authoritative reported number.
- Estimate `savings = confirmed avoidable CPU minutes × verified rate`, or use account's real per-build cost. If rate/CPU usage cannot be verified, show saved deployments or measured minutes but **mark dollars UNKNOWN**.
- Separate build cost from Function usage, asset/image optimization, CDN, log/observability, and retention/storage costs. Never claim changing a PR workflow fixes non-build spend.

### 3. Find high-impact issues, in order
1. **Project fanout:** same commit initiates builds across multiple Vercel projects. Map each to its production domains, actual service purpose, root directory, connected repo/branch, and dependencies. Identify repeated ERROR/CANCELED builds and wasted retries. Do not delete or disconnect until owners verify traffic and integrations.
2. **Trigger duplication:** Vercel Git integration alongside GitHub Actions/CLI deployment, deploy hooks, PR preview + merge production builds, branch push churn, overlapping environments, re-deploy loops, duplicate `main`-branch pipelines.
3. **Unnecessary monorepo builds:** correct Root Directory, Vercel *Skip deployment for unaffected projects* when workspace graph and GitHub integration meet current requirements; `Ignored Build Step` as alternate, but distinguish its limits. Account for shared packages and lockfile changes; never skip required releases.
4. **Build machine economics:** measure reported CPU minutes vs wall time and per-unit price for Basic/Elastic/Standard/etc. Do not automatically recommend a bigger machine because it builds faster. If changing machine, compare *total billable dollars*, performance and memory reliability.
5. **Cache misses:** `--force`, `VERCEL_FORCE_NO_BUILD_CACHE`, `TURBO_FORCE`, inconsistent framework/Node/package manager/root/branch, `no-cache` flags, unstable lockfiles, excess feature branches, missing remote cache. Diagnose, don't delete caches reflexively.
6. **Expensive install:** large or unused packages, install of the whole workspace, Playwright/Chromium downloads, native compilation, redundant installs, expensive `postinstall`, package manager changes; never drop devDependencies required for build just to make installs faster.
7. **Expensive build steps:** redundant `lint`/`tsc`/test inside both CI and build, repeated `next build`, build-time network calls, huge `generateStaticParams` fanout, costly media generation or downloads during deployment, non-deterministic build scripts, oversized artifacts/functions, broken caching.
8. **Failed releases:** track failed/canceled build root cause, build phase that burned CPU, whether failures already happened locally, and prevention with a local or CI gate.
9. **Spend guardrails:** inspect usage notifications and Spend Management. Hard pause can cause 503 for production; never enable without explicit approval and a business continuity plan.

Run local repo audit when safe:
```bash
python3 .agents/skills/vercel-cost-guardian/scripts/audit_repo.py --repo . --out vercel-repo-audit.md
```
PR risk scan (requires fetched base ref; does not deploy). This compares committed revisions only and does not include staged, unstaged, untracked, or deleted files; review those separately:
```bash
python3 .agents/skills/vercel-cost-guardian/scripts/check_pr.py --repo . --base origin/main --head HEAD
```
Optional: analyze read-only deployment export (accepts Vercel deployments API/tool JSON or normalized JSON):
```bash
python3 .agents/skills/vercel-cost-guardian/scripts/analyze_deployments.py --input deployments.json --out vercel-deployments-audit.md
```
Read script limitations: a static scanner shows **possible** issues; it is not proof of billable cost. Do not commit generated reports unless requested.

### 4. Confirm root causes before recommending fixes
For every finding state: **evidence** (link/log/path/line or specific metric), **causal explanation**, **confidence** (confirmed/probable/hypothesis), **impact metric**, **safe remediation**, **risk** and **rollback**. Prefer high-impact, low-risk actions; label unknowns as unknowns. Differentiate 'skipped via ignored step' from native skipped deployments and billable minutes.

Use [audit rubric](references/audit-rubric.md), [guidance](references/optimization-playbook.md), and [report template](assets/report-template.md). If the repo uses AGENTS.md, optionally add the [cost check guardrail](assets/AGENTS-addendum.md) only after owner approval.

### 5. Recommended development/release workflow
- Do related edits in a feature branch; lint, test, compile, and inspect locally before pushing.
- Open PR for review. PR **alone does not eliminate Vercel costs**: branch pushes may trigger preview builds and merge to `main` may trigger production build.
- Prefer native skip-unaffected behavior for supported monorepos; otherwise configure an accurately scoped ignored-build rule *only after verifying semantics and affected packages*.
- Preserve an **on-demand preview path** for visually sensitive UI or external integrations. Preview deploys can be worth the cost to avoid regressions.
- Gate merges on appropriate checks. Deploy accepted `main` changes deliberately. Batch low-risk edits, not unrelated major fixes, and don't delay urgent production fixes for cost reasons.
- Avoid redundant CLI deploys from GitHub Actions if native Vercel Git integration already handles that target. If CI deploys prebuilt artifacts, validate Vercel system-env and Next.js version-skew limitations before adopting.

### 6. Before/after verification
1. Keep baseline cohort by project, environment, build machine type, timeframe, and commit count.
2. For every approved change, test on a branch and/or safe comparison; measure the same reported metrics, note cold/warm cache differences.
3. Verify production URL, API routes, auth, SEO, webhook behavior, and business-critical UI flows. Check no essential project was skipped.
4. Compare deployment count per meaningful change, billed CPU minutes per completed deployment, failure rate, cache stats and total cost. Do not report savings from one unusually fast cached run as guaranteed.
5. Document rollback steps before settings changes. Write the final review using [report template](assets/report-template.md).

## UGCPilot watchlist (historical observations; reconfirm before acting)
Vercel team `ugcpilot`; observed projects include `ugc`, `ugc-mcp`, and `trending-release-web-3f35202`. Earlier investigation saw same SHA deploy across all three, with some repeated errors for `trending-release-web-3f35202`; `ugc-agent-staging-mcp` and `ugc-agent-staging-web` also existed. Treat these **only as leads, not as current proof of waste**. Confirm purpose, root directories, domains, service dependencies and present-day activity. Never silently remove staging/test projects.

## Output contract
Always return, in this order:
1. **Executive summary:** known bill + Build CPU share + period, separated from unknowns.
2. **Topology:** repo → Vercel projects → branches/targets → domains; whether each is required.
3. **Top 3–10 findings:** issue, severity P0/P1/P2, evidence, confidence, affected projects, actual measured impact (or UNKNOWN).
4. **Action plan:** quick/safe no-code changes, repo optimizations, platform-level changes; approval boundary and rollback per item.
5. **Cost forecast:** conservative/measured estimates with assumptions and confidence; never invented prices.
6. **Validation:** tests required, pre/post baseline, metrics to monitor in next 7 and 30 days.
7. **Blocked data:** exact measurements/access still required.

## Non-negotiables
- Read-only unless the user explicitly approves changes. No production pause, deletion, disconnection, pricing-plan update or secrets access.
- No faux savings or fabricated build logs, dollar values, cached status, metrics or successful tests.
- Don't optimize away required previews, tests, type checks or deployments without a safe replacement.
- Don't add dependencies, regenerate lockfiles or force deploys for a cost audit.
- If user requests a fix, make the smallest scoped patch, respect existing repository instructions, and include regression verification.
