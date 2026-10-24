# Ordered provider and workflow release — October 18, 2026

The release starts from production commit `284e3a50` and includes every
intentional project change in the workspace. The initial full audit contained
300 paths: 229 already match production and 71 contain pending changes. Further
fixture repairs and the current synthetic Carousel audit script are included,
alongside the release inventory. No intentional source change is deferred.
The follow-up audit adds 63 paths for the shared media library, manual Carousel
text styling and scoped planning repair, merged into the same release checkout.

## Included behavior

- New Seedream 5.0 Pro images use OpenRouter; admitted Runway jobs retain their
  original recovery path and credit reservations.
- Saved influencer images remain downloadable after automatic saving changes
  their collection. Existing files do not need regeneration.
- New Seedance 2.5 and WAN 3.0 videos use ReAPI with ordered image/audio/video
  references and durable operation recovery.
- Confirmed schedules update the calendar cache; explicit repeat scheduling
  opens a new post intent while uncertain requests retain their original key.
- The current slideshow preview exposes Save and Schedule, preserving dirty
  sequence state and the existing confirmation flow.
- Tests, documentation, Terraform ReAPI secret wiring, and diagnostic scripts
  are included with their corresponding production changes.
- Shared image collections and music management are available from Settings,
  Trending and existing Explore image/audio controls, with explicit preview and
  owner checks before applying backgrounds to a draft.
- Trending Carousel edits retain per-slide fonts, sizes, colors and free text
  positioning through the compatible worker renderer.
- Helpful Tips v59 repairs rejected hidden image descriptions without rewriting
  valid slide copy and preserves specific failed-candidate diagnostics.
- New text in shared workflow video editors starts in Inter Bold (700), including
  newly applied Remix text without previous styling. Saved choices remain intact.
- New manual slideshow device uploads and replacements fit a 4:5 canvas with
  the full image visible; existing exact-4:5 bytes pass through unchanged.

## Validation

The isolated release passes image/provider tests (141), scheduling/download
checks (140), TypeScript, route type generation, and changed-production-file
ESLint. The 1,166-case Explore run found seventeen outdated fixture failures;
all affected groups pass their 26-case rerun after current imports/provider
expectations are restored. The MCP chain passes its preceding groups, with its
remaining thirteen account-setting checks passing after resolving migration
filenames by their unique semantic name. The actual slideshow editor browser
fixture passes desktop/mobile Save, Schedule, dirty reorder, reload, touch and
duplicate-click checks. ReAPI's targeted suite also passes.

These isolated checks do not create paid media or customer posts. Hosted
deployment identities, authentication boundaries and production acceptance are
recorded separately in the release receipt after they have been checked.
After the additional merge, worker compilation, route type generation,
application TypeScript and scoped ESLint pass. All 189 added/affected tests pass,
including real text rasterization and planner-to-job failure settlement. Actual
media-library, Trending text editor and slideshow assembly browser checks pass
on desktop/mobile with isolated APIs, including atomic failed rechecks,
save/reopen, independent typography, touch/keyboard placement and dirty saves.
The first staged Turbopack build caught a worker-style `.js` import in the shared
manual-text module. It now imports the real `.ts` source, with the existing
worker compiler rewriting that extension for Node output. The corrected release
must pass an actual Turbopack production build before promotion; the failed
staged build never changed production domains.
The final web-only additions pass 81 typography/draft/image-fit tests, TypeScript,
scoped ESLint and actual font/slide-upload desktop/mobile browser checks. The
broader slideshow fixture has a pre-existing recreation-attachment failure noted
in `docs/slideshow-auto-fit-2026-10-18.md`; upload acceptance is checked separately.
The final UI commit retains exactly the worker tree deployed at `b8df8a68`;
the release receipt verifies tree equality before allowing web promotion.

## Rollout order

1. Verify the production database constraint and migration ledger. ReAPI's
   additive constraint migration is applied as `20261018071834`, the
   authoritative production timestamp. The source filename matches that ledger.
2. Grant the generation worker access to the existing enabled ReAPI secret.
   Preserve the existing OpenRouter, Google, Runway and other secret references.
3. Hold automatic Vercel builds, commit and push the complete reviewed snapshot.
4. Build an immutable worker image from that exact commit. Update and verify
   the six production worker services and two jobs, preserving runtime settings,
   resources, ingress, service identities, scaling and existing secrets. Add the
   ReAPI secret only to the AI-generation service. Direct traffic explicitly to
   the verified revisions; keep old revisions available for rollback.
5. Stage website and MCP production builds from the same commit only after
   worker verification. Promote both after successful builds, restore their
   previous automatic-build settings, and verify domains, commit IDs, public
   routes, health and authentication boundaries.

## Exclusions

No intentional source/configuration/migration/test/documentation path is
excluded. The following ignored local-only paths stay outside the release:

- `.env*` except `.env.example`: private runtime configuration and credentials.
- `.tools/**`, `.vercel/**`, `.agents/**`, `.codex/**`: local tools, credentials
  and agent/app configuration.
- `.tmp/**`, `.codex-audits/**`, `.codex-artifacts/**`, `outputs/**`, `output/**`,
  `artifacts/**`, `.release-worktrees/**`: temporary snapshots, receipts and QA
  media. They are retained locally.
- `node_modules/**`, `worker/node_modules/**`, `.next/**`, `worker/dist/**`,
  `node-compile-cache/**`, `*.tsbuildinfo`, `next-env.d.ts`, logs and caches:
  dependencies and generated output.
- Terraform local state, `*.tfvars` except `*.tfvars.example`, `*.tfplan`,
  `.terraform/**` and Supabase local state: private deployment state/settings.

The attached managed release worktree remains available for review; the user's
original checkout and its unfinished local state are preserved.
