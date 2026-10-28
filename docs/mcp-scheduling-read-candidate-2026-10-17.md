# MCP scheduling-read candidate — 17 October 2026

## Purpose

This candidate closes one narrow IDE-access gap: an authenticated UGC Pilot agent can discover whether scheduling reads are configured, inspect the connected account's existing social-account labels and connection health, list its schedules, and read one selected schedule's safe delivery state.

It is deliberately a read-only adapter over the existing application scheduling services. It does not introduce a new database schema, migration, runtime configuration, social-provider OAuth flow, worker, bucket, or publishing path.

## Candidate identity

- Worktree: `codex/mcp-scheduling-parity-20261017`
- Base: OAuth/plugin acceptance candidate `35ffb56c`
- Package: UGC Pilot `0.2.3`
- Source catalogue: 83 tools, including four scheduling tools

## Exposed tools and consent

| Tool | Scope | Effect |
| --- | --- | --- |
| `get_scheduling_capabilities` | `account:read` | Checks whether scheduling reads are configured; no account data lookup or mutation. |
| `list_social_connections` | `publishing:read` | Lists only the caller's connection labels and health. |
| `list_schedules` | `publishing:read` | Lists only the caller's schedules and safe target delivery state. |
| `get_schedule` | `publishing:read` | Reads one owned schedule by ID. |

`publishing:write` is registered as a future OAuth scope only. No current MCP tool accepts it, and it does not expand a `publishing:read` grant.

## Deliberate exclusions

The candidate cannot connect an account; create, edit, cancel, retry, reschedule, or publish a post; call a provider directly; or return OAuth tokens, provider account IDs, scopes, target settings, scheduler identifiers, or internal metadata. A future write adapter needs its own policy and identity review because some existing web scheduling paths apply verified-email/beta rules that the MCP principal does not currently carry.

## Contract checks

The scheduling adapter's isolated test covers tool discovery, pure capability reads, missing `publishing:read` rejection before data access, owner binding, safe serialization, unavailable configuration, invalid date ranges, and cross-account `NOT_FOUND` handling.

Package validation also requires that source registrations, package tool count, skill count, evaluation cases, local-install metadata, and generated archive all agree. Installed-host OAuth and production read acceptance remain separate from local checks and are not claimed by this candidate.

### 17 October local evidence

- The scheduling contract test passed all 4 cases.
- The complete MCP contract suite passed before the package-only catalogue/documentation changes in this candidate.
- Plugin validation reported 42 packaged files, 15 skills, 83 tools, and the expected pending `review.demo_recording_url` review material.
- Plugin validator tests passed 7/7; deterministic archive/build tests passed 5/5.
- ESLint passed for the adapter, scope/server registration, package validator, and their tests. `git diff --check` passed.

The full repository TypeScript command is currently blocked by four baseline errors in untouched application files: missing `PageProps` in `app/avatars/[avatarId]/page.tsx` and missing static logo imports in `app/oauth/authorize/consent-brand-mark.tsx`, `app/page.tsx`, and `components/marketing/landing-header.tsx`. Those paths have no diff from the candidate base. They should be repaired separately before treating a whole-application TypeScript check as green.
