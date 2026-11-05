# Talking Head opening-only references, 6 November 2026

Four unique sources were identified from three initial links, the screenshot and the follow-up link. The screenshot and follow-up both identify Talia grocery discovery, post 7680426189508431118. A fifth distinct reference remains unidentified.

| Original reference | New reference | Retained video | First excluded source frame |
| --- | --- | --- | --- |
| talking-discovery-full | talking-discovery-hook-v2 | 2.233333 seconds, 67 frames | 67 at 2.233333 seconds |
| talking-bittenbyaturtle | talking-bittenbyaturtle-hook-v2 | 2.933333 seconds, 88 frames | 88 at 2.933333 seconds |
| talking-carla-eatsss | talking-carla-eatsss-hook-v2 | 3 seconds, 90 output frames | 80 at 3 seconds |
| talking-taliameals | talking-taliameals-hook-v2 | 1.566016 video seconds, 47 frames | 47 at 1.566667 seconds |

The Carla original has variable frame timing. Its last hook frame starts at 2.633333 seconds and remains visible until the demo cut at 3 seconds. The 30fps derivative retains that hold. The Talia derivative has a sub-millisecond timestamp offset from encoding. No later action is added.

## Media review and storage

Inspected full-source overview sheets at one-second intervals, every source opening thumbnail through five seconds, and all 292 retained output thumbnails. All four final output frames were also inspected at larger size. The retained frames show only their respective talking-head reactions. Full ffmpeg error-checked decode passed for all four.

The original files and their catalog records remain available. New IDs provide independent hashes, opening PNGs, posters, source duration, prompts and transcript selections. This avoids rewriting historical job or saved-draft provenance.

Uploaded 16 immutable objects to the existing ugcsaas-media bucket, comprising four MP4s, four posters, four frame-zero PNGs and four source-frame indexes. All 16 public readbacks match their local SHA256 values. The new local catalog points directly to the uploaded MP4 and poster URLs. The stored-frame index uses the new MP4 hash and exact decoded opening PNG hash.

Evidence is in outputs/talking-head-hook-trims-2026-11-06. prepared.json records cuts, source/output frame counts and hashes. backend-verified.json records public readbacks. upload-manifest.json records exact object mappings. Original and derivative contact sheets are beside them.

## Recreate and Remix

The visible catalog replaces the four full examples with their hook versions. Original IDs remain resolvable. Each new generationPrompt describes the observed t=0 pose, timed facial/hand/camera sequence and complete ending. It instructs the model to use the user's own spoken message, finish the source action at its endpoint and hold if the selected model produces a longer clip. No output-quality claim is made from the prompt alone.

New transcript records bind the retained hook words to each derivative hash and duration. Existing spoken-hook ASR was reused as editable draft evidence. No new ASR or video generation was performed.

**Close glasses selfie needs speech review.** Its cached final word spans 2.52–4.04 seconds, while the visual demo starts at 2.933333 seconds. The derivative's exact audible endpoint has not been independently established. That new transcript is explicitly needs_review, and the existing server blocks new script Remix for it. The trim and timed visual direction are available. Confirm the retained audio before activating that script record. This is an intentional unresolved boundary, not a completed Remix path.

## Verification

37 focused tests passed, covering gallery replacement, old-source retention, hosted URL/source joins, real local video/frame hashes, source-script fingerprints, preparation, script API and importer failure guards, selection replacement, stale downloads and saved-session behavior. TypeScript no-emit and scoped ESLint passed. Whitespace checks passed.

The initial expanded restoration fixture incorrectly expected an old 43-second reference to pass the existing 30-second attachment policy. The fixture was corrected to retain the prior recovery cases and check full-source preservation separately. No runtime duration guard was weakened.

Backend media upload is verified. Website activation and authenticated playback/Recreate/Remix after release are NOT VERIFIED. No build, push or deployment occurred.

## Scope and preflight

Application/data files changed are lib/explore/talking-head-reference-catalog.json, talking-head-reference.ts, talking-head-source-manifest.json, talking-head-frames.json, talking-head-transcripts.json and talking-head-hook-reviews.json. Tests changed are lib/explore/talking-head-script.test.ts, scripts/talking-head-references.test.mjs and scripts/talking-head-full-sources.test.mjs. Added scripts/talking-head-hook-trims.test.mjs, four MP4/JPG pairs in public/explore/talking-head-references/v1 and four PNGs in public/explore/talking-head-frames/v1. Context, incident ledger and this receipt record the decision.

Consulted AGENTS, the global ledger, relevant Explore and incident sections, protected contracts and the context-memory, immutable-contracts, frame-analysis, video-prompt, opening-frame-prompt, UI-clarity, regression-gate and Verify Feature Wiring procedures. REPEATABLE_SOURCE_PROMPT_REVIEW.md supplied the source chronology and timestamp review method. Large histories were consulted by relevant sections under the prior scoped-history authorization.

Incident UGC-VID-20261106-TALKING-HEAD-DEMO-TRIMS stays OPEN for the missing fifth reference, Close glasses audio/script review and hosted frontend acceptance. Rollback is the scoped catalog/visibility change. Uploaded immutable objects can remain unused without altering old reference identities.

## Approval and Hook addition, 6 November 2026

The user reviewed the two displayed clips and approved both. The glasses and Talia spoken records now retain their editable cross_checked_draft status with explicit user-approval notes. The earlier glasses speech block is cleared by this manual acceptance.

The user also requested Talia in Hook references. Added explore-paired-hook-573ce74ab0b1421f00e93add using the same exact approved MP4 bytes and source frame already stored. Existing Hook import plumbing reads the additional release item, caption and source-specific phased motion through the reclassification registries. Its caption is the on-screen Trader Joe's text. Its Talking Head script remains the separately recorded spoken No way reaction. The video stays available in both workflows.

Added one WebP poster and original-audio MP3 to the media bucket. Source video and opening PNG are reused. Uploaded poster and MP3 readbacks match hashes. Hook source/link/MP4/caption/duration/motion resolver assertions pass locally. Broader release expectations now count106activeHooks and111historicalpromptidentities. The earlier uploaded16objects remain unchanged. No website release or generation.

Additional changed files are worker/src/lib/explore-hook-wall-reclassification-release.json, lib/explore/hook-wall-reclassification-text.json and hook-wall-reclassification-motion.json, their registry tests and active-catalog count assertions in lib/explore/hook-curated-frames.test.ts, hook-keyframe-motion.test.ts, hook-user-decisions.test.ts and scripts/explore-reference-audio-job.test.mjs, hook-reference-prompts-release.test.mjs, hook-reference-release.test.mjs and revised-recreate-prompts.test.mjs. The existing known stale image-prompt wording assertions in hook-user-decisions are outside this addition's acceptance evidence.
Final approval check:41focusedtestsPASS, TypeScript noEmitPASS, scopedESLintPASS,2newbackendobjectsverified. User-facing hosted gallery/Recreate/Remix acceptance awaits authorized release. No build/deploy.
