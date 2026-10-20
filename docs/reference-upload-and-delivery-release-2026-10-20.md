# Reference upload and completed-video delivery

## Upload diagnosis and correction

An upload reads local image dimensions, gets the account token, requests an
owned signed storage target, PUTs the original file, and asks the server to
verify storage and mark the asset ready. The old client performed metadata
decoding and authentication serially, and registered image/video load handlers
after assigning `src`. An immediate event could therefore leave preparation
waiting. The corrected client runs decoding/authentication together, installs
handlers first, and bounds waits with actionable errors.

Explore now shows Preparing, Uploading with transferred-byte percentage, and
Saving. Batches still run two at a time and preserve the selected main photo and
supporting-photo order. All original image bytes are preserved. No thumbnail
generation or hashing was found in this upload path; those were not the cause.
No historical upload timing trace was available to prove which phase consumed
the user's reported minute. Network speed and original file sizes still affect
the transfer; the new phases make that distinguishable from preparation/saving.

## Model limits

| Selected model / connected route | Image capacity |
| --- | ---: |
| Seedance 2.5 / ReAPI | 30 |
| WAN 3.0 / ReAPI reference mode | 10 |
| Omni Flash 1.1 / Google | 10 supported by the application |
| Kling 3.0 / Runway | 2 first/last keyframes |

Sources: [ReAPI Seedance](https://reapi.ai/docs/seedance-2-5),
[ReAPI WAN](https://reapi.ai/docs/wan-3-0),
[Runway inputs](https://docs.dev.runwayml.com/assets/inputs/),
[Google Omni 1.1 specifications](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/omni-1-1-flash).
Google's numeric limit is published for the Enterprise preview model family;
our direct stable route does not publish a separate numeric maximum. Ten is
therefore a documented family-based supported cap, not a claim of paid direct
route testing. Source video/audio do not consume image slots. API prebilling
validation and worker input checks use the same capacity; no silent truncation.

## Completed Seedance evidence

Read-only collection of task `task_01a1596a5eb3749d8606a7384e159cd2`, associated
with app job `cc899a93-7ad1-44a6-82f9-943399d7982c`, succeeded using the corrected
adapter. The provider returned a completed output on `reapiflexible.b-cdn.net`.
The downloaded MP4 is 2,880,386 bytes; SHA-256
`a3d59938889727ad7f457a2d74d1d26a8d6c11946220d14b07d85806f39b9302`.
The collection made one provider GET and one public-CDN GET, no generation POST
and no database write. The file is shown in chat from
`outputs/seedance-result-incident-2026-10-19/latest-seedance-2.5-generated-output.mp4`.
Successful retrieval is not creative/facial-fidelity acceptance.

The first staged worker did not start because the PowerShell deployment command
combined the runtime commit and version into one value. The baked source guard
correctly refused it; old traffic continued. Correctly quote the whole
`--update-env-vars` value on the replacement revision and verify `/version`.

## Release boundary

The user approved deployment of all current changes but explicitly deferred the
Supabase recovery migration. Keep its feature gate off; do not modify its billing
trigger or requeue exhausted historical jobs. New-job collection and a locally
viewable recovered file can be verified independently of that database change.
Readiness, production source identities and live checks are recorded after
rollout, separately from compilation and mocked tests.
