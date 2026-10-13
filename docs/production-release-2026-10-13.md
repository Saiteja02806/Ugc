# Complete production release, 13 October 2026

Status: preparation in progress. Deployment has not yet been claimed.

The initial complete worktree audit includes 233 intentional changed/new paths: Explore layouts, inline scheduling, clip-draft persistence, background preparation, caption review and recovery, partial generation discovery, character batch progress, slideshow-only Trending, worker contracts, infrastructure configuration, tests and documentation. Four Explore migrations are missing from production. The production MCP/plugin source is newer than this checkout and must be merged before release to preserve its approved audio, group, Library, reference and plugin 0.1.11 contracts.

Release order follows `infra/gcp/README.md`: reviewed and validated Git source to main, only missing compatible Supabase migrations, exact-source staged Vercel builds, matching immutable GCP worker rollout, then live promotion and authenticated production verification. Staging holds the live domains across the app/worker compatibility window. Existing MCP write gates remain at their persisted settings; optional warm-receiver configuration defaults off and requires a reviewed infrastructure plan before activation.

All initial changes and hashes are recorded in [the inventory](production-release-inventory-2026-10-13.json). Every excluded path and its reason is recorded in [the exclusion manifest](production-release-excluded-paths-2026-10-13.md). Temporary generated output, ignored secrets/local configuration, dependencies, builds, logs and infrastructure state remain on disk. No intentional project source is excluded.

Final validation, migration ledger, source SHA, deployment identities, worker digest, rollback metadata and production acceptance will be recorded here after execution. Production smoke checks must use the actual domains and must not submit paid generations or social posts.
