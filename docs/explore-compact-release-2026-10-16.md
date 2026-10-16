# Explore compact editor release — 16 October 2026

Release source is frozen separately from the shared worktree. It includes the compact Font/Weight row (Inter, DM Sans, Roboto Condensed, Montserrat), exact bundled export fonts, reference custom playback controls and free source-link upgrade gate, Choose image button/tab/thumbnail polish, and completed slideshow grouping/manual assembly/original import.

The existing preset, position, color and sliders remain compact. New Hook text uses Inter Medium; Wall uses Inter Regular. Legacy saved text retains its previous appearance. Font changes survive drafts/Remix/export. Wall controls remain behind advanced Edit.

## Validation

- Worker build and production Next webpack build passed compilation, TypeScript and 164 routes.
- Combined Explore/image API/font/slideshow regressions: 702 tests passed across initial successful cases and affected-suite rerun. One test belonging to excluded prompt-improvement work was removed only from the snapshot. Six older recovery fixtures needed their existing provider-balance dependency; all 73 affected checks then passed.
- Scoped ESLint passed. Actual-component browser checks passed for compact Hook/demo/Wall at 320–1900px, reference source gating/custom playback, and slideshow assembly/import/save/reload/failure retention/mobile fit. No paid generation or customer publishing was used.
- Disk exhaustion interrupted the first local build/tests. Only old ignored release `.next` directories were removed; the subsequent isolated build passed.
- Read-only production migration audit: 142 versions match after renaming one existing Git migration to its authoritative production version. Its SQL is equivalent; no SQL was applied and no migration ledger was edited.

## Deployment order

1. Hold automatic website Git builds; push this exact source commit to `main`.
2. Verify migration parity; stage both `ugc` and `ugc-mcp` production candidates without domain assignment.
3. Build the immutable worker image from the same commit; update the six active worker services and two production jobs. Preserve all nonidentity configuration, IAM, ingress, scaling, resources and schedules. Do not execute jobs.
4. Verify worker digest/commit/readiness; promote the ready production candidates; restore Git build settings; check public production responses and font bytes.

Deployment IDs, image digest, remote SHA and public smoke results are recorded in the subsequent deployment receipt. Signed-in production acceptance remains separate from local fixtures/public health checks.

## Explicit exclusions

The user previously deferred ongoing changes from the other chat. Therefore the newer slideshow prompt-improvement feature is excluded:

- `app/api/explore/slideshows/improve-prompt/route.ts`
- `components/explore/slideshow-prompt-improver.tsx`
- `components/generation/ai-studio-composer.tsx` (prompt-review slot)
- `lib/ai-studio/image-generation-api.ts` and `lib/ai-studio/image-generation-api.test.mjs` (prompt-plan wiring)
- `lib/explore/slideshow-prompt-api.ts`
- `lib/explore/slideshow-prompt-client.ts`
- `lib/explore/slideshow-prompt-generation.ts`
- `lib/explore/slideshow-prompt-plan.ts`
- `scripts/slideshow-prompt-api.test.mjs`
- `scripts/slideshow-prompt-db.test.mjs`
- `scripts/slideshow-prompt-plan.test.mjs`
- `supabase/migrations/20261016112404_slideshow_prompt_improvements.sql`

Only the matching helper wiring/test was removed from release copies of mixed files; the shared worktree was not reverted. The included path inventory is `explore-release-inventory-2026-10-16.json`. Secrets, environment/credential/tooling state, dependencies, caches and generated evidence remain ignored and excluded. Exact screenshot compositing and universal historical combined-project recovery remain known gaps; this release does not claim to implement them.
