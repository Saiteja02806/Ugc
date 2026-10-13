# MCP onboarding candidate — 2026-10-13

This unreleased candidate adds saved business onboarding through MCP for both
existing website modes. It is based on Business Context PR #51 at
`4025d6345f24aca9c6bfe74d5b3e84c0960a9bb7`. Production release, schema application,
write enablement and actual Codex/Claude onboarding acceptance remain pending.
The full application parity goal remains active.

## Behavior and invariants

Five tools read capabilities/current progress, mutate intended setup, recover
an accepted receipt, and discover request history. Website/manual structured/
manual described/mobile IDE sources remain available. New changes require
`brand:write`, the additive schema and
`MCP_BUSINESS_ONBOARDING_WRITES_ENABLED=true`; unset/false denies writes.
Reads do not create jobs or grant application access.

The existing saved mode is authoritative. Complete profile-row hashes and
draft IDs/revisions fence edits; raw accepted intent is recovered before any
new normalization or logo inspection. UUID receipts, state transitions and
queued jobs commit in one transaction. Recovery reads return historical
answers/job IDs; current progress is read separately. A changed UUID payload
fails. History preserves timestamp precision and uses an owner-bound cursor.

Background setup adapts the shared transition function; worker-only attach/
finalize actions remain unavailable to MCP. Submissions must be reopened
before changing their answers; completed setup is rejected as an onboarding
mutation. Existing website completion/goal semantics and exact identity are
retained. Omitted logo key preserves a logo, null removes it, and an owned
key is inspected by the existing storage/image service before attachment.

Legacy submission atomically completes the profile and queues a
`media_analysis` job for the existing authenticated application callback.
That callback prepares Trending only for a matching owned completed profile
version. Queue publication failures leave durable recovery work. Legacy
analysis persistence also fences cancelled/replaced sources and profile edits
made after source acceptance; callback replay preserves later identity edits.
The existing worker type/callback protocol is reused; no worker release is
part of this candidate.

Owner advisory locks precede MCP row locks. `NOWAIT` fails busy when an older
REST writer already holds a row, releasing the owner lock rather than waiting
in the reverse order of the existing website trigger. Independent-session
Linux tests exercise duplicate receipt acceptance, website/MCP stale writes
and that reverse-order collision. Those tests have not run on this machine:
the Docker Linux engine is unavailable. CI is the required evidence.

## Local validation

- Full `npm run test:mcp` passed after adding the write surface. A final added
  background lifecycle case and three callback cases subsequently passed in
  the targeted SDK run; exact-commit Linux full regression remains required.
- 14 canonical SQL onboarding receipt/provider-result cases passed.
- 11 actual SDK read/gate/ownership cases passed.
- 7 actual SDK mutation/recovery cases and 3 preparation callback cases passed.
- 19 existing onboarding database/enrollment cases and 10 existing website
  onboarding schema cases passed.
- Configured Next.js 16.3.8 Turbopack build passed (155 routes), with existing
  public Firebase configuration supplied only to the process. Type/lint passed
  before the final package/lifecycle additions; repeat final check before commit.
- Migration reconciliation guard and 6 parity-tool cases passed.
- 7 plugin validation cases, 5 deterministic ZIP/extracted-helper cases and
  new skill validation passed. Host skill evaluations remain unmeasured.

Initial local dependency junction caused Turbopack's filesystem-boundary
rejection. `npm ci` then exhausted disk space; only that failed task-created
installation was deleted. Identical committed lockfiles were checked and
52643 dependency files materialized with hard links from the existing validated
installation, avoiding further downloads. Source dependencies were not modified.
Our reproducible staging source export and ZIP were removed after the reviewed
stages were built; the exact committed source and staged deployments remain.

## Immutable candidate artifacts

- Service-only migration: `20261013141043_mcp_business_onboarding.sql`.
- Canonical LF SQL SHA-256: `e9018c85b507c6aa777880e1e10eaf4cbda3c7e71d91d1ae7ab1f9d27c71d091`.
- Plugin: 0.1.14, 16 skills, 43 allowlisted files.
- ZIP: 128803 bytes, SHA-256 `c34d7a04315cc85fe613f8923bc897d50bb648e32933f3b27627c5ead4b855c6`.
- Source registration count: 90; the last released native count is 79.
- All 26 previously tracked download files are preserved, as are both
  existing MCP configuration files and both local media transfer helpers.

The callback source requires the new migration before live deployment. Do not
deploy the callback without its service-only function. PR #51's Business Context
migration is a preceding dependency; neither candidate is currently promoted.

## Remaining acceptance and application gaps

Production schema/release requires separate authorization after exact-source
review, Linux checks and protected stage acceptance. The reported PR #51
Vercel access-request screen does not establish health readiness. No deployment
protection bypass or account permission change was made.

Dedicated local logo upload, replacement-object cleanup, screenshots and website
reanalysis remain unfinished. This candidate does not claim advanced generation,
slideshow backend rendering, full Trending/Carousel actions, social publishing,
analytics or Claude Code acceptance. Existing Codex hook/demo/download acceptance
remains separate evidence; this work does not rerender customer media to test MCP.
