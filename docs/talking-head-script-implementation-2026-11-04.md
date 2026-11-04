# Talking Head transcripts, script Remix and starting-frame handoff

4 November 2026. **Implemented locally; not built or deployed.**

## Result and provider validation

- Extracted audio locally from all25 current catalog originals, verifying source/audio hashes and preserving their full durations (777.997seconds total). The five archival references remain hidden in discovery; no video bytes or reference catalogs were changed by this implementation.
- ElevenLabs Scribe v2 rejected the first source with HTTP401. One deliberate diagnostic submission, after a successful read-only credential check, established `payment_issue`: failed/incomplete account payment. No ElevenLabs transcript was produced. Uncertain requests were not retried.
- The user then explicitly authorized local transcription or inexpensive OpenAI transcription after checking price. OpenAI Whisper produced25cached full-source transcript drafts with word/segment evidence, estimated at$0.0778. Its February2027retirement applies to this offline import script; there is no new production transcription endpoint or dependency on Whisper at runtime.
- Three independent GPT-Transcribe checks added an estimated$0.011219. Source contact sheets corroborated the selected hook/demo transitions. The second transcriber disagreed on slang and a negation in the long Sab source; it was not treated as infallible. Source-caption-supported readings were retained. Some Whisper word estimates have zero duration; these remain warnings and are never synthesized into precise karaoke timings.
- Compared GPT-6Luna medium against GPT-6.1Terra medium on three real introductions with two business contexts: saved UGCPilot context and a clearly labelled fictional English-practice app. The six-case initial comparison made12calls. Promptv2 then received6focused calls on three weak cases. No automatic reviewer, provider fallback or retry was used.
- Terra passed length/schema validation in9/9outputs; Luna passed7/9. The v2closing-cue checks passed for all three Terra follow-ups. Manual output review still found that discovery wording can become less vivid when unsupported source claims are removed; user review remains necessary. This small, non-randomized comparison does not establish general model superiority or production latency.
- Selected **gpt-6.1-terra with explicit medium reasoning**, script promptv2, for this new feature only. Existing Hook/Wall model configuration is unchanged. The optional `OPENAI_TALKING_HEAD_SCRIPT_MODEL` supports the two tested candidates; there is no silent provider/model switch.
- Actual reported text usage implies approximately$0.003076for Luna and$0.018872for Terra at the documented Standard rates, including reported cached-input counts. Combined transcription/check/comparison estimate: **$0.110967, about$0.11**. This is an estimate, not invoice evidence.

Frozen system prompts, exact user payloads, source hashes/ranges, raw returned copy, request/response IDs, validation errors, token usage and timings are in `docs/talking-head-script-model-comparison-2026-11-04.json`. Raw ASR responses and request checkpoints remain under `.tmp/talking-head-{scribe,openai}-2026-11-04/`; full source review sheets are under `.tmp/talking-head-script-review-20261104/`. These are source-analysis artifacts, not UI acceptance screenshots.

## User flow implemented

Recreate opens the existing starting-frame panel. Talking Head alone receives a script section inside that panel's settings area. It loads cached source text and saved business readiness without submitting inference. The user can expand the hook and the full source transcript draft, edit only the hook words, and confirm that demo narration is excluded before clicking **Remix for my business**.

Script review/remixing is independent of starting-image generation. It does not alter image inputs or trigger another image job. An error preserves existing text. A reply for older words cannot overwrite newer edits; it is offered explicitly as an older result. Missing business context links to Settings, and script details can be reloaded without replacing edited words.

**Use this starting frame** keeps the approved image and its ordered raw identity IDs, and carries the displayed script into Create. Create's existing textarea is labelled **Talking Head script** in this mode, avoiding a divergent second editor. Reopening preparation for the active source prefers the current Create words, including an explicit empty edit, over an older preparation draft. Demo selection and its audio are unchanged. Frame/photo Change remains the existing control.

The initial output duration is chosen from the selected model's supported durations using an approximate speech estimate. If the script is longer than every supported duration, it stays intact and generation is blocked with a shortening/longer-duration explanation. Sound is never changed automatically. Spoken-script generation requires Sound on; long scripts are never silently truncated or accelerated.

The video request contains a separate `talkingHeadScript` field. Scene directions remain separate. The real API validates that the owned starting image belongs to Talking Head, checks sound/duration/length before billing, compiles the approved words exactly once into the model prompt, and freezes both raw words and final prompt in the durable worker input. Explicit speech overrides conflicting dialogue in scene directions. This verifies payload correctness, not generated speech or lip-sync fidelity.

## Storage, ownership and recovery

The transcript store resolves only catalog IDs and verifies the current source hash. There is no arbitrary URL import through the app. All25entries are explicitly transcript drafts; three have independent ASR/source-frame cross-checks. The user can correct the draft before Remix. Full source text is retained separately from the selected introduction. The 44.38second Sab introduction is retained whole and correctly fails a short-video duration check.

New script Remix uses a dedicated endpoint and spoken-script prompt. It reuses the existing private `explore_text_remixes` table and `explore_claim_text_remix` transaction, including the shared20-per-day allowance. Its frozen input includes purpose, source/transcript hashes, reviewed input words, hook range, current business profile/version, model, reasoning and prompt version. A durable claim precedes every paid application request.

Storage uses compatible text blocks for historical receipt readers; all such blocks cover the selected introduction and are explicitly not overlay or word-timing instructions. The script API returns the joined spoken text. Long-script receipts are tested without truncating words. No existing Hook/Wall/Slideshow prompt or receipt format was changed.

The browser preserves an immutable pending request before submission. Reopening performs no automatic POST. **Check saved remix** uses GET, including when source metadata is unavailable. A temporary404cannot erase the request marker or start a second paid call. Corrupt stored requests are preserved and block new spending; they are not silently replaced. Current-account authentication and owned lookup protect receipt reads; new-creation flags/credit-plan gates do not prevent owned read-only recovery.

Read-only checks of the configured Supabase project returned200for the existing Remix table and exposed claim-RPC metadata. No customer rows were returned, no schema migration was needed, and **no production database write** was made. Real hosted request admission/save/recovery remains NOT TESTED.

## Protected behavior receipt

| Behavior | Status and evidence |
| --- | --- |
| Original t=0image preparation and source/identity roles | VERIFIED in unchanged receipt/image paths and existing regression tests; no new frame selection, image prompt or source media changes. Generated image fidelity NOT TESTED. |
| Raw identity-photo carryover/order and existing Change picker | VERIFIED in actual parent/selection tests, including approved-script handoff. Existing unsupported ReAPI combination still blocks before billing. |
| Literal first frame plus extra face context on ReAPI | **NOT VERIFIED / existing limitation.** The prior zero-capability guard is retained. This feature does not solve that provider constraint or silently remove photos. |
| Hook and Text on screen preparation | VERIFIED by a real shared-component test: script section renders only for Talking Head. Their existing text Remix, frame, photo and generation tests pass. |
| Demo, source selection, Sound and scheduling state | VERIFIED by actual parent tests. No Demo/audio/scheduler implementation changed; no hosted schedule/publication claim. |
| Script editing, stale replies, empty drafts, recovery, ownership | VERIFIED by actual component/API handlers with isolated auth, provider and storage boundaries; no live paid application request. |
| Approved words through client→API→worker input | VERIFIED through real client/API admission with only external writes replaced; exact words occur once. Generated dialogue/lip-sync NOT TESTED. |
| Desktop/mobile visual acceptance and signed-in production flow | **NOT TESTED.** No dev/production/browser-fixture build was started; no deployment occurred. Source sheets are not UI screenshots. |

## Files changed in this implementation

New runtime/data:

- `app/api/explore/talking-head-script/route.ts`
- `components/explore/talking-head-script-section.tsx`
- `lib/explore/talking-head-script-api.ts`
- `lib/explore/talking-head-script-store.ts`
- `lib/explore/talking-head-script-draft.ts`
- `lib/explore/talking-head-script-input.ts`
- `lib/explore/talking-head-script-remix.ts`
- `lib/explore/talking-head-transcripts.json`

Scoped runtime integration:

- `components/explore/hook-starting-frame-workspace.tsx`: optional Talking Head script slot only. Concurrent image-status admission work is preserved.
- `components/explore/hook-workflow-preview.tsx`: preparation/script handoff, current-script priority, duration selection and typed request field. Prior photo changes remain intact.
- `components/explore/workflow-creation-form.tsx`: script-mode label/help only.
- `lib/explore/workflow-session.ts`: backward-compatible optional script-mode flag.
- `lib/explore/workflow-generation-client.ts`: independent spoken-script field, readiness and immutable fingerprint.
- `lib/explore/starting-frame-workflow.ts`: approved dialogue block for explicit new requests only.
- `lib/ai-studio/video-generation-api.ts`: owned-workflow validation, pre-billing compilation and durable raw script field.

Offline validation/import scripts:

- `scripts/transcribe-talking-head-references.mjs`
- `scripts/transcribe-talking-head-openai.mjs`
- `scripts/import-talking-head-transcripts.mjs`
- `scripts/compare-talking-head-script-models.mjs`

Tests:

- New `lib/explore/talking-head-script.test.ts`, `lib/explore/talking-head-script-api.test.mjs`, `scripts/talking-head-script-section.test.mjs`.
- `scripts/hook-starting-frame-ui.test.mjs`: real shared-slot isolation.
- `scripts/workflow-demo-audio-state.test.mjs`: actual frame/script/raw-ID handoff and updated import fixture.
- `scripts/workflow-generation-api-contract.test.mjs`: actual typed-script admission and before-billing negative cases; stale ReAPI assertions corrected to existing policy.
- `scripts/workflow-generation-client.test.mjs`, `scripts/workflow-source-video-ui.test.mjs`: new import fixtures, retaining original behavior assertions.
- `scripts/talking-head-references.test.mjs`: missing preload fixture import repaired; gallery behavior assertion retained.

Documentation: this report, the comparison JSON, a follow-up link on the original plan, and append-only entries in `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`, and `docs/ai-context/nonnegotiables.md`.

This list covers this implementation's changes, not every dirty path in the shared worktree. Existing source-folder imports, photo fixes, preload/loading, slideshow, image-provider and motion work were preserved. No dependencies, global styles, production settings, migrations, worker routing, source files or media bytes were changed for this feature.

## Verification

Read-only preflight passed. Non-build test groups:

- Core/new feature/client/API/gallery/full-source group: **98passed** — `.tmp/talking-head-script-core-tests.log`.
- Existing parent/receipt/image/Remix/draft regression group: **400passed** — `.tmp/talking-head-script-regression-tests.log`.
- Existing ReAPI/Scribe/subtitle-policy worker group: **38passed** — `.tmp/talking-head-script-worker-tests.log`.
- Total: **536tests, zero final failures/skips** across disjoint file groups.

Node tests use the repository's `next-server-only-test-loader.mjs` or `worker-source-test-loader.mjs` with `--experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test`. These execute source, not a browser bundle or application build.

Core files: `lib/explore/talking-head-script.test.ts lib/explore/talking-head-script-api.test.mjs scripts/talking-head-script-section.test.mjs scripts/workflow-generation-api-contract.test.mjs scripts/workflow-generation-client.test.mjs scripts/workflow-source-video-ui.test.mjs scripts/talking-head-references.test.mjs scripts/talking-head-full-sources.test.mjs`.

Regression files: `lib/explore/workflow-session.test.mjs lib/ai-studio/video-generation-api.test.mjs lib/explore/remix-text-api.test.mjs lib/explore/remix-text.test.ts scripts/remix-text-db.test.mjs scripts/explore-format-generation-ui.test.mjs scripts/explore-workflow-job-recovery.test.mjs scripts/workflow-reference-inputs-ui.test.mjs scripts/workflow-demo-audio-state.test.mjs scripts/starting-frame-photo-carryover.test.mjs scripts/starting-frame-animation-references.test.mjs scripts/explore-format-reference-upload.test.mjs scripts/hook-starting-frame-client.test.mjs scripts/hook-starting-frame-ui.test.mjs`.

Worker files: `worker/src/lib/reapi-video.test.ts worker/src/subtitles/elevenlabs-provider.test.ts worker/src/subtitles/explore-policy.test.ts`.

`npx tsc --noEmit --incremental false`, scoped ESLint and diff-whitespace checks passed for the new/changed implementation except the existing parent lint defect below. No build command or deployment was run.

Parent lint caveat: `hook-workflow-preview.tsx` still has the existing `react-hooks/refs` error assigning `scheduleDraftRef.current` during render. The identical error is reproduced from HEAD. A new callback-dependency lint finding introduced during implementation was corrected; the final parent result has only the existing error. Logs: `.tmp/talking-head-script-parent-lint{,-head}.log`. This report does not claim the entire repository is lint-clean.

Initial broader test failures were missing import fixtures and stale pre-existing ReAPI expectations, not15new application defects. Fixtures were updated to use the actual policy and retain their behavior assertions. The earlier gallery fixture incident now has concrete passing evidence.

## Preflight, incidents and limits

The user explicitly authorized relevant complete historical sections plus full protected contracts after the two history files exceeded1.3MB. Applied that exception; no claim of a full historical read. Read repository AGENTS instructions, full nonnegotiables, relevant Explore/Talking Head/Remix/incident entries and earlier folder/photo/plan reports. Applied skills actually read: ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-starting-frame, ugc-video-prompt, ugc-frame-analysis, ugc-opening-frame-prompt, ugc-regression-gate, OpenAI docs/model-selection, Supabase and reference-remix guidance. Read the installed Next route-handler guide. Official current OpenAI/ElevenLabs specifications/prices and Supabase documentation informed the provider checks.

Related incidents: `UGC-VID-20261104-TALKING-HEAD-FULL-SOURCE-DIALOGUE` now has local transcript/script implementation evidence, but stays open for hosted/generated acceptance. `UGC-QA-20261104-TALKING-HEAD-GALLERY-FIXTURE` has a passing local fix. `UGC-VID-20261104-RAW-PHOTO-CARRYOVER` remains partial for provider support. No existing history was deleted or rewritten.

Remaining NOT VERIFIED: exact verbatim ASR accuracy and every proposed hook boundary, new desktop/mobile visuals, real signed-in hosted Remix persistence/recovery, generated speech/lip-sync/identity, and literal first frame plus raw face references on the current ReAPI routes. Review remains explicit; long introductions are preserved, not disguised as short recreations.

Rollback boundary: remove only this feature's new files and its scoped optional fields/slot/handoff/compiler/API hunks; preserve all unrelated worktree changes and historical paid receipts. The data and scripts are local until a separately authorized release. No build or deployment is authorized by this receipt.

Official sources: [OpenAI transcription](https://developers.openai.com/api/docs/guides/speech-to-text), [Whisper price/retirement](https://developers.openai.com/api/docs/models/whisper-1), [GPT-Transcribe](https://developers.openai.com/api/docs/models/gpt-transcribe), [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra), [ElevenLabs Scribe API](https://elevenlabs.io/docs/api-reference/speech-to-text/convert).
