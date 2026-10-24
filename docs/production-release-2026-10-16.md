# Complete Explore production release — 16 October 2026

The user requested deploying all current intentional project changes in the
recorded deployment order. This release includes Explore UI/editor/audio fixes,
slideshow versions/business-context/recovery, the reviewed Hook catalogue and
reference-prompt pilot, shared API/media/Library changes, scripts, tests and
documentation. Complete project save/resume across every historical combined
video is still a documented gap; this release does not claim to implement it.

Concurrent work was included at the user's explicit request: influencer image
downloads, ordered multi-image generation references and non-destructive result
dismissal. The reference review stopped at a usage limit; only its 42 completed
prompt entries are included. Unreviewed references retain normal behavior without
invented prompts. No unfinished task was represented as completed.

## Ordered rollout

1. Validate and push the complete source commit to production `main`. Hold
   automatic Vercel domain assignment while the compatible release is staged.
2. Verify the production Supabase migration ledger. Two already-applied SQL
   bodies match after removing comments/whitespace. Rename their Git files to
   authoritative versions `20261014141245` and `20261014141251`; execute no SQL
   and do not modify the remote migration ledger. All 141 versions then match.
3. Stage production Vercel builds for website `ugc` and shared-code project
   `ugc-mcp`, using the exact source commit. Keep current production domains on
   their previous healthy releases until the worker understands the new inputs.
4. Build an immutable image from that same commit in GCP `ugcsaas`, region
   `us-central1`. Update the six active UGC worker services and the video-render
   and carousel-replenishment jobs. Preserve routing, resources, secret bindings,
   IAM, ingress, scaling and timeouts. Test/canary jobs and `ugc-tinder-deck` are
   separate workloads and retain their current images.
5. Verify worker digest/SHA/readiness, promote the ready Vercel deployments and
   restore automatic domain assignment. Check public production URLs and logs;
   do not spend generation credits, schedule or publish customer posts as smoke
   tests. Record authenticated acceptance separately from public health checks.

## Review and validation

- Explore regressions: 1,074 passed after fixture dependencies and obsolete
  numbered-title/CSS assertions were corrected. Temporary-file tests require
  execution outside the Windows sandbox.
- Additional application regressions: 112 passed. Image provider/worker checks:
  21 passed. Other worker regressions: 84 passed.
- Review found that legacy slideshow reference-role paths could discard the
  frozen business context and output position. All paths now preserve them;
  a provider-boundary regression covers each role without a paid request.
- The MCP runner now enables TypeScript transforms for slideshow save tests,
  matching the source dependencies. Full MCP rerun, production build and final
  release checks are recorded in the deployment receipt when they complete.
- TypeScript and changed-file ESLint checks passed before staging. Browser
  acceptance remains distinct; the earlier shared-browser profile was busy.
- The first isolated production build compiled, typechecked and generated all
  163 pages. It preceded the concurrent influencer additions; the final combined
  snapshot receives a new build. The complete MCP suite passed 316 checks;
  additional final Character/download/reference-prompt suites passed 145 checks.

## Exclusions

No intentional product, configuration, migration, script, test or documentation
change is deferred. Excluded paths are local/generated/private artifacts:

- `node-compile-cache/**`: Node bytecode cache, retained locally and now ignored.
- `.tmp/**`, `outputs/**`, `.codex-artifacts/**`, `.codex-audits/**`, `artifacts/**`,
  `output/**`: local evidence, temporary sources, snapshots, images and logs.
- `node_modules/**`, `worker/node_modules/**`, `.next/**`, `worker/dist/**`,
  `*.tsbuildinfo`, `next-env.d.ts`: dependencies and generated build output.
- `.vercel/**`, `.tools/**`, `.env*` except the tracked public `.env.example`,
  private Terraform state/variables and Supabase local state: machine-local
  configuration, tooling, credentials or environment state.

The included-path inventory is `production-release-inventory-2026-10-16.json`.
Raw cloud specifications and rollback snapshots remain in ignored local evidence.
Deployment IDs, commit and image digest must be added only after verification.
