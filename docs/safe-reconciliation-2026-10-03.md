# Safe reconciliation - 3 October 2026

## Current status

Explore's generation/finishing/scheduling client connections and standalone Audio are integrated in this isolated worktree on the previously verified newer-main baseline. The dependency/build blockers are resolved. Current local implementation and remaining release gaps are recorded in [the UI/Audio integration report](explore-ui-audio-integration-2026-10-04.md); hosted evidence and deployment gates are recorded in [the release preflight](release-preflight-2026-10-03.md). Other reconciliation groups and hosted activation remain held. This is not a full worktree merge or a production release. The preparation findings below are historical; later sections supersede earlier preview descriptions and inventory snapshots. The latest audio meaning is recorded in [the Explore audio contract](explore-audio-contract-2026-10-03.md).

## Preparation outcome

An isolated managed worktree was prepared at the GitHub main commit verified with git ls-remote: `3ed9c684b6c710eb9f3c7a4624f7082e8a535daa`. The shared checkout remains at `d7414877ccdca40d5b77510f6563eba6e6c5a1d5`. This is reconciliation preparation, not a completed feature merge or a release.

During preparation, only the previously approved eight-line `.gitignore` block was carried into the isolated worktree. At that stage app, worker, infrastructure, migration and runtime asset contents retained the verified main baseline. No feature source was overwritten, deleted, staged, committed, pushed, uploaded or deployed in that preparation phase.

## What this does and does not solve

This makes review possible against the newer base and prevents indiscriminate staging of older local implementations. The narrow ignore rules hide generated review images and recovery copies without deleting them or ignoring editable projects, source media or final exports.

It does not repair or connect unfinished Explore generation, composition, scheduling or subtitle rendering. Local Workflow 1 and Workflow 3 routes still guard development previews; the local creation panel renders disabled actions without job callbacks. See the original checkout's `docs/workflow-generation-subtitle-code-audit-2026-10-02.md`. Production functionality was not tested.

## Frozen comparison

The comparison includes all 809 tracked changes and untracked paths recorded for this pass: 230 tracked changes and 579 untracked files; zero staged files. The source is shared and continues to change. Refresh before carrying further work.

| Classification | Paths | Action in this pass |
| --- | ---: | --- |
| overlapping-change | 54 | Hold for semantic reconciliation; neither side wins automatically. |
| local-only-change | 26 | Apply only .gitignore; hold other changes. |
| already-on-main | 303 | Retain identical main version; no duplicate import. |
| local-only-deletion | 29 | Hold; no deletion propagated. |
| local-addition | 350 | Hold for coherent feature/asset review. |
| overlapping-addition | 47 | Hold for semantic reconciliation; neither side wins automatically. |

“Overlapping” means both sides changed relative to the old base, or independently added differing contents. It does not mean a textual merge necessarily fails. An automatic merge would not prove behavior remains correct.

## Review groups

These are path-based review queues, not independent commit-ready bundles. Shared manifests, navigation, API contracts, dispatch, billing and worker types cross the groups. Keep their coupled implementations and tests together.

| Queue | Already on main | Local candidate | Overlap | Deletion |
| --- | ---: | ---: | ---: | ---: |
| Shared configuration and integration | 44 | 62 | 49 | 0 |
| Billing and pricing | 32 | 0 | 4 | 0 |
| Create Content deletions | 0 | 0 | 0 | 29 |
| Authentication and onboarding | 51 | 0 | 3 | 0 |
| Marketing and SEO | 12 | 4 | 6 | 0 |
| Social, scheduling and analytics | 23 | 8 | 3 | 0 |
| Carousel and Wall text | 55 | 2 | 5 | 0 |
| Explore UI and catalogue | 1 | 68 | 0 | 0 |
| MCP and OAuth | 26 | 0 | 18 | 0 |
| Character, audio and subtitle tools | 28 | 40 | 13 | 0 |
| Runtime media assets | 31 | 61 | 0 | 0 |
| Design sources and retained exports | 0 | 131 | 0 | 0 |

## Held decisions

- Explore UI and catalogue: keep the user's existing layout work, including the rollback of the rejected composer redesign. Restore no rejected redesign. Preserve dev-preview limitations. Review shared compositor/results/navigation against newer video provider, reference, quality and recovery code.
- Create Content: 29 local deletions appeared in the shared checkout during the initial audit and were held. The user subsequently confirmed removing the **screen**. The follow-up below retires its routes/navigation without deleting backend handlers, saved data, assets or in-flight jobs.
- App/worker integrations: do not copy whole older package manifests, job dispatchers, video API files or worker types over newer main. Resolve overlapping functionality and paired lockfiles together.
- Assets: all existing local editable design sources, source media, fonts and retained exports stay where they are. No GCP upload or relocation is required to prepare this review. A future storage migration must verify object copies and update consumers before removing any local runtime reference.
- Existing release decision: `docs/release-2026-10-01.md` explicitly deferred the new Explore rollout. This task prepares reconciliation; it does not authorize production rollout or generation/provider costs.

## Migration reconciliation

The Supabase checklist was used to hold schema changes until history and permissions can be reconciled. This pass compares Git blob contents only; it did not query hosted migration history or verify database state. The target baseline itself contains duplicate MCP migration contents under two timestamps; no migration was removed, renamed, repaired or rerun.

| Local migration | Content match in verified main |
| --- | --- |
| `supabase/migrations/20260925170000_allow_wall_text_v13_50px_typography.sql` | `supabase/migrations/20260925170000_allow_wall_text_v13_50px_typography.sql` |
| `supabase/migrations/20260927150038_mcp_oauth.sql` | `supabase/migrations/20260927150038_mcp_oauth.sql`<br>`supabase/migrations/20260927202555_mcp_oauth.sql` |
| `supabase/migrations/20260927183258_mcp_atomic_generation_job.sql` | `supabase/migrations/20260927183258_mcp_atomic_generation_job.sql`<br>`supabase/migrations/20260927202613_mcp_atomic_generation_job.sql` |
| `supabase/migrations/20260929120000_allow_higgsfield_generation_provider.sql` | `supabase/migrations/20260929120000_allow_higgsfield_generation_provider.sql` |
| `supabase/migrations/20260930144135_mcp_video_generation.sql` | `supabase/migrations/20260930144135_mcp_video_generation.sql` |
| `supabase/migrations/20260930160000_auth_email_rate_limits.sql` | `supabase/migrations/20260930160000_auth_email_rate_limits.sql` |
| `supabase/migrations/20261001120000_audio_generation.sql` | No exact content match; hold for feature/history review. |
| `supabase/migrations/20261002192039_character_generation_batch.sql` | `supabase/migrations/20261002192039_character_generation_batch.sql` |
| `supabase/migrations/20261002200207_character_preferences.sql` | `supabase/migrations/20261002200207_character_preferences.sql` |
| `supabase/migrations/20261003041318_character_allowance_privileges.sql` | `supabase/migrations/20261003041318_character_allowance_privileges.sql` |
| `supabase/migrations/20261003045336_character_gemini_3_pro_image.sql` | No exact content match; hold for feature/history review. |
| `supabase/migrations/20261003080500_dodo_billing_recovery.sql` | `supabase/migrations/20261003080500_dodo_billing_recovery.sql` |
| `supabase/migrations/20261003092157_extend_trending_free_trial_to_seven_days.sql` | `supabase/migrations/20261003092157_extend_trending_free_trial_to_seven_days.sql` |
| `supabase/migrations/20261003110411_one_time_free_generation_credits.sql` | `supabase/migrations/20261003110411_one_time_free_generation_credits.sql` |
| `supabase/migrations/20261003114017_fund_generation_job_retries.sql` | `supabase/migrations/20261003114017_fund_generation_job_retries.sql` |

Database changes must be coordinated with their app/worker contracts and the actual migration history before any deployment. Reference: [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations).

## Local review artifacts

- `.tmp/reconciliation-20261003/inventory.json` records exact relative paths, old/local/target Git blob hashes, decisions and migration content matches. It contains metadata only, not file backups or copied credentials.
- `.tmp/reconciliation-20261003/verify-read-only.mjs` checks the frozen inventory, detects source drift/new candidate paths, confirms the approved ignore block exactly and rejects unexpected isolated changes or staging. It reads local files and Git objects only; it does not perform network, database, provider or Git writes.
- Run from this isolated checkout: `node .tmp/reconciliation-20261003/verify-read-only.mjs`. The ignored `.tmp` artifacts are local review data, not production runtime code.

## Next gate

Review the held feature groups on the isolated baseline, starting with Explore and shared navigation/composer integration. Re-capture any paths modified by concurrent work before applying them. Use targeted source checks and appropriately authorized acceptance checks. Do not use Stage All, delete unresolved files, or replay duplicate migrations.

## Validation

Verification for this preparation checks source/configuration invariants only. The read-only verifier passed: target HEAD is the pinned GitHub main commit, runtime source is unchanged, there are no unexpected target changes or staged files, and the ignore block is exactly the approved eight-line addition. Node syntax checking and `git diff --check` passed.

All 178 previously ignored review images and auto-saves still exist in the original checkout and match their saved SHA-256 hashes. Their metadata is retained in `.tmp/reconciliation-20261003/approved-artifact-hashes.json`; none was removed, moved or uploaded.

The verifier detected concurrent source drift in `lib/pricing/plans.test.ts`. This is held work, not an applied isolated change. The inventory must be refreshed before merging that path; a passing safety check is not a claim that the feature inventory is current or merge-ready.

Prior app/worker TypeScript checks in the shared checkout are historical for this preparation and are not claimed as isolated merged-feature acceptance. No media generation, transcription, live provider call, publishing, migration or deployment was executed.

## Implementation: Explore UI integration

The user authorized careful integration with newer main. The original shared checkout was not edited. The target is `C:/Users/chund/.codex/worktrees/safe-reconciliation-20261003/UGC`, still at `3ed9c684b6c710eb9f3c7a4624f7082e8a535daa`. GitHub main was rechecked and still matches that commit.

### Applied scope

- Added the Explore page, workflow cards and local development routes for Create Hook, Creator Phone and Recreate, with their self-contained shared UI components, styles, catalogue types and regression checks.
- Workflows 1 and 3 share Create / Edit video / Schedule sections, matching-height frames, desktop-only example placeholders, full-width demo upload, horizontal demo audio, illustrative subtitle styles defaulting to Clean, and platform icons. Existing disabled generation, finishing and scheduling actions remain disabled.
- Recreate retains the approved narrow draggable split, no full-height divider lines, clearer recreation arrow, Slideshows / Wall of Text / Hook videos order, category interleaving and no gallery totals. The rejected later composer redesign was not reapplied.
- Manually added optional Recreate presentation props to newer main's image/video workspaces and composer/results components instead of replacing them with the older local versions. Preserved newer quality, supported-duration, reference upload, session/history, account isolation, recovery and retry handling.
- Preview Recreate explicitly locks generation even if paid access is passed, does not inherit live job IDs or load generation history, and does not show live History controls.
- Selected image reference URLs flow through the existing image API's trusted-storage validation; reference changes reset the request idempotency key. Provider API and billing reservation code were not changed.
- Updated Explore's own icon/navigation and text-only Generate controls while retaining main's Create Content route/navigation. Removed the first unwanted Wall of Text catalogue item and invalidated its old library cache key; no storage object was deleted.
- Carried the catalogue preparation/import utilities without executing them. Staged references remain excluded from the authenticated catalogue until an explicit later verified publication.
- Copied and hash-verified only eight referenced runtime covers and 342 existing staged preview assets. All originals remain on disk. No GCP object was uploaded, modified or removed.

The reference slideshow gallery is an independent imported Explore catalogue, not the Trending Carousel planner, matcher or rendering pipeline. No Carousel architecture/product decision or worker behavior was changed.

### Explicitly held

The separate Audio generation page and its coupled worker/API migration integration are not merged yet. Its Explore shortcut is temporarily withheld to avoid a dead link; the underlying preset is retained. Other billing/pricing, authentication, marketing, MCP, social integration, provider and migration overlaps, Create Content deletions, and unreferenced design-source/export additions remain held. The earlier inventory is a review queue, not a claim that every intentional change has now been reconciled.

Production Explore rollout remains deferred by the existing release policy and production proxy. This integration does not enable workflows 1/3 generation, demo composition, subtitle rendering or scheduling. Those need a separately scoped implementation of owned media, supported settings, durable jobs, final audio/video composition and saved exports.

### Current verification and limitations

- Next.js route type generation succeeded. Focused Explore/shared UI TypeScript compilation succeeded using `.tmp/reconciliation-20261003/tsconfig-ui.json`.
- Scoped ESLint and `git diff --check` passed.
- All 151 selected offline UI, source-contract, mocked local-media and newer-main session/reference/recovery checks passed. The media-staging fixture suite was not executed. No browser, real generation, transcription or live provider tests were run.
- The read-only preservation verifier confirmed 58 existing named generation/display functions were unchanged apart from the explicitly compared preview guard/reference addition. All 421 protected main API, worker, billing, migration, infrastructure, proxy and dependency-manifest paths match the pinned baseline.
- All 350 runtime copies match their frozen source hashes. All 178 previously ignored review images/auto-saves remain present and match their original saved hashes. The 56 captured local text files had no source drift when rechecked.
- At the initial UI integration stage, borrowed dependencies caused four Runway SDK type errors: main requires `@runwayml/sdk 4.20.1`, while the shared installed copy was `4.4.0`. This validation blocker is now resolved by the isolated locked installation described below. Main's SDK-facing code and lockfiles remain unchanged.
- Nothing was staged, committed, pushed, deployed, migrated or published. Production acceptance is not claimed.

The old `verify-read-only.mjs` checks the preparation-only state and is no longer the acceptance check after implementation. Current local preservation check: `node .tmp/reconciliation-20261003/verify-ui-preservation.mjs`. It reads Git objects, source and asset hashes only.

The frontend-design guidance constrained this to preservation of the approved UI, not a new redesign. Next.js and React guidance informed client/server boundaries, explicit development gates, permanent tab state, effect dependencies, accessible controls and preview isolation.

### Next gate

Reconcile the remaining coherent feature groups separately and install dependencies matching the newer main lockfiles in an isolated release checkout. Then run combined-release validation before requesting rollout. Do not Stage All, enable unfinished workflow actions, replay migrations or move/delete original assets as a shortcut.

## Follow-up: remaining-issue audit and validation fixes

### Fixed in this pass

- Installed the exact existing app and worker lockfiles into separate ignored dependency folders inside this worktree. Install lifecycle scripts were disabled. Repointed only this worktree's two dependency junctions to these installations and retained the previous junctions under the ignored review directory. The original checkout's dependency installation was not upgraded or modified; no project manifest or lockfile was changed.
- The correct Runway SDK is now available to both app and worker. Full-project TypeScript and worker compilation pass without changing or weakening provider types.
- The first production build compiled successfully but failed while prerendering because the isolated checkout had no public Firebase configuration. A local build helper now forwards only seven allowlisted public Firebase keys from existing local configuration, never prints their values, and excludes private server credentials. No environment file was copied or created. The configured production build passes and generates all 130 static pages. Authentication source and deployed settings were not changed.
- Copied the existing same-version FFmpeg executable into isolated dependencies and verified its hash, preserving the source. This allowed the synthetic local media-staging fixture suite to run without downloading or executing package install scripts.
- Carried the two missing Explore regression updates: the legacy catalogue contract now expects the 62 retained Wall of Text references and rejects the retired first clip, and the query test verifies that an old cached catalogue cannot reintroduce it. No additional media was removed.
- Added `scripts/reconciliation-audit.mjs` and six unit checks. This utility reads both checkouts and Git objects, classifies current differences, and refuses a snapshot if files, candidate paths or checkout revisions change during capture. It does not stage, write source, access remote systems or run migrations. Its stdout contains hashes/path metadata, not a backup or environment values.

### Latest validation

- Full app TypeScript: passed (`tsc --noEmit --incremental false`).
- Worker compilation: passed (`tsc -p worker/tsconfig.json`).
- Configured Next.js production build: passed. This is local compile/prerender verification, not authenticated production acceptance.
- Combined offline regression run: **214 passed, zero failed, zero skipped**. This includes UI/source contracts, cache retirement, synthetic media fixtures, session/history recovery, mocked image/video API queues and fake provider clients. It does not make real generation, transcription, billing or cloud-storage requests.
- Scoped UI/audit lint and `git diff --check`: passed.
- Preservation checks: 58 existing functions, 421 protected main paths, 350 runtime copies and 178 original review images/auto-saves still pass their comparisons.
- Nothing staged, committed, pushed, deployed, migrated or published. Original source/assets were not edited by this pass.

### Refreshed inventory

The original shared checkout has continued changing. The latest stable read-only capture is `2026-10-03T13:34:12.742Z` and contains **821 paths**, replacing the earlier 809-path snapshot for the next review. Its metadata is saved locally at `.tmp/reconciliation-20261003/remaining-inventory.json`.

| Classification | Paths | Meaning |
| --- | ---: | --- |
| Already on main | 301 | No duplicate import needed. |
| Integrated exactly | 66 | The isolated version matches the local candidate. |
| Adapted integration | 11 | Main/UI/test combinations differ byte-for-byte; retain the manual review and regression evidence, not automatic approval from hashes alone. |
| Local additions | 297 | Pending coherent review; includes documents, design sources and assets, not just executable features. |
| Local-only edits | 19 | Pending feature-group review. |
| Overlapping edits/additions | 98 | Both versions need semantic comparison; these are not 98 reported runtime failures. |
| Local deletions | 29 | Existing main files preserved; confirm the intended Create Content retirement before propagating deletions. |

### Remaining issues, in implementation order

1. **Separate Audio feature:** the local `/audio-generation` UI, API, worker handler, job/queue types, private media storage and additive schema form one coupled feature. Integrate and validate them together behind their existing disabled-by-default release flags. Do not expose the currently withheld shortcut or dispatch a new job type from only a web-side change. Actual deployed migration history and storage configuration have not been checked or changed.
2. **Other intentional changes:** review remaining authentication, marketing, pricing, MCP, character/provider and social/time-zone groups against main. Preserve newer main fixes, refresh shared source before each transfer, and run each group's relevant offline checks. Many files already match main; copying the complete older checkout would undo newer fixes.
3. **Screen retirement:** the user confirmed removing Create Content. Its normal screen and E2E preview now return `notFound()`, and its primary navigation entry is removed. The broader 29-file deletion was not propagated because removing the screen does not require deleting existing projects, APIs or render workers.
4. **Unfinished workflow capabilities:** Create Hook and Creator Phone now have a shared opt-in development generation connection, described below. Hook/demo/audio composition, final spoken-audio subtitles, saved finished exports and scheduling still need implementation. Those actions stay disabled. Passing offline checks is not authenticated production acceptance; do not enable unfinished actions or production rollout.
5. **Release/media acceptance:** browser/responsive checks, verified staged-media publication and authenticated acceptance against `https://www.getugcpilot.com` remain required before an authorized rollout. The production Explore guard remains intact. No real generation test is performed without separate authorization.

No further UI redesign was performed. The frontend guidance kept the approved presentation intact; the Next.js guidance informed the full build checks, and environment guidance constrained validation to public configuration without copying private credentials.

## Follow-up: workflow corrections and gated generation connection

This supersedes the earlier preview-only implementation description **for explicit development generation mode only**. The original shared checkout remains untouched; all corrections are in this isolated integration checkout. Nothing is staged, pushed, deployed, migrated, published or enabled in production.

### What was corrected

- Both Create Hook and Creator Phone use the real AI Studio model, duration and quality capabilities. Settings live in each workflow parent, survive Create / Edit video / Schedule changes, and normalize incompatible duration/quality together when the model changes. Model availability follows the existing Seedance flag.
- The application supports text-only generation for Kling 3.0, Omni Flash 1.1 and an enabled Seedance 2.5. Image references are optional. “Image references only” described the currently implemented **reference inputs**, not a requirement for an image or a universal limitation of the provider models.
- Selected video/audio generation references and app recordings are rejected before upload or submission. They are never silently ignored or claimed to provide voice matching. Local controls remain available for layout review; demo/video audio remains separate in Edit video. Kling app screenshots are blocked because its current adapter treats images as endpoint frames rather than app-screen guidance; Omni/Seedance accept the supported multi-image payload.
- The new owner-scoped client sends the user's prompt/settings to the existing authenticated `/api/ai-studio/videos/generate` endpoint. Only explicit clicks submit. Retained local `File` objects or approved library images are uploaded through the existing owned-media workflow; blob URLs and local paths never enter the generation request.
- Both workflows reuse the existing eligibility, billing, durable job and owned-media read APIs. They check account-specific credit data, block duplicate clicks, preserve every acknowledged job in a partial batch, restore saved job IDs by account/workflow, and pass a selected saved output into Edit video. No provider implementation, billing reservation logic or database schema was replaced.
- A lost or malformed acknowledgement retains the same request key/body while the component remains mounted. A different prompt/settings/reference cannot replace an unconfirmed submitted request. Account changes/unmounts stop stale submission work. Refresh status reads existing jobs/media; it does not start a generation.
- The shared uploader gained an optional expected-owner argument, checked before cloud writes. Existing three-argument callers retain their behavior. Preview boundaries never mount authentication, billing or job hooks, and preview Generate buttons remain disabled and text-only.
- Retired the authorized Create Content screen, loading screen and E2E preview, and removed its navigation item. Backend handlers, worker code and existing data/assets remain intact.

### Rollout guard

The connection requires all three conditions: `NODE_ENV=development`, server-side `EXPLORE_GENERATION_DEVELOPMENT_ENABLED=true`, and an explicit `?mode=generate` request. This flag has **not** been configured or enabled. Existing `?preview=1` requests always remain non-spending, even when the development flag is set. Production/test requests remain hidden, and the existing production proxy is unchanged.

### Current verification

- **215 selected offline checks passed**, zero failures/skips, across 148 Explore/UI/local-fixture checks, 50 main settings/session/reference/retirement contracts, 12 mocked main image/video API checks, and 5 actual workflow-client-to-API-handler checks with all external writes replaced. The latter verify text-only requests for all three models, creator/app image handoff, partial batches, unchanged retry identities and rejection before billing.
- Full app TypeScript, scoped ESLint and the configured Next.js production build passed. The build compiled/prerendered all 130 static pages using only the existing allowlisted public Firebase configuration. This is local build verification, not a deployment or production authentication check.
- Preservation comparisons still pass: 58 existing generation/display functions, all 421 protected main API/worker/billing/migration/infrastructure/proxy/dependency paths, 350 runtime asset copies and 178 retained original review artifacts. No source asset was deleted, moved or uploaded.
- No real generation, paid provider call, transcription, billing reservation, cloud-storage write, scheduled post or publishing request was executed. Tests use injected/fake services and local fixture media.

### Still required before release

- Connect durable demo/audio composition and subtitle export. The main edit-render endpoint handles manual overlays/trim, not these automatic subtitles; the standalone `worker/src/subtitles` implementation is not imported into production worker flow, and does not yet support the illustrated Editorial choice. UI samples are not proof of rendered subtitles. Clean remains the default illustrative style and speech-caption scope remains the combined hook/demo video.
- Connect scheduling to a saved finished output and an explicitly resolved connected social account. The user subsequently asked to show connected accounts. Both workflows now offer that read-only list and explicit account selection in connected development mode; the publishing action remains unconnected/disabled. Never choose a destination account arbitrarily.
- Extend unconfirmed-request recovery across reload/navigation before production enablement. Acknowledged server job IDs survive reload; the pending unacknowledged request key/body currently stays in memory only. Production remains disabled until this and finishing/scheduling are addressed.
- Complete the remaining release reconciliation queues and authenticated hosted acceptance before deploying all intended changes. The earlier 821-path inventory is a historical review snapshot, not an up-to-date release-complete manifest.

Next.js/React guidance informed ownership boundaries, persistent tab drafts and fail-closed preview separation; frontend guidance preserved the approved UI rather than redesigning it. Existing server-owned media/authentication contracts were reused without adding browser database access or exposing credentials.

## Follow-up: connected accounts and ordered-release preparation

The user required Git → required Supabase migration → Vercel revision → GCP worker image → production smoke, after the required implementation is complete. The [release preflight](release-preflight-2026-10-03.md) records exact current targets, observed ledger differences, verified already-applied SQL, compatibility gates and access limitations. No deployment step has been executed by this pass.

Both Hook and Creator Phone now share a guarded connected-account control under platform selection. It reads only owned accounts through the existing authenticated API, shows account names/usernames, requires explicit selection, blocks expired/permission-missing destinations, clears destination on platform changes and exposes loading/error/empty states. Preview mode and inactive tabs mount no account lookup. This changes the local scheduling draft only: there is no scheduled-post write, OAuth/disconnect mutation or fabricated account data.

Current checks: 106 focused offline regressions passed, including 10 new account checks; full app TypeScript, scoped lint, the configured 130-page production build, and the preservation verifier all passed. Original source/assets are unchanged. The browser remains signed out; real account display and production workflow acceptance are not claimed.

Production already contains three local migration candidates with equivalent complete SQL after line-ending/outer-whitespace normalization. They must not be replayed. The migration freeze guard passes, but strict canonical version parity is not yet satisfied. This distinguishes an actual pending migration from an already-applied migration with a different timestamp.

Still required: complete durable composition/subtitle export and scheduling, cross-reload unacknowledged-request recovery, the remaining all-changes reconciliation, final hosted access/inventory checks, and combined-release acceptance. A passing local build does not remove these release blockers.

## Latest follow-up: request recovery, audio scope and migration evidence

This section supersedes the older memory-only recovery, 130-page build and 97-file migration descriptions above. All changes remain in the isolated integration checkout; original source/assets are preserved. No staging, commit, push, deployment, paid request or SQL execution/ledger repair was performed.

### Durable recovery, with an unresolved edge case

An owner/workflow-scoped, versioned pending-request marker is persisted and verified before POST. It stores only an opaque request UUID and quantity, not prompts, tokens, files or media URLs. Acknowledged job IDs are persisted before the marker is cleared. Browser locks prevent concurrent tabs from submitting through this boundary.

The new authenticated GET-only recovery route looks up the same owner/job-type child identities and returns IDs only. Reload can recover a fully created batch after a lost acknowledgement, even with an empty draft or no remaining generation credits. Missing/partial/malformed/foreign records retain the marker and never cause an automatic POST, provider retry or billing call.

This is not complete terminal recovery: if only part of a batch was created, or the original request never reached the server, there is no durable server request receipt proving that missing children may safely be resumed or abandoned. The marker remains blocked for manual resolution. Add a safe server receipt/resolution contract before production enablement; do not advise clearing browser storage to retry.

### Composition and the latest user clarification

- Added a bounded, unregistered local composition primitive. It normalizes framing without cropping, appends an optional demo, preserves input files via verified snapshots, never overwrites an existing output, and separates a music-free speech track from added background layers. Synthetic tone checks verify segment order and soundtrack isolation. It does not own/download/persist inputs, call ASR, render captions, upload output or schedule a post.
- The approved subtitle scope is English, up to **60 seconds for the complete opening + demo**. The shared policy checks measured duration before outputs and the rendered duration afterward; unsupported language/overlong sequences fail without automatic trimming. Both UI workflows disclose the scope in an information popover without restoring unwanted subtitle subtext. The older local pilot remains 30-second-only and has not been ported into production.
- Main voice means a Create-generation audio reference, not an uploaded replacement voice for the demo. Removed the mistakenly added unconnected `demoVoicePath` input. Shared UI wording now separates generation guidance from demo-only playback. No layout redesign or tab rename was applied.
- Replacement versus mixing for Demo audio is still an unanswered product choice. The existing unregistered demo-background implementation is not an approved final production behavior. A vetted default background track and subtitle backend/Linux packaging are also unresolved.
- Seedance documents audio-reference capabilities, but the application's client/API/OpenRouter adapter currently reject audio references. They remain fail-closed until the complete owned-media/provider path is reconciled. See the audio contract for official sources and exact current limitations.

### Already-applied migration evidence, not a replay plan

The three complete SQL files previously verified against the hosted ledger were added to canonical Git history using their actual applied versions: `20261003045651_character_gemini_3_pro_image.sql`, `20261003121102_prevent_early_social_publishing.sql`, and `20261003122024_account_timezone_preferences.sql`. They were not run again. Original candidate files and existing main history were not removed or rewritten.

Canonical history now contains 100 files versus 98 rows in the recorded hosted evidence. The read-only audit reports 40 exact applied matches, 46 applied text differences needing review, one applied row without stored SQL evidence, 10 exact SQL matches under other applied versions, and three unverified files. Eleven hosted versions are absent from active Git history. A text-hash difference is **not proof of schema drift**: comments, stored statement boundaries and formatting still require semantic review. Every audit row has `replayAllowed: false`; the audit is not deployment-ready.

The Docker Linux engine was unavailable, so disposable-database reset rehearsal and Linux subtitle image validation could not be completed. No production reset, blanket push, baseline replay or history repair was used as a workaround.

### Validation and release boundary

- The corrected audio/UI/recovery/policy/composition run passed 63 offline checks. A subsequent 59-check run passed the additional generation-vs-demo isolation contract and migration guards alongside overlapping UI/recovery tests. These are separate scoped runs, not full-release or live-provider acceptance.
- Full app TypeScript, worker compilation and scoped ESLint passed. The configured Next.js production build compiled/prerendered **131** static pages, forwarding only allowlisted public Firebase configuration.
- Preservation verification passed: 58 existing functions, 421 protected newer-main paths, 350 runtime asset copies, 178 retained original review artifacts, and zero staged paths. Existing provider/billing/schema runtime code was not changed by this audio correction.
- The last successful inventory capture was `2026-10-03T17:17:51.192Z`: 821 source candidates — 301 already on main, 48 integrated exactly, 31 adapted integrations, 295 additions, 19 local-only edits, 51 overlapping edits, 47 overlapping additions, and 29 deletions requiring scoped handling. It is historical metadata, not a refreshed release-complete manifest. A later refresh was not executed because the automatic approval service hit its usage limit; this was not an unsafe-action determination. The approval check was not bypassed.
- Still required: owner-backed final composition/subtitle export, supported voice-reference integration, safe terminal request resolution, saved-output scheduling, remaining all-changes/history reconciliation, Linux validation and authenticated hosted acceptance. Production remains disabled. No deployment order step has begun.

Frontend/Next.js/React guidance kept the approved structure, attachment ownership and honest disabled states intact. Migration/deployment guidance kept evidence reconciliation separate from applying SQL or promoting unfinished code.

## Connected Explore and Audio follow-up — 4 October 2026

This supersedes historical statements above that finishing has no caller, Apply edits/Schedule post are unconditionally disabled, or standalone Audio is not integrated. [The integration report](explore-ui-audio-integration-2026-10-04.md) records the implementation and limitations. Both Hook and Creator Phone use the shared real finishing/scheduling controller; ready owned Audio output can be selected for Demo-only background audio. New dispatch is still held until reviewed schemas, private GCP storage, matching workers and credentials are present.

The stable read-only comparison captured at `2026-10-04T12:47:07.124Z` contains **859** original-source candidate paths: 301 already on main, 75 integrated exactly, 66 adapted integrations requiring review, 293 local additions, 13 local-only changes, 36 overlapping changes, 46 overlapping additions and 29 deletions requiring scoped review. These classifications are review queues, not bug counts, approved exclusions or evidence that every intended change is integrated. Both staging areas are empty. Original and release HEADs remain the recorded revisions; this local comparison does not establish fresh remote/deployed parity.

The user's authorized Create Content screen retirement is retained; its API/render/data/in-flight work is not deleted wholesale. All remaining intentional source and runtime-asset groups remain release scope. No Git push, hosted migration/history repair, cloud deployment, paid provider call or real social post occurred in this follow-up.
