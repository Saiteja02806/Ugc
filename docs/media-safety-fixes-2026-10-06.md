# Media safety fixes — 6 October 2026

Branch: `codex/media-safety-fixes-20261006`, based on `9927b52dfaac277551370680d0d20baa74996d27`.
Implementation checkout: `C:/Users/chund/.codex/worktrees/complete-release-20261005/UGC`.

## What this pass changes

- Legacy combined renders now return measured MP4 duration, dimensions and bytes.
  Both scheduled combinations and Hook-library combinations persist them, with
  the output file name. The existing Buffer-only canary contract is preserved.
- The newer Explore finisher was already saving measured output details. Its
  rendering, demo-only audio rules, subtitle limits and output bucket are retained.
- Private media readers check owner, readiness, deletion and recorded storage
  location. Publishing and new generation submissions resolve private objects at
  execution time, rather than freezing short-lived URLs into queued requests.
  Resuming a known paid provider operation does not re-read expired references.
- Explore finishing uses the recorded input location; public inputs and all
  current output/catalog paths keep their existing primary bucket.
- API and MCP media responses can issue signed, uncached private preview URLs.
  The delivery route rechecks readiness/deletion, supports byte ranges and pins
  the GCS generation. Thumbnails have separately signed tokens.
- Edit projects persist canonical source URLs, not browser bearer links. Owned
  Edit API responses mint fresh playback URLs; unavailable sources have no stale
  playback fallback. Scheduling keeps canonical inputs for worker resolution.
- Upload completion checks the reservation's recorded bucket. Existing public
  reservations and current audio validation are preserved.

## Historical metadata repair

A fresh read-only production aggregate found 62 ready, undeleted
`combined_render` rows, all missing duration, dimensions and file size. This is
missing metadata, not proof that their videos are missing or broken.

`scripts/backfill-render-media-metadata.mjs` is inspection-only by default. It
probes generation-pinned, size/time-bounded existing files and fills only null
fields. Conditional updates require the original row version and storage key,
ready/undeleted status and each target field still being null. Pagination uses
an ID cursor so updating rows cannot skip the second page. Only combined-render
records are repair candidates; unrelated media is not modified.

Production repair completed: **62 inspected, 62 conditionally updated, zero
failures, zero videos regenerated, zero stored files deleted**. A final independent
database aggregate confirms 62 ready combined-render assets, zero incomplete
records and zero non-positive measured values. No asset URL, storage key, existing
populated video-detail field or stored video object was changed by the repair.

The initial broader read-only inspection also checked seven unrelated Edit
exports and changed none; one combined-video download was interrupted. The
scoped repair used bounded read retries and successfully verified that file.
GCS SDK listener/deprecation warnings did not cause repair failures; none were
hidden by disabling validation or warning reporting.

```powershell
# Supply an approved, ignored environment file explicitly; never commit it.
node --env-file=APPROVED_ENV_PATH --experimental-strip-types scripts/backfill-render-media-metadata.mjs --inspect
# Only after inspection/review, fill missing metadata without regenerating files.
node --env-file=APPROVED_ENV_PATH --experimental-strip-types scripts/backfill-render-media-metadata.mjs --mode=backfill --execute --yes
```

## Private storage is staged, not enabled

**Keep `PRIVATE_USER_MEDIA_ENABLED` unset or `false`.** Setting it to `true`
deliberately rejects new app/MCP upload reservations; this is a fail-closed gate,
not an activation switch. No private upload writer or automatic bucket cutover
is enabled in this patch. No existing object is moved, overwritten or deleted.

Before a separately approved rollout:

1. Provision and verify a separate private bucket, IAM/public-access policy,
   app/worker read and signing permissions, and required upload CORS. Configure
   `GCP_PRIVATE_MEDIA_BUCKET`, `MEDIA_DELIVERY_SIGNING_SECRET` (server-only, at
   least 32 characters) and the canonical HTTPS application origin.
2. Finish private upload reservation/confirmation and test in-flight public
   reservations, app uploads and MCP uploads, including audio.
3. Exercise browser preview URL expiry/renewal in every reader. Fresh API links
   and durable queued inputs are implemented; automatic renewal for already-open
   browser players and all legacy consumers is not accepted yet.
4. Inventory separate thumbnails and historical references in schedules,
   demos, Edit projects and Hook drafts before any row URL/location switch.
   Do not tag a row private unless its object and required derivatives exist.
5. Verify production owner isolation, editing/finishing, request recovery and
   publishing on the real site, with explicit approval for any paid/posting test.
6. Separately approve private MCP cleanup if desired. The safety review rejected
   adding private tombstoning/deletion in this no-delete pass. Cleanup therefore
   fails before any private-object write; existing public cleanup is unchanged.

`scripts/migrate-user-media-to-private-gcs.mjs` has only inspect and copy modes.
Copy mode requires `--mode=copy --execute --yes`, uses generation-pinned sources
and create-only targets, verifies bytes/checksum/content type and source stability.
It cannot switch database rows or delete sources; `--delete-source` is rejected.
Private-copy mode has not been executed. These safeguards replace the unsafe
historical move-and-delete draft rather than importing it wholesale.

No old private-media SQL migration, broad RPC grant, generic worker-storage
default change or Terraform rollout is included. The separate working private
audio integration is not replaced by this user-media staging work.

## Older drafts: decisions, not another bulk reconciliation

- Keep current Explore/AI Studio UI, billing controls and generation recovery.
  Do not restore the July visual draft `ea7649682699d27f537ce20f3fecbb052d9fee12`.
- Durable render-slot/account-lane safeguards from `2156482...` are already
  patch-equivalent to main; do not duplicate them.
- Do not replay historical capacity SQL from `a191d8a...` or raise queues. The
  earlier read-only review found two live database render slots and social
  service/source capacity drift. Infrastructure alignment needs its own reviewed
  plan; this pass changes no capacity or applied migration history.
- `6c1c7ee...` is optional canary delay tooling, not a user-generation fix.
- Marketing drafts are outside the three selected fixes and remain untouched.
- Two concurrent UI copy edits appeared in the implementation checkout during
  validation: `workflow-composition-panel.tsx` and `workflow-edit-workspace.tsx`
  label demo audio Optional. They were preserved, not authored or reverted here.
  No files in the older dirty Desktop checkout were overwritten.

## Validation and limits

- App TypeScript and matching worker compilation passed.
- Optimized app build passed with only the existing public browser configuration;
  the initial no-configuration attempt stopped at Firebase `auth/invalid-api-key`.
- 88 expanded worker rendering/publishing/provider regressions passed; 17
  mocked image/OpenRouter integration tests passed.
- 23 private delivery/ownership/range/gate/maintenance tests passed. Explore
  storage tests also verify private input routing without changing output storage.
- The full combined Explore suite passed **376 tests** after extending its older
  upload test harness for the new reader imports. Its new test checks reservation
  location and preserves Demo audio's 600-second and Create-reference 30-second
  caps. Existing Audio/OpenRouter/image/idempotency API tests passed (24), as did
  MCP permission/upload contracts (24).
- Scoped lint had no errors; two untouched existing worker unused-variable
  warnings remain. Patch whitespace checks passed.

Offline/mocked tests and a local build are not authenticated production
acceptance. This pass does not claim paid generation, transcription, editing or
publishing was tested end-to-end in production. Source changes have not been
pushed, merged or deployed in this pass.

The Next.js route-handler guidance informed awaited route params and uncached
delivery. Environment-variable guidance kept secrets server-only and out of the
release checkout; only public browser configuration was passed to local builds.
