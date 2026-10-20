# Runway switch release — 1 October 2026

Release from the previously deployed `a60281d` source. Scope: Runway Seedance 2.5
default in Videos, Google Omni unchanged, 5,000-credit daily guard approved by
the user. Setup, API mapping, costs and legacy recovery are documented in
[Runway setup](runway-seedance-setup.md).

All intentional changes made for this Runway release are included: application
label/validation, worker adapter/routing/recovery, SDK and lockfiles, budget
estimates/tests, Terraform defaults/examples, and documentation.
The removed Higgsfield SDK and paid `index.ts` example are recoverable from Git.
No database migration or historical data rewrite is required; `runway` is
already an allowed provider. Legacy Higgsfield values remain valid for history.

## Validation

- Production Next.js build and TypeScript passed.
- 15 focused Seedance/routing/recovery tests passed.
- 47 video settings/composer/reference/audio API tests passed.
- Worker regression: 211 tests + 20 render/posttests passed.
- Root/worker dependency audits reported zero vulnerabilities.
- Targeted ESLint passed without warnings/errors.
- Read-only Runway organization checks confirmed both local and actual production
  credentials authenticate and report the Seedance 2.5 model. No paid generation
  was submitted. Available provider balance was 900 credits at verification.
- Broader app regression detected a pre-existing stale scaling assertion: the
  test expected 10 instances, while deployed Terraform source already specifies
  20. The assertion was aligned to 20; no capacity setting was changed.

## Exclusions and unchanged targets

The original checkout remains dirty and is not overwritten. This release uses
the clean, isolated release checkout. Deferred Explore files remain excluded
as listed in [the earlier release](release-2026-10-01.md).
Separate concurrent changes in these original-checkout paths are preserved and
not folded into this video-provider release:

- `CAROUSEL_CONTEXT.md`
- `components/social/platform-selection-modal.tsx`
- `components/trending/hook-video-schedule-drawer.tsx`
- `docs/tiktok-direct-post-audit-runbook.md`
- `lib/scheduling/platform-settings.test.ts`
- `lib/scheduling/platform-settings.ts`
- `lib/trending/trending-platform-scheduling-ui.test.mjs`

Local `.env.local` files, credentials, `.tmp/`, `.tools/`, `.vercel/`, `.next/`,
`node_modules/`, `worker/dist/`, and private Terraform state/tfvars are excluded
because they contain secrets, local runtime settings, dependencies or generated
artifacts. They are not pushed. Local Runway cap files were set to 5,000.

Only the website Vercel project and AI generation Cloud Run service need a new
revision for this change. The other workers/jobs, dedicated MCP deployment,
Carousel/Wall rendering, image sourcing, social publishing and schedulers retain
their existing releases and settings. IAM, ingress, queues and resource capacity
are not changed. The legacy credential is retained for GET-only recovery, not
for generation.

Production rollout results are recorded in the local verification receipt after
Git → migration check → Vercel → GCP → smoke checks finish. Signed-in and paid
generation acceptance must not be described as passed unless actually exercised.
