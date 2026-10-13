# Explore functional fixes and review, 13 October 2026

This work implements the follow-up to the read-only Explore audit. Changes are local and production acceptance is still pending. The worktree also contains intentional changes from other concurrent tasks; none were reset, staged, pushed or deployed by this task.

## Step-by-step status

1. **Slideshow scheduling:** reviewed the existing saved-Library-item validator and title correction. Saved slideshows do not require video clips. Inline confirmation, exact source identity, account/time validation and durable retry remain covered by local checks.
2. **Subtitle recovery:** a failed terminal job with unconfirmed transcription no longer locks unrelated editing forever. A different saved video or subtitles-off edit can continue. The old exact draft and request identity are archived before replacement; storage failure blocks a new dispatch. The same-source style-only action only checks the old request. Terminal uncertainty no longer polls indefinitely or offers cancellation against a terminal job. Earlier requests are checked with GET only; an earlier finished output is recoverable from Creative Assets. Earlier caption-only transcripts retain their original server request and browser identity, but a direct archived-caption restore control remains future work.
3. **Image result recovery:** reviewed existing mixed-batch restoration and moderation-message changes. Successful candidates remain visible with failed siblings after reload. Moderation failures explain the rejection without suggesting an unchanged blind retry.
4. **Finishing delays:** verified unchanged-source reuse, compatible direct audio composition and versioned single-job composition using real local FFmpeg tests. Reviewed the opt-in authenticated warm receiver and validated Terraform configuration. Startup latency is not solved in production until that worker/routing release is enabled and measured. No infrastructure apply was performed.
5. **Colors and preview:** existing workflow CSS now inherits the app palette locally; the ready indicator uses the shared success token. Talking Head preview stays visible. The latest marked screenshot request removes the Hide/Show control and the redundant heading, description and empty Library shortcut/section; this supersedes the earlier hide-toggle preference.
6. **Durability and loading:** new ordinary image/video submissions save exact input and request identity before POST and use a cross-tab lock. Explicit recovery first checks owner/scope-scoped jobs, including terminal results; hydration does not submit paid work. Account changes cannot reuse another owner's submission. Library reads have bounded token/body deadlines, owner-scoped caches and visible refresh/retry states. Decorative cover videos attach media only near the viewport and pause offscreen/hidden or under reduced motion.

## Review corrections

The review found and corrected a cross-tab recovery-history overwrite and stale account/scope submission state. The independent agent also identified a partial-admission discovery race and inconsistent slideshow metadata reader scope; those corrections passed 62 focused checks and were independently inspected by the primary agent. Partial acknowledgements now preserve a separate GET-only discovery identity; later children merge with newer stored jobs and retain the original scoped prompt/ratio metadata without becoming the current selection. Authentication waits in finishing/status/output/cancellation are now bounded as well as fetch waits. Existing status checks do not automatically retry mutations.

Some older VM fixtures assumed removed imports, route files, media-model labels and panel placement. Fixtures were reconciled with the current contracts while preserving the behavior assertions. Source guards and paid-operation identity checks were not relaxed to make tests pass.

## Validation evidence

- Integration, generation UI, source selection, cached library, preview and recovery suite: **129 passed** before the independent partial-discovery follow-up.
- Combined scheduling/generation/finishing, SQL receipt and character regression suite: **206 passed**.
- Finishing recovery/store/deadline follow-up: **47 passed**.
- Application TypeScript, scoped ESLint and worker compilation passed.
- Full Next.js production build passed after retrying outside the sandbox; the initial build failed on a filesystem EPERM, not a compilation diagnostic.
- Terraform configuration validation passed; no plan/apply or warm-instance change.
- Wider real-render subtitle suite initially failed on sandbox temp-file rename permissions. Moving its temporary directory inside the workspace resolved that; a remaining VM import fixture was corrected. The full final suite passed **104/104** checks.

Final restoration and schedule regression run: **365/365** passed. The reviewed Wall single-video background-scheduling path and its live preview follow-up passed **87/87** checks. The latest compact Talking Head correction passed **102/102** checks, with TypeScript and scoped ESLint passing. The independent quantity audit passed **171/171** checks and **32/32** actual worker fixture checks. Suites overlap, so these totals should not be added into a unique-test count. Logs are in `.tmp/explore-fixes-20261013/`; the full production build above predates the final UI changes.

## Production and release dependencies

The latest read-only check resolves `www.getugcpilot.com` to deployment `dpl_H2K9hU7bq11m6fgNjyK59bTPmQkJ`, source `e3de4a4eb66cb7c7c6e6de6bda9bc9062aafbc63` (`codex/mcp-library-content`). It supersedes the earlier recorded website revision. The deployed commit does not contain `/api/explore/schedules`. The production migration inventory still does not include the local three-output, clip-draft, pending-video-schedule and caption-review migrations. Keep dependent feature gates disabled until compatible database, worker and website contracts are released and verified together.

Recommended release order: validate/apply backward-compatible migrations; release the compatible worker; release the website with the intended gates; enable the reviewed optional warm receiver only with its authenticated Cloud Tasks routing and cost/configuration plan; verify real production flows and timings. Rollback disables newly enabled gates and restores the previous website/worker revisions; additive receipt data should be preserved.

Production user-flow acceptance cannot be claimed from local previews. This task has not started paid generation, submitted a schedule, published a post or deployed changes.

## Final UI direction and restoration

The nine-variant prototype and the single scrolling workspace study were rejected. The user chose the supplied compact screenshots: narrow left controls, stage navigation within that panel, and preview/gallery right. Functional recovery and scheduling changes are retained; no Git rollback was used.

| Workflow | Restored presentation |
| --- | --- |
| Hook video | Create / Demo / Schedule; Generate / Upload / Creative Assets; Quality and Videos immediately visible; dense right reference gallery |
| Slideshows | Create / Edit slides / Schedule; reference upload and slide-version count; dense right image gallery |
| Wall of text | Create / Edit / Schedule; immediately visible generation settings; single-video text editor and live Schedule preview |
| Talking Head + Demo | Create / Edit demo / Schedule; three direct source choices; square image/video/audio reference controls; Your instructions; both settings rows visible; preview always shown |

The last marked screenshot explicitly removes Talking Head's additional title/description, Hide/Show button, Library shortcut and empty Library section. These are removed from this route. Reference popovers, uploads, audio ownership, caption recovery and explicit scheduling confirmation remain wired. Audio references guide vocal delivery with Seedance 2.5, up to 30 seconds; generation contract checks verify the uploaded owned audio ID. Audio reference guidance is distinct from Demo background music.

Desktop controls use 360–440px and galleries use 16px horizontal gaps. The populated 9:16 Hook/Demo overview has adjacent 328px cards with a 16px card gap; measured visible media-edge gap is 49.6px, including internal card padding. Expanding either editor retains its larger editing surface. App theme tokens remain inherited: local background `#1f1f1f`, card `#292929`, accent `#ff7045`.

Primary browser checks covered all four Create, Edit/Demo and Schedule screens at 1536px, with populated clip checks at 1800px. Independent browser review confirmed all four at actual 390px without horizontal overflow, plus compact pane switching and Schedule fields. That phone review preceded the final Talking Head removals/tile simplification; source checks pass, but a fresh final phone capture is still needed. Development compilation and browser-control timeouts are separate from production render latency.

Review screenshots are in `.tmp/explore-fixes-20261013/ui-review/`. Earlier `talking-head-restored-final.png` and `talking-head-audio-reference.png` captures precede the user's last removal request; the final `talking-head-compact-final.png` capture shows the corrected compact form at 1280px. The audio picker was re-opened successfully after the removals. Do not use the older screenshots as final acceptance.

## Scheduling wait recheck

The new local pending-schedule path supports Hook, Talking Head + Demo and Wall of Text before the final MP4 exists, behind the existing capability gate. It persists an exact owned-media snapshot and schedule acknowledgement before rendering; only verified finished output can become platform publishing targets. Slideshow image posts schedule their saved Library sequence without video composition.

The recheck found Wall lacked a producer for that pending snapshot after its Demo panel was removed. A reviewed single-clip producer now freezes its trim, timed text, original sound level and chosen background audio/playback using the established one-pass edit contract. It guards source/account changes, loading/errors, stale confirmation and unmount. The capability-disabled path still exports first. The Schedule preview uses the existing local sequence player and accurately says the final file prepares in the background. No render is submitted merely by opening that preview.

Production is **not verified faster**. A fresh read-only aggregate found 19 completed matching finishing jobs in the previous seven days: **116.1–227.2 seconds**, median **171.9 seconds**, median pre-start **157.5 seconds**, median worker time **12.0 seconds**. Latest completion: 12 October 2026, 18:42:07 UTC. No newer completed sample proves improvement. These are backend job timings, not a measured schedule acknowledgement duration. Relevant migrations are still absent, and the new pending-schedule API is absent from the deployed source.

## Multiple-output recheck

All four local workflows preserve 1, 2, 3 or 4 outputs through selectors, billing, distinct jobs and recovery. Production offers 1, 2 or 4. Fresh production receipt constraints and both Talking Head batch/recovery validators still accept 1, 2 or 4; three needs the additive migration and website release.

Two is already supported. For Slideshows it means two versions of the selected slide, not two whole slideshows. For video workflows it means two alternatives; the selected one is edited and scheduled. Individual provider rejection can still yield a partial result. Ordinary admission may partially succeed, while Talking Head reservation is atomic. No live paid batch was submitted for this verification.
