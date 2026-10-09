# Explore finishing and Scribe — 4 October 2026

## Release status

The backend/API **and both Explore clients are now connected in the isolated release checkout**, including saved-output scheduling and the reconciled Audio screen/API/worker. This is offline verification, not deployed acceptance. The original dirty checkout and original assets remain preserved. No source was staged/pushed, production migration applied, ledger repaired, cloud resource deployed, paid provider called, or social post published.

The user approved ElevenLabs Scribe for English subtitles, with a **60-second combined video limit**. Create audio remains a generation reference. Optional Demo audio mixes underneath the demo's original sound during the demo only; it does not replace that sound or play over the opening. Added whole-video music is a separate layer. Both known added layers are excluded from the transcription track. Embedded music already inside an original clip cannot be separated by this pipeline.

## Implemented boundaries

- `POST /api/explore/finishes` verifies Firebase ownership and the existing generation-access policy, bounds JSON to 8 KiB, validates the normalized edit and matching request/header UUID, and derives its fingerprint server-side. Clients cannot choose an owner, source URL/storage key, provider, fingerprint or output identity. Only ready owned asset IDs are accepted by the reservation RPC.
- A reviewed additive migration atomically reserves one owner-scoped receipt, output ID and `render_demo_video` job before dispatch. One active finish per owner prevents overlapping renders. Replays retain those identities; changed edits using the same request conflict. Queue failure leaves the committed job available to existing durable dispatch recovery, never a replacement paid request.
- `GET /api/explore/finishes?requestKey=...` is authenticated, no-store and read-only, even when starts are disabled. An absent receipt is **unconfirmed**, not proof that an interrupted POST cannot commit. Completed outputs are rechecked for current ownership, readiness and deletion. Raw speech, provider errors, internal input and storage URLs are not returned by this endpoint.
- The app's request storage and worker-only transcription/storage/rendering are separate. Shared pure receipt validation and Scribe policy constants align the runtimes without importing Node ESM worker dependencies into Next.js. The full build caught and resolved this runtime-boundary problem; no global Next.js resolver change was made.
- The GCP video worker registers the owned finishing handler. Existing handler/queue types remain present. It checks all selected asset ownership before download, pins input objects to their GCP generations, bounds downloads, composes the ordered clips and fits/fades added audio without shortening video or altering source files.
- Original combined speech is prepared as bounded mono 16 kHz PCM16 WAV. Scribe preparation validates its actual size, measured duration, format, silence and hash **before** a paid claim. Synchronous multipart transcription uses `scribe_v2`, automatic language detection, real word timings, and no diarization, events, multichannel, webhook or extra paid options. Only detected English and valid ordered word timings are accepted; no timings are invented and no other paid provider is tried.
- Owner/hash/duration/provider-policy claims are durable, lease-bound and serialized in Supabase. Validated transcripts are saved before captions or output publication. Cached results are owner-isolated. An unanswered earlier submission fences subsequent requests, including a new edit/request for the same speech. A late matching saved result can repair that uncertainty; an operator must not clear the fence merely to force another charged call.
- Captions are actually burned with the existing packaged fonts for Clean, Bold box and Active word. Editorial is still unimplemented and fails explicitly before a paid claim, rather than silently changing the user's style. This is a release gap, not an approved feature removal.
- The finished MP4 is written to a deterministic reserved GCP object using generation-zero preconditions. Provenance binds owner, request, fingerprint and renderer. Recovery rejects foreign, malformed, overlong or mismatched object metadata. URLs must be durable HTTPS URLs without credentials, query tokens or fragments. Sources are never overwritten.
- Atomic finalization saves one ready owned `media_assets` derivative, retaining its source parent ID. Lost upload acknowledgements and transient record-finalization failures schedule bounded recovery. A subsequent worker delivery first checks the existing output, avoiding another render/transcription when the object is already stored. Cancellation/current-lease checks protect publication; cancellation after an accepted provider call is not a promise that the upstream charge can be undone.

## Migration and activation

`20261004053418_explore_video_finishing.sql` is **new and unapplied**. Its service-only receipt/RPC permissions, owner/lease checks, uncertain-submission handling and atomic finalization were rehearsed in an isolated PGlite database. The lease extension narrowly adds the new renderer type to the current main function, preserving existing predicates and privileges. This rehearsal does not certify all production triggers, migration-history equivalence or hosted compatibility.

The transcript claim/save signatures include a provider policy key. App, schema and worker must be deployed from the same validated release; do not deploy a partial older schema/worker combination or replay historical applied migrations.

Activation remains off in examples:

- App: `EXPLORE_FINISHING_ENABLED=false`, `EXPLORE_FINISHING_SUBTITLES_ENABLED=false`.
- Worker: `EXPLORE_SUBTITLE_TRANSCRIPTION_ENABLED=false`.
- Terraform: `explore_subtitle_transcription_enabled=false`, `elevenlabs_api_key_secret_id=""`.

The Terraform change references an **existing** Secret Manager secret only when transcription is enabled and requires its ID before enabling. A conditional non-authoritative worker secret-access member is now included; no hosted IAM grant, plaintext key or new secret was created. The existing OpenAI secret for unrelated Reaction generation remains unchanged; this is not an application-wide provider replacement. Terraform is unavailable locally, so native `terraform fmt/validate/plan` and actual Secret Manager permissions remain unverified.

Before activation, verify the actual ElevenLabs account's Scribe entitlement, key scope, allowance/usage policy, worker secret-access permission, GCP configuration, migration ledger and worker handler/revision compatibility. A voice-generation plan must not be treated as proof of unlimited Scribe allowance. Do not make a paid canary merely because offline checks passed.

Primary API contract: [ElevenLabs speech-to-text conversion](https://elevenlabs.io/docs/api-reference/speech-to-text/convert). The implementation uses word timestamps from that response; real recognition accuracy and account charges have **not** been tested here.

## Validation evidence

- **135 focused offline checks passed**, zero failures/skips in the final runs: 60 worker/provider/cache/retry regressions, plus 75 owned finishing/job/GCP/API/store/disposable-schema/synthetic-video checks.
- The synthetic media check uses the actual Scribe adapter with an injected response, verifies its submitted WAV excludes the known added music, burns those mocked word timings across both clips, checks visible caption pixels, and preserves the composed soundtrack. It is not real speech-recognition validation.
- Worker compilation, full app TypeScript and scoped ESLint passed. The complete configured Next.js build passed, including **134 static-generation entries** and the new dynamic finishing endpoint. Only six existing public Firebase build settings were passed in memory; no private environment file or server secret was copied/displayed.
- `git diff --check` reported no whitespace errors. Generated fixtures alone were cleaned up; no supplied media was removed, modified or uploaded.

## Remaining release work

1. Implement Editorial's matching renderer/fonts and resolve default-music selection/licensing. Resolve unsupported Create generation-reference audio/video contracts without ignoring selected inputs or confusing them with appended Demo media. The active model routes still reject Create audio/video references, even though an unused Runway Seedance adapter contains reference-support code.
2. Verify actual migration history, provision the separate private GCP Audio bucket, validate native Terraform plans and Linux worker packaging, and confirm the app/worker service identities, provider key scopes and actual Scribe allowance. The coupled feature migrations remain unapplied.
3. Finish every intended remaining source/migration/runtime-asset reconciliation, including landing, Trending, Wall of Text, Scheduling and other fixes. No unresolved source change was silently excluded from the release.
4. Complete combined-release visual/responsive and authenticated hosted acceptance, then use the user's order: **Git → reviewed required Supabase migrations → Vercel → GCP worker → real production-domain smoke check**. Hold newly introduced app dispatch until the matching worker is serving. Read-only/non-spending production smoke remains the default; paid generation/transcription or publication needs separately bounded authorization.

See `explore-ui-audio-integration-2026-10-04.md` for the client/Audio changes and current validation evidence. Older backend-only descriptions above are historical, not evidence that the client remains unconnected.
