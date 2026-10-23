# Trending and Audio polling optimization

Ready for local review. No deployment, production mutation or paid generation.

## Changes

- Both the active Trending Reaction card and its text editor use the existing
  foreground-polling helper. Initial
  and subsequent timer reads wait while hidden/offline. Return triggers one
  status read, with no overlapping poll and no missed-interval catch-up.
- Reaction polls every 2.5 seconds after a successful preparation read. Repeated
  failures back off through 5, 10 and 20 seconds. A terminal result removes its
  timer/listeners; an explicit save restarts status recovery. Preparing/ready
  state changes no longer restart the effect and duplicate reads. Draft text is
  initialized once per creative/assignment and survives status updates.
- Audio history uses the same lifecycle instead of a 1.6-second interval. It
  pauses offline as well as hidden and immediately checks on return. Its next
  successful poll waits 1.6 seconds after the previous response; read failures
  back off through 3.2, 6.4, 12.8 and 25.6 seconds.
- Polling waits for the initial saved-receipt lookup to settle. That lookup is
  cancellable and bounded by the existing 20-second read deadline; failure
  releases the gate so foreground recovery can continue. An absent saved
  receipt slows subsequent reads to 30 seconds; return still checks immediately.
- An uncertain receipt remains protected from automatic resubmission. If other
  jobs are active, polling reads general history so those jobs can complete too.
- Audio still reconciles the exact saved request key and selects completed
  output. An unresolved saved receipt can recover even if no job id was
  acknowledged. Explicitly uncertain receipts remain blocked. Key-scoped history
  merges preserve other pending jobs and the catalogue's original freshness.
- Unmount aborts status reads; late results cannot update the departed session.
  Reaction also checks cancellation after waiting for auth and before fetching.
- Backoff is opt-in through `maxErrorIntervalMs`; existing foreground-polling
  consumers retain their prior retry cadence. Initial catalogue/restoration and
  user-triggered mutation/reconciliation paths remain separate from timers.

Generation/save submission, playback, worker execution, credits and persistence
contracts are unchanged. This batch concerns both Reaction preparation
loops and Audio history; it does not consolidate all generation-status observers.

## Validation

- Thirteen focused tests execute the actual component polling effects and shared
  helper with deterministic visibility, online events, timers and transport.
  They cover 30-minute hidden/offline periods, return, no overlap, bounded
  backoff/reset, terminal stop, pending unmount, saved-key recovery, cache
  freshness and the unresolved/uncertain receipt distinction.
- The real Reaction component's save callback is exercised with a lost save
  response: one PATCH, durable revision recovery, exact draft retention, resumed
  status checks and no replay on return.
- Twenty helper, Audio cache/auth/client and Reaction contract tests pass.
- Sixty-eight existing finishing and pending-schedule regressions pass with the
  changed shared helper, including receipt recovery without new mutations.
- Application TypeScript and scoped ESLint pass. The production webpack build
  passed, including static-page generation and native decoder bundle checks.
  The final incremental run against all completed source changes also passed:
  compilation, TypeScript, all 171 static pages, build tracing and postbuild.
  Log: `.tmp/trending-audio-polling/build-final.log`.
- A broader existing Trending source test has three passing assertions and one
  failure: it expects `getTrendingPreparationCopy(useContext(...))` in one
  expression, whereas existing source uses an intermediate `preparationState`.
  The same assertion fails against HEAD. That preparation-copy section and its
  assertion were not changed in this batch.

These are local effect/component tests with isolated transports, not hosted
account acceptance or measured production invoice savings. No layout was changed.
Production acceptance after a separately authorized release must use the real
production domain and existing pending work, without submitting paid work merely
to test polling. Default Turbopack remains unqualified from the previous batch.

## Build environment

The first build ran out of disk space. Removed generated caches only, after
checking resolved paths under this workspace: `.next/cache` and `.next/cache`
inside `.tmp/explore-release-20261015/source-final`,
`.tmp/explore-release-20261015/source`, `.tmp/release-2026-10-12/checkout`,
`.tmp/multi-output-build-workspace`, `.tmp/subtitle-position-20261007`.
About 7 GB was recovered. Source, media and release artifacts were retained.
Initial successful build log: `.tmp/trending-audio-polling/build.log`.

## Follow-up correctness review

The user-requested review reproduced three gaps before correction:

1. Slow initial Audio recovery could overlap timer polling because the restored
   flag was set before awaiting the initial history lookup.
2. Saved receipts absent from history were retried every 1.6 seconds indefinitely.
3. An uncertain saved receipt could keep history reads scoped to that receipt,
   preventing other active jobs from being reconciled.

New regression tests failed for all three before the fixes; they now pass.
An additional restoration test verifies that a failed initial lookup unlocks
recovery and that an unmounted lookup cannot mark a later session restored.
The shared helper accepts a dynamic success interval for the absent-receipt case;
all existing callers with numeric intervals retain their previous behavior.

Review validation: 13 focused tests plus 88 cache/client/finishing/scheduling
regressions pass (101 total). Scoped lint and application TypeScript pass. The
review production webpack build passed compilation, TypeScript, prerendering,
tracing and native decoder postbuild checks (exit 0). Evidence is recorded in
`.tmp/trending-audio-polling-review/build.log` and `tests.log`; the three failing
before-fix regressions are in `.tmp/trending-audio-polling/review-before.log`.
No production deployment or hosted acceptance.
