# MCP business onboarding implementation progress

Development checkout: `C:/Users/chund/.codex/worktrees/mcp-business-onboarding/UGC`.
Branch: `codex/mcp-business-onboarding`, based on reviewed Business Context
candidate `4025d6345f24aca9c6bfe74d5b3e84c0960a9bb7` (PR #51).

## Current review checkpoint (supersedes the initial notes below)

Draft review: https://github.com/Saiteja02806/Ugc/pull/53.
Pushed source: `17824a3a0d185ed4cfe3c47ca1b21e451f199610`, verified against
the remote branch. The isolated checkout is clean. This candidate now adds five
onboarding tools: two reads, gated setup mutation, receipt recovery and history.
Both legacy and background state transitions are implemented locally.

The complete MCP regression passed. The final targeted tests passed 14 SQL
cases, 11 SDK read/gate cases, 7 SDK mutation/recovery cases and 3 preparation
callback cases. Existing onboarding (19) and website contract (10) cases passed.
Configured Next build, final type/lint, migration guard, package validation and
deterministic archive/helper checks passed. The build of the exact pushed
commit also passed with all 155 routes. Linux runs
38433159318 and 38433200738 passed on the exact pushed source, including all
six independent PostgreSQL concurrency cases. Their logs prove duplicate
receipt recovery, competing website/MCP edits and the reverse lock-order
collision behavior. Migration guard run 38433200623 passed. Primary Vercel
preview is pending; the separate Trending preview failed and is excluded from
readiness evidence. No production release or schema application occurred.

Plugin candidate 0.1.14: 16 skills, 43 files, 128803-byte ZIP, SHA-256
`c34d7a04315cc85fe613f8923bc897d50bb648e32933f3b27627c5ead4b855c6`.
Local migration 20261013141043 has canonical SQL SHA-256
`e9018c85b507c6aa777880e1e10eaf4cbda3c7e71d91d1ae7ab1f9d27c71d091`.
All 26 older download artifacts, both MCP configurations and transfer helpers
are preserved. Detailed evidence is committed in the candidate's
`docs/mcp-business-onboarding-candidate-2026-10-13.md`.

No production schema, promotion or write enablement occurred. Dedicated logo
upload, screenshots, website reanalysis and real Codex/Claude acceptance remain
unfinished, alongside the other full-application parity gaps. PR #51's protected
stage still needs an actual health response through the normal owning-account
sign-in; the reported access-request page is not readiness evidence.

Read-only production history was rechecked through the existing connected
Supabase project `kltxwijhluawgveykfbt`: account settings migration
20261013090422 is present; candidate versions 20261013112752 and 20261013141043
are absent. CLI sign-in is not required for this connected access.

The failed partial dependency installation and this task's reproducible source
export/ZIP were removed to recover disk space. Identical locked dependencies
were materialized with hard links and the configured build passed afterward.
Ignored dependency/build/cache/temporary paths were excluded from the push;
all intentional candidate source, migration, package, tests and docs are included.

The full application parity goal remains unfinished. This development work is
separate from PR #51's exact staged release and has not changed production.

## Implemented locally

- `get_business_onboarding_capabilities`: pure configuration/enrollment read.
- `get_business_onboarding`: owner-bound saved website mode, profile completion,
  background draft answers and analysis/finalization job IDs. Legacy accounts
  can recover their latest 20 setup jobs even before a profile exists.
- Shared profile projection used by both the existing website endpoint and MCP.
  Existing completion/version/goals rules remain authoritative.
- Strict intent contracts for all four existing intake payloads and background
  start/identity/goals/submit/edit actions. These contracts are preparation for
  write adapters; they do not expose or implement mutations yet.
- Read outputs omit owners, internal job inputs/outputs and provider/database
  diagnostics. HTTP integration coverage checks all data reads are owner-bound
  and that no mutation, queue publication or provider request occurs.

## Verified

- Ten actual MCP SDK/PostgREST integration cases pass against the complete
  canonical SQL migration history loaded into isolated PGlite.
- Nineteen existing onboarding database/enrollment cases pass.
- TypeScript, targeted lint and source/package inventory validation pass.
- Full MCP regression suite and the configured production build are running;
  record their terminal results before treating this checkpoint as validated.
- The first build attempt rejected the dependency junction outside Turbopack's
  filesystem root. This is a worktree dependency setup issue, not acceptance of
  the application build. Locked dependencies must be installed locally and the
  ordinary build rerun.

These local checks do not establish hosted acceptance, independent-connection
race behavior, full onboarding writes or complete application access.

## Required next implementation

Support both saved legacy profiles/setup jobs and the application's background
draft protocol. Do not enroll a legacy account into a different protocol merely
to make an MCP path easier. Preserve website/manual/mobile input choices, exact
identity, inspected owned logos, saved goals and timezone behavior.

New writes need immutable, owner-bound request UUID receipts and exact revision
fences. Acceptance, durable job creation and receipts must commit atomically;
queue publication runs afterward and existing recovery dispatch handles a lost
publication. Recover a prior raw intent before inspecting newer state. Reusing
a UUID with different intent must fail, including after a later website edit.
Use the existing per-owner onboarding advisory lock before locking profile rows
so a wrapper does not reverse the existing guard's lock order.

Background actions must adapt the shared transition function; worker-only
`attach` and `finalize` must not be callable through MCP. Legacy identity/goals/
completion need the existing version/completion semantics plus atomic receipts,
rather than an unfenced sequence of service-side REST writes. The legacy and
background completion paths also prepare Trending content and can activate
application access/trial state: this is part of the intended onboarding action,
never a read/connectivity test.

Logo upload/removal, screenshots, website reanalysis, mutation history/recovery
and real host acceptance remain required. Existing general job control is not
automatically proof that every onboarding retry is supported. Prove support
against the persisted job type, original input and retry policy.

## Release/access status

PR #51's existing protected MCP stage is
`https://ugc-owfnvc1i4-ugcpilot.vercel.app/mcp/health`. The reported Vercel
"Request Sent" screen proves access is pending; it does not prove the JSON
health response. No protection bypass or team permission change has been made.
The normal account that owns the deployment is different from the account
shown on the access-request page; ordinary sign-in with the owning account is
the pending human check.

The active production source remains the previously verified PR #50 release,
`21866e2287501bf5b13b355a2fa103c0258a8afc`, with 79 discovered native tools.
PR #51 remains a separate 85-tool candidate. This development branch contains
87 registrations after adding the two onboarding reads, and reports onboarding
write tools as unavailable. No new migration or release has been authorized or
applied as part of this onboarding development.
