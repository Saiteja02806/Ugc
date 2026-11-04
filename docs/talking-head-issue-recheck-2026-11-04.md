# Talking Head issue recheck and narrow corrections — 4 November 2026

Status: source-selection defect corrected locally; one caption-supported hook spelling corrected. Broader transcript/word-boundary review and video-review-gate policy remain OPEN. No deployment or production configuration changes.

## Corrections

1. A fresh reference no longer inherits unrelated Create instructions. TalkingHeadScriptSection uses initialScript only when the caller explicitly marks it as same-source preferred. Otherwise it restores that source's saved script or loads its hookText. The parent already scopes preference to the active starting-frame reference. Existing A/B saved drafts and pending Remix markers are preserved. No blanket browser-storage deletion or historical receipt migration.
2. The native Sawyer source frame at4s visibly captions ChatGPT. Corrected only the editable selected hook and its offline importer, with a correction evidence note. Raw ASR fullText, segments, response/hash, source hash and draft status remain unchanged. Existing saved user scripts are not overwritten. This confirms the spelling correction, not complete auditory transcription accuracy.

## Files changed by this continuation

- components/explore/talking-head-script-section.tsx — one initial-fallback condition plus source-ownership explanation.
- scripts/talking-head-script-section.test.mjs — selected-source fixture support;3tests for freshB/A→B→A, same-source active words and pendingArequest recovery acrossB.
- scripts/import-talking-head-transcripts.mjs — caption-supported Sawyer hook correction.
- lib/explore/talking-head-transcripts.json — Sawyer hook/correction note only; regeneration produced byte-identical25-record corpus.
- lib/explore/talking-head-script.test.ts — corrected hook assertion plus raw-ASR preservation/evidence assertions.
- EXPLORE_CONTEXT.md; docs/ai-context/clear.md; docs/ai-context/nonnegotiables.md — append-only correction and protected source-isolation rule.
- docs/talking-head-predeploy-audit-2026-11-04.md — follow-up linking these corrections while retaining the original audit.
- This receipt. Ignored diagnostics and source-frame PNG in .tmp/local-https.

## Validation

211/211 focused tests PASS,0failures/skips after final correction. Includes actual script component/API, typed video client/API contract, reference/full-source catalog, parent handoff/Demo/session, starting-frame tabs and raw-photo retention. `.tmp/local-https/talking-head-source-fix-tests.log`.

Original regression diagnostic now8/8PASS, compared with7PASS/1FAIL before repair. `.tmp/local-https/talking-head-cross-source-diagnostic-after.log` versus the prior diagnostic log. These8overlap the existing component tests and are not added to211as independent coverage.

Nonincremental noEmit TypeScript PASS, scoped ESLint PASS, scoped diff whitespace checks PASS. Logs `.tmp/local-https/talking-head-source-fix-{types,lint}.log`. No build command. Offline importer rerun touched only its expected catalog, with before/after exact bytes equal; no network/provider calls. Source evidence `.tmp/local-https/sawyer-transcript-review-t4.png` was actually viewed at original resolution and clearly spells ChatGPT.

## Protected behavior and remaining limits

VERIFIED by executable source tests: same-source manual/empty edits stay authoritative, A/B draft separation and returning restores saved words, uncertain requests retain Check saved remix without POST, stale replies keep newer edits, source/model/ownership/Sound/duration constraints, identity photo retention, frame/script handoff and Demo/session isolation.

VERIFIED by scoped code change: no layout/controls/CSS, source-opening/timestamp selection, image prompts, Terra medium/promptv2, provider routes, scheduling or billing changes. Existing UI screenshots from preparation-section work are historical; no fresh signed-in desktop/mobile browser acceptance was obtained for this content-only continuation.

NOT VERIFIED / STILL OPEN: complete listening/word review and hook boundary validation across25source drafts; video review-checkbox enforcement (currently Remix-only); fresh real-provider image/video continuation; generated speech/lip-sync/identity and production acceptance. All25records remain draft/cross_checked_draft, not certified ready. Existing saved words that were contaminated before this fix or contain old ASR spelling are intentionally preserved; user correction/review is needed. The repair prevents fresh cross-source fallback, not a guessed migration of past user edits.

The current importer uses saved closing phrases and whole-ASR fallback; no separate AI hook-detection prompt was secretly added. This review did not change that architecture or make new paid ASR/Remix calls. Keep release on hold for the remaining readiness gaps.

Preflight sources actually read: repository AGENTS instructions, full protected contracts, relevant complete Explore/clear incident sections under the prior user waiver, original predeploy audit, actual component/caller/store/importer/tests and existing Next client-component guide. Skills applied/read: ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-regression-gate; source inspection follows the existing frame-analysis procedure. Read-only tools/preflight.py passed prerequisites. Original OPEN incidents recorded before fixes; UGC-VID-20261104-TALKING-HEAD-CROSS-SOURCE-SCRIPT is locally corrected with tests, hosted acceptance unverified; UGC-QA-20261104-TALKING-HEAD-TRANSCRIPT-READINESS remains OPEN. Historical reports/findings retained; rollback only the listed fallback/correction/tests, preserving unrelated shared work.
