# Explore optional Demo and uploaded-video editor handoff

## Behavior

Hook video and Wall of text now follow Create → Edit video → Demo → Schedule.
The Edit video tab opens a ready Upload or Creative Assets selection, just as
the Edit this video button does. Pending/failed uploads cannot become an editor
source or a scheduling output.

Demo reuses the older workflow's square upload cards, media player, saved-audio
picker and framing/pan dialog. It adds Upload/Creative Assets, replace/remove,
trim, original-volume and optional soundtrack controls. The main area shows
Opening → Demo and the confirmed final video. Continue without demo schedules
the saved opening. Slideshows retains its existing three-section behavior.

## Save and backend compatibility

Save final video freezes the owner-verified opening/demo/audio selection.
The existing single-video editing API trims the demo and adjusts its original
volume. When soundtrack audio is selected, a second existing edit pass mixes
it from the trimmed segment's beginning with the requested volume/playback.
The existing owned-demo composition API then joins the saved opening before
that prepared clip. These intermediate owned assets use the existing media
store; only the merged result is presented as the final scheduling output.

This preserves the existing prohibition against combining primary format edits
and an appended demo in one draft. It also keeps opening text/audio out of the
demo and rebases recorded pan positions to the trimmed demo's timeline.
No worker contract, schema, queue, generation model or provider changes are
required. The existing deployed final-render worker must handle
`render_demo_video`, format editing and demo framing; production feature flags
remain authoritative. Save receipts retain their exact immutable retry keys.

Drafts are scoped to the owner, workflow and opening video. Restoring selected
assets performs owned reads; starting/retrying a save requires an explicit
button action. An account change unmounts the previous owner's hooks. Edits,
replacement or removal clear the final scheduling output.

## Verification

- Regression tests exercise clicking Edit video directly for Upload and
  Creative Assets in both video workflows, failed/pending uploads, replacement,
  merged-output scheduling and skipping Demo.
- Save coordination tests cover preparation, optional soundtrack, final join,
  disabled preview and failure. Existing hook/API/worker tests cover ownership,
  receipt recovery, cancellation and immutable retries.
- A real offline FFmpeg test renders an edited wall opening, a trimmed/muted
  demo and an added soundtrack, then joins them. It verifies duration, wall
  text only on the opening and the expected segment-specific audio frequencies.
- Local browser preview verifies the reported upload-to-Edit tab interaction.
  Live authenticated saving/generation is not used for these checks.

## Explicitly excluded prompt changes

The local prompt commit `0b8d69bc74fcfcd61bfb9c8acc5e56d5bc074006` stays on
`codex/workflow-reference-prompt-context-20261008`; it is not part of this
release. Its deferred changes touch these paths:

- `CAROUSEL_CONTEXT.md` (only its deferred prompt/business-context section;
  this release adds a separate Demo decision)
- `docs/explore-reference-prompt-context-2026-10-08.md`
- `lib/ai-studio/image-generation-api.test.mjs`
- `lib/ai-studio/image-generation-api.ts`
- `lib/ai-studio/reference-media-flow.test.ts`
- `lib/ai-studio/video-generation-api.test.mjs`
- `lib/ai-studio/video-generation-api.ts`
- `lib/explore/format-generation-prompt.test.ts`
- `lib/explore/format-generation-prompt.ts`
- `lib/explore/slideshow-generation-prompt.test.ts`
- `lib/explore/slideshow-generation-prompt.ts`
- `worker/src/jobs/generate-image.test.mjs`

These are excluded at the user's explicit request. The original dirty checkout
is preserved. Local `.env*`, `.tools/`, `.tmp/`, validation logs, dependency
directories, `.next/`, `worker/dist/`, `next-env.d.ts` and
`tsconfig.tsbuildinfo` are local configuration, credentials, caches or generated
artifacts and are not source release changes.
