# Productivity image cleanup — 11 October 2026

Status: safeguards validated; reservation replay guard applied to production.
Targeted website rollout and source retirement are pending.

## Requested scope and identity

The user requested removal of the exact human image
`productivity-human/Pinterest_2026-08-16 (61)/pinterest_029.jpg` and all images
under `productivity_humanhookpart-2/human`, from local sources and backend
selection, without breaking existing carousels. There are 40 unique file hashes:
39 hook backgrounds and one human background. All 40 match canonical production
assets. Eleven identical local copies occur outside the requested paths; their
hashes are also rejected by the import policy. The two MP4s in the named folder
are separate from the requested images and are not accepted by this importer.

## Safe removal contract

The source rows have 422 historical slide references across 417 completed
carousels. Their reservations also occur in 24 failed generations. No affected
job was active at the preflight snapshot. There are 24 undeleted saved Library
items and six edits associated with affected completed generations.

The cleanup archives and deactivates the 40 source rows with an explicit
`user_requested_retirement` reason and a preservation marker. It retains their
approved review metadata, source bytes, slide references, usage history and
rotation state. A targeted website safeguard keeps existing ready rendered
slides readable and supplies their original backgrounds to owned edits.
Fresh image selection and the Hook library remain subject to active/ready gates.
Generic archived, rejected and unreviewed assets stay blocked.

The database replay guard blocks a previously assigned retired asset before
either idempotent reservation replay returns. It does not clear old usage or
rewind rotation. Failed generations with retired reservations cannot reuse
those sources; a future generation must use a successor.

Local preparation excludes the rejected paths and hashes before deduplication.
Import and reconciliation reject obsolete manifests before writes. Protected
tombstones cannot be refreshed, removed as stale, or replaced through a hash
collision. Destructive reconciliation locks/rechecks current preservation
markers and the rejected hashes before changing any foreign keys or usage.

## Backups and acceptance

Before mutation, all 40 specified local source files were copied into
`.tmp/productivity-image-retirement/local-backup`, retaining relative paths.
Source and backup SHA-256 values matched. Backend rows and the production
reservation function were captured in the same ignored audit directory.
Historical preflight visibility was recorded per generation: 351 had six
visible slides, while 66 already had fewer under the pre-existing source gates.
The acceptance requirement is no further loss caused by this cleanup.

Validation completed before rollout:

- 40 focused tests for historical reads, image roles, import rejection and
  reconciliation preservation passed.
- Five PGlite PostgreSQL tests exercised both replay branches, inactive,
  archived, rejected, excluded and missing sources, normal active replay,
  migration idempotence, baseline rejection and unchanged usage/rotation.
- Root and isolated-release TypeScript checks passed; scoped ESLint and
  `git diff --check` passed.
- The isolated webpack production build compiled and passed its TypeScript
  stage, then prerendering failed because the checkout lacks Firebase build
  environment values. The default Turbopack build also cannot follow the
  checkout's dependency junction. The configured hosted production build must
  succeed before source retirement proceeds.

Production migration verification found exactly two replay guards. Function
owner, service-role-only execution ACL, security-definer setting and fixed
search path are unchanged. The advisor reports only the existing informational
RLS-without-policy notices on private service-role tables; this change adds no
table or public execution grant.

No paid image generation or customer batch was triggered for this cleanup.
The production website safeguard must be READY before the source rows are
retired. Final retirement and post-removal results will be appended here.

## Folder and allocation explanation

See [folder inventory](C:/Users/chund/OneDrive/Desktop/UGC/docs/productivity-folder-inventory-2026-10-11.md)
and [allocation audit](C:/Users/chund/OneDrive/Desktop/UGC/docs/carousel-image-allocation-audit-2026-10-11.md).
The active backend uses hook, human and static roles. The nested part-2 `human`
folder maps to first-slide hook still images. There is no runtime Other role.
The misspelled part-3 folder is unsupported by the standard importer.

Rotation is per business profile, category and role, with newest-first fresh
selection followed by deterministic shuffle cycles. The pre-removal audit
found no reuse-before-unseen cases in any of 15 productivity business profiles.
Reservation consumption by failed renders and unequal role pool sizes mean
global usage counts are not equivalent to fair user-visible exposure.
