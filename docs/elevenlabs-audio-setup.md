# ElevenLabs audio setup

The separate `/audio-generation` screen appears between Explore and Trending. Voiceover Studio is its new default tab, with at most six recommended voices at a time above the Text to speech editor. Social media is selected first; UGC ads and Product demos offer purpose-specific shortlists. Next/previous arrows show another small group, while View all voices opens the complete library. The original Voice library, Text to speech, My voices and My audio tabs remain available. The library preserves its three-column layout and full provider metadata; focus choices promote suitable voices while retaining every catalogue entry. Library/private voice selection returns to the last editor used. Both editors share the same draft and generation controls. Focus changes, navigation and refreshes preserve the selected voice and draft. See [the native audio product decisions](audio-ugc-native-plan.md). It supports available preset voices, saved generated recordings, streamed speech playback, private reference uploads and exact recordings. Starter adds consent-based private voice cloning. Explore video attachment, lip sync, conversational voice agents, music and sound-effect generation remain later stages.

The integration is disabled by default. No production migration, deployment or live ElevenLabs generation has been performed as part of this implementation. As of October 3, 2026, new audio creation requires an active **UGC Pilot Starter or Growth** entitlement. UGC Free users can browse every screen and listen to voice samples but cannot generate. This application access check is separate from the ElevenLabs account's provider plan.

## Account bookmarks release

As of October 5, 2026, voice rows include **Use It** and a bookmark control. The new **Bookmarks** tab saves voices to the signed-in account across reloads and devices. Use It sets the voice for the existing text-to-speech editor without generating, discarding a draft or altering plan access. Free users can save and select voices, while new audio creation still requires active UGC Starter/Growth access.

Before deploying this web update, apply the prepared `supabase/migrations/20261005042533_audio_voice_bookmarks.sql` through the existing reviewed migration workflow. It adds an isolated, RLS-enabled preference table with server-only access; no provider key or additional worker configuration is needed for bookmarks. Do not apply unrelated pending migrations as part of this step. A bookmark database error leaves the existing audio workflow usable and shows a retry message. This task verified the migration using disposable PostgreSQL and browser/provider fixtures; no production schema change or deployment was performed.

Production acceptance after deployment: save a voice, reload and verify it in Bookmarks, open the same account on a second device, remove it and refresh, confirm a different account sees its own bookmarks, then use a saved voice and verify the script remains unchanged. Check both Free and paid accounts: preview and bookmarking use no TTS, and generation remains paid-only.

## Where to put the API key

For local development, **add** the following entries to the project's existing `.env.local`; preserve its other configuration:

```dotenv
ELEVENLABS_API_KEY=your_private_key
AUDIO_GENERATION_ENABLED=true
AUDIO_GENERATION_PUBLIC_ENABLED=false
AUDIO_GENERATION_ALLOWED_USER_IDS=your_firebase_uid
```

Use an application-owned ElevenLabs account and a restricted key with subscription/user, voice and model read access plus text-to-speech access. The account/subscription read permission is required to detect Free/Starter capabilities and remaining allowance. Do not prefix the key with `NEXT_PUBLIC_`, place it in frontend code, commit it, or paste it into chat.

The same settings belong in the web host's **server environment** for the target deployment. Production testing requires the tester's Firebase UID in `AUDIO_GENERATION_ALLOWED_USER_IDS`, plus active UGC Starter/Growth access. Local development requires the same UGC plan entitlement. An invitation never permits a Free UGC account to generate. Keep `AUDIO_GENERATION_PUBLIC_ENABLED=false` during the provider pilot; set it to true on the web host for the eventual Starter/Growth release after configuration and production acceptance. That public switch still excludes UGC Free users and preserves the existing credit reservation.

On October 1, 2026, the Vercel `ugc` project was checked through its environment-variable UI: the existing `elevenlabs_api_key` is a write-only **Secret** scoped to **Production**. Its value was neither revealed nor tested against ElevenLabs. The server accepts this lowercase name as a compatibility fallback; a nonempty uppercase `ELEVENLABS_API_KEY` takes precedence. Keep the uppercase spelling for new configurations. There is no need to reenter the existing Vercel secret. Vercel applies environment changes to new deployments; the local compatibility change also requires deployment. See [Vercel environment-variable documentation](https://vercel.com/docs/environment-variables).

The Cloud Run AI generation worker also needs `ELEVENLABS_API_KEY` (or its lowercase compatibility spelling) and `AUDIO_GENERATION_ENABLED=true`. A web-only key loads the catalogue but cannot generate audio in the worker. Vercel environment variables do not automatically propagate to Cloud Run.

For the existing Terraform worker configuration:

```hcl
enable_audio_generation      = true
elevenlabs_api_key_secret_id = "your-existing-secret-manager-secret-id"
```

Store the key's value in GCP Secret Manager, grant the worker service account Secret Accessor on that secret, and use its secret ID in Terraform. Never put the value in `.tfvars`. Preserve the existing `worker_job_types` and add `generate_audio` if the deployed configuration sets an explicit list. The updated example/default already includes it. Build and deploy the updated worker image with its existing FFmpeg/FFprobe tools.

After upgrading to Starter, enable voice write access on a restricted management key if needed. Set `ELEVENLABS_VOICE_API_KEY` in **both** the web host and worker for cloning/deletion. If omitted, these operations use `ELEVENLABS_API_KEY` and therefore need its voice-management permission. Free testing does not require cloning access.

## Database and worker setup order

1. Keep audio disabled in both deployments while setting up.
2. Review and apply `supabase/migrations/20261001120000_audio_generation.sql` to the same Supabase project used by the app and worker, through the project's normal reviewed migration process. Check the full pending migration list first: this checkout contains unrelated pending work, and a blanket database push could apply it too.
3. The migration creates the **private** `private-audio` bucket, owner-scoped audio records, atomic usage limits, duplicate protection and a provider lease. It preserves existing allowed job types and prevents broad browser storage policies from exposing this bucket. An existing public bucket with this name makes the migration fail safely.
4. Configure the worker's secret, allowed job type and existing Cloud Tasks/Supabase settings. The web app and worker use the existing Supabase server service-role key. Browser access goes through Firebase-authenticated app endpoints; Firebase UIDs are not Supabase `auth.uid()` values.
5. Deploy the worker and web changes, then enable audio for invited testers. Do not alter the existing image/video storage bucket or make this bucket public.

Uploads pass through the authenticated web API, so no browser storage CORS change is required. Generation runs in the existing durable job queue. Leaving the screen or stopping live playback does not cancel the worker or lose the saved result.

## Provider testing and the Starter upgrade

The backend reads the actual account's subscription, supported models and paginated voice catalogue. It does not assume a plan from a manually entered label. Initially it offers supported **Flash v2.5** and **Multilingual v2** models plus current default voices eligible for the account. Voice samples use existing preview audio rather than submitting paid TTS.

Before generation is connected, the library can show real premade voice metadata and preview URLs from ElevenLabs' anonymous public catalogue. The live catalogue returned 21 voices during verification, including Roger, Sarah, George, Alice and Daniel; this number is dynamic. Public demos are explicitly unavailable for generation until the authenticated account catalogue grants access. A catalogue outage shows an empty state. Orb avatars are original CSS artwork. Celebrity portraits, licensed iconic voices, popularity counts and unavailable community voices are not fabricated.

An eligible UGC Starter/Growth tester may use the ElevenLabs Free provider tier for noncommercial testing. UGC Free accounts cannot create speech, private voices or uploads, even when invited or given trial generation credits. Generated files from the provider's Free tier retain a permanent `test_only` flag, show attribution and use a `free-test-` download filename. Upgrading the provider account does not convert earlier recordings into commercially licensed outputs. Check [ElevenLabs commercial-use guidance](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform) before using them in published work.

Upgrade the same ElevenLabs account, then select **Refresh voices**. Starter cloning is unlocked only when the live subscription is active and reports the cloning capability. The worker rechecks slots, monthly voice operations and allowance before submission. A reference creates a reusable private voice; uploading a recording alone does not clone it. Exact recordings preserve the uploaded audio and use no TTS allowance.

For additional paid preset voices, add the chosen Voice Library voices to the ElevenLabs workspace yourself, then put their provider IDs in `ELEVENLABS_ALLOWED_VOICE_IDS`, comma-separated, on the web server. Refresh the catalogue. IDs from tutorials are not a reliable catalogue. Other users' instant clones stay hidden even if a clone ID is mistakenly added to this list.

Verification-required clones stay unavailable for generation and appear in activity. Complete verification in ElevenLabs, then select **Refresh voices**. Fresh provider metadata must explicitly confirm verification before an owner-scoped conditional update makes the local profile ready; deleted profiles cannot be revived. Moderated or still-pending voices remain unavailable. There is no public clone marketplace or professional-clone workflow in this pilot.

## Limits and recovery

Default server limits in `.env.example` are:

| Setting | Default |
| --- | --- |
| Script length | 1,500 characters |
| Uploaded recording | 3 MB, validated audio, at most 3 minutes |
| Generated output | 12 MB, at most 3 minutes |
| Global script allowance per quota period | 9,000 characters |
| Per-user script allowance per quota period | 3,000 characters |
| Per-user requests, including upload/clone operations | 30 |
| Estimated paid generation spend cap | 5,000,000 micros ($5) |
| Concurrent provider operations | 1 |

Provider-backed quota periods use the account's next allowance reset. Upload validation uses the calendar month. Limits are conservative application reservations, not a replacement for the actual ElevenLabs balance. Other applications using this account consume the same provider allowance. Paid cost estimates are model-specific guardrails; verify the current account quote before increasing them. Custom-rate voices are excluded. Keep ElevenLabs automatic top-ups off during the pilot unless a budget is explicitly approved.

The existing UGC credit reservation applies only when a future public paid rollout is explicitly enabled. Invited testers use the pilot limits without UGC credit deductions. Leave public access disabled until pricing and real production acceptance are reviewed.

Double submissions with the same request key return one job. Concurrent uploads use separate temporary object paths, so a conflicting payload cannot overwrite the winning recording; an unreferenced losing object is removed. A metadata response lost after commit is recovered before cleanup. Concurrent clone requests for the same reference return the existing request. After a provider POST starts, automatic retries never submit that same request again. If the final MP3 is already stored, the worker can retry metadata finalization from the saved file. If the response was lost before the file was saved, activity says **Needs review**; do not press Generate repeatedly to replace it.

For an uncertain clone, inspect the ElevenLabs workspace for the voice whose name includes the audio request UUID. Reconcile its provider ID and verification status into that owner's `audio_voice_profiles` row before completing/releasing the request. Do not create a second clone blindly. For an uncertain speech request without a saved final file, inspect ElevenLabs request/usage history and resolve it manually before choosing a new generation. Raw provider errors and keys are never returned to the browser.

Removal first retires the owned record atomically, blocking its reuse before external cleanup. Remove recording then deletes its private object and streaming chunks while retaining minimal request history. A recording used by an active request or private voice cannot be removed until that use ends. Remove private voice then deletes it from ElevenLabs; reference recordings can be removed separately. In-flight or uncertain records require review first. If provider or storage cleanup fails, the retired entry stays unavailable and **Retry removal** appears in My voices or My audio. Retrying completes cleanup without restoring the record.

Rollback: set `AUDIO_GENERATION_ENABLED=false` on the web host and worker. Saved owner-authenticated playback remains available. Keep the audio tables and private bucket to preserve recordings/history, and resolve jobs that have already submitted to the provider. The flag does not interrupt an already running provider call.

## Acceptance checks before real use

Builds, mocked provider/API/worker tests and a disposable PostgreSQL migration test validate the code without spending provider allowance. The PostgreSQL fixture tests duplicate protection, quotas, concurrent clones, terminal settlement, provider leases, retirement races and restrictive storage policies. Real FFmpeg tests validate supported formats and reject playlists, video and oversized durations. Local browser fixtures cover search, selection, responsive layout, Free/Starter gates, one submission on double click, saved playback, preview-only generation blocking and cleanup retry. These checks do not constitute production acceptance.

Local verification on October 1, 2026: 58 audio/provider/media tests, 15 disposable database tests and 32 existing queue/job regression tests passed. Web production compilation, worker compilation and targeted ESLint passed. Dark/light desktop and 320/390px mobile layouts were checked. The actual local bootstrap endpoint rejected anonymous access and returned real public voice demos with generation, cloning and upload disabled against intentionally unavailable test storage. The Terraform bindings were reviewed but not applied or validated by a Terraform plan; the CLI is unavailable here.

The app checks the strict server-side UGC subscription before new speech, cloning, upload or replay dispatch. The worker reads the existing active billing subscriptions and active complimentary grants again before a new provider call. Billing outages keep browsing available and stop/defer generation. Existing saved playback, download, history and cleanup remain owner-scoped after a downgrade. Previously generated output can still be finalized without another provider call. Deploy both web and worker access changes together; no new database migration is required for this gate.

Once configured, use `https://www.getugcpilot.com/audio-generation` while signed in as an eligible invited Starter/Growth tester:

1. Verify a UGC Free account sees the full screen and available voice samples, but Generate audio, cloning and uploads remain disabled. Check Starter and Growth accounts can generate once enabled; verify inactive plans cannot. Provider tier/allowance stays hidden in the user interface.
2. Generate one short script; listen live in a browser supporting MP3 MediaSource streaming, then replay/download the saved recording. Other browsers can use saved playback after completion.
3. Navigate away during another short job and verify its result survives a refresh.
4. Upload a small exact/reference audio file; confirm worker validation and that another signed-in user cannot fetch its asset or stream. Check anonymous storage reads fail.
5. Confirm the actual ElevenLabs allowance deduction and test attribution. Test removal of an unused recording.
6. After Starter upgrade, create one authorized reference voice, generate with it, and confirm other users cannot see or select it. Remove the private voice when no longer needed.
7. Verify Explore and Trending still load and their existing generation flows continue to work.

Record the deployed web/worker revisions and production results before increasing limits or enabling public access. Do not count offline browser fixtures as live provider verification.
