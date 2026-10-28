# Audit rubric: prioritize measurable savings

## Severity
- **P0**: risk of runaway metered spend, infinite build/redeploy loop, unauthorized deployments, serious production incident. Reproduce and immediately propose safe containment; no unilateral action.
- **P1**: same unrelated commit causing multiple demonstrably unnecessary billable builds; persistent repeated failing expensive deployments; disabled cache; very high CPU minutes or build cost.
- **P2**: moderate build script inefficiency, redundant slow lint/test stages, poor monorepo targeting, potential large dependency/install overhead; needs confirmation.
- **Informational**: no evidence of an impact or purely theoretical issue.

## Proof thresholds
- Confirmed: two independent observations where possible (e.g. billing + deployment inspect; build log + commit/config; root config + affected file diff).
- Probable: repo heuristic + deployment chronology, but no billed resource breakdown.
- Hypothesis: code search or generic best practice only; **never attach quantified savings**.

## Comparisons to perform
- Builds per `main` commit, preview branch and `project`.
- Build CPU minutes per READY, ERROR, and CANCELED deployment (when actually reported).
- Total CPU minutes spent on failures (not all canceled deployments necessarily bill the same way; defer to billing).
- p50/p95 billable duration per project and build-machine tier; cold vs warm cache.
- Overlap of repo roots, `main` branch deployments and Vercel CLI workflows.
- CPU minutes and dollars per release before and after.
- Ratio of Build CPU spend to included credits separately from invoice overages.

## Decisions that require evidence
- Do projects actually serve different components? Don't equate same SHA with duplication if monorepo dependencies legitimately cause rebuilds.
- Is the repo actually configured with valid workspaces, GitHub integration and unique dependency names for native skip-unaffected?
- Do lockfile/Node/package manager/framework version changes explain a cold cache?
- Is a slow build machine actually cheaper in CPU minutes versus a fast machine?
- Does omitting a build mean missing API/server changes or breaking scheduled jobs/auth/webhooks?

## Example finding
`P1 | probable | Git SHA abc123 built in frontend and archive-site, one ERROR | evidence: Vercel deployment IDs and project roots | savings: UNKNOWN until CPU minutes measured | proposed: inspect domains and owners, then disable archive-site Git connection only if unused | risk: preview or redirect dependency | rollback: restore integration and verify domain`.
