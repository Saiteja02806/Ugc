# Stored starting frames and automatic Hook text

Implemented locally on 2026-10-25. Neither change is deployed or enabled in production by this work.

## Stored starting frames

`lib/explore/hook-source-frame-store.ts` stores verified ordinary Hook frame-zero PNGs at the existing canonical snapshot key. A small immutable index binds source SHA, frame SHA, dimensions and `frame0-png-v1`. The PNG is uploaded and read back before publishing its index. GCP generation preconditions prevent concurrent writers from replacing accepted objects.

With `EXPLORE_STORED_SOURCE_FRAMES_ENABLED=true`, the ordinary Hook reader uses the verified stored frame (plus the existing bounded in-memory cache). Even after server restart, it does not download or decode the reference MP4. A missing/corrupt frame gives an unavailable response; the user request does not initiate extraction. Curated and private creator frames retain their existing paths and access checks. Wall and Talking Head extraction is outside this change.

The explicit backfill covers the active ordinary Hook catalogue. Both Hook publication scripts now prepare ordinary frames before activating their local release manifest. Bump the extractor version if the extraction contract changes; never replace an index silently.

## Automatic Hook text

The main Explore composer uses the shared AI Studio video admission route. Both that route's ordinary and atomic admission paths now accept the optional automatic-text choice. The UI enables the choice by default for reference-backed Hook generations after rollout, checks reviewed reference text, business context and allowance, and explains any unmet requirement before Generate.

Admission snapshots the reviewed Hook source, business version/context, existing brand-remix prompts and model into the accepted job. It does not call an AI provider. One stable text UUID binds a generation batch. The worker claims the existing `explore_text_remixes` receipt before a single model call, runs it alongside video generation and reuses the saved result for other variants and retries. Failed or ambiguous calls are never automatically resubmitted. This uses the existing 20-remix rolling daily allowance, without changing video credit prices or adding a reviewer model call.

Each output uses its actual duration and aspect ratio to fit the same adapted text. Short single-block Hooks span the full output; multiple beats keep proportionate timing. Fitting uses the shared preview/render layout, reduces font size within editor bounds and never truncates copy. Unsupported or unfit results need review.

The additive database trigger initializes the owned media's `hook` clip draft as part of video completion. It never updates an existing draft. Normal server restore puts the text on the main video preview, where it is editable and movable. Existing local edits take precedence over late server restore. Intentional removal remains empty across replay and reopening. Rendering and scheduling continue through existing saved-edit paths.

If text fails, the video still completes with `needs_review` metadata. The editor requires text or an explicit Continue without text choice. Saving that empty draft records the user's decision. Recovery is bounded: a claim abandoned during a process crash can require manual review; it cannot silently generate again.

## Local verification

- 118 tests passed in the combined storage, frame API, frame approval, text preflight, video admission, text lifecycle/fitting, database, editor-handler, clip-draft and Remix suite.
- 31 worker integration/regression tests passed, including mocked video-provider routing and real FFmpeg MP4 duration/silence checks.
- 38 shared Remix, timing, draft and render checks passed, including real FFmpeg caption exports, emoji, separate text beats and removing Hook text when the appended demo begins. Total: **187 passing tests** across these three runs.
- Full application TypeScript check, worker TypeScript build, scoped ESLint and whitespace checks passed.
- Storage checks include an actual PNG persisted to disk, then loaded by a fresh production reader while source download and decoder callbacks are forbidden. Hash mismatch, missing image/index, partial upload, concurrent preparation, access checks and stream size/cancellation are covered. GCP adapter writes are tested with immutable create-only options; no production bucket write was made.
- Text lifecycle tests cover four concurrent variants, worker retry, failed provider output, abandoned pending claims, lost save responses, no second provider call, real Postgres draft initialization, ownership rejection and preservation of edited/removed text. Database tests use PGlite and execute the migration, including service-role privileges.
- The actual editor component's restore, edit, move and removal handlers are exercised in an isolated hook/portal harness. They verify automatic main-preview text, matching render-edit data, early local edits, late restore, reopening and explicit continuation after text failure. These are not browser geometry or live account tests.
- Provider output is stubbed. No new paid AI generation, production scheduling or publishing was performed. Existing Hook prompts are reused; this does not establish live model quality or latency.

## Rollout and production acceptance

1. Deploy migration `supabase/migrations/20261025010000_automatic_hook_text_drafts.sql`, then the worker and web changes. Keep rollout flags off during preparation.
2. In the intended storage environment, run:

   ```powershell
   node --env-file=.env.local --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types scripts/prepare-hook-source-frames.mjs --write
   node --env-file=.env.local --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types scripts/prepare-hook-source-frames.mjs
   ```

   The second command must report zero missing frames. It is read-only. Confirm bucket IAM and lifecycle retain these canonical objects.
3. Enable `EXPLORE_STORED_SOURCE_FRAMES_ENABLED` on the web runtime. Recreate an ordinary reference on a cold and warm instance; verify hash/first-picture identity and that no MP4 download/FFmpeg extraction occurs. Measure hosted latency. Check a curated and private reference separately.
4. Ensure the worker has its existing Supabase credentials and OpenAI key. Enable `EXPLORE_AUTOMATIC_HOOK_TEXT_ENABLED`, `NEXT_PUBLIC_EXPLORE_AUTOMATIC_HOOK_TEXT_ENABLED` (requires web rebuild), and existing `EXPLORE_TEXT_REMIX_ENABLED`.
5. On authenticated `https://www.getugcpilot.com`, generate an explicitly approved test batch. Close/reopen the workflow, verify editable text on each main preview, change it, save, reopen and verify exact preservation. Remove text and repeat. Check exported video pixels/timing, mobile layout and explicit text-failure continuation. Scheduling approval remains deliberate.

Production acceptance, hosted cold-start latency, live model generation and browser visual inspection remain unperformed. The production browser was previously disabled in Work settings; no alternate browser was used to bypass that restriction. The installed Supabase CLI also failed before command execution while writing its external telemetry file, so the migration was authored as a local artifact and executed/tested with PGlite; production migration/advisor checks remain part of release.

Independent rollback: disable the stored-frame flag to restore the legacy ordinary frame path; disable the automatic-text UI/server flags to stop new automatic requests. Retain immutable objects and saved draft/Remix receipts. Already-admitted jobs continue from their frozen inputs.

Implementation references: [GCP object preconditions](https://docs.cloud.google.com/storage/docs/request-preconditions), [Supabase JavaScript RPC](https://supabase.com/docs/reference/javascript/rpc), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
