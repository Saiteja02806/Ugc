# Complete follow-up release — 13 October 2026

Status: user authorized deployment of all current intentional checkout changes.
Combined validation is in progress; no follow-up production success is claimed.
The previous release baseline is `a2b3dd79ebf20c6a6ae96f493523cc695d6feccb`.

The initial 98-path release is merged at `1177258d` and its website builds and
immutable worker image succeeded, but its live promotion was held. Additional
completed navigation changes are included in the final source freeze: static
Talking Head entry with the same preview guard, complete character-card
prefetch, decorative cover cancellation and separately loaded editor code.
Sidebar cleanup and completed candidate progress documents are included.
Candidate Business Context/onboarding/logo runtime remains deferred in its
separate branches. The user's later request to hide the Slideshow Edit hook
library is explicitly excluded from deployment and will be prepared locally
after the deployment source is frozen.

This release includes the landing Talking Head UGC video/badge and passive
three-second slideshow; browser fetch-receiver fixes; stable workflow frames
across Create/Edit/Schedule; reference tile collections and actual Recreate
video inputs; stale image/video/audio guards; character session recovery,
library pagination and automatic image saves; their tests and review records.
No smaller intentional checkout change is omitted.

Release order follows `infra/gcp/README.md`: validate/freeze the complete Git
source, hold Vercel Git builds/live alias assignment, push main, apply only
missing compatible Supabase migrations, restore build configuration and build
exact-source staged Vercel targets, build one immutable worker image and roll it
out to all six services and two jobs, then promote and verify actual production.
Original settings, worker configuration and rollback target identities are
recorded privately before mutation. Live alias assignment is restored afterward.

The only missing local migration is
`20261013143246_character_auto_save_influencer_images.sql`. Its service-only
completion trigger saves validated character outputs and backfills previously
completed, unselected images. Existing names, dates, ordinary Studio media and
deleted images are preserved. Real Postgres tests cover atomicity and access.

Generated review output under `outputs/`, secret/local environments, caches,
builds, logs, helper state and infrastructure plans/state are excluded and
retained. The full inventory and exclusions are in the adjacent
`followup-release-inventory-2026-10-13.json` and
`followup-release-excluded-paths-2026-10-13.md`. Business Context runtime remains
in its separately deferred branch; its current progress document is included
as documentation only.

Current-source checks, immutable source SHA, migration parity, deployment
identities, worker digest and final acceptance will be recorded in
`.tmp/followup-release-2026-10-13/live-release-report.md`. Production verification
must use the real domains. No paid generation or social post will be submitted
merely to prove release activation; acceptance limitations will be explicit.

## Frozen-source validation checkpoint

Application TypeScript and worker TypeScript passed. The current-source broad
application run covered 171 files and 1,342 tests: 1,338 passed initially and
four local HTTP fixture tests failed on sandbox connection permissions. The
isolated media-transfer rerun outside the sandbox passed all 14 tests. No
application assertion remains unresolved. The compiled worker suite passed
606/606. Changed-file ESLint passed with zero errors and one existing unused
test-variable warning. Whitespace and script syntax checks passed.

Review covered the complete diff, with focused inspection of native browser
fetch calls, reference collection limits/payloads, stale input guards, draft and
schedule locking, character owner/provenance checks, session expiration and
atomic completion/backfill. The completed source chats additionally recorded
30 workflow frame browser cases, six reference-tile browser cases, real
slideshow generation-request fixture checks and character session/gallery
fixtures. No fresh paid provider job or social publishing action is claimed.

Supabase project identity is `kltxwijhluawgveykfbt`; production has 135 migration
versions and the source has 136, with only the automatic character-save migration
missing. Before migration, production has eight completed builder images,
seven already saved influencers, and one unsaved image. The completion trigger
is absent. The baseline security advisor has informational notices only.

The final navigation/UI source passed 146 focused checks, final application
TypeScript and scoped ESLint. The existing UI reconciliation source assertion
was updated for the reviewed inline-reference layout; no application behavior
was changed to satisfy it. The attempted full follow-up rerun was interrupted
before completion and is not claimed as passed. Initial broad regression and
worker results above remain the evidence for the otherwise unchanged scope.
The source chat's configured production build and rapid-switch browser checks
also passed. Exact-source Linux website builds and live acceptance remain
required before declaring this final revision deployed.
