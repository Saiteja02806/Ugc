# Explore Schedule preview and latency fixes — 12 October 2026

The Schedule screen can now play the current Hook and Demo edits as one continuous browser preview while its publishing file prepares. The preview never becomes a media asset or a schedule submission. Publishing continues to require the owned, ready, verified finished file.

## Changes

- The preview follows independent trims, timed text, Demo crop/pan, original volume, selected audio and the reference soundtrack. Hook text does not cross into the Demo.
- The next clip preloads. A changed source or draft starts a fresh paused player; hiding the browser or leaving Schedule stops playback. A finished file arriving during playback does not interrupt it; “View finished video” selects that file explicitly.
- Saved audio and source settings must load before Play becomes available. Loading failure is visible and cannot silently omit selected audio.
- Foreground finishing checks use a one-second read-only interval. Hidden tabs skip that interval and resume on visibility/focus. Ordinary workflows retain their four-second interval. An uncertain response automatically recovers the existing request without creating another render.
- A single-source trim/text edit without subtitles shares the composition encoding pass. Paired music remains a separate audio mix using video stream copy. Existing subtitle and two-source editing paths retain their previous pipeline.
- Finished Explore exports can pass scheduling validation when their owner, completed receipt, output identity, fingerprint, draft and MP4 contract match. Foreign, unfinished and unverified combined assets remain rejected.
- Explicit user audio on a paired-reference single-clip edit stays in its saved clean mix. The registered reference soundtrack is applied once afterward; generic final/background music does not replace it.

## Local measurements

These are local observations, not a production service-level guarantee.

| Check | Observed time |
| --- | ---: |
| Edit → visible sequence preview, both media ready | about 1.4 seconds |
| 720×1280, 30fps, 3-second Hook with text | 0.97 seconds |
| 1080×1920, 30fps, 5-second Hook with text | 1.20 seconds |
| 1080×1920, 30fps, 5-second Hook + 8-second Demo composition | 2.41 seconds |

The previous 1080p Hook text sample took 2.09 seconds and encoded twice; the new sample encoded once. Timing varies with machine load. The joined-video path was not changed into a single worker job: existing frozen receipts and stage recovery remain intact.

Cloud worker startup, queue wait, network transfer, large sources and optional subtitles can still make the publishing file take longer than five seconds. The fast-preview approach removes that export wait from the user's ability to review the sequence; it does not claim a five-second maximum for all exports.

## Verification boundary

Checks use actual local browser media and isolated worker/API test fixtures. The browser test trimmed Hook to 2–4 seconds and Demo to 1–3 seconds, verified a four-second continuous sequence, confirmed Hook text disappeared at the Demo boundary, and confirmed both players stopped. Desktop and mobile layouts were checked with one visible player and the original left-side Create, Edit and Schedule tabs.

No production publishing, paid generation, hosted data changes, push or deployment was performed. Authenticated production timing and delivery remain to be measured after deployment.

The final focused run passed 119 preview, editor, finishing-state and scheduling tests. Separately, 74 targeted worker tests passed for reference audio, ownership, storage recovery, composition, subtitles and single-pass editing (the worker run overlaps the single-pass checks). Root TypeScript, scoped ESLint, worker build and whitespace checks passed. A fresh page load restored the saved drafts and displayed the first preview frame; the 390×844 phone check kept playback controls above the Schedule footer without horizontal overflow.
