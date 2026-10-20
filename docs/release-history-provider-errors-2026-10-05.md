# Character history and provider-error release preflight

## Scope and baseline

This is the next web-only release after `6e82f4c75b75d3ffdc7b4ebba8c022a3143bf6f3`.
GitHub `main`, the release branch and the live Vercel production deployment all
matched that revision during preflight on October 5, 2026. The active checkout is
`codex/deploy-complete-updates-20261005` in the complete-release worktree, not the
older desktop checkout.

The 19 pending intentional files are included together:

1. `app/api/characters/history/route.ts`
2. `components/characters/character-history.tsx`
3. `components/characters/character-session.test.mjs`
4. `components/characters/character-workspace.module.css`
5. `components/characters/character-workspace.tsx`
6. `components/characters/use-character-builder.test.mjs`
7. `components/characters/use-character-builder.ts`
8. `docs/ai-character-builder.md`
9. `docs/seedance-portrait-reference-check-2026-10-05.md`
10. `lib/characters/history.test.mjs`
11. `lib/characters/history.ts`
12. `lib/characters/identity-service.ts`
13. `lib/characters/identity.test.ts`
14. `lib/characters/identity.ts`
15. `lib/characters/types.ts`
16. `lib/jobs/background-job-contract.test.ts`
17. `lib/jobs/background-job-contract.ts`
18. `lib/jobs/background-job-retry-route.test.mjs`
19. `scripts/workflow-provider-errors.test.mjs`

This preflight document is the twentieth file. No intentional pending file in
the release checkout is omitted. Existing Explore, Audio, Trending, scheduling,
landing, slideshow and prompt-driven character work remains in the baseline.

## Behavior

- Character History lists owned completed candidates, including unsaved images.
  Starting a new workspace visit does not automatically redisplay old completed
  results. Unfinished or uncertain requests retain their existing recovery and
  duplicate-submission protections. History access neither generates images nor
  deletes, copies or bills for them.
- The known Seedance portrait-rejection signature receives a safe, specific
  frontend explanation and is not retried as an unidentified transient failure.
  Raw provider diagnostics, private URLs, request IDs and credentials remain
  private. Unrecognized failures retain their existing safe fallback.
- OpenRouter remains the configured Seedance provider. This release does not
  change provider safety restrictions, authorize real-person portraits, integrate
  ReAPI/PiAPI, disable content filters or submit a paid generation request.

## Complete original-source audit

The older desktop checkout has 903 changed/untracked file paths. These are not
903 new bugs or 903 pending release files: most are the older release source.
The fresh audit compared every path against the existing source-review ledgers.
885 paths matched prior source-review decisions. The other 18 were checked
against the current release: 17 match exactly, including the previously committed
prompt-driven generation work. The eighteenth is
`components/characters/character-session.test.mjs`: its test callback was named
`CharacterTestRender` so ESLint recognizes the mocked hook-rendering function.
The test-only adaptation does not change production code or test behavior.

The complete path-by-path preservation and exclusion decisions remain in:

- `docs/release-review-2026-10-05.json`
- `docs/release-expanded-review-2026-10-05.json`
- `docs/release-prompt-driven-review-2026-10-05.json`
- `docs/release-expanded-2026-10-05.md`

The older `index.ts` paid-provider experiment and the duplicate historical
`supabase/migrations/20261003045336_character_gemini_3_pro_image.sql` alias remain
excluded under those reviewed decisions. The applied canonical migration is not
rerun. Compatibility Create Content backend APIs and old stored media remain
preserved although the user-facing screen is retired.

Secrets/local `.env*` files (except the safe `.env.example`), `.vercel/`, dependency
directories, `.next/`, `worker/dist/`, `.tmp/`, local Terraform state/private
variables, generated visual-review images and motion-design auto-saves remain
excluded according to `.gitignore` and the ledgers. Editable design projects and
approved runtime assets remain preserved. The explicitly deferred replacement
workflow videos are not substituted for the approved covers. Nothing is deleted
from the older checkout or local disk by this deployment.

## Verification

- 110 focused character, history, identity, recovery, provider-contract and
  frontend-error tests passed on the final files.
- 374 Explore/Audio/reference/finishing/scheduling regression tests passed.
  The focused and broader suites overlap; these are not 484 unique tests.
- Application TypeScript, scoped ESLint and Git whitespace checks passed.
- The optimized Next.js 16.3.7 build passed, including 146 static entries and
  the new authenticated character-history API route.
- Worker TypeScript compilation passed as part of the Explore regression suite.
- Hosted Supabase migration history was checked read-only: 106 applied versions,
  including character prompt-driven generation at `20261005140223`. This release
  adds no SQL and needs no migration or migration-history repair.
- Existing GCP workers reported ready. This release modifies no worker source,
  package, infrastructure, storage configuration, dependency or secret binding;
  those matching workers are deliberately left unchanged.

## Deployment and acceptance boundary

Deployment has not occurred at the time this preflight document is written.
Push this complete commit, fast-forward `main` only if the remote baseline still
matches, and wait for the matching Vercel production deployment to become ready.
No database apply or GCP rollout is necessary for this web-only revision.
Production acceptance must use `https://www.getugcpilot.com`, not localhost.

The rollback baseline is Vercel deployment
`dpl_mtCChJDDNEpvV4Q4NKBQ62KVLAEk` at the revision recorded above.
Signed-in visual/provider acceptance is separate from offline tests and public
HTTP checks. No authenticated browser session is available during this preflight;
do not report a real paid generation, scheduled publication or account-history
browser flow as tested. Record the final Git SHA, deployment identity, alias and
read-only production checks in the deployment receipt after rollout.
