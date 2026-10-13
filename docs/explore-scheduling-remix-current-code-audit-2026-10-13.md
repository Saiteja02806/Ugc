# Explore scheduling and Remix Text: current code audit

Checked the current working tree, including recent uncommitted changes, on 13 October 2026. This review used the source, isolated component/API/database simulations, a real local FFmpeg composition, and read-only production capability/schema checks. No deployment, production migration, paid generation or social schedule was created.

## Result

| Question | Current code | Production evidence at this review |
| --- | --- | --- |
| Can a user confirm a Hook + Demo schedule before the complete MP4 is ready? | Yes, through the gated background scheduling path. | The required `explore_video_schedules` table is absent, so this path cannot pass its availability check. |
| Does Save edits require rendering the video? | No. The new clip draft API saves edit data independently. | The required `explore_clip_drafts` table is absent. |
| Does Remix Text actually have generation behind it? | Yes. The website POST endpoint makes a model request and saves the result. | The connected production account reports `remix_enabled=false`, `provider_configured=false`, and `remix_available=false`. |

The recent implementation addresses the render-blocked confirmation issue. These changes require rollout before customers receive that behavior. Rendering speed and schedule acknowledgement speed are separate measurements.

## Hook + Demo scheduling scenario

The current `FormatWorkspace` checks `/api/explore/schedules?configOnly=1`. If background scheduling is available, entering Schedule does not request the old sequence of opening export, Demo export and final join. The schedule panel receives an immutable composition containing both clips and their independent trims, text, audio and supported framing.

The user can select accounts, caption, date and time, open the inline review, and explicitly confirm Schedule post while the final video is missing. `PendingExploreSchedulePanel` supplies a restricted `pendingVideo` to the shared ScheduleEditor. Uploads, valid media, account selection and any explicitly requested caption review remain prerequisites.

The new POST endpoint durably reserves the finishing receipt, job, schedule snapshot and recovery outbox. Its 202 acknowledgement precedes dispatch/rendering/platform scheduling. The user sees: “Your schedule is saved. The video is preparing in the background; you can leave this screen.” Status polling is GET-only every five seconds while this panel is active. Worker callbacks and periodic recovery complete the accepted request after the browser closes.

The worker combines both clip edits within one job, avoiding separate remote launches for those independent edits. The same job can still perform several local encodes. Only the exact verified completed asset is handed to publishing. The selected time remains fixed; missed deadlines fail visibly instead of silently moving the post.

With the background feature disabled, unavailable storage, or a failed capability lookup, the UI retains export-first scheduling. That fallback still waits for the final output. Hook, Wall of Text and Talking Head + Demo have the new path; Slideshow scheduling remains an image-post flow.

There is no established production acknowledgement duration or accurate render ETA in these changes. `Server-Timing: schedule_ack` supports measuring acknowledgement after rollout. The five-second polling interval is not a five-second export promise. The default scheduling lead is five minutes and can be configured; it is separate from preparation duration.

Relevant source:

- `components/explore/format-workspace.tsx`: capability selection and Schedule transition.
- `components/explore/format-demo-section.tsx`: independent opening/Demo composition snapshots.
- `components/explore/pending-schedule-panel.tsx`: explicit confirmation, durable browser identity, status/recovery.
- `app/api/explore/schedules/route.ts` and `lib/explore/pending-schedule-service.ts`: durable acknowledgement and finalization.
- `components/explore/hook-workflow-preview.tsx`: Talking Head + Demo integration.
- `worker/src/lib/explore-video-finishing.ts`: one-job composition.

## Remix Text scenario and backend

The actual RemixTextSection browser simulation passes for Hook, Wall of Text and Slideshow. It verifies generating a suggestion, reviewing it, applying it without losing the tested style/audio, selecting the correct reference/slide, recovering an uncertain response with the original request key, blocking duplicate provider work, failed-request handling, stale account replies, and custom starting text. Separate tests verify that edited suggestions survive reloads.

The website calls `/api/explore/remix-text` directly. It requires authenticated generation access, `EXPLORE_TEXT_REMIX_ENABLED=true`, Supabase receipt storage, `OPENAI_API_KEY`, and saved business name/product summary. It accepts reviewed reference copy or user-entered starting text plus optional instructions. Business facts are retrieved on the server.

`explore_claim_text_remix` reserves the request before the provider call and enforces owner identity, idempotency and the rolling 20-attempt daily limit. OpenAI structured output is validated and saved in `explore_text_remixes`. The configured model comes from `OPENAI_TEXT_REMIX_MODEL`, with the current source default `gpt-5.6-luna`; provider acceptance/output quality was not tested live in this review. SDK retries are disabled. Existing requests are recovered instead of automatically billed again.

This is synchronous text generation in the web API, with a 60-second provider timeout and an 85-second browser timeout. Those are timeout limits, not measured generation times. It does not queue a video generation job. Applying the suggestion updates clip text overlays or the selected slide; exporting those edits uses the existing media renderer.

One remaining UI inconsistency: the Hook overview badge in `remix-text-section.tsx` defaults to “Available” even when generation is disabled or still loading. The button and inline unavailable notice enforce the actual gate. Also, the reference-text GET returns `enabled` from the rollout flag alone; missing provider configuration is rejected later by POST. These do not prove a successful provider run.

## Verification and small test repairs

The combined current-code run passed **242 tests, zero failures and zero skips**. It includes pending schedule confirmation while rendering is incomplete, closed-browser recovery, cancellation/deadlines, source/account changes, duplicate callbacks, database transaction checks, clip draft persistence, Remix API contracts, and actual FFmpeg output checks for independent trim/text/audio and segment order.

The separate mock browser simulation passed all three Remix formats. Web TypeScript, worker TypeScript build, scoped ESLint and diff whitespace checks passed.

Two stale test harnesses were corrected during verification:

- `scripts/remix-text.browser.cjs`: avoid closing the now-open Text style control and wait for reference loading/manual controls before interacting.
- `scripts/workflow-finishing-api.test.mjs`: resolve the current `.ts` subtitle imports in its isolated module harness.

Product behavior was not changed by this review. Test output is in `.tmp/explore-schedule-remix-audit-20261013/tests.log`; browser screenshots are in `.tmp/remix-text-browser/`.

## Remaining release work

Background scheduling needs the clip-draft and pending-schedule migrations, compatible website/worker deployment, working signed finalization and periodic recovery, then `EXPLORE_PENDING_SCHEDULING_ENABLED=true`. The optional warm worker route addresses remaining startup latency and is separately opt-in.

Remix generation needs its production rollout flag and provider configuration. Its receipt table already exists in the inspected database. Real authenticated production confirmation/render/publishing and real provider remix generation remain acceptance work after rollout. Local simulations establish implementation behavior, not a production latency guarantee.
