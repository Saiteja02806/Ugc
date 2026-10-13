# Combined business MCP release candidate

Branch: `codex/mcp-business-release`. Not released to production.

The isolated business candidates were based on account-settings source
`21866e2287501bf5b13b355a2fa103c0258a8afc`. Read-only deployment inspection
found a newer application release, and `origin/main` now resolves to
`1177258da1d997f31366559c093edd0a48c951da` (merged PR #54). This branch merges
that complete source with logo candidate `7ae3b5255b19b44e800e90f738df835ead842928`,
which includes reviewed Business Context PR #51 and onboarding PR #53.

Both ancestry checks pass. No intentional newer application path was omitted.
The merge preserved all newer Explore, scheduling, clip-draft, caption, character,
landing and worker source. Runtime files merged without conflicts; two
documentation conflicts were resolved by retaining both sets of decisions.
The net worker diff against main is empty. The business candidate does not
introduce a worker rollout or revert the newer application release.

## Candidate surface and schema

Business Context draft/apply and immutable receipts; saved legacy/background
onboarding and durable completion; dedicated logo reservations, local transfer,
verified bytes and shared attachment guard. Plugin 0.1.15 has 16 skills/45 files,
134339-byte ZIP, SHA-256
`204c618dfde1752592b77dfa8f8c6680486c5024698dbbef91db925022b0f0ca`.
Source registers 96 tools; current native discovery remains 79 released tools.

Only three migrations differ from current main:

- 20261013112752: Business Context (SHA-256
  `636a11250215c968c20267e87f508ceeccd7c4822a83961cb5aecc9fb6a283e6`).
- 20261013141043: onboarding (SHA-256
  `e9018c85b507c6aa777880e1e10eaf4cbda3c7e71d91d1ae7ab1f9d27c71d091`).
- 20261013165323: logo reservations/attachment guard (SHA-256
  `0ca7f2eecddd2d63a08a4fa68f4316fbe3f2c2147353239e59f752755c841b63`).

Read-only production history confirms all three are absent. The newer
application's five Explore/character migrations (20261012172333, 20261012212314,
20261012212532, 20261013060000, 20261013143246) are already present. Do not
reapply them. No new schema has been applied or live domain promoted here.

All nine new-write gates must remain explicitly false at build and runtime:
private uploads, audio imports, groups, Library, text remix, account settings,
Business Context, onboarding and business media. Schema/configuration/tool
discovery are separate from enabled writes and intended host acceptance.

## Combined local verification

- Full `test:mcp` passed against reconciled source.
- `test:explore` passed 905 cases on its unmodified repeat. The initial run
  passed 903 but one reference-audio file exited after partial success without
  an assertion trace; its targeted 7 cases then passed, followed by the full
  905-case rerun. No renderer assertion or product behavior was changed.
- Compiled worker suite passed 606 cases.
- Scheduling UI passed 97 cases; scheduling metadata passed 3.
- Business Context passed 20; existing onboarding schema passed 10. Its exact
  image-construction assertion was updated to recognize strict error mode plus
  the new bounded pixel limit and separate metadata call.
- Configured Next.js 16.3.8 build passed all 157 routes with existing public
  Firebase configuration supplied only to the local process.
- Migration guard and plugin validation passed; source plugin/download bytes
  and preceding generic transfer helpers are preserved.

Logo PR #55's corrected exact-source Linux runs 38438458277 and 38438466732
passed all eight independent-session cases and migration guard 38438466907.
An earlier PR run hit Docker's temporary initialization server; the fixture
now waits for the final TCP listener. The combined branch needs its own
exact-source Linux/preview checks. A dedicated CI job exercises the preserved
Explore/worker/scheduling/business contract paths as well as the existing MCP
workflow. Package tests do not establish measured host skill behavior.

## Required before production

Prepare reviewed exact-source website/MCP stages with all nine gates false,
verify bytes/health/isolation through supported existing authentication, and
recheck latest production/main before any promotion. Retain the existing
application deployment holds recorded in CAROUSEL_CONTEXT. Authorization for
the earlier account-settings release does not cover these three new schema
changes or this combined promotion; obtain specific approval only after the
builds and migration bytes are concrete and reviewable.

Full application parity remains active. Dedicated screenshots, reanalysis,
advanced generation integration, full Explore/editor drafts, slideshow text
rendering, Trending/Carousel actions, social publishing/analytics, gated-feature
activation and real Codex/Claude acceptance are still required. No customer
content has been generated/uploaded solely for connectivity in this candidate.

## Linux media setup correction

The new combined Linux job exposed that the npm `ffmpeg-static` Linux 7.0.2
binary lacks `drawtext`, although the Windows binary used for local acceptance
has it. Required-filter diagnostic run 38441110677 proves `drawtext: false`;
the first Linux real text-render tests therefore could not run their filters.
No customer input or application error detail was exposed during diagnosis.

Combined CI now installs the same distribution FFmpeg/font stack selected by
the worker Dockerfile, including the committed Inter alias, and uses the pinned
package's supported `FFMPEG_BIN` override. It checks required filters before
running unchanged rendering assertions. This adjusts the test environment only;
no runtime dependency, worker image, production setting or render behavior was
changed. Fresh exact-source Linux acceptance remains required.

## Portable font identity assertion

At source `7cdaa818`, MCP Linux run 38441457287 and the migration guard passed.
Both combined application runs reached the worker suite after Explore passed.
The worker suite passed 605 of 606 cases; its Avenir font identity check retained
the expected width of 310 pixels, but Linux rasterized height at 37 instead of
Windows' 35. This was an exact pixel-height assertion, not a failed font lookup.

The test now retains the exact advance-width check, compares both dimensions
against the explicitly named Demi-Bold face on the same host, and requires the
serif fallback to have a different width. No renderer, font asset, worker image
or production configuration changes. Fresh Linux results must verify this
comparison; previous application failures remain recorded.

## Exact-source Linux acceptance and latest live reconciliation

Source `92f0eb36` passed both combined Linux runs 38445537488 and 38445532875,
MCP run 38445537517, and migration guard 38445537491. The combined job passed
907 Explore, 606 worker, 97 scheduling UI, 3 scheduling metadata, 20 Business
Context and 10 onboarding schema cases. All five required FFmpeg filters were
present; the portable Avenir identity comparison passed.

A fresh live deployment inspection then found website
`dpl_CUXcYhNf8ykvHiG8pxzVLRxnYsYX` and MCP
`dpl_FfqQgPemMxdXcLvWyNWiiAwarr1W`, both READY at main source
`07a4e516407151d5411f37e05fece468e8dcfdbd` (PR #57). The candidate now merges
that entire reviewed release without conflicts, including the static Talking
Head entry/preview guard, split editor loading, cover cancellation and sidebar
cleanup. Latest-source validation is required again after reconciliation.

Automatic approval review rejected creating production-target stages at the
preceding source: `--prod` remains a production deployment operation even with
`--skip-domain`. No stage was created. Obtain explicit approval for protected
website/MCP stages at the final reviewed source, with nine gates false and no
live alias assignment. Migration/promotion approval remains a separate final
step after actual builds and readiness checks. Ordinary `vercel curl` would
create a new project automation bypass because none exists; no such access
change was performed. The reported browser sign-in used a different account
from the authenticated team-owner CLI (`chundusrisaiteja2003-1629`).
