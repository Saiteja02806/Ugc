# MCP gated schedule-creation candidate — 17 October 2026

## Purpose

This source-only candidate adds one safe scheduling write: `create_schedule`. It is disabled by default and must not reach the existing scheduling service until `MCP_SCHEDULING_WRITES_ENABLED=true` is present in the MCP deployment.

The adapter accepts only a caller-owned media asset or saved Library item, caller-owned selected connections, an explicit ISO time, IANA timezone and stable request UUID. It delegates ownership, readiness, plan, platform and schedule-lead policy to the application's existing `createUserSchedule` service. It neither creates a social connection nor calls a provider API directly.

## Verified-identity bridge

The website requires a Firebase-verified identity for TikTok and YouTube. Prior MCP access tokens carried only `firebase_uid` and scopes, so passing a guessed eligibility flag would have weakened that policy.

Migration `20261018043539_mcp_verified_identity.sql` adds a service-only `email_verified` boolean to OAuth authorization codes and access/refresh tokens. The OAuth consent route stores it only after `requireFirebaseUser` has verified the Firebase identity. Code exchange and refresh copy the same boolean. The MCP transport exposes only that boolean internally as `authInfo.extra.emailVerified`; it never returns an email address or Firebase bearer credential. Existing token families default to `false` and need fresh consent before they can qualify for TikTok/YouTube targeting.

## Current scope

| Tool | Required scope | Runtime requirement |
| --- | --- | --- |
| `create_schedule` | `publishing:write` | Configured scheduling service and `MCP_SCHEDULING_WRITES_ENABLED=true` |

Schedule reads remain separately available with `publishing:read`. The candidate still has no MCP tools for social OAuth, schedule editing, cancellation, retry, rescheduling, immediate publication, or analytics.

## Local validation

- `npm run test:mcp` passed, covering the MCP catalogue, OAuth token lifecycle, migrations, media transfer, finishing, drafts, audio, references, groups, Library and account settings. Its local transfer fixture used temporary loopback servers only; no production request or customer media operation ran.
- `scripts/mcp-scheduling-tools.test.mjs` passed after final review: four read tools and the write tool have separate scopes, capability reads stay pure, configuration and the write flag must both be available, the default write gate stops before service access, and owner/verified-identity inputs reach the shared scheduling service correctly.
- `scripts/test-mcp-verified-identity-migration.mjs` passed: service-only grants hold, a verified consent decision survives exchange and refresh, and an older token family remains unverified.
- UGC Pilot package validation and deterministic archive tests passed for version `0.2.4`: 42 files, 15 skills and 84 source tools. Marketplace-review evidence is still incomplete because `review.demo_recording_url` has not been supplied.
- The isolated Next Webpack build compiled and completed TypeScript checks. Static prerendering then stopped because this checkout has no valid Firebase browser configuration (`auth/invalid-api-key`). The default Turbopack path also cannot use this worktree's shared `node_modules` symlink inside its filesystem root. Neither result changes production behavior.

## Release boundary

No migration has been applied and no write gate has been enabled. A release must first validate the migration's service-role-only grants, stage the MCP deployment with the write gate false, then test a new OAuth consent and a real selected-media schedule only after a specific user request. Existing customer token families must not be silently elevated.
