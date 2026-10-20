# WAN completed-output collection correction

The provider completed WAN job `56b8b792-b13f-448d-9fed-8e14b4cf9c52`, but
UGC Pilot rejected its `file.deepytb.com` output link and exhausted recovery
attempts. The video was not lost at prompt submission or rendering.

## Changes

- The ReAPI adapter accepts the two exact output hosts `cdn.reapi.ai` and
  `file.deepytb.com`. HTTPS, no embedded credentials, no nonstandard port and
  no redirects remain mandatory. API authorization is sent only to ReAPI.
- Provider completion and usage are checkpointed before collection. Untrusted
  URLs are never persisted or fetched. A later attempt reads the same task
  for a fresh link, including after a failed download.
- Missing output, a rejected link and download failure carry a distinct safe
  collection error through the generic retry wrapper. Website and MCP status
  explain that the provider finished and that the existing video needs recovery.
  Historical `provider_operation_pending` failures also have a useful safe
  message; exhausted jobs do not advertise an available user retry.
- No prompt, model, moderation, duration, credit policy or sound setting changed.

## Verification

`npm run test:reapi-video` passes, including regression coverage for the live
host, spoofed hosts, private URLs, missing results, failed downloads, preserved
settlement and same-task recovery without duplicate submission. The worker
compiles. All 12 MCP-operation tests and scoped ESLint pass.

The built corrected adapter was also run against the existing production
task `task_01a14f1e0128769d801b2ff0513c92c0`. It made exactly two read requests:
one saved-task GET and one CDN GET. There were no POSTs, database writes or
new generations. It returned a valid 4,000,226-byte MP4, byte-for-byte identical
to the video retrieved during the audit, retaining the task's reported usage.
The sanitized receipt is `.tmp/video-quality-audit/fixed-adapter-verification.json`.

Full app `npx tsc --noEmit` currently fails outside these changes at
`components/media/image-library-browser.tsx:85`: a readonly string array is
passed to mutable array state. The library file was not modified by this fix.

## Production and original-job recovery

This is a local correction. The deployed worker, website/MCP status and the
failed original database job have not been changed by this work.

Deploy the corrected AI-generation worker before recovering the job; deploy
the website/MCP changes to expose the improved error messages. The original
job has exhausted its three attempts, so ordinary customer retry is unavailable.
Controlled operator recovery must retain its original owner, input fingerprint,
provider `reapi`, operation `primary-reapi` and exact saved provider task ID.
Check the original credit-reservation state and use the application's atomic
billing/job recovery path; do not directly mark the database job completed or
create a replacement generation. A failed job may have released its original
application credit reservation, independently of the paid provider task.

After recovery, verify the same task ID, persisted output and usage, ready owned
media asset and completed website job on the production domain. The read-only
adapter check above does not establish those deployed database/UI conditions.

The [provider task reference](https://reapi.ai/docs/api/tasks) documents saved
task polling and output collection; the additional hostname is supported by
the actual authenticated production response and successful download, rather
than inferred from the documentation's example hostname.
