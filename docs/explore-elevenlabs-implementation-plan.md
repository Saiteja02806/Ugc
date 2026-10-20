# ElevenLabs for Explore: implementation plan

Prepared 1 October 2026; access policy updated 3 October 2026. The separate Audio generation screen and durable audio backend are implemented locally. New audio creation now requires active UGC Pilot Starter/Growth access; UGC Free users can browse voices and listen to samples. The earlier Free testing proposal below refers to the application's ElevenLabs provider tier, not free UGC user generation. Account access, actual provider allowances and a production generation have not been verified. The setup and implemented scope are recorded in [ElevenLabs audio setup](./elevenlabs-audio-setup.md); later video/audio integration stages below remain planned.

## Recommended outcome

Start with ElevenLabs Free for invited, noncommercial testing, then upgrade the same account to Starter. Speech is a separate, durable capability within UGC Pilot's existing Next.js, Firebase, Supabase, GCP Cloud Tasks and Cloud Run architecture. The initial screen includes preset speech, private uploads, saved output and live playback, with private cloning gated by live Starter capabilities. Video attachment and sound effects are later stages, with separate generation and pricing rules.

Implementation decision: audio uses a dedicated **private Supabase Storage bucket** behind authenticated application APIs. Existing GCS image/video storage stays as it is. This supplies a verified private boundary without changing public media permissions. Actual configuration names and deployment bindings supersede the proposed examples below and are listed in the setup guide.

Here, “live audio” means generating a written script and playing the audio as it arrives. Microphone conversations and voice agents would require a separate interaction design.

Preset speech is a moderate integration. Reliable storage, billing and ownership are the main work. Instant cloning adds quota and privacy requirements. Matching a speaking person's lips to the generated recording requires an audio-driven video provider or a separate lip-sync stage; speech generation alone does not provide that.

## What the current application already has

The Hook UI has separate “Use as voice reference” and “Use exact recording” choices. They currently use local files and browser previews; they are not durable uploads or completed generation features. Create Hook remains a local preview in the workflow catalogue. The existing video API and worker do not accept an audio asset.

The application already has authenticated uploads, background job persistence, credit reservation, provider-operation recovery and video rendering. Reuse those patterns. Firebase UID is the ownership identity. Supabase holds application data; GCS holds media. Cloud Tasks dispatches Cloud Run workers. There is no need to introduce another job platform for this feature.

Relevant existing files:

- [Hook preview](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/hook-workflow-preview.tsx) and [composer](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/hook-workflow-composer.tsx).
- [Workflow availability](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/workflows.ts).
- [Reference upload pattern](C:/Users/chund/OneDrive/Desktop/UGC/lib/ai-studio/reference-media-upload.ts).
- [Video request validation and billing](C:/Users/chund/OneDrive/Desktop/UGC/lib/ai-studio/video-generation-api.ts) and [video worker](C:/Users/chund/OneDrive/Desktop/UGC/worker/src/jobs/generate-hook-video.ts).
- [Background jobs](C:/Users/chund/OneDrive/Desktop/UGC/lib/jobs/background-jobs.ts), [queue configuration](C:/Users/chund/OneDrive/Desktop/UGC/lib/queues/config.ts), [worker types](C:/Users/chund/OneDrive/Desktop/UGC/worker/src/types.ts) and [dispatch](C:/Users/chund/OneDrive/Desktop/UGC/worker/src/processor.ts).
- [Storage contract](C:/Users/chund/OneDrive/Desktop/UGC/lib/storage/types.ts) and [GCS implementation](C:/Users/chund/OneDrive/Desktop/UGC/lib/storage/gcs.ts).
- [Render engine](C:/Users/chund/OneDrive/Desktop/UGC/worker/src/lib/render-engine.ts). Existing Trending music composition has its own volume and fit rules; narration needs an explicit separate render contract.

The current media collection type supports influencer, image and video. The initial audio feature should use dedicated audio records and upload endpoints, sharing lower-level storage helpers. Adding audio to every generic image/video collection, filter and browser is unnecessary for this first release.

## 1. Establish account access and a working baseline

Use an application-owned ElevenLabs workspace. Activate Starter monthly for the pilot. Current Creative pricing is $6/month before taxes; annual billing is $60/year. Starter includes instant cloning, while professional cloning requires a higher tier. The Creative and API pricing pages present allowances differently, so do not promise a character allowance from the Creative credit number alone. Confirm the actual account's API allowance and billing configuration before setting product limits. Sources: [Creative pricing](https://elevenlabs.io/pricing), [API pricing](https://elevenlabs.io/pricing/api).

Required setup:

- A restricted server API key with voice/model read and TTS permissions. Keep clone/create/delete permissions on a separate restricted key where practical. Use server secrets for the web backend and worker; never a public environment variable or browser-held key. Follow [API authentication](https://elevenlabs.io/docs/api-reference/authentication).
- Read `GET /v1/user/subscription` for active status, usage, allowance, voice slots, clone capability and operation limits. Treat example responses in documentation as examples, not Starter entitlements. Read `GET /v1/models` for currently supported TTS models. Source: [subscription endpoint](https://elevenlabs.io/docs/api-reference/user/subscription/get).
- A private GCS bucket or verified private storage boundary, upload CORS, object read/write access for the appropriate service identities, and authenticated playback or expiring read URLs. A folder name inside a publicly readable bucket does not make a reference recording private.
- Proposed server configuration: `ELEVENLABS_API_KEY`, optional separate voice-management key, `ELEVENLABS_TTS_MODEL_ID`, `EXPLORE_AUDIO_ENABLED`, `EXPLORE_VOICE_CLONING_ENABLED`, `EXPLORE_AUDIO_STREAMING_ENABLED` and private audio bucket settings. Validate names and deployment bindings during implementation.
- Application limits for characters per request, per-user generation allowance, global monthly spend and concurrent requests. Begin with one provider call at a time. Disable automatic account top-ups during the pilot unless a specific budget is approved.
- Consent wording for uploading/cloning a voice, deletion behavior, and access to eligible commercial-use voices/models. Paid-plan licensing does not grant rights to someone else's voice or uploaded material. Source: [commercial-use guidance](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform).

Before editing application code, record the complete current Git status and existing validation failures. Preserve intentional local work. Follow the repository's installed Next.js 16.3.7 documentation and existing authentication conventions. This plan does not require an authentication migration.

Completion check: an authenticated server can read subscription, models and voices; no key appears in the browser; actual account limits and the pilot cap are documented.

## 2. Obtain voices and build the catalogue

A voice is the speaker identity (`voice_id`). A model is the speech engine (`model_id`). They are separate selections, and not every model/voice combination should be offered without checking compatibility.

Use these provider operations from the server:

| Purpose | ElevenLabs API |
| --- | --- |
| List voices already accessible to our workspace | `GET /v2/voices`, following pagination |
| Discover community voices by language, accent or use case | `GET /v1/shared-voices` |
| Add an approved community voice to the workspace collection | `POST /v1/voices/add/{public_user_id}/{voice_id}` |
| Create an instant clone from authorized recordings | `POST /v1/voices/add`, multipart audio files |
| Generate speech | `POST /v1/text-to-speech/{voice_id}/stream` |

Sources: [list voices](https://elevenlabs.io/docs/api-reference/voices/search), [library discovery](https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared), [add a library voice](https://elevenlabs.io/docs/api-reference/voices/voice-library/share), [instant clone API](https://elevenlabs.io/docs/api-reference/voices/ivc/create), [stream speech](https://elevenlabs.io/docs/api-reference/text-to-speech/stream).

Initially select four to six current voices covering the actual use cases: conversational, energetic, calm and narration, including needed accents/languages. These are catalogue categories, not assumed provider names or invented voice IDs. Choose and audition real voices in the account. Library additions can be managed manually in ElevenLabs for the first release; a custom administration UI is optional.

Sync provider metadata into an application catalogue: internal ID, provider voice ID, display name, language/accent labels, description, preview URL, compatible models, availability, pricing modifiers and retirement notices. Cache shared catalogue metadata for approximately 15 minutes and recheck eligibility before spending. Preserve the last known catalogue if a refresh fails; disable generation for a voice confirmed unavailable.

Use the provider's existing preview audio where available. Opening the voice picker and pressing a sample play button should not submit TTS. A preview of the user's own script is a generation and must show its cost.

The client receives approved shared voices plus only the current user's private clones. Never return every workspace voice directly to every user: all customer clones would exist inside our shared provider account.

Starter has 10 custom voice slots. Saved Voice Library voices do not consume those custom slots. Adding/editing voices also has a monthly operation quota, so cloning again for each hook is the wrong design. Track the account's real capacity and reserve clone slots atomically. Source: [voice slots and operations](https://help.elevenlabs.io/hc/en-us/articles/24351056337937-How-many-voice-slots-do-I-get-per-tier-and-how-can-I-increase-it).

Avoid old default voice IDs from tutorials. ElevenLabs says its existing Default voices expire on 31 December 2026; select current replacement or eligible library voices and support retirement notices. Source: [voice capabilities](https://elevenlabs.io/docs/overview/capabilities/voices).

Completion check: voice cards show real playable samples; selecting one resolves to a currently accessible provider ID; one user cannot discover or select another user's clone.

## 3. Persist recordings and reference voices

Use two explicit flows:

| User choice | Meaning | Provider usage |
| --- | --- | --- |
| Preset voice | Speak the written script using a selected catalogue voice | One TTS generation |
| Voice reference | Create/reuse a private clone, then speak the written script using it | Clone operation, followed by TTS |
| Exact recording | Keep the recording's existing words and performance | No TTS; duration validation and rendering only |

A voice reference is not attached to ordinary TTS as an arbitrary audio URL. Instant cloning first produces a reusable `voice_id`. A clone also does not guarantee identical delivery; audition it before using it.

For cloning, request clean recordings of one speaker, preferably around one to two minutes, and confirm permission. This sample can be much longer than a short hook. Validate clone samples separately from exact hook recordings. Source: [instant-cloning preparation](https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning).

Implement authenticated prepare/upload/complete steps. Validate allowed types, byte limits and actual decoded audio on the server/worker, then measure duration and mark the asset ready. Client-supplied MIME type and duration are not authoritative. API requests use owned asset IDs, not arbitrary remote URLs.

Proposed additive data records:

| Record | Minimum contents |
| --- | --- |
| `audio_assets` | ID, Firebase owner UID, purpose, private object key, MIME, size, measured duration, checksum, status, timestamps |
| `audio_voice_profiles` | Internal ID, owner UID or approved shared scope, provider voice ID, source sample ID, consent record, status, availability, timestamps |
| `audio_generation_requests` | ID, owner UID, job ID, request key, script revision/hash, voice and model, settings snapshot, usage quote, provider operation, output asset ID, status |

Enable RLS on exposed-schema tables and deny direct browser access for this server-mediated design. Server queries must explicitly enforce Firebase ownership; a service-role connection bypasses RLS. Do not copy a Supabase `auth.uid()` policy unless the project's Firebase-to-Supabase identity bridge has actually been configured. Source: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

Give cloning a durable request record and a bounded worker operation if it can outlive an API request. Persist its result immediately. Recover an orphaned provider clone after an interrupted finalization instead of blindly creating another. Respect any `requires_verification` result before making it available. Delete private samples/clones on an explicit owner request using a reconciled cleanup flow; remove catalogue access immediately while cleanup completes. Define treatment of already exported recordings separately.

Completion check: a recording survives refresh, has verified metadata and private playback; an existing private clone is reused; cloning stops cleanly when account capacity is exhausted.

## 4. Add durable speech generation and billing

Proposed application endpoints under `/api/explore/audio`:

| Endpoint | Contract |
| --- | --- |
| `GET /voices` | Approved shared catalogue plus the authenticated user's private voices |
| `POST /uploads/prepare`, `POST /uploads/complete` | Ownership-scoped upload lifecycle |
| `POST /voices` | Authorized clone request using an owned sample asset; return its durable request/job ID |
| `DELETE /voices/{id}` | Explicit owner deletion of a private voice |
| `POST /generations` | Validate and reserve usage, persist request/job, return `202` with IDs |
| `GET /assets/{id}` | Authenticated playback or a short-lived read URL; support browser range playback |

Reuse existing authenticated job status/output retrieval after verifying it exposes only owned jobs. For polling, no provider API call is needed.

Add `generate_audio` and, if needed, a clone job type consistently across database constraints, web/worker type unions, executable task lists, dispatch, queue targeting, deployment environment validation and billing. Add `elevenlabs` to the provider-operation constraint if using that recovery ledger. Expand constraints to retain every current provider/job value. Create an audio queue or equivalent dedicated concurrency control using existing Cloud Tasks infrastructure. Account-wide leases must cover both queued generation and future streaming.

Generation lifecycle:

1. Authenticate using the existing Firebase flow and enforce application plan access.
2. Resolve an approved/owned voice and ready assets. Validate script size, supported model and settings.
3. Compute a server quote using the model/voice rate and a versioned UGC Pilot credit policy. Provider credits, USD usage and our product credits are separate units.
4. Atomically reserve application usage and create the request/job. Enforce unique `(owner_uid, request_key)` and reject reuse with a different payload.
5. The worker checks the account budget and obtains a global provider slot, records submission state and calls ElevenLabs.
6. Save audio under a unique immutable object key; decode/probe the completed file and persist its asset record.
7. Finalize delivered usage once and mark the job complete only after its audio is durable. Keep cost accounting for failed/partial provider calls even where product policy refunds the customer.

Use `mp3_44100_128` initially, subject to the account's verified support. Retrieve available models rather than assuming the newest release. Start with an available Flash/Turbo model for responsive speech and an available Multilingual model where quality/language warrants it. Confirm pronunciation and voice compatibility with actual samples.

Cloud Tasks redelivery, duplicate clicks and page refresh must return/resume the same generation. An unchanged saved audio asset can be reused across video variants. An explicit regenerate action creates a new billable revision; editing text/voice/settings invalidates the previous selection. Prevent an old request completing later from replacing a newer draft.

Retry known transient failures with bounded backoff. Do not assume provider TTS supports our application idempotency key. After an ambiguous submission timeout, reconcile using saved provider identifiers/history where supported, or show an uncertain state. A blind retry could charge twice. Save finished output before database/billing finalization so that finalization retries do not regenerate speech. A cancelled request may already have consumed provider usage.

Completion check: two simultaneous submissions of the same request create one billable generation; a worker restart after file persistence resumes finalization; quota or unavailable voices cause useful errors before unnecessary spend.

## 5. Attach audio to video with an explicit contract

The existing video adapter has no audio input. Adding a voice dropdown alone cannot complete this step.

For voiceover, persist a render specification identifying the audio asset, timeline start, affected segment, speech gain, original-audio behavior and optional background track. Reuse FFmpeg/storage/probe helpers. Do not route speech through Trending's existing music composition gain and loop/trim behavior.

Generate and approve the audio before launching expensive video variants. Measure its real duration against supported hook durations. If it does not fit, require a shorter script, longer supported duration or a user-approved edit. Do not silently cut spoken words or change playback speed. An exact recording follows the same duration gate without TTS.

Preserve the existing demo behavior: original demo audio remains unless the user explicitly chooses a mix/replacement; optional demo background audio cannot exceed the demo length and is not automatically trimmed. Creator narration and demo background sound are separate assets. Generated native speech must have an explicit replacement/mixing decision to avoid two voices playing together.

For a creator visibly speaking, run a small technical prototype of either a provider with verified audio input or a dedicated lip-sync service. Confirm accepted formats, maximum duration, facial references, quality, cost, operation recovery and output rights. Build a capability matrix for the actual adapters. Disable unsupported combinations in the UI. Voiceover can ship independently; a talking creator workflow must pass the audio/lip-sync gate before being presented as complete.

Completion check: audio fits the intended segment, remains intelligible, avoids overlapping unintended speech, and the exported MP4 plays correctly. Talking-person output additionally passes an actual lip-sync check.

## 6. Add live playback without generating twice

Saved generation already provides on-demand speech. Actual live playback is a separate transport feature: start listening before the complete audio file exists.

Use one generation ID and one ElevenLabs provider call. An authenticated streaming backend acquires the same budget/concurrency reservation as a worker, sends chunks to the browser and also writes a recoverable output. The completed asset becomes the recording used for video; do not submit another TTS request when the user chooses “Use this audio.”

A Cloud Tasks worker's request response is not a browser audio stream. Prototype the streaming endpoint in the existing hosting environment, checking buffering, timeouts, authentication, browser decoding and disconnect behavior. If necessary, use an authenticated Cloud Run streaming path with the same records and credentials boundary. Fetch-based playback can carry the existing Firebase authorization; a native audio element needs a suitable authenticated proxy or short-lived scoped URL.

Pick and implement one disconnect policy: continue a bounded generation to durable completion, or cancel and explicitly mark it partial. Do not rely on unawaited work surviving a Next.js response or client disconnect. Partial bytes never become a ready asset. A retry or reattachment observes the same request; streaming failures can fall back to waiting for that request's saved audio.

Completion check: playback starts before finalization, replay/video attachment uses the saved result, provider usage shows one generation, and disconnect/reconnect does not create a second call.

## 7. Validate, deploy and roll back safely

Release each capability behind a server-enforced flag. UI flags alone are insufficient. Keep existing workflow availability rules until the complete corresponding workflow passes acceptance.

Implementation order: account/catalogue -> private uploads and data records -> saved preset speech -> private clone reuse -> video attachment -> streaming. Each stage must satisfy the completion check above before the next is enabled for users.

Validation during implementation:

- Web build/lint and worker TypeScript build; focused tests for request ownership, private clone visibility, atomic duplicate prevention, quote/reservation/finalization, provider uncertainty and duration gates.
- Existing image/video upload and generation flows, media playback, relevant rendering/billing behavior, and no-audio requests retain their behavior. Run regression checks appropriate to any shared files changed.
- Browser verification of selected voice, uploaded recording, refreshed state, stale completion handling, generated playback and exported video. Check keyboard interaction and understandable loading/error states.
- One approved bounded real generation in the production account after non-billable mocks pass. Verify usage and stored output; then cover provider 429/quota/error paths with fixtures rather than repeated paid calls.
- Final authentication/hosted integration acceptance on [the production domain](https://www.getugcpilot.com), with the feature enabled only for the pilot account first. Local builds are preliminary checks.

Deploy additive schema first, then workers capable of the new jobs, then web routes/UI with flags off. Verify every affected deployment target has the compatible version before dispatching new job types. Do not combine this release with unreviewed changes elsewhere in the dirty worktree.

Rollback by disabling new audio submissions and cloning. Preserve existing audio, job polling and completed outputs. Let already submitted jobs settle or deliberately reconcile them; do not delete new tables or private clones as a rollback mechanism.

## Pilot success and upgrade triggers

Start with preset voices for all enabled pilot users and cloning for a small explicitly limited group. The 10 custom slots are shared by our application account, not renewed per UGC Pilot user. This is a capacity constraint for public self-service cloning even when preset selection is inexpensive.

Track model/voice character usage, provider spend, product credit consumption, latency, failure/uncertain rates, clone slots and operations, storage, and video/lip-sync cost separately. Upgrade or change the voice-account design when measured volume or clone capacity requires it. Do not build the product budget around a temporary model promotion.

Release acceptance: a user can choose a real preset voice or their authorized reference voice, generate and replay their script, select the exact saved audio for a supported video path, and reopen the result after refresh. Duplicate requests do not spend again, private assets remain owner-scoped, and existing image/video workflows retain their verified behavior.
