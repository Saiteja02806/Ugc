# Talking Head folder audit — 4 November 2026

Status: full-video catalogue additions verified locally; not deployed. Prompt implementation deferred following the user's instruction, “do not create a prompt for all this videos.” No batch prompts or transcripts produced. No builds, pushes, deployments, media generation or transcription-provider requests.

## Folder results

| Supplied folder | Result |
|---|---|
| D:/talking head links | All 11 MP4s already imported at full supplied duration. Ten byte-identical copies; Studyfetch Lauren previously converted from HEVC to H.264 with its 61.867-second duration retained. |
| D:/hookswithlinks/New folder (15) | Missing from Talking Head. Added Carla original, 43.100 seconds, rather than the 3.434-second short copy. |
| D:/hookswithlinks/New folder (37)/New folder | Missing from Talking Head and distinct from the existing parent-folder Expressive discovery reference. Added Talia original, 34.922 seconds, rather than the 1.867-second short copy. |

Existing eleven IDs: talking-sophia-designsthings, talking-emmgr4c3, talking-tessam-bible, talking-websites-explainer, talking-katiemeidt8, talking-studyfetchlauren, talking-sidghst, talking-studywithsab, talking-bittenbyaturtle, talking-studywithsawyer, talking-mumtipswithginny.

The catalogue now has 25 archival entries / 20 visible cards. Existing 23 entries, hashes, source links, frame bindings and exclusions are unchanged. Both new videos are copied byte for byte; exact frame-zero PNGs and preview posters are packaged. D: source files, existing short Hook sources and saved jobs/drafts are unchanged. New entries reuse the existing common compatibility directions; no per-video recreation prompt was authored.

Machine-readable evidence: `.tmp/talking-head-audit-20261104/folder-audit.json`, `production-media-audit.json`; original catalogue snapshots, frame sheets and test logs are in the same directory. These are temporary local evidence, not production deployment receipts.

## Recreate workflow findings and proposed approach

1. Keep the complete original for reference preview and source attribution. Separately bind a reviewed opening-hook interval to the same reference ID and full-source hash. The demo must stay outside the generated hook.
2. Inspect cuts, framing, gestures and expressions locally with FFmpeg and timestamped frames. For Carla and Talia, reviewed 0.25-second samples through both full endings show a person opening followed by app demonstrations. Talia's native transition is between frames46/47 at source1.533333/1.566667s. Carla's cut is around2.9s; its irregular timestamps require further boundary inspection. These visual observations are not speech transcription.
3. Extract only the hook's audio locally. Prefer an already available local recognizer, or ElevenLabs Scribe v2 for word timestamps when local inference is unavailable. Cache by source/audio hash, hook range, provider/model and policy version; transcribe once during reference preparation, not on every Recreate click. Review uncertain words and cut-spanning words; captions and lip shapes are not evidence of exact speech. Silence must never become invented dialogue.
4. Build a concise prompt from approved opening state, scene/camera/light, timed performance beats and verbatim reviewed hook speech. Preserve repetitions, pauses and delivery. Source controls action/scene; selected influencer images control identity under existing explicit appearance options. Demo footage and captions stay in the separate editing/composition flow. Explicit user script edits override copied dialogue; Sound on/off remains a deliberate choice.
5. Wire the same reviewed data through selection, starting-frame preview, approval, recovery, final server prompt and duration validation. Block an unsupported duration rather than squeezing speech into4s. Some supplied intros last17–47s before a demo; the user has not chosen a multi-clip route or approved which shorter sentence counts as the hook. Do not guess this across all references.
6. Inspect actual generated video against source timing and speech before claiming recreation quality. Exact replica or lip-sync is not guaranteed by a detailed prompt.

Code evidence:

- `components/explore/use-talking-head-reference.ts`: legacy video-reference selection seeds catalogue directions and attaches the full MP4; long references are preview-only on this path.
- `components/explore/talking-head-references.tsx`: the starting-frame route permits verified long-source references; legacy attachment preserves its30s ceiling. Existing cards/layout and preview controls need no redesign for the additions.
- `lib/explore/hook-keyframe-prompt-preview.ts`: Talking Head currently selects generic own-script directions and a4s preview; it does not use a reviewed per-source speech/action record.
- `lib/explore/starting-frame-workflow.ts`: Talking Head instructions currently prohibit source-script copying. Changing catalogue prose alone would not repair this final provider prompt.
- `components/explore/hook-workflow-preview.tsx`: starting-frame approval uses the model's default duration. The source duration also needs to distinguish full preview from hook action.
- `lib/explore/hook-starting-frame-history.ts`: history supplies generic directions and4s; recovery must eventually preserve new reviewed hook instructions without rewriting historical user edits.
- `lib/explore/workflow-generation-client.ts`: reference directions and user instructions are assembled separately; a nonempty user instruction is required. Recreate script prefill and precedence need an explicit implementation decision.
- `worker/src/subtitles/elevenlabs-provider.ts`: existing Scribe v2 adapter validates16kHz mono PCM, real word timestamps, detected English and bounded responses; no automatic paid retry. Reuse relevant validation/cache patterns; do not misuse final-caption ownership records as reference-catalogue transcription records.

## Transcription checks

No local recognizer was initially installed; no ElevenLabs credential was found in the checked local configuration/environment. Prebuilt faster-whisper packages were downloaded into an isolated temporary target without changing project manifests. Import failed because Windows application control blocked PyAV's motionvectors DLL. No audio inference or external transcription ran. A Gemini full-video analysis upload was rejected by automatic approval review and was not executed; the user then preferred local analysis/ElevenLabs. Do not bypass the Windows block or send videos elsewhere.

ElevenLabs supports Scribe v2 word timestamps: https://elevenlabs.io/docs/overview/capabilities/speech-to-text . Check the account's actual API pricing/allowance before estimating spend: https://elevenlabs.io/pricing/api?price.section=speech_to_text . Local compute is not a zero-cost production service; compare measured throughput/quality with Scribe using a small reviewed sample before selecting hosting. No benchmark or “cheaper and better” claim is established here.

## Verification and protected behavior

- 44 focused tests PASS using the repository loader and Node transform-types: Talking Head references/full sources, canonical source registry and shared prompt preview. Includes existing auth, restore, edited-direction, stale-download, failed-replacement, long-video and source-hash checks.
- Scoped ESLint and `npx tsc --noEmit --incremental false` PASS. Initial `git diff --check` passed; the final whole-worktree check found an unrelated concurrent extra blank line at `components/explore/recreate-workspace.tsx:280`, left untouched. This task's scoped diff check passes. No build was run. Initial baseline commands needed the repository loader and transform-types; those invocation errors were corrected before accepting the14baseline Talking Head tests.
- Both new full MP4s decode completely with FFmpeg `-xerror`; SHA-256 matches the supplied originals.
- Offline frame preparation verified25source hashes and generated exact t=0 PNGs. Original23catalogue/source/frame rows compare equal to their pre-change snapshots.
- All15supplied MP4 files rehashed to establish the originals were not modified;11previous packaged files retain original measured full durations and expected hashes.
- Production canonical route redirects from getugcpilot.com to vidmake.io. The Talking Head application path `/explore/create-hook` redirects to sign-in; authenticated gallery visibility/playback/Recreate remains NOT VERIFIED. Static media hash checks alone do not prove a card is present in the signed-in catalogue.
- All11previously imported full production MP4s returned HTTP200 with exact expected SHA-256 hashes. Lauren initially timed out and passed on a read-only retry. The two new local files have not been deployed.
- VERIFIED locally: full lengths, source links, t=0 provenance, archival recovery tests, unchanged old rows and source files. No application layout, generation runtime, model, Sound setting, Demo, scheduler, dependencies or configuration changed.
- NOT TESTED: fresh desktop/mobile UI acceptance (no authorized builds; existing browser fixture bundles with webpack and was not run), authenticated hosted gallery, new live files, provider generation, speech/lip-sync quality, production persistence or publication. These remain separate from the passing local tests.

## Files changed

- `lib/explore/talking-head-reference-catalog.json`
- `lib/explore/talking-head-source-manifest.json`
- `lib/explore/talking-head-frames.json`
- `scripts/talking-head-references.test.mjs`
- `scripts/talking-head-full-sources.test.mjs`
- `lib/explore/starting-frame-reference-source.test.ts`
- `public/explore/talking-head-references/v1/talking-carla-eatsss.mp4` and `.jpg`
- `public/explore/talking-head-references/v1/talking-taliameals.mp4` and `.jpg`
- `public/explore/talking-head-frames/v1/talking-carla-eatsss.png`
- `public/explore/talking-head-frames/v1/talking-taliameals.png`
- This report; appended task entries in `EXPLORE_CONTEXT.md` and `docs/ai-context/clear.md`.

Concurrent Hook motion changes and previous documentation were preserved. Rollback boundary: remove only these two added reference triplets/manifest rows and this task's test/count/documentation hunks. No old reference is replaced.

Preflight: read AGENTS.md, nonnegotiables.md, applicable Explore/Talking Head history and ledger sections, existing import/release notes and relevant callers/tests; ran tools/preflight.py successfully. Initial bulk context/ledger reads were truncated and do not establish a complete historical read. Skills actually read: ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-frame-analysis, ugc-starting-frame, ugc-video-prompt, ugc-opening-frame-prompt, ugc-regression-gate. Installed Next route-handler guide inspected. Application runtime edits were not made. Incident UGC-VID-20261104-TALKING-HEAD-FULL-SOURCE-DIALOGUE remains OPEN for hosted gallery and prompt implementation; local import has concrete verification.
