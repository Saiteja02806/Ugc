# Seedance Explore admission investigation — 19 October 2026

The reported message comes from a stale application allowlist. The workflow UI
offers Seedance 2.5, but shared admission rejected every Seedance request with
`exploreFormat: hook` or `wall_text` before reserving credits or creating a job.
This exact HTTP 400 was reproduced by a test of the real handler before the fix.
The same guard exists in the website source deployed during this investigation.

## Production evidence

Read at approximately 16:03 IST on 19 October:

- Production website: `getugcpilot.com`, deployment
  `dpl_G2uE1WvQf12MK8MmgR2b7WFZ4vEG`, READY, commit
  `d2f698a74cf63a255f3fbdf512ae1af2ab7a47be`. Its admission source excludes
  Seedance from the Explore format allowlist.
- AI worker: `ugc-ai-generation-worker-hookaudio-0df6a7d3`, ready with 100%
  traffic, commit `0df6a7d39ae043eff0a9da0be9c0a61a0bf4c8fe`, immutable image
  `sha256:54d28565616dc8391c1e02cc179f9d3c81f306b8aa981039a6370b4a162d51e5`.
- `REAPI_API_KEY` references enabled Secret Manager `reapi-api-key`, version 1.
  An authenticated read-only `GET https://reapi.ai/api/v1/balance` returned
  HTTP 200 and a positive balance. Credentials stayed in memory; no key or balance
  amount was printed or persisted.
- The exact adapter from that worker commit was executed with an offline fetch
  stub. It sends `doubao-seedance-2.5-face`, Bearer authentication,
  `content_filter: false`, `omni_reference_task_type: reference`, and all selected
  image/video/audio URLs. Submission ID, polling, completion and credential-free
  CDN collection passed. No real provider generation request was made.
- Read-only database aggregates found no accepted Seedance jobs on 19 October.
  The latest recorded Seedance submission remains 17 October, on the older route.
  An app-side validation rejection does not create a failed background job.
- The screenshot's individual request ID is unavailable. Vercel did not retain
  the older request window; a recent-window search returned no matching log.
  The diagnosis is based on the exact error source, production source and failing
  real-handler reproduction, not an invented per-request provider log.

## Local correction

Admit Seedance consistently in three related guards: Explore model selection,
registered gallery-video inputs, and owned audio references. Gallery media uses
the model's 2–30-second reference range; output remains the user's selected
4–30-second duration. The gallery resolver accepts an explicit 30-second cap.
Its existing registration, format verification and bounded download remain.

The fix preserves ReAPI provider identity and all reference metadata through
ordinary admission and Explore's atomic batch callback. It does not set Omni edit
mode, shorten inputs, alter model availability, change ownership/auth checks,
skip MIME/size validation, or change credit/idempotency behavior. Talking Head
requests without `exploreFormat` did not trigger this particular stale guard.

The previous test explicitly asserted Explore Seedance was unsupported. That
assertion now checks Kling, which the format UI does not offer. Added real-handler
coverage includes prompt-only, image, uploaded video, audio and gallery inputs
for Hook/Wall in ordinary/atomic admission; preserved settings/provider; 2/30s
gallery boundaries; invalid durations; and disabled rollout before billing.
Component submission tests cover Seedance gallery/audio without Omni edit mode;
the actual gallery resolver verifies the 30-second boundary.

Earlier routing/credential research was incomplete as acceptance evidence: UI
tests mocked successful submission, while Seedance API tests omitted the actual
Explore format field. Neither exercised this incompatible boundary.

## Verification and status

The final combined API/client/component run passed 113 tests; the ReAPI adapter
and real worker routing/recovery suites passed 15 tests. TypeScript checking,
lint on all five changed code/test files, and whitespace checks passed. The
exact deployed adapter also passed its isolated offline transport test.
Final check receipts are saved
under `.tmp/seedance-admission-audit-20261019/`, including sanitized production
configuration and the exact deployed-adapter offline test.

This fix is local, not deployed. No paid generation, retry, database mutation,
provider switch, credential rotation or production deployment was performed.
A successful authorized Seedance generation with a saved ReAPI task and playable
owned output remains necessary to establish live end-to-end success.

Provider references:
[Seedance 2.5](https://reapi.ai/docs/seedance-2-5),
[credit-free balance check](https://reapi.ai/docs/api/balance).
