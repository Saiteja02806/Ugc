# Starting-image status recovery: test repair and separate patch

Local only; no deployment, worker/API mutation, paid generation or migration.

## Patch 1: recovery harness

The existing VM loader could not import the new pure starting-frame video model
helper. It now loads the actual helper instead of replacing it with a stub.
The unchanged recovery assertions then passed: all 39 Hook, Wall, Slideshow and
read/cancellation/account checks. This repairs the 23 harness failures recorded
in the earlier status audit; it changes no application behavior.

Review artifact: `.tmp/starting-image-recovery/01-test-harness.patch`.

## Patch 2: starting-image read recovery

`hook-starting-frame-workspace.tsx` uses the new, small
`lib/explore/hook-starting-image-polling.ts` policy for status reads only:

- Pending jobs check every three seconds. Network failures, timeouts, HTTP
  408/409/429 and 5xx back off to one read every 15 seconds until recovery.
  Successful pending reads return to three seconds; verified terminal jobs stop.
- Cached terminal images do not automatically refetch on remount, focus or
  reconnect. Explicit status checking remains available where the UI offers it.
- Hidden tabs and offline fetches remain guarded by the existing TanStack
  runtime. Focus/reconnect promptly checks nonterminal recoverable work.
- Authentication, permission, missing receipts and malformed/mismatched receipt
  failures stop automatic checks. Check image status remains an explicit GET
  against the same saved receipt/job. No generation is automatically submitted.
- Non-JSON gateway errors retain their HTTP status, so an HTML 502 can recover;
  malformed successful responses cannot bypass receipt validation.
- Owner, draft, source, input, output and model checks remain in the real receipt
  verifier. No prompt, generation admission, provider or worker change.

Review artifact: `.tmp/starting-image-recovery/02-starting-image-recovery.patch`.
These artifacts contain this task's changes against the existing working copy,
excluding unrelated pending changes. Their reverse applicability was checked
with `git apply --reverse --check --ignore-space-change` (Windows line endings).

## Validation

- All 39 repaired baseline recovery checks pass before changing product behavior.
- The combined recovery/UI suite passes all 89 tests, including all six focused
  status-recovery tests and the terminal-remount regression.
- Focused status tests execute the actual component's query options and GET
  reader with the installed QueryClient/QueryObserver and the real receipt
  verifier. Only transport, auth and clock/event inputs are controlled. They
  cover transient failures, hidden/offline return, terminal stop, repeated
  failures, hard errors, explicit recovery, HTML error responses and independent
  results for multiple variations. All transport calls are asserted GET-only.
- Existing UI tests cover durable uncertain receipts, cross-tab revision guards,
  explicit image selection, multiple variations, close during authentication,
  failed admission and preserved photo/model/output binding.
- Scoped lint and application TypeScript pass. The final production webpack
  build passed with all changes, including the terminal-remount guard:
  compilation, TypeScript, all 171 static pages, tracing and decoder postbuild
  checks (exit 0). Log: `.tmp/starting-image-recovery/build-final.log`.

Evidence: `.tmp/starting-image-recovery/{baseline,combined-tests,status-tests,build}.log`.
These are isolated local checks, not physical-device or authenticated production
acceptance. Default Turbopack remains unqualified from previous batches.

## Remaining confirmed bottlenecks

Re-ran the installed-runtime probe after the fix. Receipt:
`.tmp/starting-image-recovery/remaining-bottlenecks.json`.

| Remaining item | Local evidence | Next safe step |
| --- | --- | --- |
| Inactive AI Studio panel polling | Discovery disabled; saved-job detail query still enabled | Define background completion behavior, then coordinate observers and reconcile on reactivation |
| Explore list/detail overlap | Three pending jobs: one list plus three detail reads per five-second cycle | Establish shared status ownership with list seeding and detail fallback; retain final reads when a job leaves the list |
| Terminal cache reads | Cached completion reads once on mount and once on reconnect | Tune only verified final results, preserving retry/output-collection and explicit refresh |

The probe also confirms zero reads during hidden/offline cycles and one shared
request for simultaneous observers of the same query key. Those safeguards
already work and should be preserved. This is not a claim of a bottleneck-free
application or a measured reduction in the production invoice. No additional
runtime failure was found in this patch's tested paths; the remaining status
optimizations above are still pending separate implementation and validation.
