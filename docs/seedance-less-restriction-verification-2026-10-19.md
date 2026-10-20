# Seedance 2.5 Less Restriction verification — 19 October 2026

**Later correction:** this report verified provider routing and credentials, but
missed the Explore request admission guard. Hook/Wall requests carrying
`exploreFormat` were blocked before reaching this route. See
[the admission investigation](seedance-explore-admission-fix-2026-10-19.md).
Provider configuration alone does not establish that a user can submit a request.

**Current production configuration: yes, new Seedance requests use the ReAPI
key and request the intended Less Restriction route. Historical failed Hook
requests did not use that route. Successful live Seedance output on the new
route remains unverified.**

## Historical versus current

Read-only production records show the latest failed Seedance Hook job,
`61b3ec72-d214-42fe-b6e6-b3443a46734e`, created 17 October at 17:41:01 IST,
recorded provider `openrouter`. It failed with an image-privacy rejection and
returned no provider task ID. Its adapter reads `OPENROUTER_API_KEY` and sends
model `bytedance/seedance-2.5`. That request did not use `REAPI_API_KEY` or the
current ReAPI model. Other older records use OpenRouter, Runway or Higgsfield.

At this check there are eleven Seedance jobs for the connected owner and none
recorded with provider ReAPI. The last remains the 17 October failure. This is
evidence of historical behavior, not a test of the new route.

## Current production evidence

| Check | Verified result |
| --- | --- |
| Production domain | `www.getugcpilot.com` / `getugcpilot.com` |
| Website deployment | `dpl_94nR5GYobVohbNgBZTNT7jgg7QBf`, READY, production |
| Website commit | `e3a4cbc87432f8605402d91965eb79c164f17b43` |
| Hook start route | `/api/ai-studio/videos/workflow-start` invokes shared video admission |
| New Seedance admission | Saves `provider: reapi`; atomic batch preserves it |
| Worker traffic | 100% to `ugc-ai-generation-worker-release-1323837c` |
| Worker commit | `1323837c57251ba50a58fad0142829e720229469` |
| Immutable worker image | `sha256:ab61992bd8a6bbbb400e7742818f2d11f5ccad682653cd6fdc3f9382d9fccd07` |
| Worker key environment | `REAPI_API_KEY`, Secret Manager `reapi-api-key`, version `1` |
| Key validation | Authenticated read-only balance GET returned HTTP 200; key valid and funded |
| Submission endpoint | `POST https://reapi.ai/api/v1/videos/generations` |
| Model field | `doubao-seedance-2.5-face` |
| Restriction field | `content_filter: false` for Seedance |
| Reference mode | `omni_reference_task_type: reference` when media is attached |

The deployed adapter reads the ReAPI key and sends it as Bearer authentication
to ReAPI. It does not read the OpenRouter or Runway key on that branch. The
worker selects the recorded `reapi` provider before legacy video-reference
routing, so attaching a reference video does not redirect a new request to
Runway. Historical operations retain their original adapter for recovery.

The UI label `Seedance 2.5` and historical feature flag name
`NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE` do not determine the backend provider.
The request admission and operation records do.

## Primary-source research

ReAPI's [current Seedance API reference](https://reapi.ai/docs/seedance-2-5#content_filter)
specifies `doubao-seedance-2.5-face` and uses `content_filter: false` for the
unmoderated channel on the same model. This is the setting this project calls
Less Restriction; no separate `-less-restriction` model ID is required. The
setting requires API-key authentication and a prompt; website sessions cannot
select it. The adapter supplies both. The separate `doubao-seedance-2.5-eco`
variant is not selected here.

The [model page](https://reapi.ai/models/seedance-2-5) also exposes the content
filter field and identifies the standard Seedance model. The
[balance reference](https://reapi.ai/docs/api/balance) documents a read-only,
credit-free key validation endpoint. All provider research used those primary
sources. Configuration verification does not independently certify the
provider's internal implementation or acceptance of any particular input.

## Executed verification and remaining limit

Loaded the exact ReAPI adapter source from the deployed worker commit and
executed it against an offline fetch stub. The test confirmed the endpoint,
Bearer authentication, exact model, false content filter, reference mode,
task polling and credential-free CDN download. No real generation POST was
sent. This tests code behavior, not the provider's live generation service.

Separately validated the actual deployed secret through one authenticated
balance GET. The key stayed in memory and was never printed or saved.
Sanitized receipt: `.tmp/video-quality-audit/seedance-route-verification.json`.

No product change was needed because the requested configuration is already
present in both deployed components. No live video generation, paid retry,
database update, key rotation or deployment was performed. A successful
authorized Seedance run with a saved ReAPI task and playable owned output is
still needed to establish end-to-end production generation success.
