# Explore fast saves, background scheduling and form widths

Local implementation, 13 October 2026. No production migration, render, post, infrastructure update or deployment was performed.

## What the user sees

- Save edits stores the exact trim, text blocks and timing, sound levels, owned audio selections and supported framing as a versioned database draft. It does not export pixels. Preparing a publishing file remains a separate operation.
- Hook, Wall of Text and Talking Head + Demo can confirm a schedule inside their workflow before the finished MP4 exists, when background scheduling is enabled and the chosen assets are ready. The confirmation acknowledges **schedule saved, video preparing**. It does not claim that the platform publishing file is ready.
- The browser sequence preview continues to show the clips and edits while preparation runs. Uploading new footage/music and generating/reviewing requested captions remain real prerequisites; this change does not promise instantaneous uploads or speech recognition.
- Preparation carries independent opening/Demo edit snapshots into one worker job. It reuses the established renderer inside that job; this can still require several local encodes, but removes separate remote launches and intermediate transfers for those edits.
- The normal scheduler, already finished videos and Slideshow image posts retain their existing paths. Create, Edit and Schedule stay on the left.

## Why the previous wait was long

The prior production audit measured a matching opening edit, Demo edit and join chain totaling **8 minutes 56 seconds** of job time. Approximately **95%** was spent before worker processing. Each separate job paid the startup delay again. This is measured backend time, not an exact browser click-to-button trace. See [the production audit](./explore-render-delay-audit-2026-10-13.md).

Saving editable project data separately from processing an exported video is an established editor behavior; [Kapwing describes autosaved project work and a separate export step](https://www.kapwing.com/help/save-to-device/). Durable acknowledgement, an independently recovered queue and read-only progress checks follow the [asynchronous request-reply pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/asynchronous-request-reply). These references inform the design; they do not establish performance guarantees for UGC Pilot.

The new Save edits and schedule acceptance APIs await authentication, validation and durable database persistence, not FFmpeg, queue launch or a social platform scheduler. Their successful responses expose `Server-Timing: clip_save` and `Server-Timing: schedule_ack` respectively so rollout measurements can separate acknowledgement from rendering.

Historical Vercel logs for the final schedule POST were outside the available one-hour retention. A recent read-only lookup returned no matching schedule records. Therefore that POST's past duration, and the new production acknowledgement duration, are unmeasured. No five-second end-to-end export guarantee is asserted.

## Width review

The supplied screenshot shows a settings panel whose short date/time values occupy very long inputs. The caption also expands with the panel rather than its reading task. This is a form-density issue; reducing every workspace container would reintroduce the small editor the user asked to remove.

The shared scheduling presentation now uses these responsive upper bounds:

| Surface | Maximum | Purpose |
| --- | ---: | --- |
| Settings/summary panel | 760 px | Keep related scheduling controls together on wide displays |
| Caption/platform content | 640 px | Comfortable text scanning and balanced platform choices |
| Date/time pair and inline confirmation timing | 480 px | Match the width to short values and native pickers |

All use the available width when smaller. Date and time retain visible labels, native values, time zone handling and existing validation. Controls keep 44 px heights; caption resizing and mobile 16 px input text remain supported. The large clip editor is unchanged by these width limits. The pending schedule buttons use the same shared Button and action classes as the ordinary workflow form.

Replace demo and Creative Assets now use clearer selection tiles with an icon above the label. The marked redundant scope and local AI-disabled paragraphs are removed from the Hook overview. Errors and relevant unavailable-feature guidance remain visible.

Follow-up capture: the persistent local preview was repaired and the actual updated Schedule screen was captured at 1800 × 1000 with loaded sample media. Screenshot: 09-schedule-narrow-fields-real.jpg in the task visualization folder. Desktop field widths are visually verified; mobile visual acceptance and production acceptance remain outstanding. The first local video-route compilation took 2.7 minutes, while its application code took 54 ms; this development compile is separate from production rendering latency.

## Persistence and recovery protections

- Clip draft writes use owner checks, an expected revision and an immutable request identity. Lost save replies can replay the same identity; stale revisions cannot silently overwrite another device's draft.
- The schedule reservation transaction creates the finish receipt, render job, immutable publishing snapshot and recovery outbox together. It creates no platform publishing targets before the exact finished asset is verified.
- Browser storage persists the request before POST. Restoring and polling use GET only. Web Locks serialize confirmation across tabs; server idempotency remains authoritative.
- Clip/account changes during asynchronous media resolution invalidate the confirmation. The response checks the confirmed caption, time zone, time, accounts, explicit provider options and exact output identity.
- Worker callbacks are signed. The existing authenticated periodic job-recovery endpoint reconciles the outbox, so a closed browser or failed after-response dispatch does not own completion.
- Generic scheduling cannot publish the pending raw clip or modify a still-preparing immutable workflow snapshot. Cancellation remains available.
- A missed original deadline fails visibly. Finalization retains the original time and uses the existing finalization lead policy rather than imposing a fresh five-minute lead. The time is not silently moved.
- A verified preparation failure with no publishing targets allows a new explicit confirmation for a future time. A partial platform failure with existing targets cannot create a duplicate schedule through this panel.
- Completed-file recovery reuses the committed output; callback retries do not rerender or resubmit paid transcription.

## Rollout requirements

Deploy the additive migrations `20261012212314_explore_clip_draft_saves.sql` and `20261012212532_explore_pending_video_schedules.sql` with their existing Explore finishing dependencies. The related caption-review migration must accompany the caption implementation where used. These tables/functions are restricted to the service role; client authentication is verified by the app.

Deploy the website and compatible worker together. Enable `EXPLORE_PENDING_SCHEDULING_ENABLED=true` only after verifying the migrations, editing/finishing flags, worker finalization signing configuration and authenticated periodic recovery. Capability detection falls back to the established export-first scheduling path when disabled or unavailable. Disabling new acceptance does not stop recovery of committed schedules.

The optional warm worker route addresses the remaining one-shot startup delay, but is a separate undeployed infrastructure change. Confirming a schedule quickly and completing its file quickly are separate performance measurements.

## Verification

Focused regression coverage includes real PostgreSQL-compatible migration execution, owner/revision/idempotency checks, atomic reservation rollback, cancellation races, explicit inline confirmation before rendering, lost replies, cross-tab duplicates, stale selections, provider settings, caption corrections and legacy workflow behavior. A real FFmpeg composition test checks independent trims, timed overlays, segment order and per-clip audio.

The combined focused run passed **316 tests** with zero failures, including the real FFmpeg and database tests. Web TypeScript, worker TypeScript build and scoped ESLint passed. The final button-class cleanup then passed all 11 pending-panel checks again. Production latency and the latest visual layout remain unverified until a deployment and accepted browser review.
