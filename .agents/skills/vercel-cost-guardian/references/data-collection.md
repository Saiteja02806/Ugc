# Data Collection: Vercel Build Cost Audit

## Account tools (read-only)
- Prefer Vercel connected tools if installed/authorized: enumerate team and projects; list deployments; get deployment details and build events; read billing charges. Tool APIs vary, so inspect definitions first. Don't call mutation operations.
- For each project record: display name, ID, Git repo, Root Directory, production branch, production domains, deployment-target environments, framework preset, package manager, build command, machine type/CPU, concurrency setting, skip-unaffected status, ignored build step, whether it is needed, and owner.
- Capture a bounded 7-day and 30-day window, with timezone and observed coverage. If APIs page, follow cursors to avoid treating first page as total history. If billing API returns subset, label incomplete.
- For each deployment: ID/url, commit SHA, ref, timestamp, target (`production`, `preview`, custom), status, `billableDuration`, `cpuMinutes`/`buildCpuMinutes`, `build` duration, `postBuild` duration, machine type. Field names are API-version dependent; prefer verified dashboard/inspect values.
- Build logs: installation steps; cache restored/not restored; bundled/prerendered pages; traced functions; compile errors; resource constraints; exit stage.
- For cost: dashboard Billing → Usage / usage breakdown by project/service/date, or Vercel charges tools. Do not conflate `effectiveCost` or credit-adjusted entries with a payable invoice or total build spend.

## Vercel CLI (optional: use existing authentication; no auth dump)
```bash
vercel ls
vercel inspect <deployment-url-or-id>
```
CLI >=59.23.1 supports displayed billable duration and CPU minutes. If CLI version is older, use dashboard/authorized connector rather than upgrading automatically. Avoid commands that deploy or change settings (`vercel --prod`, `vercel promote`, `vercel project update`, `--force`) during audit.

## Deployment analysis input
`scripts/analyze_deployments.py` accepts:
- Vercel-like raw object shaped `{"result": {"deployments": {"deployments": [...]}}}` or `{"deployments": [...]}`;
- or a normalized array of objects with `project/name`, `sha/meta.githubCommitSha`, `target`, `state`, `created`, optional `cpuMinutes`, `billableDurationMinutes`.

Known `cpuMinutes` is authoritative *only if* exported from actual Vercel billable CPU metric. If absent, script reports UNKNOWN rather than deriving from milliseconds of elapsed wall time.

## Local repo audit input
`git ls-files` or fallback file traversal, package.json, package-lock.json, pnpm-lock.yaml, yarn.lock, bun.lock(b), pnpm-workspace.yaml, turbo.json, vercel.json, `.github/workflows/*.yml`, next.config and selective source files. Heuristics are *suspicions*, not proven regressions.

## Consent boundary
Keep access tokens in Vercel/CI secret stores. If a token is necessary, user configures it out of band. Never paste `.env` values into report. Sanitize logs/URLs if sensitive.

## Useful official sources (recheck for changes)
- https://vercel.com/docs/monorepos
- https://vercel.com/docs/project-configuration/project-settings
- https://vercel.com/docs/deployments/troubleshoot-a-build
- https://vercel.com/docs/builds
- https://vercel.com/docs/spend-management
- https://vercel.com/pricing
- https://vercel.com/changelog/deployments-now-show-billable-duration-and-cpu-minutes
- https://vercel.com/changelog/basic-build-machines
