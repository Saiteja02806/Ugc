# Optional addition to existing AGENTS.md (copy the text below; do not replace file)

## Vercel build-cost guardrails

When a change affects package manifests, lockfiles, build scripts, Next.js configuration, static generation, Vercel configuration, CI workflows, workspace topology, or deployments, load `.agents/skills/vercel-cost-guardian/SKILL.md` and run its **PR guard** workflow before approving the change. For unexpected Build CPU Minutes cost, deployment fanout, failing/slow builds, or cache problems, run its **Full audit** workflow. Use read-only diagnostics first, give root causes with evidence and measured costs, follow `clear.md`/`nonnegotiables.md`, and never change Vercel production settings, disconnect projects, or delete deployments without explicit approval. Preserve required tests and a preview QA path.
