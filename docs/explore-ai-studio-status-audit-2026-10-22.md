# Explore and AI Studio generation-status audit

Follow-up: the recovery harness and starting-image status gap below are now fixed
locally in separate patches. See `starting-image-recovery-fix-2026-10-22.md` for
validation and the remaining confirmed bottlenecks. The initial evidence below
is retained as the before case.

Read-only application audit. No product source/configuration change, deployment,
account/API request, database change or paid generation. Local mocked transports
and the installed TanStack Query runtime were used to check query behavior.

## Findings and order

### 1. Starting-image status recovery needs a reliability fix first

`components/explore/hook-starting-frame-workspace.tsx:128` creates one query per
readable variation. At line 136, any query error disables periodic refetching;
`retry: false` also prevents retrying the failed read. A transient status error
can therefore leave an accepted pending job without automatic periodic checks.
The request/checkpoint is retained and Check image status remains available.

An isolated execution of these exact query options with the installed runtime
confirmed: successful pending read, one failed 3-second read, then zero remaining
3-second timers. Focus caused no read; reconnect caused one. This is a recovery
gap, not evidence of lost work or a duplicate paid submission.

Recommended first patch: bounded retries/backoff for transient status reads,
paused hidden/offline, with terminal stop and immediate reconciliation on return.
Keep receipt validation, explicit handling of auth/ownership/invalid records and
the exact existing request. Never regenerate to compensate for a failed read.

### 2. An inactive AI Studio panel still enables individual job reads

`components/generation/ai-studio-workspace.tsx:92` mounts both image and video
panels, marking only one active. Both pass the active flag to
`useRecoverableWorkflowJobs` (`ugc-chat-workspace.tsx:336`,
`video-generation-workspace.tsx:484`). In
`lib/jobs/background-job-client.ts:86`, however, that flag gates account
discovery only: `useBackgroundJobs(ids)` receives no enabled flag, and individual
queries are enabled for any authenticated owner/job ID at line 144.

The local hook-options check reproduced disabled discovery alongside enabled
detail queries for a saved job. Thus known pending jobs can continue detail
polling in the inactive mode. Actual transfer depends on saved IDs and status.
This is not a cross-account leak: query keys include owner, and the provider
remounts by owner.

Before changing this, preserve the intended completion behavior: both panels
currently reconcile finished results while mounted. A safe patch must retain
job IDs and recover outputs on reactivation; it must not stop the server job,
clear recovery state or silently change selections. Decide whether a lightweight
shared completion watcher is needed while a panel is inactive.

### 3. Explore discovery and detail queries overlap in purpose

The active list and job detail endpoints both serialize the public job contract.
The current recovery hook polls the list every five seconds when nonempty and
each nonterminal job every five seconds using distinct query keys. List data is
not used to satisfy or refresh the detail cache.

With three pending jobs, the local runtime measured one list plus three detail
reads on mount and on a simulated five-second cycle. Nominally this is 48 reads
per minute while all three stay pending, excluding retries, focus and other
requests. This fixture count is not production traffic or invoice attribution.

This applies to format-scoped Explore recovery. Standalone AI Studio does not
enable format discovery when `exploreFormat` is absent, so do not attribute that
list overhead to every AI Studio visit. The current FormatWorkspace mounts its
ImagePanel/VideoPanel directly; the older WorkflowGenerationBoundary is not an
additional observer to count automatically on that screen.

Recommended later patch: coordinate which query owns current status, using list
snapshots where adequate and detail fallback where needed. Simply seeding data
will not eliminate interval reads while detail queries retain zero stale time
and independent five-second timers. Keep detail recovery for known IDs when the
list fails, is limited, omits the job or loses it at completion. List membership
is not a durable completion record.

### 4. Cached terminal jobs read again on mount and reconnect

Shared detail hooks set `staleTime: 0`. Their interval and focus callbacks stop
for terminal states, but mount and provider-default reconnect still refetch stale
data. With a cached completed job, the local runtime measured one read on mount
and one on reconnect. Same-key simultaneous observers shared one pending read.

This is a lower-priority optimization. Do not make all terminal jobs immutable:
explicit retry/cancellation, output collection, missing media, refreshed URLs
and provider uncertainty must still reconcile. Any cache change needs a precise
definition of a verified finished result, plus explicit invalidation/recovery.

## Existing safeguards to retain

- The installed query observer suppresses interval reads while unfocused and
  pauses offline fetches. A simulated hidden/offline cycle made zero reads.
  There is no `refetchIntervalInBackground` override in these hooks/provider.
- Owner-scoped query keys, provider reset by owner and expected-owner token
  acquisition prevent cache reuse across accounts.
- Active-list discovery retains discovered IDs after they disappear from the
  list, enabling a final individual read and output collection.
- Shared status reads already have cancellation and a 20-second deadline.
- Local draft recovery, cross-device discovery, list discovery, detail status,
  output asset verification and billing refresh have distinct purposes. Similar
  timing does not make them equivalent or safe to delete.
- Archived generation discovery is initial/explicit GET recovery, not a timer
  loop. Preserve its receipt and idempotency semantics.

## Local evidence and limits

Ignored reproducible probe: `.tmp/explore-status-audit/audit.cjs`.
It executes the actual shared hook options and starting-image query options with
the installed QueryClient/QueryObserver, an injected timer provider, fake auth,
fake jobs and synthetic focus/online events. Receipt:
`.tmp/explore-status-audit/receipt.json`.

Existing recovery tests: 39 attempted, 16 passed, 23 failed. All 23 failures
reported `Unexpected import: @/worker/src/lib/hook-starting-frame-video` in the
isolated test harness before the relevant video panel could run. The passing
checks include all five read/cancellation/owner tests and eleven slideshow
recovery tests. These failures establish a harness gap; they do not establish
that Hook/Wall recovery works or that it is broken. Repair that harness and rerun
it before implementing a polling change. Full log:
`.tmp/explore-status-audit/recovery-tests.log`.

No production request counts, response bytes, real-device navigation or hosted
account acceptance were measured. After an authorized release, acceptance must
use the real production domain. Do not create paid work just to measure polling.

## Proposed implementation sequence

1. Repair the Hook/Wall recovery harness and establish the existing behavior.
2. Fix transient starting-image status recovery as a separate reliability patch.
3. Define inactive-panel completion expectations, then coordinate its observers.
4. Consolidate active-list/detail reads using the same one-job/multi-job scenario.
5. Consider terminal cache tuning only after the above passes.

Required checks: one job, multiple variations, partial completion, list failure,
job disappearance from the list, delayed media persistence, transient/404/auth
reads, repeated focus/reconnect, inactive-mode return, reload, another tab,
account switch, uncertain provider outcome and retained drafts. Every automatic
recovery test must assert that no generation/retry/cancel mutation was sent.
