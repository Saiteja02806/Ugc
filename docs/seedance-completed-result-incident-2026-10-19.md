# Seedance completed video rejected during collection — 19 October 2026

The latest Seedance failure is a confirmed application result-collection bug.
The provider successfully generated the video. Its Less Restriction output
uses `reapiflexible.b-cdn.net`, which the deployed collector did not accept.
This investigation does not establish that older failed jobs had this cause.

## Production evidence

- Background job: `a9619070-8517-4d56-b213-d44bab46c141`.
- Created 19 October at 21:10:53 IST; failed at 21:15:22 IST.
- Workflow `exploreFormat: hook`, `model: seedance_2_5`, `provider: reapi`,
  requested 4 seconds, 720p, 9:16, with image and video references.
- One saved provider operation, `primary-reapi`, and one provider task:
  `task_01a154d2b81773e9b0c01d62ddb32fff`.
- Authenticated saved-task GET confirms `status: completed`, model
  `doubao-seedance-2.5-face`, no provider error, one MP4 output, usage 1281
  provider credits. Persisted provider cost is USD 1.281.
- Database operation is `provider_succeeded`, with no persisted output key.
  The app job failed with `PROVIDER_OUTPUT_COLLECTION_FAILED` and internal
  reason `The provider completed the video but its output link was not accepted.`
- Worker logs at 15:44:08Z and 15:44:41Z show collection retries, then final
  failure at 15:45:22Z, all on `ugc-ai-generation-worker-hookfix2-fac61da3`.
  The job exhausted all three attempts. These were collection attempts for
  the same paid task, not three separate video generations.
- Its billing reservation for 16 application credits is `released`.

## Exact cause and why previous fixes did not cover it

The live worker commit `fac61da34608dc3f4414702ab87f3f332bdcc14f` accepts only
`cdn.reapi.ai` and `file.deepytb.com` as provider download hosts. The first
is the documentation example CDN; the second was added after the earlier
WAN incident. This completed Seedance response supplies an HTTPS signed MP4
on a third exact host, `reapiflexible.b-cdn.net`. The app rejected the host
before any download. Repeating the same allowlist check could not recover it.

This is different from the earlier Explore admission guard, which rejected
Seedance before submission, and from historical image-privacy rejections on
the old OpenRouter route. The admission fix did reach production: this new
request reached ReAPI and completed. Prior enablement checks verified menu,
configuration and routing; they did not exercise a real Less Restriction
output link, so they could not establish end-to-end success.

The exact deployed request builder selects `doubao-seedance-2.5-face` and
`content_filter: false`. ReAPI's [Seedance reference](https://reapi.ai/docs/seedance-2-5#content_filter)
documents this as its unmoderated route on the same model, with output in an
isolated bucket. The task's actual model and output confirm the new ReAPI
route. The provider's internal channel is not separately exposed by task GET.

## Reproduction and local correction

Ran the exact deployed adapter source against the existing saved provider
task. It reproduced the output-link rejection, without sending a paid POST.
Then ran the corrected adapter against the same saved task and downloaded
the actual MP4. No API credential is forwarded to CDN storage; redirects
remain disabled and signed URLs are omitted from receipts and logs.

The focused local change adds only `reapiflexible.b-cdn.net` to the exact-host
allowlist. It does not admit `*.b-cdn.net`, lookalike suffixes, HTTP, embedded
credentials, nonstandard ports or arbitrary provider links. Regression tests
cover collection, cost retention and same-task worker recovery; the existing
WAN/retry/provider tests continue to pass (26 total). Worker compilation and
full decoding of the recovered MP4 pass.

Recovered file:
`outputs/seedance-result-incident-2026-10-19/existing-seedance-result.mp4`

- 3,244,762 bytes; H.264 video, AAC audio, 720×1280, 24 fps, 4.064 seconds.
- SHA-256: `b0bcb264e5dca0c9636d880ecb1bd0dda7e1ea75820dc3487a681b11c93a9b1a`.
- This verifies retrieval and decoding, not fidelity to the user's creative
  instructions or suitability of the generated audio.

## Release and original-job recovery status

This is a diagnosis request. The collector correction is local and has not
been deployed or merged. The production job remains failed, and the local
recovered file has not been imported as a production asset. This report must
not be described as completed production repair or customer job recovery.

A production rollout must contain the corrected AI-generation worker.
Original-job recovery must preserve its owner, fingerprint, operation and
task ID, and account for the released app-credit reservation through the
supported billing/job recovery path. Do not mark the row completed by hand
or submit a replacement paid generation. A new deployment alone will not
automatically recover a job that already exhausted its attempts.

Sanitized receipts: `outputs/seedance-result-incident-2026-10-19/`.
No new generation POSTs, database writes, credit changes or production
deployments were performed during this investigation.

## User follow-up: output versus reference

Compared the exact uploaded source asset `67afe1c0-5b74-49b2-8667-c5867e092b35`
with the MP4 returned by the completed provider task. The reference is
947,527 bytes, 3.166667 seconds, 30 fps, video only; returned output is
3,244,762 bytes, 4.064 seconds, 24 fps with AAC audio. Their SHA-256 hashes
differ. The delivered local file is the provider task output, not an accidental
copy of the uploaded reference. A clearly named copy is available as
`outputs/seedance-result-incident-2026-10-19/seedance-2.5-generated-output.mp4`.

Visual inspection at 1.5 seconds shows a very similar scene/person and the
original "Part time job / Coloring Books" captions in both. Thus the requested
caption removal was not fulfilled at that frame. Provider completion/output
provenance does not certify successful face replacement or creative fidelity.
No claim is made that different bytes alone prove a successful transformation.
