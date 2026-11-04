# Talia Talking Head duplicate cleanup — 5 November2026

Status: gallery curation VERIFIED locally. No deployment or production settings changes.

Scope contract: remove talking-surprised-story (1.567seconds, source TikTok7687894160086486286) from new Talking Head discovery; keep talking-taliameals (34.922seconds) and all its media/provenance/frame/transcript data intact. Preserve packaged short media/catalog entries for historical draft/reference recovery. Do not change source URLs, prompts, Terra/ReAPI, layouts, other workflows or other Talia posts. The long entry has existing attribution7680426189508431118; both prepared opening images were inspected and match. The linked TikTok page could not be accessed through web; no live source-content claim. User explicitly identifies the pair to curate.

Files/functions: visibleTalkingHeadReferences in lib/explore/talking-head-reference.ts; exact catalog/media/visibility and archived-recovery assertions in scripts/talking-head-full-sources.test.mjs and scripts/talking-head-references.test.mjs. Append-only Explore/clear record and this receipt. Acceptance: one fewer visible card (19), no short card in either legacy/starting-frame mode, unchanged long34.922s bytes/metadata, exact opening-frame link, short still restores saved work, gallery preview shows full duration. Rollback only the new filter clause/tests, retaining unrelated worktree changes.

Preflight: git status inspected; engineering/protected contracts and relevant complete folder-audit/Explore/incident sections read under existing user-approved historical-read exception. Context-memory, immutable-contracts, UI-clarity and regression-gate read. tools/preflight.py prerequisite discovery performed. No new prompts, frame selection/generation, transcription or image/video model calls.

Incident: UGC-UI-20261105-TALIA-SHORT-DUPLICATE OPEN before code edit.


Verification:42/42focused tests PASS,0failures/skips, including both gallery modes, unchanged25source/frame hashes, retained full Talia metadata, other Talia full post preservation, legacy short-reference recovery and neighboring parent state. Command: Node existing server-only loader/experimental-transform-types/experimental-test-module-mocks runner over scripts/talking-head-full-sources.test.mjs, scripts/talking-head-references.test.mjs, lib/explore/talking-head-script.test.ts and scripts/workflow-demo-audio-state.test.mjs. Log .tmp/local-https/talia-dedup-tests.log. Scoped ESLint passed; types outcome recorded below when confirmed. No builds or deployment.

Actual local gallery before change had one short and one full card. After hot reload: short card0, full card1, total19. Retained full preview loaded talking-taliameals.mp4, readyState4, browser duration34.920998s and displayed0.0/34.9s. Exact prepared opening PNG SHA256matchesbothsources:23160b6c94c977ccec15044c52f843a338c3ba09f29c71e4fead381bb06f8ea4. Full/source/provenance bytes were not rewritten. One browser read was interrupted by navigation during hot reload, then repeated successfully. No unrelated browser tabs changed by this task.

Visual evidence .tmp/local-https/talia-dedup-kept-full-preview.png was opened and inspected and shows the retained full-duration player. The earlier before capture showed mobile creation controls rather than the full gallery and is not accepted as a matched card-layout baseline. No CSS/layout controls changed; card presence was checked through actual DOM and both-mode component tests. Production, generated-output quality and a complete responsive screenshot diff are NOT TESTED.

Files in this incremental task: lib/explore/talking-head-reference.ts; scripts/talking-head-full-sources.test.mjs; scripts/talking-head-references.test.mjs; EXPLORE_CONTEXT.md; docs/ai-context/clear.md; docs/talking-head-talia-dedup-2026-11-05.md. No source/ASR files, prompts, Terra/ReAPI, user drafts, provider/scheduler settings or other worktree edits changed. Archived short files retained for historical recovery rather than deleting media out from under saved work.

Final npx tsc --noEmit --incremental false completed successfully (exit0, empty talia-dedup-types.log). Talia local curation checks complete.
