# Explore slideshow provider-credit failure — October 16, 2026

## Production finding

The reported Marketing-reference slideshow requests reached the image worker
and selected OpenAI Flare. Both jobs in batch
`b7973e0f-a6f9-4d44-a00d-4146c6274f95` failed after three rejected submissions.
The newer batch `44f34f05-1db6-47f2-9afd-3271a9ba6593` had the same outcome.
The first attempt began at 12:26 IST; the newer attempt began at 12:29 IST.

Each durable provider-operation record contains OpenAI error code
`credit_balance_exhausted` and the diagnostic:

> 429 You have no credits remaining. Add credits to continue using the API

All four provider operations are failed with no accepted operation ID. This is
a billing rejection from the OpenAI API account used by the backend, separate
from the customer's UGC Pilot credit balance. It is not evidence of invalid
references, prompt-policy failure, missing worker capacity or failed rendering.
The API key's provider account/project needs available credit to use this model.
Changing ChatGPT subscription settings is not a backend API-credit repair.

A read-only check of all four jobs and their idempotency-matched billing
reservations confirmed **four released reservations of one app credit each**.
The newer reservations initially had null background-job links while queued;
looking them up only through `background_job_id` would have missed them. Their
links and release states were present after terminal settlement.

## Why the UI reported an unknown cause

The submission classifier treated every HTTP 429 as transient, including this
explicit billing rejection. It persisted the private provider diagnostic, but
threw a generic retryable `provider_submission_rejected` error. After three
attempts, the job retained only that generic public-facing reason. The public
error mapper did not explain this code and displayed the screenshot's fallback.

## Local repair

- A small shared classifier recognizes explicit provider balance/quota billing
  codes and the observed exhausted-credit response before generic 429 handling.
- The provider-operation record becomes non-retryable, and the worker receives
  the structured terminal code `PROVIDER_INSUFFICIENT_CREDITS`. It follows the
  existing terminal settlement and delivery-deletion path instead of requeuing.
- Image-job public errors describe insufficient **image provider** credits.
  Known raw billing codes and historical recognizable messages are also safe
  and non-retryable. Raw request IDs and provider diagnostics remain private.
- Genuine rate limits still retry. Ambiguous submissions still stop rather
  than risking a duplicate paid submission. Prompt construction, model choice,
  reference ordering, generation fingerprints and customer billing amounts
  are unchanged.

No production job, reservation, API key, provider balance or model selection was
modified. The fix is local; web and worker deployment are required. Existing
jobs that already lost their specific cause cannot be inferred from their
generic public error alone; their private operation records remain the evidence.

## Verification

Targeted API/public-contract/retry tests, worker submission/processor tests and
image-provider boundary regressions cover billing failure, transient 429,
uncertain acceptance, safe errors, delivery deletion, ownership and input
preservation. Worker compilation, full app TypeScript and scoped lint are run
separately. No paid generation or retry was triggered by the investigation.

Recovery with the same model requires funding the correct OpenAI API billing
account/project and then an explicitly requested fresh generation. A different
provider/model is an alternative only if the user chooses it; this task does
not switch models or buy credits automatically. Real output acceptance remains
pending that external billing repair.
