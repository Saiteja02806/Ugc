# Combined release plan — 8 November 2026

## Authorization and scope

The user requested deployment of the website, backend and GCP workers, and explicitly asked not to deploy the `vidmake-intro-full-v11.mp4` review video or its related videos. MCP is **not** part of this release and must not be built, deployed or reconfigured.

Scope is the complete intentional worktree at the release commit, including the FLUX 3 Hook model, free-video-pass Kling 3.0 restriction, per-demo saved edits, Explore covers/analytics/SEO updates, scheduling recovery, and their tests and documentation. Local-only review selections, credentials, caches, build output and held intro-video media are excluded as described below.

## Video hold and deployment exclusions

- `vidmake-intro-full-v11.mp4` is not present in the repository and is not in Git or the Vercel upload.
- `.vercelignore` excludes the entire `remotion/` authoring tree, `public/explore/covers/vidmake-launch*` and `public/explore/covers/vidmake-intro*`, plus root `vidmake-intro*`.
- `.gitignore` excludes local `vidmake-intro*.mp4` exports, `part1-male-selections/`, `part2-female-selections/` and the local `remotion/public/explore/covers/sources/vidmake/*.mp4|*.mp3` review sources.
- The new Explore cover MP4/WebP derivatives (`ai-character-promo-c59ea3f200cf`, `slideshow-promo-19a41bb41632` and their opening posters) are product UI assets, not part of the held intro video, and remain in the release.
- No MCP project, Git connection, environment variable, IAM, queue, database schema or Vercel project setting is changed by this release.

## Preconditions and gates

Validation completed locally on 8 November 2026:
- Full Explore suite: **1452/1452 pass**, 0 failures.
- Focused composer/API/worker/free-pass suites: 112/112, 48/48, 32/32 and 3/3.
- Application `tsc --noEmit`, worker build and scoped ESLint: clean.
- Vercel static cost audit: no package, lockfile, build-script or trigger change; the only configuration edits are content-hashed cover headers and the `.vercelignore` upload reductions.
- The isolated `explore-background-composition.test.mjs` suite passes 4/4; the concurrent full-suite run is green in the final gate.

The earlier hold is lifted. On 8 November 2026 the user authorized the website and GCP worker release after the invite free-generation badge fix. MCP stays out of this release.

Remaining pre-deployment checks:
1. Free-video-pass migration `20261107120000_add_free_video_pass_links.sql` confirmed applied in production. The local Supabase CLI link points at production, but `migration list` could not parse `.env.local`; do not edit that file or apply migrations silently.
2. Capture the current production Vercel deployment ID (CLI is not authenticated in this session) before the website push.
3. Capture the current Cloud Run service/job image digests before applying worker changes. All six current services use image `sha256:c6e1c42e0106eaaec63203cb80dda79e302ba9571d808169981edc91b6dc7eb8`; revisions are recorded in the release receipt.

## GCP worker rollout

1. Commit the complete release and push to Git `main`.
2. Build one worker image from that exact commit with `node scripts/build-push-gcp-worker-image.mjs --cloud-build --tag worker-gcp-<shortsha>` (Docker daemon is not running locally; Cloud Build is the safe path).
3. Record the image digest, then update `worker_image_uri`, `worker_version` and `worker_git_commit` in the six worker stacks.
4. `terraform plan` each stack first; apply only image/version changes. Expected services: `ugc-ai-generation-worker`, `ugc-carousel-worker`, `ugc-carousel-edit-worker`, `ugc-reaction-render-worker`, `ugc-social-publish-worker`, `ugc-video-render-worker`; jobs: `ugc-video-render-job` and the scheduler job(s) managed by the matching stacks. Do not touch `ugc-tinder-deck` or unrelated canary resources.
5. Verify each service reports 100% traffic on the new revision, the worker `/version` endpoint matches the baked commit, and startup logs show the same revision. Do not execute paid generation or publishing jobs as part of the rollout.
6. If any check fails, move traffic back to the captured previous revision/image; the image and revisions remain retained.

## Website and backend rollout

1. Push the release commit to `origin/main`. The website project `ugc` is Git-connected; MCP is not Git-connected and is not deployed by this push.
2. Wait for the Vercel website build to reach READY; do not create a duplicate manual deployment while the Git build is running.
3. Verify the production aliases and public pages on `https://vidmake.io` (and `www`): `/`, `/explore`, `/guides`, `/pricing`, `/mcp` (website marketing route only), sitemaps and robots.
4. Verify the free-video pass flow and FLUX 3 model visibility on a signed-in/public smoke path where possible. Paid model generation and real link claiming are separate acceptance checks.
5. No new database migration is applied for FLUX 3; the free-pass migration must already be present. If it is missing, stop and report rather than applying it silently.

## Rollback boundary

- Website: restore the previous Vercel production deployment captured before the push; keep the previous deployment ID.
- Workers: restore the captured previous image digest/revision for each service/job; preserve old revisions and images.
- No MCP rollback is required because MCP was not deployed.
- Do not delete or rewrite queued background jobs, historical receipts, saved drafts or media.

## Open acceptance after deployment

- Real provider FLUX 3 generation quality, identity/starting-frame behavior, and free-pass Kling 3.0 generation remain separate paid/media acceptance checks.
- Signed-in browser checks for the free-pass model list and the 390px header remain required.
- Billed Vercel build CPU minutes/dollars and Cloud Build/Cloud Run cost remain UNKNOWN until the provider reports them.
