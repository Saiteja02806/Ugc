# Explore: three-gap implementation audit — 2026-10-04

Implemented in `C:/Users/chund/.codex/worktrees/safe-reconciliation-20261003/UGC`, on the existing isolated release checkout. The original Desktop checkout, existing release changes and Git index were preserved. This is a source/offline verification record, not production acceptance or deployment approval.

## Input meanings preserved

| Input | Actual destination/behavior |
| --- | --- |
| Create image, audio, video/app recording | AI generation references, not appended demos or soundtrack mixing |
| Demo video in Edit video | Appended after the generated opening |
| Demo audio in Edit video | Background layer during the demo only; original demo sound remains |
| Background music Off | No default music; original opening/demo sound and separately selected demo audio remain |
| Background music On | Explicitly approved default track under original opening/demo sound |
| Auto subtitles | English speech across opening + demo, up to 60 seconds combined; no automatic video trimming |

## 1. Create audio/video references — connected in source

- Both Hook and Creator Phone use the same upload/client/API contract. Reference files upload on an explicit Generate click only. An app recording and generic reference video cannot both be selected.
- The server checks the authenticated owner's ready, undeleted media asset, canonical trusted URL, collection, MIME, bytes and saved duration **before** credit reservation or the atomic Explore start adapter.
- UGC Pilot's current limits are one audio reference (25 MiB), one video reference (250 MiB), each up to 30 seconds, and six combined references. These are application limits, not claims about OpenRouter's maximum asset count. Unsupported model attachments fail visibly, never disappear silently.
- New Seedance 2.5 user-facing API jobs freeze `provider: "openrouter"`; the worker sends typed `image_url`, `audio_url` and `video_url` objects through `input_references`. Create references never enter finishing demo/music fields. Text-only generation stays valid; Kling/Omni image behavior is retained.
- Existing request identities, full-reference fingerprints, account checks, receipt recovery, key allowance preflight and no-automatic-paid-POST retry protection remain. Video-reference allowance checks cover OpenRouter's documented $2 authorization without treating it as the final charge.
- No new Runway routing was added. Accepted legacy provider jobs retain their existing recovery behavior.
- Removed the unimplemented "Exact recording" mode from the reference popover. The UI describes reference guidance, not guaranteed voice cloning or copying the recording into output. The React review retained the existing layout, owner-scoped state, accessible switches and event-driven uploads rather than adding automatic effects.
- Primary contract checked read-only against [OpenRouter's public OpenAPI schema](https://openrouter.ai/openapi.json), [Seedance model](https://openrouter.ai/bytedance/seedance-2.5) and [official reference-mode documentation](https://openrouter.ai/blog/insights/seedance-2-5-review/). No inference API key, private media or paid generation was sent during verification.

Entry points: `lib/explore/workflow-generation-client.ts`, `components/explore/workflow-generation-boundary.tsx`, `lib/ai-studio/video-generation-api.ts`, `worker/src/lib/openrouter-seedance-video.ts`.

## 2. Editorial subtitles — actual renderer connected

- Editorial now passes through the same owned finishing receipt/API and worker as Clean, Bold box and Active word.
- Uses actual timed transcript words and measured libass font ink for page layout, deterministic keyword typography, transcript escaping, safe caption regions and bounded animation. It does not invent word timing or speech emphasis.
- Packaged all three renamed SIL-OFL Editorial font faces and the licence. Their hashes match the preserved original checkout. Existing Docker `COPY src/assets` includes them at the worker's expected assets path.
- Font/runtime checks occur before requesting transcription. Unsupported layouts/fonts fail closed instead of silently falling back to Arial or publishing a misleading result.
- Existing ElevenLabs Scribe production adapter, durable transcript reuse, original-speech-only input and English/60-second rule remain. The standalone offline subtitle tool also supports Editorial; the three classic styles remain unchanged.
- Illustrative UI cards remain labelled samples. Actual captions are reviewed in the saved finished video.

Entry points: `worker/src/subtitles/editorial.ts`, `editorial-media.ts`, `worker/src/lib/explore-video-finishing.ts`, `lib/explore/workflow-finishing-api.ts`.

## 3. Default background music — wiring complete, track still required

- Connected switch defaults Off. Apply edits with Off never fetches, uploads or adds default music.
- On + Apply edits requests an authenticated, bounded, no-store default-track endpoint. The server resolves **only** `EXPLORE_DEFAULT_BACKGROUND_AUDIO_ID` from an active, human-approved `hook_audio_assets` row and validates its trusted GCP location. It accepts no client track/URL override, makes no paid music-generation call and chooses no random import.
- The client saves an owned track snapshot through the existing verified media upload before creating the finishing receipt. Reload restores the saved choice; uncertain retries keep the original draft/identity. Turning music Off invalidates an old music-bearing output for scheduling until new edits are applied.
- Original audio is preserved. Longer tracks fit/fade to video length; short tracks repeat only if the catalogue explicitly marks them loopable, otherwise play once. Demo audio has its own separate playback preference.
- **No default track was selected or configured.** The supplied D: library folders are not accessible in this environment. An attached approved track or existing active/approved GCP Hook-audio catalogue ID is still needed. Until configured, On fails with an actionable message; Off still works. No library asset was uploaded, deleted or assigned presumed rights.

Entry points: `app/api/explore/default-music/route.ts`, `lib/explore/workflow-default-music-api.ts`, `workflow-default-music-client.ts`, `components/explore/use-workflow-finishing.ts`, `.env.example`.

## Verification completed

- Next.js 16.3.7 optimized production build: passed, including app type checking and 141 static pages. Only allowlisted **public** Firebase build settings were forwarded in memory; integrations remained disabled for this build.
- App `tsc --noEmit --incremental false`: passed.
- Worker TypeScript build: passed.
- Targeted ESLint for changed app source: passed.
- Combined Explore client/API/UI/recovery suite: **182 passed, 0 failed**.
- Compiled worker/provider/Editorial/Scribe-policy suite, including real worker handler with mocked OpenRouter: **44 passed, 0 failed**.
- Offline synthetic FFmpeg composition/subtitle/API suite: **41 passed, 0 failed**. All four styles burn visible caption pixels; captioning preserves encoded AAC, source files remain unchanged, original speech excludes both known added music layers, and demo-only audio stays out of the opening. Transcripts/provider calls were fixtures/mocks, not live recognition-quality tests.
- `git diff --check`: passed. Windows CRLF notices are not whitespace errors.

Total for these final focused runs: **267 passing offline tests**. Earlier stale preview-only assertions and incomplete ownership fixtures were corrected; the final runs above pass.

## Not done / still required before full release

- Configure the approved default-track ID; verify production OpenRouter/Scribe allowance, server-only credentials, private audio GCP storage and matching worker image/environment.
- Finish whole-release source reconciliation and semantic migration-history review. This task neither applies SQL nor replays applied migrations.
- Confirm the combined release on the actual hosted authenticated application. Local builds and mocked calls do not demonstrate live generation, transcription quality, cloud permissions, scheduling or publishing.
- No source was staged, committed, pushed, migrated or deployed; no real provider job or production post was created. Follow the approved Git → Supabase → Vercel → GCP worker → production smoke order only after remaining release checks pass.
