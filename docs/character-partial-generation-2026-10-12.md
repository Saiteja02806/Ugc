# Character batch partial-generation investigation

The user confirmed the affected request is the two-image character batch at
2026-10-12 16:19:04 UTC (21:49 IST). Its durable input records specify
`gpt_image_2_5`, not Seedream. Both requested candidates were created in the
same atomic batch. There are no Seedream character jobs in the production
database at investigation time.

Candidate 1 (`a27129ab-ebb8-45a2-9dd8-46739ca0cff9`) completed and saved an
owned image. Candidate 2 (`5dba497a-754e-4a11-8ece-60d690c9930c`) failed with
OpenAI's `moderation_blocked` error. Its provider operation is failed with
`retry_allowed=false`. The successful candidate committed one credit; the
failed candidate released its one-credit reservation. The count selector,
batch transaction and independent per-image dispatch did not drop an image.

The actual application defect is failure presentation: the public job contract
did not recognize this image-provider moderation code, so it reported an
unidentified failure and could suggest retrying a terminal rejection. Character
results also lacked an explicit batch count and admitted-model labels, and a
reload hid the failed candidate once both jobs became terminal.

The fix maps the known error code to the safe terminal moderation message,
adds an owner-validated model to character status, labels each result with its
actual model, and displays created/failed/pending counts. A partially failed
batch is recovered visibly from the existing receipt after reload; fully
successful prior batches remain in History. New session explicitly dismisses
the recovered batch. Recovery only checks the original jobs and never submits
another paid generation.

Provider moderation remains authoritative. This fix does not guarantee every
candidate will be accepted, change the prompt/reference behind the user's back,
or bypass the provider's safety check. Review the prompt/reference and request
only one replacement if desired, since the first image already exists. No new
paid generation is needed to verify the historical failure and credit release.

Validation: focused behavioral tests cover the observed mixed batch, safe
moderation mapping and terminal retry policy, actual-model provenance, pending
counts, cross-account isolation, reload recovery and explicit session dismissal.
TypeScript and scoped ESLint pass. Deployment verification is recorded below
when the isolated correction reaches production.
