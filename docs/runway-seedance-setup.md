# Runway Seedance 2.5 video generation

The Videos screen defaults to **Runway · Seedance 2.5** (`seedance_2_5` in the
application, `seedance2_5` in Runway). Google Omni Flash 1.1 remains on the
existing Gemini route, with its existing settings and reference restrictions.

Seedance runs in the AI generation worker using `RUNWAYML_API_SECRET`.
The secret stays server-side: local `.env.local` and Google Secret Manager's
`runwayml-api-secret`. The Vercel app dispatches jobs; it does not call Runway
from the browser. The Runway SDK is pinned to 4.20.1 in both lockfiles.

## Inputs and output settings

- Prompt-only: Runway text-to-video.
- One image without audio: image-to-video, with the image as the first frame.
- Multiple images or audio: text-to-video with `references` / `referenceAudio`.
- A video with optional images/audio: video-to-video, `mode: reference`.

The last route produces a new video conditioned on the uploaded clip and honors
the chosen output duration, aspect ratio and quality. It is not Runway's in-place
`edit` mode, which requires `duration: auto` and forbids `ratio`.
The screen keeps its existing 4–30 second Seedance choices and 480p/720p quality
choices. It does not add 1080p or other models. Portrait ratios are `480:854` /
`720:1280`; landscape ratios are `854:480` / `1280:720`.

The app still permits 30 combined reference files, including one video, but
Runway accepts at most 10 audio references. Verified audio plus video durations
must total less than 30 seconds. Audio ownership and ready-state checks run
before application credits are reserved. Input videos must meet Runway's 480p
minimum. Upload sourcing and storage are unchanged.

## Spending guard and durable recovery

The user approved **5,000 Runway credits per UTC day** on 2026-10-01.
Set `RUNWAY_DAILY_CREDIT_LIMIT=5000` in the AI worker and local environment;
Terraform's AI worker variable/default/example match this setting.
Seedance costs 20/30 credits per output second at 480p/720p, plus 10/15 credits
per input video second (rounded up), with an 80-credit generation minimum.
The default five-second 720p output is 150 credits before video-input charges.

The existing daily usage guard is a pre-submission check, not an atomic spending
reservation: concurrent submissions or delayed provider usage reporting can
overshoot it. No autobilling or provider account settings are changed.
Application subscription credit pricing is also unchanged.

Provider request IDs are persisted before polling. Accepted requests resume
without a new generation or budget check; saved output URLs can be downloaded
again. Budget failures are marked as known non-submissions, and uncertain
acceptance never triggers an automatic second paid request.

No new Higgsfield requests can be submitted. Its SDK and billable example were
removed. A GET-only compatibility adapter and the historical database provider
value remain so older paid requests/results are not lost or billed twice.
Retain the legacy Secret Manager credential until the rollout and any older
requests are conclusively finished; do not delete historical provider rows or
rewrite applied migrations.

## Video failure presentation

The visible model selector reads `Seedance 2.5`; its model value and Runway
provider routing remain unchanged. Google Omni keeps its existing label and
behavior.

Video failures use a readable panel with a title, the public failure reason,
and grouped recovery actions instead of a small status badge separated from
the composer buttons. An empty failed session does not also say `No generations
yet`; successful results in a partial batch remain visible below the panel.

`Edit prompt` focuses the existing composer without clearing its prompt or
reference media. `Dismiss` uses the existing finished-job dismissal. Retry is
shown only for the displayed failed job when its public error is retryable and
generation access permits it; moderation failures do not offer a replay button.
All recovery actions are non-submit buttons. The composer retains Generate,
active-job Cancel and the existing access controls.

The image workspace does not opt into this failure panel and retains its
existing behavior. Reasons and job IDs wrap at narrow widths. The dev-only
`/e2e/video-failure-preview` fixture never submits jobs and returns 404 in a
production build. `npm run test:ai-edit` covers rendering and integration
contracts without paid provider calls.

## Verification and deployment

Terminal provider failures retain a structured job error code. Safety failures
use `PROVIDER_CONTENT_MODERATION`; other terminal failures use
`provider_operation_failed`. The provider operation and background job retain
the same category, and neither is replayed as a new paid generation.
The public job contract shows an allowlisted explanation, not raw diagnostics,
request identifiers, secrets or speculative claims about a triggering input.
It also recognizes known historical Runway `JOB_FAILED` signatures without
rewriting database rows. The existing Wall privacy boundary is unchanged.
The moderation message identifies the category without guessing which input
triggered it. An unavailable moderation service is not classified as a rejection.
Other failures retain their known timeout/upload/queue reasons; unknown reasons
are identified honestly and retry advice follows the actual retry eligibility.
This error-reporting change does not alter prompts, references, model routing,
moderation settings, generation, credit settlement or subscription pricing.

`npm --prefix worker run test:seedance` covers request construction, paid-request
containment, legacy recovery and provider routing without paid API calls.
Deploy Git source, check migrations (no new provider/schema migration required),
deploy Vercel, then build/deploy the AI worker and verify production.
Explore, Carousel, Wall of Text and social publishing behavior are outside this
change. Do not release the deferred Explore work from the original checkout.

Official sources: [Runway models](https://docs.dev.runwayml.com/guides/models/),
[API reference](https://docs.dev.runwayml.com/api/),
[inputs](https://docs.dev.runwayml.com/assets/inputs/),
[pricing](https://docs.dev.runwayml.com/guides/pricing/).
