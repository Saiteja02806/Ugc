# Preventing completed-video delivery failures

The user asked to leave Supabase unchanged. The recovery migration was canceled;
its function is absent and the existing production billing trigger is unchanged.
Do not retry that migration or recover historical exhausted jobs without renewed
approval. `ENABLE_COMPLETED_PROVIDER_OUTPUT_RECOVERY` now defaults off so the
website does not advertise this database-dependent recovery action prematurely.

The previously built worker image includes the exact Seedance isolated-CDN
allowlist fix and tests that resume saved tasks without a new paid submission.
Image: `sha256:f65b3379c4edc9eeef02fc957a867cfc2c71bb5456e9849e67f204122676154f`.
Worker source: `2daa1c2bf8b20e8ce65098f3e1475f37ef544f0c`.
Revision `ugc-ai-generation-worker-resultsfix-2daa1c2b` was staged at zero traffic.
After the activation command was interrupted, read-only inspection confirmed
that production still routes 100% to `ugc-ai-generation-worker-hookfix2-fac61da3`.
The new collector therefore must not be described as serving users yet.

Prevention checks:

- `scripts/check-generation-worker-release.mjs` verifies the reviewed worker SHA,
  baked/runtime identity and 100% routing to one revision. Missing version
  support on the old worker fails acceptance, even when the website is healthy.
- `.github/workflows/video-delivery-regressions.yml` runs mocked provider,
  completed-output, prebilling-reference and isolated database regression tests
  on relevant pull requests and main pushes. It has no provider secrets and
  performs no paid generation or production database writes.
- Unknown URLs remain rejected safely. Exact approved provider-CDN links are
  collected without forwarding API keys. Regression fixtures cover missing
  links, lookalike hosts, download failures, completion recording and recovery
  without a second generation POST.
- The supported historical recovery implementation is bounded, owner-checked
  and separately gated. Neither a source push nor deployment alone repairs
  already-failed exhausted jobs.

These controls reduce recurrence risk; they cannot establish live end-to-end
acceptance before the worker rollout and a real saved-result collection check.

Local verification: 201 job/retry/workflow checks, 29 worker/provider checks,
five isolated database/release-guard checks, TypeScript and scoped ESLint passed.
The standalone live release check refused acceptance because the old worker's
`/version` endpoint returned 404. No production database migration, billing
change or historical-job recovery was performed.

The intentional concurrent Hook overview scheduling shortcut and its context
notes were included after reviewing the small diff and rerunning the relevant
workflow tests. Only ignored credentials, caches/dependencies and generated
`outputs/` evidence are excluded from the source push.
