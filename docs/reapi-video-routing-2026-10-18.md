# ReAPI Seedance 2.5 and WAN 3.0 routing

This supersedes the initial mistaken interpretation of “reapi” as OpenRouter.
ReAPI is https://reapi.ai. New API jobs for `seedance_2_5` and `wan_3_0` freeze
`provider: "reapi"`, including text/image requests and audio/video guidance.
Existing model identifiers and application credit policy remain stable.

| Application model | ReAPI model | Explicit review setting |
| --- | --- | --- |
| Seedance 2.5 | `doubao-seedance-2.5-face` | `content_filter: false`, as requested for Less Restriction |
| WAN 3.0 | `wan3.0-video` | `content_filter: true` |

ReAPI documents Less Restriction as a setting on the same Seedance model,
not an invented `-less-restriction` model ID. Its platform terms still apply.
The adapter never falls back to another provider or review setting on failure.

## Wire contract and admission

Submit `POST https://reapi.ai/api/v1/videos/generations`, Bearer authentication
from worker-only `REAPI_API_KEY`. Poll `GET /api/v1/tasks/{id}` and read
`output.video_urls[0]`. Accept `id` (canonical envelope) or `task_id` (also named
in Seedance prose), rejecting conflicting IDs. Save it immediately before any
poll or download. Never retry a paid POST on network/5xx/malformed acceptance.

The prompt is unchanged, references keep their order within each media type,
and URLs use `image_urls`, `audio_urls`, `video_urls`. These are generation
references, independent from demo footage and soundtrack finishing. Seedance
declares `omni_reference_task_type: "reference"` when references exist; WAN
declares `generation_type: "reference"` to avoid turning images into keyframes.
Use `size` for aspect ratio, explicit duration/resolution and generated audio.
Seedance requests MP4; WAN documents MP4 output.

Application admission retains six distinct references total, at most one audio
and one video, and validates ready ownership and stored duration before billing.
ReAPI-specific limits are enforced without expanding unrelated product limits:

- Seedance output: 4–30 whole seconds, 480p/720p, 9:16/16:9. ReAPI also offers
  1080p, but that is not newly enabled in this release.
- WAN output: 2–30 whole seconds, 480p/720p/1080p, 9:16/16:9.
- Seedance timed inputs: each 2–30 seconds; video at most 200 MB.
- WAN timed inputs: each 1–15 seconds; video retains the stricter 32 MB app cap.
  Reference video plus output must fit within 30 seconds.
- Audio: MP3/WAV, at most 15 MB. Video: MP4/MOV. Existing WAN image ownership
  and 16 MB multimodal image checks remain stricter than the provider maximum.
- Private owned reference URLs are signed by the existing resolver at execution
  time, rather than enqueue time. Canonical inputs remain in fingerprints.

## Persistence and recovery

Operations use `primary-reapi`, the existing atomic reservation and saved ID.
Provider settlement `usage.credits / 1000` is recorded as provider USD cost;
these provider credits are separate from application credits. Existing storage
and MP4 verification run before marking output persisted.

Recovery polls the saved task, refreshes its CDN URL, and downloads without
forwarding the API key to the CDN. HTTPS `cdn.reapi.ai` and the verified live
WAN output host `file.deepytb.com` are admitted as exact hostnames; embedded
credentials, nonstandard ports and redirects are rejected. Completion and
settlement are recorded even if collection fails, without storing untrusted
links. A safe `PROVIDER_OUTPUT_COLLECTION_FAILED` error preserves the actual
collection stage through retries and customer reporting. Credentials, signed reference URLs
and raw provider errors are not written into diagnostics.

HTTP 402 is classified as provider credits, 80006 as terminal moderation,
429 as a known transient rejection, and accepted-task poll errors as recoverable.
Uncertain submissions never create another paid task. Historical jobs retain
their OpenRouter/Runway/Higgsfield adapters, fingerprints and provider IDs.

## Release status and order

18 October follow-up: the underlying integration is deployed. The corrected
output-host/collection-error behavior above is local and not yet deployed.
The corrected adapter successfully downloaded existing WAN task
`task_01a14f1e0128769d801b2ff0513c92c0` using only read requests; no task was
resubmitted or database/billing state changed. The original app job remains
failed after exhausting its attempts. See
`wan-output-collection-fix-2026-10-18.md` for current validation and recovery
requirements. The initial rollout record below is historical.

Implementation and mocked regressions are local; no paid provider submission
or production deployment was performed. A read-only hosted-database query
confirms the current provider constraint excludes `reapi`; migration is required.

The user created Google Secret Manager `reapi-api-key` in project `ugcsaas`,
version 1 enabled. A read-only authenticated `GET /api/v1/balance` succeeded on
18 October 2026 and reported 20,100 credits ($20.10). The secret was read into
memory only, sent only to the official ReAPI endpoint, and never printed or
written to a file. No generation or charge occurred. Terraform secret injection
is prepared; the production worker has not yet been updated to use it.

Validation: targeted `test:reapi-video` passes 95 tests; the existing workflow
video-reference suite passes 153 tests (overlapping coverage). Worker build,
root TypeScript, scoped ESLint, Terraform formatting and validation pass.

1. Apply `20261018071834_allow_reapi_generation_provider.sql` (production ledger
   timestamp assigned on October 18; the former planned filename was renamed).
2. Store a funded ReAPI key in Secret Manager and configure
   `reapi_api_key_secret_id`; Terraform injects only the worker secret and grants
   its service account access. Preserve historical provider keys for recovery.
3. Deploy and verify the compatible AI-generation worker.
4. Deploy web admission. Existing `NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE`
   and `NEXT_PUBLIC_ENABLE_OPENROUTER_WAN` names remain the rollout switches;
   their historical names do not determine the new provider.
5. Verify fresh authorized generation on https://getugcpilot.com, including
   saved provider ID, output and usage. Local mocked HTTP is not live acceptance.

Run `npm run test:reapi-video` for the targeted API/adapter/worker/recovery suite.

## Primary sources checked 18 October 2026

- [Seedance 2.5 model and review settings](https://reapi.ai/docs/seedance-2-5)
- [WAN 3.0 reference schema and duration limits](https://reapi.ai/docs/wan-3-0)
- [Task status, output and settled usage](https://reapi.ai/docs/api/tasks)
- [Error codes](https://reapi.ai/docs/api/errors)
- [Free authenticated balance endpoint](https://reapi.ai/docs/api/balance)
