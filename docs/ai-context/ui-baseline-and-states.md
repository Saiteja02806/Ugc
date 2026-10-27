# UI Baselines and State Matrix

**Screenshots with red circles/X marks are BUG EVIDENCE, NOT approved pixel baselines.** Capture approved screenshots from a known-good commit or get an approved design reference before using visual comparison thresholds.

## Required states to protect

| Screen | Key states | Assertions |
|---|---|---|
| Hook Video / Generate | empty, restoring, loaded, invalid/expired frame, Change modal, generating, failed | Stable preview geometry; one loaded preview; Change opens source chooser; no duplicate tile; all tabs remain usable |
| Hook Video / Upload | empty, uploading, done, failed | Existing layout and file semantics unchanged |
| Hook Video / Creative Assets | empty, selected, previewing, error | No cross-tab selection leakage |
| References gallery | default list, filter, selected card, loading preview, invalid media, revisit | Selected card and selected account map correctly; cards not warped; reference IDs stable |
| Your videos | empty, processing, ready, failed, refresh | Correct generation target/source IDs and durable result |
| Demo | available video, loading, error | Playback and navigational state unaffected |
| Schedule | no platform, chosen account(s), date, time, invalid input, pending request, persisted, failed, refresh | 24-hour UI picker, correct local time, successful backend durable schedule, no duplicate post |

## Viewport testing

Use the repository's existing target sizes. If none are documented, start with desktop 1440×900, intermediate 1024×768 and mobile 390×844 and confirm these are appropriate. Test zoom/scroll at fixed side-pane heights; do not cut off fixed schedule CTA. Record browser/version and whether fonts/assets finished loading.

## Screenshot diff rule

1. Run the same seeded state at the same viewport, browser and timezone in BEFORE and AFTER.
2. Mask ONLY expected dynamic content (timestamps, changing media thumbnails). Do not mask changed buttons/controls.
3. Review differences manually; update baselines only when the change is explicitly approved. A passing threshold cannot alone prove UX correctness.
4. Save before/after screenshots and changed regions in the task report.

## User-level acceptance flows

1. Select a reference video -> generate a suitable starting frame -> replace it using Change -> generate video -> preview output -> navigate away/back -> verify persistence.
2. Verify face-clear source chooses first frame; occluded face considers a later timestamp; generated prompt remains aligned to selected source timestamp.
3. Choose TikTok/Instagram/YouTube account targets -> select date/time (24-hour) -> schedule -> refresh -> confirm backend job/targets -> verify worker picks up at selected local time and status reflects publish or failure.
