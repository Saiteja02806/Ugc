# MCP audio access candidate — 12 October 2026

Status: local candidate; production remains on export-history runtime `415405fc834577c7547583e66ebbb989f985b85b` with 33 tools and plugin 0.1.8. This candidate registers 43 tools. It is not full audio or full application parity and has not been deployed. No customer audio generation/upload, provider mutation, preference write or deletion was submitted.

## Implemented surface

| Tool | Existing OAuth scope | Behavior |
| --- | --- | --- |
| get_audio_capabilities | account:read | Account/plan/rollout/model/cost and queue readiness; pure catalogue mode; explicit unsupported binary/clone flags |
| list_audio_voices | assets:read | Owner-eligible catalogue or honest public-preview fallback; no preview/storage/provider account details |
| list_audio_assets / get_audio_asset | assets:read | Stable paged undeleted private-library metadata and video eligibility |
| list_audio_generations / get_audio_generation | jobs:read | Paged safe history and client UUID recovery; no requeue; exact owner/job/request/output identity |
| generate_audio | generation:write | Shared website speech submission, existing models/voice rules, quota/credits and stable request replay |
| get_audio_preferences | assets:read | Shared website voice selection and bookmarks |
| set_audio_voice_selection / set_audio_voice_bookmark | assets:write | Idempotent account preference assignment; no voice admission or generation |

No new OAuth scope or migration is introduced. None of these handlers accepts caller identity, provider keys, storage URLs, pricing, private profile overrides or test/commercial overrides. Paid generation is marked destructive/idempotent and instructions require saving the request UUID and exact inputs before an intended generation. Unconfirmed reads do not prove no submission.

## Shared services and boundaries

`lib/audio/service.ts` extracts the existing account, plan, catalogue, request reservation/replay and speech routines from the HTTP adapter. Website handlers retain Firebase authentication, response headers/status and body parsing. The generation service receives the body after its existing plan guard, preserving the previous auth/plan/body ordering. Upload/clone/playback/removal HTTP paths keep their current services and storage. Replay now explicitly verifies job owner/type before dispatch, consistent with new submission.

Website bootstrap still reconciles genuinely verified private voices as before. MCP read-only capability/catalogue paths set `refreshVerification:false` and never update that status or call its provider verification operation. Preference writes do not grant voice permission; new speech resolves selection against the same owner's actual eligible catalogue.

Private audio metadata remains separate from visual `media_assets`. Generated audio recovery checks exact worker identity: owner-scoped request, `generate_audio` job, `audio:<request UUID>` key, input audioRequestId, completed request/job, ready output whose ID/generation equal the request ID and matching test flag. Upload recovery checks its exact owned source output; clone history checks the exact owned request/profile/source with ready or verification_required status. Removed/foreign/misidentified artifacts are omitted. Raw scripts, errors, provider operation IDs, object keys and URLs are not returned. Signed pagination cursors bind the owner and collection, preserve database timestamp precision and reject cross-collection substitution.

## Remaining audio work — required for the full goal

- Authenticated private download/stream/sample binary delivery usable by Codex and Claude Code without extracting OAuth credentials; expired delivery must recover via owner-aware reads.
- Actual local audio upload bridge using bounded measured bytes and server validation, plus durable intent/replay and interruption recovery.
- Import eligible commercial audio/default music into the finisher's owned media contract; private audio IDs are not generic visual-library IDs. Reference/private recordings and free tests must remain excluded from video use.
- Private voice cloning with explicit source/permission, verification refresh, owner-scoped asset/voice retirement and cleanup recovery.
- Public package instructions/version/distribution for the complete audio workflow, actual production release and read-only host checks, then user-intended media acceptance. Existing public 0.1.8 archives are immutable and unchanged.

Capability flags for MCP upload, download and cloning remain false. The audio candidate is kept out of production while those transfer/workflow adapters are unfinished; the existing live 33-tool release stays available.

## Verification and limits

- 48 actual shared website/MCP adapter checks passed, including seven new audio MCP scenarios: all scopes and unsigned calls before activity, pure reads versus website verification, shared preferences, speech reservation/replay and billing, stable request recovery across gate/downgrade, pagination/cursor isolation, and upload/clone output identity.
- Complete MCP suite passed with 43-tool discovery and scope/read-only/destructive annotations, alongside retained image/video/finishing/Demo/upload/operation/Edit/private-media regressions. The audio adapter and existing SQL transaction checks are included in that suite/CI.
- Audio provider/worker/media suite passed 86 checks before the final added adapter test; final shared adapter checks above supersede that adapter count. The worker TypeScript build passed. ElevenLabs provider tests passed 11, private GCS storage tests passed six.
- Existing audio SQL tests passed 15 on the project's pinned disposable PGlite runtime. Its two old Supabase bucket/policy assertions were updated to match the already-existing GCS migration (no migration bytes changed). Anonymous table/RPC denial, stable reservation/replay, quota serialization, terminal settlement, uncertain requests and cleanup ownership remain tested. GCS byte privacy is tested separately rather than inferred from retired Supabase Storage policies. The test defaults to the pinned project runtime while preserving its override.
- TypeScript, touched-file lint, seven package validation checks, four deterministic builder/immutable archive checks and Next.js 16.3.8 production compile passed. Final candidate/CI status is recorded as completed below.
- Production was inspected read-only: the five existing audio record/preferences tables are RLS-enabled, service SELECT/INSERT allowed, anon/authenticated SELECT denied. `create_audio_generation_request` is invoker with empty search path and service-only EXECUTE. No schema, grants, bucket or IAM mutation was made.

These fixtures exercise actual shared services/query builders and existing SQL primitives, with mocked provider/storage/queue boundaries. They do not prove a hosted paid generation, private transfer, multi-client interruption or local download. Supabase current query/filter docs and the same-day changelog were consulted; installed Next server/client boundary guidance was read. Full application parity and the original real hook → demo → finished download journey in both IDEs remain unfinished.

## Published candidate

Reviewed candidate commit: 0055433f5dc1f8831c654f40f4d7fdf2b49b1377. Draft PR #41 (https://github.com/Saiteja02806/Ugc/pull/41) is attached and stacked on codex/mcp-edit-export-history. Exact-commit MCP CI 38248424314 and 38248441470 both completed successfully, including the full 43-tool suite, shared audio adapter/SQL tests, package validation, immutable builder checks and app/worker dependency audits. Final local MCP suite, compile and lint/type checks also passed.

A post-push alias read confirmed production is still website dpl_4bszasuCMsTM3ibWiH1eFBgbUfFA and MCP dpl_D2GUbYmA4YVWiuNDDYxgD4rsRPwc. No candidate deployment/promotion occurred. All fourteen intentional candidate source/test/config/evidence paths are committed and the remote SHA matches; unrelated primary-root source, local credentials/config, temporary fixtures/logs and build/cache output remain excluded. No intended isolated source path was omitted.
