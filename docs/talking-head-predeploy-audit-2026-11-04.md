# Talking Head pre-deployment audit — 4 November 2026

**Decision: do not deploy this feature as-is.** The spoken-script/Remix architecture and core guards work, but a new-source script-selection defect is reproduced and the hook corpus is still draft quality. This is an audit, not a runtime repair or deployment authorization.

## Release-blocking finding: previous-source script can override the new hook

CODE CONFIRMED and reproduced. `components/explore/hook-workflow-preview.tsx:440` always passes current Create instructions as initialScript. The child's fallback in `components/explore/talking-head-script-section.tsx:17` uses a nonempty initialScript even when preferInitialScript is false. The source loader at line51 then prefers current.script over the newly fetched hookText.

Trigger: use/edit a script for reference A, then Recreate previously unopened reference B in the same workflow. B has a different source/hash and fresh source-scoped storage, but inherits A's words. Those words can then be saved/remixed under B's source metadata. The original-hook disclosure still shows B, making the mismatch easy to miss. Same-source Create priority, including explicit empty edits, should remain; it must not seed an unrelated new source silently.

Executable diagnostic: `.tmp/local-https/talking-head-cross-source-diagnostic.test.mjs` runs the actual component with the existing isolated React/API harness. Seven existing tests pass; the additional new-source assertion FAILS: actual Words from a different reference, expected Try this. Parent caller and reference-selection code inspected to establish the real input path. This is not a new live paid request or a fabricated provider result. Log: `.tmp/local-https/talking-head-cross-source-diagnostic.log`.

Required regression before release: A→B→A, new B loads its own hook, returning A restores its owned draft, same-source active Create edits/explicit empty stay authoritative, stale requests never overwrite B. Repair only the scope of the initial-script preference; do not discard saved scripts globally.

## Transcript and hook extraction findings

There is **no separate AI prompt that detects the hook boundary** in the implemented pipeline. Offline ASR transcribes full audio without business context. ElevenLabs Scribe was attempted but produced no transcript because of payment_issue; the cached corpus actually uses OpenAI whisper-1, temperature0, verbose_json, word and segment timestamps. No new transcription request was made in this audit.

`scripts/import-talking-head-transcripts.mjs:8` defines13 per-reference closing phrases. It takes the first matching phrase prefix; the12 other catalog records default to all ASR text (`:33`). Three pilot end times are explicit; other boundaries use a normalized word-prefix length estimate (`:40`), not an independently verified sentence/shot classifier. Seven of20 visible records use all ASR text. Many of these are genuinely short spoken reactions followed by visual demos; fallback alone is NOT proof of demo leakage. It does mean the importer cannot certify that future/full spoken demos are excluded.

Fresh checks read all25 source videos and cached ASR JSONs: 25/25 source SHA matches,25/25 ASR response SHA matches,25/25 fullText equals raw ASR text. There are20 visible and5 archival records. All25 remain draft/cross_checked_draft; only3 have documented independent cross-checks. Full text and hook text are separate. The UI loads hookText into the editor and sends displayed script only to Remix; the fullText disclosure is not automatically sent to the writing model. Later fullText/demo material is not appended to the approved spoken block by the video compiler.

**Wording remains unverified across the corpus.** A concrete example is `talking-studywithsawyer` (`lib/explore/talking-head-transcripts.json:1120`), whose hook says chatubt. This needs source-audio/caption review, not silent guessing or ASR re-generation. Existing manual corrections for ChatGPT in Katie and God bless in Tessa preserve raw outputs.97 zero-duration ASR words remain flagged. They are not trustworthy word-by-word timings; current app does not use them for rewritten-word synchronization. Audio stream offsets include0 and0.042993s, so do not promote ASR seconds to source-frame-precise alignment without accounting for offsets.

Six visible original scripts exceed the current2.8words/s estimate at the15s maximum of these Talking Head starting-frame routes: warm-story32.5s, mug-story43.3s, emmgr4c318.6s, katiemeidt825s, studywithsab70.4s, car-story-full15.8s. Some source speakers are much faster. The current implementation intentionally blocks these unchanged scripts rather than truncating/accelerating them. Users need editing/Remix to fit; this is not support for every original introduction in a single clip. No automatic switch to a longer provider is authorized.

## Review-gate gap

The review checkbox is required for the Remix POST (UI and schema literal true) and reset when words change. However, `onChange(text)` carries only text; the parent stores preparation.script, not its reviewed state. Frame approval at `components/explore/hook-workflow-preview.tsx:141` carries it into Create, and generation validates nonempty text/Sound/duration/owned frame, not the checkbox. The compiler labels it APPROVED SPOKEN SCRIPT although the checkbox may never have been checked.

This is a code-confirmed review-policy gap, not evidence that the source full transcript is automatically submitted. Decide/enforce review for imported draft words before video generation while preserving deliberate manual edits and historical jobs. A passing Remix review test does not prove video review enforcement.

## Prompts and model that are correctly wired

- Runtime system prompt is byte-identical to the frozen promptv2 in the comparison artifact. Default exact model gpt-6.1-terra; Responses call explicitly uses reasoning.effort medium, strict JSON script schema, maxRetries0 and no model fallback.
- Prompt specifies spoken introduction only, minimal business adaptation, preserved rhetorical order/tone/language/closing bridge, supplied-business facts, no invented testimonials/income/statistics, no demo/extra CTA/stage directions and untrusted source/business data.
- Validator enforces shape, character/word ceilings and the specific Let me show you closing cue. It does not mechanically prove semantic grounding, all rhetorical structures or hook-only content. Human review remains necessary.
- Earlier comparison Terra9/9 vs Luna7/9 describes length/schema validation across6initial cases and3v2 follow-ups, not9independent human-quality passes on all25sources. Final v2 was tested on3cases from2source hooks. The websites adaptation is less vivid than the original; no general quality guarantee follows from schema success.
- Source lookup binds current catalog/source SHA. Remix admission validates transcript hash/business version/review and freezes model, reasoning, prompt version, exact input and hook range after a durable claim. Owned recovery does not regenerate. One earlier actual localhost receipt independently confirmed Terra medium/v2 and a successful result; no new live call here.
- Raw selected script is independent of scene directions, frozen into the request fingerprint, compiled once as quoted words, and saved with the final prompt in durable video input. Sound and estimated duration are checked before billing. ReAPI payload builders reject excess prompt length rather than silently slicing speech. Generated speech/lip-sync still requires real-output QA.
- Provenance maintenance caution: transcriptSha256 is the raw ASR response hash, not a digest of corrected hookText plus hookEndMs. Editing the import boundary/corrections alone would not change that hash. Future corpus revisions should separately version/fingerprint the reviewed selection and preserve historical receipts. No corpus edits made here.

## Fresh validation and boundaries

208/208 existing targeted tests PASS,0failures/skips; new diagnostic is7PASS/1FAIL and is not counted as additional release passes. Test files: talking-head-script unit/API/UI, workflow-generation API contract/client, source-video UI, Talking Head references/full sources, parent Demo/audio state, starting-frame UI, raw-photo carryover and workflow session. Exact command/log: `.tmp/local-https/talking-head-predeploy-tests.log`. Nonincremental noEmit TypeScript PASS; `.tmp/local-https/talking-head-predeploy-types.log` is empty. Scoped diff whitespace checks PASS.

All25 source/hash results and boundary-word comparisons: `.tmp/local-https/talking-head-predeploy-transcript-audit.json`. Tiny existing Sawyer sample at source-review003.jpg inspected, but this audit does not claim complete listening or new frame-by-frame review of every video. No additional ASR/model API requests, source transcription rewrite, image/video generation, cloud settings, migrations, production build or deployment.

Preflight uses existing AGENTS instructions, full protected contracts and relevant complete Explore/clear sections under the user's approved historical-read exception. Applicable skills read: ugc-context-memory, ugc-immutable-contracts, ugc-regression-gate, ugc-frame-analysis, ugc-video-prompt, ugc-starting-frame and ugc-opening-frame-prompt. Review scope is the source→ASR→hook selection→script draft→Remix→approved video prompt chain. Prior UI and live verification receipts are separate historical evidence; they do not replace the newly failing source-switch case.

Files changed by this audit: this report and append-only findings in EXPLORE_CONTEXT.md and docs/ai-context/clear.md; ignored diagnostic scripts/logs only. Application source and all concurrent user work preserved. Incidents OPEN: UGC-VID-20261104-TALKING-HEAD-CROSS-SOURCE-SCRIPT and UGC-QA-20261104-TALKING-HEAD-TRANSCRIPT-READINESS, linked to the earlier FULL-SOURCE-DIALOGUE incident. No release sign-off until the new regression passes and hook accuracy/boundaries receive review. Fresh authenticated full-refresh, live image/video output and production acceptance remain NOT VERIFIED.

Follow-up,4November2026: narrow source-isolation correction now passes the original failing diagnostic8/8 and211focusedtests. Sawyer editablehook spelling corrected against sourcecaption4s while preserving rawASR. See docs/talking-head-issue-recheck-2026-11-04.md. This supersedes the unfixed status of those two specific findings only; broader transcript readiness and video review-gate policy remain OPEN. No deployment.
