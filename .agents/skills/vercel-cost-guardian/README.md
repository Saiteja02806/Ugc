# Vercel Cost Guardian (UGCPilot)

A portable **Agent Skills** skill for an AI IDE (Codex, Cursor, Claude Code, and other skill-compatible agents). Audits deployment frequency, duplicated project/commit fanout, billed build CPU usage, cache configuration, and expensive build pipelines. **Read-only by default**.

## Install
Copy the complete folder into your repository at:

```
.agents/skills/vercel-cost-guardian/
  SKILL.md
  scripts/
  references/
  assets/
  tests/
```

The `name:` in `SKILL.md` matches the directory name as required by the Agent Skills specification. Other IDEs may use client-specific skill paths. Follow your IDE's skill discovery instructions and restart or refresh discovery.

## Invoke in AI IDE

> Use the `vercel-cost-guardian` skill in **Full audit** mode. Read repository rules, inspect current Vercel projects and 30-day build costs if connected, investigate redundant and failed deployments, identify the three most expensive confirmed issues, and propose a ranked, safe solution. **Read-only. No setting changes or deployments.**

For a PR:

> Use the `vercel-cost-guardian` skill in **PR guard** mode. Inspect changed files for build duration, cache invalidation, deployment frequency, and billing risks. Report code-level recommendations, but do not modify settings or deploy.

For fix implementation after approval:

> Use the `vercel-cost-guardian` skill in **Optimize** mode to implement only the approved fix and show measured before/after billable CPU minutes, verification tests, and rollback.

## Local helpers (Python 3.10+)

```
python .agents/skills/vercel-cost-guardian/scripts/audit_repo.py --repo . --out vercel-repo-audit.md
python .agents/skills/vercel-cost-guardian/scripts/check_pr.py --repo . --base origin/main --head HEAD
python .agents/skills/vercel-cost-guardian/scripts/analyze_deployments.py --input deployments.json --out vercel-deployments-audit.md
```

The deployment script accepts a Vercel-like JSON deployment listing or normalized JSON. No API calls, credentials or writes to the repo occur except the explicitly requested output report.

## What the skill DOES NOT do
It cannot measure real charges from repository code alone, infer a Vercel project's domain/service role from its name, or tell you that $X can be saved without usage measurements. It does not silently disable builds, delete projects, change production settings, or install libraries.

## References
- [Agent Skills specification](https://agentskills.io/specification)
- [Vercel Monorepos](https://vercel.com/docs/monorepos)
- [Vercel Build troubleshooting](https://vercel.com/docs/deployments/troubleshoot-a-build)
- [Vercel Build CPU Minutes in deployment details](https://vercel.com/changelog/deployments-now-show-billable-duration-and-cpu-minutes)
- [Vercel Spend Management](https://vercel.com/docs/spend-management)

## Trigger automatically on risky coding tasks
To make the AI IDE more likely to load this skill during normal development, copy the relevant short rule from `assets/AGENTS-addendum.md` into your **existing** `AGENTS.md` (append, never replace). You can also explicitly use `/vercel-cost-guardian` or attach the skill in supported IDEs.

## Local tests
`python -m unittest discover -s tests -v` from the skill directory.
