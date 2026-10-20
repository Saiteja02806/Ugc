# Explore UI and Audio integration — 4 October 2026

## Outcome and release boundary

Implemented in `C:/Users/chund/.codex/worktrees/safe-reconciliation-20261003/UGC`, not the original dirty checkout or live site. The requested Apply edits and Schedule post controls have real guarded handlers in Workflow 1 and Workflow 3. Audio's existing screen, API, database contract and worker are reconciled into this release checkout and its owned ready results are selectable from Explore.

No staging, commit, push, hosted migration, deployment, paid generation/transcription or real post was performed. This is not a complete-release readiness certificate. The user-required deployment order remains Git → reviewed missing Supabase migrations → Vercel → GCP worker → production-domain smoke check, after the full release passes its remaining gates.

## Connected behavior

- Apply edits uploads owner-bound Demo files, submits an immutable finishing draft/key, polls the existing finishing endpoint and shows only a verified ready saved video. English subtitle choices use the real finishing pipeline, up to 60 seconds combined. Clean remains the default. Recovered results restore their actual subtitle choice; changing an edit requires applying it before scheduling.
- Demo audio preserves original Demo sound and mixes underneath it only during the Demo. Play once/repeat is explicit, and fitting/fading never shortens the video or changes sources. Background tracks can be up to 10 minutes; the existing Create-reference upload path retains its 30-second cap. The server determines this policy from the owned saved upload, not a completion-body override.
- Demo video/audio accept upload and drag/drop. Choose saved audio reads the owner's Audio library, excludes free-test/noncommercial output and private voice-cloning recordings, and downloads only an explicitly chosen bounded ready asset. The original Audio record/object remains in private GCP storage; the selected file becomes a separate owner-uploaded composition attachment, not a raw private storage URL in a job.
- Scheduling passes the verified finished video and explicitly chosen connected account to the existing confirmation editor/API. Caption, account time zone, lead time, permissions and mandatory platform choices are preserved. Success requires an exact matching server schedule; an uncertain response does not display a false success or generate a new key.
- Reload recovery is read-only. Exact finishing, schedule and Audio speech identities/payloads are stored before dispatch. Explicit resumes retain them; Web Locks serialize same-browser tabs. An unchanged completed finish is checked rather than re-rendered. A lost upload acknowledgement is recovered through the owner API and never deletes potentially committed media.
- Older pending Audio requests are recovered/polled by their exact request key, not just the newest history page. Uncertain provider submissions retain their reservation and block fresh paid submission. Token/account changes prevent stale work from being applied.
- Audio's original consent, Starter/Growth entitlement, provider allowance, quota/credit, private-voice ownership, cancellation, cleanup and at-most-once fences are retained. Audio uses `ELEVENLABS_VOICE_API_KEY` with existing key aliases as fallbacks; Scribe retains its separate `ELEVENLABS_API_KEY` setting. These are server-only.
- Explore/Audio remain visible. `?preview=1` is always non-spending. The explicit production dispatch gates remain off in examples until schemas and matching worker revisions are present; this is ordered-deployment safety, not a final feature exclusion.

## Infrastructure and schema

- Audio bytes use a separate `GCP_PRIVATE_AUDIO_BUCKET`, never the public media bucket or a new Supabase Storage bucket. Runtime checks require enforced public-access prevention. Reads pin object generations and check bounds/CRC; writes use generation-zero preconditions and only accept an identical replay.
- Additive Terraform configuration provisions an opt-in private bucket with uniform access, no public members/CORS, `force_destroy=false` and `prevent_destroy=true`. App/worker permissions are bound to that bucket. AI worker activation adds `generate_audio` without replacing existing job types; bucket/secret prerequisites are required. Existing secret policies are not replaced.
- Scribe configuration reaches both the compatibility render service and one-shot render job. Conditional worker secret-access members are declarative only; no cloud IAM has changed. Review duplicate membership if both worker modules are configured to manage the exact same secret/principal pair.
- The Audio candidate migration enables RLS, denies browser roles table/RPC access and grants service-only invoker access. Its offline database test now exercises service-role job creation, claim and credit settlement, not only superuser behavior. Existing Storage policies and unknown future job types remain untouched.
- Candidate migrations: `20261001120000_audio_generation.sql`, `20261003190747_explore_atomic_generation_requests.sql`, `20261004053418_explore_video_finishing.sql`. Refresh the hosted ledger before applying any. Do not replay already-applied character, early-publish or time-zone migrations.

## Validation and limitations

The full configured Next.js build passes with 140 static-generation entries; worker compilation, app TypeScript and scoped ESLint pass. Only six existing public Firebase settings were forwarded in memory; no private environment file was copied or printed. Offline suites exercise synthetic FFmpeg media, injected Scribe responses, client React harnesses, mocked APIs/storage and isolated PGlite databases. They are not live-provider accuracy, authenticated browser acceptance or proof of production deployment.

Final scoped runs passed with zero failures/skips: **251** combined Explore/Audio/UI/storage/database checks; **125** finishing/Scribe/synthetic-media/generation-recovery checks; **22** existing account-picker/form/publishing-policy checks and **95** time-zone/platform-settings/scheduling-contract checks. The eight controller tests included in the 251-check run execute the actual finishing hook and scheduling boundary: both workflows open account confirmation before POST, persist the selected video/account/settings first, retain the exact request after a lost response, never POST on hydration, and reject wrong media/accounts or unavailable durable storage. These runs do not constitute a whole-source release audit.

The fresh read-only reconciliation snapshot at `2026-10-04T12:47:07.124Z` still contains 859 original-source candidates and empty staging areas. The reconciliation report records its classification counts. Original files and both HEADs are preserved; the snapshot is not a deployment or a claim of fresh remote-main parity.

Frontend/React guidance kept the approved visual structure and separated controller refs from rendered state. Supabase guidance informed browser-role denial and service-only RPCs. Existing newer-main backend handlers were retained; Create Content's authorized retirement applies to its screen, not its APIs, stored assets or in-flight jobs.

Still required before claiming the complete release ready:

1. Create voice/video-reference integration: the active provider routes still reject those inputs. Do not silently drop them, append them, or claim voice matching is implemented. Unused Runway Seedance reference-support code is not an active integration.
2. Editorial rendering and a licensed/selected default background track remain unresolved. Clean, Bold box and Active word render; Demo uploads work. Those remaining controls are not falsely enabled.
3. Complete every intentional remaining original-source reconciliation and semantic migration-history review. This pass does not certify all landing, marketing, Trending, Wall of Text, MCP or other review queues.
4. Native Terraform fmt/validate/plan, Linux worker image validation, actual private bucket/credentials/allowance, full visual/responsive review and production-domain authenticated acceptance remain unverified. Local Terraform is unavailable. No hosted configuration is assumed ready merely because the app compiles.

Do not activate new dispatch before the required database contracts and corresponding worker image are serving. Read-only/non-spending smoke remains the default; no production customer post or paid canary is implied by this report.
