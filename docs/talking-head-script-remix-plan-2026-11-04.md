# Talking Head spoken-script Remix: plan and initial validation

Follow-up: the user authorized transcription, comparison and implementation. Local results, provider fallback, changed files and verification are recorded in [the implementation receipt](talking-head-script-implementation-2026-11-04.md). The planning snapshot below is historical.

Date: 4 November 2026. Status: **PROPOSED; application implementation has not started.**

The requested sequence is plan, validation, then implementation. This document defines the reviewable flow and the evidence required to proceed. No transcription upload, paid model comparison, application code change, build or deployment was performed for this planning step.

## Product intent and scope

Keep the selected source video, opening composition, influencer identity and source provenance. Extract what the source actually says. Let the user adapt the talking-head introduction to their saved business context with the smallest useful changes, preserving its rhetorical setup, sequence, tone and conversational delivery. The source transcript remains intact; the editable script is a separate draft.

Use the existing Recreate starting-frame preparation panel. Add the requested **Talking Head script** section there, available while the starting image generates. Retain the existing image controls, image approval and compact preview with Change. Do not introduce a second photo chooser, a second image-generation route or a separate script modal. Script changes must not invalidate an approved image.

The first release covers the packaged Talking Head catalog, including historical references for recovery. It does not add an arbitrary video URL transcription endpoint or automatically generate prompts for every catalog video. Hook and Wall text Remix, their saved receipts, Demo, scheduling, image models and ReAPI video routing retain their existing behavior.

## What the repository currently establishes

| Finding | Evidence and implication |
| --- | --- |
| 25 packaged Talking Head references, 20 discoverable, 777.997 seconds total | Catalog and `visibleTalkingHeadReferences`; five archival examples stay hidden. The two latest full originals are local additions, not deployed. |
| No Talking Head entries in either existing reference text catalog or its transcript evidence file | The existing extraction pipeline performs OCR on visible captions. Its filename is not evidence of speech transcription. A dedicated reviewed speech source is required. |
| Existing Remix infrastructure is reusable | `lib/explore/remix-text-api.ts` authenticates, loads saved business context, claims a request before a paid call, enforces a shared 20-per-day allowance, saves output and recovers owned receipts. It disables automatic SDK retries. These are code-verified properties, not hosted acceptance. |
| Overlay schemas cannot safely be used unchanged | `reference-text.ts` accepts hook/wall_text/slideshow, validates overlay blocks, and limits non-Wall blocks to 600 characters. The resolver uses the separate Recreate catalog. Talking Head references currently expose format hook elsewhere; that must not send spoken scripts through the Hook overlay prompt or renderer. |
| Starting-frame approval currently carries image and raw identity IDs, not a script | `HookStartingFrameWorkspace` passes `identityAssetIds` from the approved generation input. Talking Head `approveStartingFrame` stores the frame, changes generation settings and closes preparation. Its instructions state is separate. |
| Current video prompt has a mixed free-text channel | `workflowGenerationPrompt` combines reference directions and user instructions. The Talking Head compiler asks for the user's script but has no typed approved-script field. The new flow needs an explicit spoken-script boundary. |
| Duration requires explicit handling | 17 full sources exceed 15 seconds. Three exceed 60 seconds: katiemeidt8 65.534s, studyfetchlauren 61.867s, studywithsab 60.767s. Current first-frame Omni durations are 4/6/8/10s; Seedance/WAN go to 15s. Talking Head approval currently selects the model's 3/4s default. Full source length must not be treated as a supported output length. |
| Existing Scribe adapter has a narrower purpose | `worker/src/subtitles/elevenlabs-provider.ts` uses scribe_v2 with word timing, bounded PCM16 mono 16kHz audio, English detection, a 4MiB limit and the finished-subtitle policy of at most 60 seconds. Reusing it unchanged would reject three full sources. |
| Raw-photo delivery remains a separate unresolved integration | The local picker retains editable raw photos, but the literal-first-frame ReAPI policy still reports zero additional face references. Script Remix must not silently drop those selections, switch provider, or claim that earlier requirement is fully solved. |

## Proposed user interaction

1. **Recreate:** open the existing preparation panel for that exact reference. Load its verified source frame and cached reviewed transcript independently. Do not charge for transcription or run Remix merely because the panel opened.
2. **Choose the influencer:** use the current upload/My Influencers controls and generate the starting image as today. Image generation begins only on its existing action.
3. **Talking Head script:** show an expandable **Original script** with the reviewed introduction's time range and an editable **Your script**. A fresh draft can visibly start from that original. An existing user-edited draft is restored instead of overwritten. Full transcript context can be expanded, with demo narration visibly identified outside the introduction.
4. **Remix for my business:** use the business already saved in Settings and show its name. Return one editable script draft. Preserve the source setup and order; adapt relevant product, audience or problem elements. Do not turn every source into generic promotional copy. Missing business context offers the existing Settings path and preserves the text.
5. **While the image generates:** allow reading, editing and remixing the script. Use independent loading/error states; a failed remix preserves the previous script and does not cancel the image job. Editing during an in-flight request prevents a late response from replacing newer text. Deliberate reremix uses the approved source plus current user guidance and keeps the previous result recoverable.
6. **Use this starting frame:** carry the approved image, its original ordered raw influencer IDs and the reviewed script draft into the same Talking Head workflow. Keep the existing button label, with nearby copy explaining that the displayed script is carried forward. Selecting an image from older history restores its identity references without rolling back newer script edits. If script preparation is incomplete, the user can keep preparing the frame and finish the script in Create; video submission remains gated appropriately.
7. **Create:** show the same editable script with no divergent second copy. Change continues to add/remove/upload person photos independently of the script. Retain the single starting-image preview. Check script length against the user's selected duration, display a clearly approximate speech-duration estimate, and require Sound on for a spoken-script generation. Do not silently change the sound preference. A user may deliberately choose a silent workflow without pretending it speaks the script.
8. **Generate video:** freeze the current image, photo selection, exact approved words, scene directions, duration and sound setting into one immutable generation request. The server validates ownership and source identity. Demo narration is not included. The existing Demo/Edit/Schedule flow follows afterward.

The introduction ends at a **reviewed demo boundary**, not an assumed silence or the end of the first sentence. If talking continues over demo footage, the time range still separates those purposes. Ambiguous transitions stay needs_review. For an introduction longer than the supported clip, show the mismatch and allow explicit shortening or a shorter reviewed selection. Do not truncate, accelerate speech, or quietly pretend that one 10–15s output recreates a 17–47s monologue. Multi-clip generation is a separate future scope.

## Transcription approach

Perform a one-time import for the 25 packaged sources, deduplicated by actual source hash. Extract full audio locally with the installed FFmpeg tooling. Submit only the prepared audio to **ElevenLabs Scribe v2**, as the user suggested; image/video uploads to Google are unnecessary for this step. Scribe supports word-level timestamps ([official API](https://elevenlabs.io/docs/api-reference/speech-to-text/convert)). Keep verbatim mode, actual language detection, no transcript-edit feature and no business-biased transcription. Business adaptation happens afterward.

Implement the catalog import separately from finished-video subtitle policy. It must accept these complete measured sources under a bounded import limit without increasing the global 60-second subtitle limit. Reuse existing extraction/validation techniques where compatible; do not weaken the production subtitle adapter. Current sources fit easily within 4MiB as mono PCM16 16kHz audio; each source is checked before submission. If future imports require chunks, retain exact offsets and deduplicate overlapping words; do not guess timestamps.

Cache and checkpoint each source/model/policy request before proceeding. Preserve a durable result per successful call; an uncertain paid request must not be automatically resubmitted. Save full source hash, measured duration, audio hash, provider/model/policy, original transcript, real word times, language, reviewed introduction range and review status. Human corrections create reviewed text alongside the original provider output, preserving both. Hearing/word uncertainty and the demo boundary must be reviewed against the actual video and audio before ready status.

Publish only reviewed catalog records; cache lookup during Recreate is then immediate and incurs no additional transcription charge per user. The initial admin import may use versioned JSON following the existing catalog pattern; a new production database transcription system is not required for this fixed catalog. Future user-upload transcription would require a separate owner-scoped backend job design.

Local Whisper remains a possible later cost comparison. In the earlier audit its installed PyAV dependency was blocked by Windows Application Control; that attempt did not produce transcripts or establish a working local option. Do not install more dependencies or bypass that policy as part of this feature.

## Remix backend and model selection

Use a dedicated **spoken-script purpose**, resolved against the Talking Head catalog and reviewed transcript hash/range. Reuse the current authentication, business lookup, durable claim, daily allowance and receipt machinery, with backward-compatible request/receipt parsing. Do not merely pass format hook to the current overlay implementation.

The request identity must include its purpose, reference ID, source/transcript version and reviewed range, user guidance and an explicit business-context revision. The saved input freezes the business profile, exact script source, model, reasoning setting and prompt version. Recovery reads that receipt rather than running a new request or substituting today's business profile. Old Hook/Wall/Slideshow payload hashes and receipts remain valid.

Use a script-specific schema with ordered spoken beats and final spoken text. The UI presents one natural script; the backend retains the source mapping. Do not label source word timings as timings for rewritten words. Store language, estimated speaking duration and review warnings separately. The full source transcript remains immutable and does not become an overlay.

The script prompt should:

- Preserve the original curiosity/setup, sentence roles, order, tone, language and approximate speaking length.
- Make the smallest natural business-relevant changes, using only saved business facts and explicit user guidance.
- Avoid transferring personal experiences, testimonials, savings, outcomes, statistics, guarantees or capabilities from the source to this business. Rewrite unsupported first-person claims truthfully.
- Keep spoken words separate from scene/camera/gesture directions and from demo narration.
- Treat source transcript and business data as data, not executable instructions.
- Return structured script only, without captions, emoji instructions, commentary, extra CTA or invented dialogue.

**Provisional recommendation: Luna with explicit medium reasoning first, Terra medium as the quality challenger.** This is a candidate selection, not a claim that spoken-script quality has passed.

| Exact candidate | Standard text input/output per 1M tokens | Role in validation |
| --- | --- | --- |
| gpt-6-luna | $0.10 / $0.50 | Current efficient candidate for this new feature; official docs support medium reasoning. |
| gpt-6.1-terra | $1.00 / $5.00 | Challenger for natural spoken adaptation and difficult business changes. |
| gpt-5.6-luna | $0.20 / $1.20 | Existing Hook source-code default and historical baseline. |

Prices checked 4 November 2026: [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra), [existing Luna baseline](https://developers.openai.com/api/docs/models/gpt-5.6-luna). Account availability and actual billed reasoning-token usage are not verified. Terra's listed rates are ten times the corresponding current Luna rates; that does not prove a tenfold per-request bill. Measure usage, latency, failed outputs and review effort.

Keep a separate Talking Head script model configuration. Do not migrate Hook/Wall by changing their shared environment variable. The existing Remix adapter only explicitly applies medium for model names matching gpt-5 and otherwise sends temperature; setting a gpt-6 model name alone therefore does not establish medium reasoning. The new branch must explicitly support and test the chosen model's API parameters and structured output. No tools or web search are needed for this writing call.

The earlier five paid gpt-5.6-luna/medium Hook tests are documented in `docs/hook-remix-medium-five-review-2026-10-24.md`; they are useful baseline evidence for short overlays only. Their paid authorization is exhausted and does not authorize a new benchmark. No automatic second-model fallback or paid reviewer is proposed.

## State, prompt and implementation boundary

Use a typed script draft scoped by owner, workflow draft, reference hash and introduction range, separate from the starting-image generation draft. Retain original/remixed/manual origin, current revision, source provenance and Remix receipt where present. Reload restores it; source or owner changes discard late responses. Explicitly clearing the script remains a real edit. Validate any saved draft before restore.

In video generation, compile an explicit approved dialogue block plus separate source scene/action directions. The server and worker must receive the same approved text, not infer it from mixed free-text instructions. Persist that text and provenance in the generation request/receipt and include them in the idempotency fingerprint. Sound on requests exactly those words; voice references influence voice, not dialogue. A model prompt alone cannot guarantee verbatim delivery or accurate lip-sync: generated audio must be checked afterward.

Candidate implementation files, subject to the validation results:

- New `lib/explore/talking-head-script.ts`, reviewed transcript catalog/store and an offline `scripts/transcribe-talking-head-references.mjs` import with tests.
- New script prompt/validation module; scoped additions to `lib/explore/remix-text-api.ts` and request/receipt parsing, with a dedicated purpose instead of Hook overlay routing. Existing `explore_text_remixes` JSON receipts appear capable of storing it; deployed schema/permissions still need read-only verification before declaring no migration necessary.
- A Talking Head script section inside `components/explore/hook-starting-frame-workspace.tsx`; script state owned by `components/explore/hook-workflow-preview.tsx` and its workflow draft, not by an image-job receipt.
- Explicit optional script fields in `lib/explore/workflow-session.ts`, `workflow-generation-client.ts`, server generation contracts and `starting-frame-workflow.ts`, traced through the worker before submission. Backward-compatible recovery required.
- Focused tests for transcript provenance, Remix claims/model payloads, script state and exact generated prompt contents. Existing UI styles and controls are reused.

Rollback boundary: only the new script/transcript feature and its optional fields. No dependency upgrades, unrelated refactor, global styles, production settings, provider changes or schema writes are part of this plan. Builds remain prohibited without explicit user build authorization.

## Validation gates before implementation and release

1. **Transcript pilot:** manually review three representative full sources: short clear hook, longer introduction with demo voiceover, and difficult speech/background sound. Check every word in the selected introduction, especially brands, numbers and negations; validate monotonic word times and source hashes. Review the demo boundary using both frames and audio. Silence must not produce invented speech. Do not mark a source ready with unresolved critical words.
2. **Model comparison:** freeze six representative source/business cases and compare Luna medium with Terra medium on identical inputs (12 explicitly budgeted requests if this comparison is authorized). Cover same-domain and cross-domain adaptations, unsupported first-person claims, missing business facts, a generic hook that needs little change, and a long introduction. Judge source structure, business accuracy, natural speech and duration fit; record actual output, usage and latency without silently repairing results. Select the cheapest model that meets the quality bar; if neither does, revise the prompt before app wiring.
3. **Backend contract:** authenticating owner, closed catalog lookup, source/hash mismatch, changed business context, request-key conflict, duplicate click, timeout, failed save, quota, missing profile and historical receipt recovery. Assert selected model and explicit medium in the actual request payload. No new paid request on a recovery read.
4. **Interaction and persistence:** cached transcript loading, missing/needs-review transcript, image success plus Remix failure and the reverse, editing during a request, changing references/accounts, closing/reopening, reload, explicit empty script, old image history and manual script preservation. Script updates never regenerate the image. Raw-photo add/remove/upload and its original carryover stay intact.
5. **Generation contract:** exact approved words once in the prompt, no original dialogue appended after remix, no demo narration, correct source frame/timestamp, independent identity references, duration validation and honest Sound-off behavior. Existing unsupported ReAPI input combinations still fail before billing; no provider switch.
6. **Visual and hosted acceptance after implementation:** approved baseline comparison on desktop/mobile, stable image preview and usable footer, keyboard access, and real signed-in production transcript/Remix/receipt readback. Only explicitly authorized media generation can qualify spoken-word, identity and lip-sync quality. Mock tests and compilation cannot establish that result.

## Initial validation actually run

Read-only preflight passed. Catalog/OCR inventory and current callers/contracts were inspected. Existing tests were run without a build:

```text
node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/explore/remix-text-api.test.mjs lib/explore/remix-text.test.ts scripts/remix-text-catalog.test.mjs scripts/talking-head-references.test.mjs scripts/talking-head-full-sources.test.mjs
Result: 58 tests; 57 passed, 1 failed.

node --import ./scripts/worker-source-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test worker/src/subtitles/elevenlabs-provider.test.ts worker/src/subtitles/explore-policy.test.ts
Result: 16 passed, 0 failed.
```

The gallery failure occurs before its behavior assertions: its VM import map lacks `./use-starting-frame-preload`, which the concurrently edited `talking-head-references.tsx` now imports. This is a verified fixture/import mismatch, not proof that retired cards are visible. No fixture or application fix was made during planning. Incident `UGC-QA-20261104-TALKING-HEAD-GALLERY-FIXTURE` records it. Logs: `.tmp/talking-head-script-plan-base-tests.log` and `.tmp/talking-head-script-plan-asr-tests.log`.

**VERIFIED:** source inventory/count/durations, missing Talking Head records in current caption catalogs, existing API and provider policy tests above except the named gallery fixture, and code paths identified in this document.

**NOT TESTED / NOT VERIFIED:** new transcripts, transcript accuracy or boundaries, Luna-versus-Terra output quality/latency/cost, new UI, hosted database behavior, signed-in production flow, real generation and lip-sync, or full first-frame plus raw-photo provider support. No build, deployment, database mutation or paid provider call was made.

Preflight sources actually read: repository AGENTS instructions; full `nonnegotiables.md`; applicable Explore context/incident sections and previous folder/photo audit reports. Earlier bulk context/ledger output was truncated; a complete historical read is not claimed. Skills read: ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-video-prompt, ugc-starting-frame, ugc-regression-gate, openai-docs with model-selection reference, Supabase and remix-ugc-reference. Official OpenAI and ElevenLabs documentation and Supabase roles documentation were consulted. The Supabase changelog markdown fetch failed; no Supabase implementation followed.

Planning-only files changed: this document and an append-only incident entry in `docs/ai-context/clear.md`. Runtime protected behaviors were not changed; fresh visual and production acceptance remain NOT TESTED.
