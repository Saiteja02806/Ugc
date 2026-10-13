# MCP Library content candidate — 13 October 2026

The candidate adds ten scoped tools on the reviewed PR #47 base (which depends on reference PR #46). Source discovery is 73 tools; custom production domains remain on their verified audio restoration with 46 tools. Advanced generation PR #45 remains separate.

## Behavior

Owned saved Carousel/slideshow items, ordered outputs, exact snapshot revisions and archive tombstones are browsable with owner/filter-bound keyset pagination. Unsaved owned Carousel generation IDs are discoverable. Inspecting a Carousel shares the website's owner/completion/latest-ready-edit resolution and exact save payload, rejecting pending/failed/incomplete edits rather than reverting to original pixels.

Saving binds actual generation/slide/edit state and the current Library destination, including tombstones. New service-only requests are recorded atomically with the unchanged canonical save RPC or metadata-only removal. Accepted results recover before current gates, plan/media readiness or source resolution; they are historical snapshots and never overwrite later website changes. Removed Carousel saves require an explicitly requested new recreation at the inspected destination revision. Explore v2 saves reuse the website's exact owned-image validation, order and fingerprint contract. Existing v1 website saves remain compatible.

Removal archives metadata and preserves source media/saved slide files. Existing scheduling dependencies and application publishing policy remain authoritative. This candidate does not add scheduling, cancellation or storage deletion. It saves already rendered slideshow images; browser-only text-bearing slideshow rendering remains a separate incomplete backend workflow.

## Security and migration

`20261013062530_mcp_library_content.sql` creates an immutable owner/request receipt table, four invoker RPCs with empty search paths, and deterministic paging indexes. Browser roles cannot access the new table/functions. The service role has receipt SELECT/INSERT, without UPDATE. Original website RPC definitions and their security mode are preserved. `MCP_LIBRARY_WRITES_ENABLED` defaults false.

Read-only production metadata checks confirmed RLS/service-role access, nullable manual slideshow generation FK, and absence of both new group and Library receipt tables. Line-ending-normalized original function definition MD5s match the actual canonical SQL fixture:

- `save_generated_carousel_library_item`: `d19bea6257ba42b62d429bc96df264fc`
- `explore_save_slideshow`: `93837afff509fe553d0b9eda030873e2`

No group/Library migration was applied. No custom-domain promotion, bucket/IAM change, worker release or customer media operation was performed.

## Validation and remaining boundaries

Six actual PostgreSQL transaction cases, seven actual MCP SDK/PostgREST cases, four shared owner-resolution cases and six existing slideshow regressions passed. Coverage includes foreign owners, incomplete/unsafe edits, stale source/destination/membership snapshots, changed ordered inputs, accepted save/removal replay after later website changes, lost acknowledgement after commit, whole transaction rollback, deleted-state recovery, service-only permissions and bound page cursors. Upstream source/media rows are isolated fixtures; Library tables/FKs/RLS and original save RPCs are canonical. PGlite calls do not establish real multi-session PostgreSQL concurrency or production acceptance.

The complete MCP suite, TypeScript, scoped lint and thirteen package/migration-parity checks passed. The migration freeze guard passed. The offline production build compiled and prerendered successfully using synthetic Firebase public configuration. Its initial unconfigured build failed with `auth/invalid-api-key`; this was an isolated environment limitation, not hosted acceptance. Final review refinements passed six SQL/seven SDK cases, TypeScript/lint/diff checks and five real package-builder cases. The new source list and request history page checks are included. Exact-head Linux and hosted checks will be recorded after push.

All intentional candidate source/SQL/CI/tests/docs/consent changes are included. Unrelated dirty primary-workspace changes, local environment/configuration, ignored dependencies/build output/logs/fixtures, and temporary helper files are excluded. Published/private plugin 0.1.9 artifacts, older downloads and the lockfile are unchanged. New Library workflow packaging/installation, hosted schema/gates, intended account actions and Claude Code authentication remain unfinished.

Migration SHA-256: `45f2ea298147507f6023f5ac90d515c75272f64bbae63567cb7fa80c3c468535`. All 21 intentional paths were audited before staging.


## Approved production migration checkpoint

The user approved the combined PRs #46–#48 gated release. Group and Library migrations were applied without customer media operations. Supabase assigned authoritative ledger versions `20261013072941` and `20261013072958`; local filenames and executable fixture references were aligned to those versions without changing either reviewed SQL body.

Post-application inspection exposed Supabase default `ALL` grants to `service_role` on newly created public tables, which the isolated original fixtures did not reproduce. Additive correction `20261013073411_mcp_request_receipt_permissions.sql` revokes those grants on only the two new receipt tables and retains SELECT/INSERT. Production verification confirms RLS enabled, browser roles denied, service-role UPDATE/DELETE/TRUNCATE denied, and all six new RPCs restricted to service-role invocation with empty search paths. The correction does not change existing application table grants, existing website save RPCs, media, buckets/IAM or workers.

A real PostgreSQL grant regression now starts with the production default ALL grant, executes both original receipt DDLs and the correction, verifies all browser/service-role privileges, and exercises allowed inserts/reads plus denied updates/deletes/truncation. Both projects have explicit production false configuration for group, Library, text-remix, audio-import and private-upload writes. Domain promotion and post-release verification remain pending at this checkpoint.
