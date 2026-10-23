# Demo and Creative Assets video preview optimization

Status: ready for review; local validation complete. No deployment or push.

## Behavior

- Existing posters load without fetching the video until playback. Visible videos
  without a usable poster decode a frame into a display-only canvas (maximum
  dimension 320 px), then release the video element and its source.
- Scrolling the whole card offscreen, hiding the document or going offline pauses playback and
  releases the decoder. Returning shows the retained still; Resume restores the
  playback position. Source changes isolate the still and playback position.
- Canvas contents stay within the mounted card. No pixel readback, storage,
  upload, CORS changes, original-media replacement or shared account cache.
- Retry explicitly requests a new decoder even when an earlier still exists.
- Opening the Demo expanded preview clears background card playback.

Implementation: `components/media/video-preview.tsx` and the two expanded-preview
callbacks in `components/demos/demos-workspace.tsx`. Creative Assets uses the
same shared preview without changes to its data or mutation paths.

## Completed evidence

- 36 focused tests pass: Demo upload concurrency, cancellation, uncertain
  completion retry, cleanup, partial delete failure, metadata timeout, rendered
  source selection, Saved and group contracts.
- The full actual-card browser suite passed 82 assertions at 1440x1200 and
  390x844 with zero page errors. It covers preview/poster fallback, proportion,
  playback, resume time, source changes, ended replay, unmount cleanup,
  hidden/offline/offscreen return, cross-origin stills and dialog teardown.
  Explicit mobile-controls and retry-after-playback-failure regressions pass.
- Scoped ESLint and application TypeScript passed after the mobile fix.
- Desktop, mobile Demo and mobile Creative Assets screenshots were inspected:
  existing card layout, controls and source proportions remain intact.

## Before/after measurement

The same local 40-card long-scroll scenario was run with the prior component
and the updated component. Counts include the fixture's other cards as well.

| Viewport | Previous loaded sources after return | Updated loaded sources after return | Updated requests on return |
| --- | ---: | ---: | ---: |
| 1440x1200 | 52 | 0 | 0 |
| 390x844 | 46 | 0 | 0 |

Both versions made zero requests on return. The improvement demonstrated here
is releasing idle video elements/decoders while retaining a still. No production
bandwidth, dollar saving or total browser-memory reduction is claimed. Retained
canvas pixel storage is bounded to 320 px per dimension (roughly 11.8 MB desktop
and 9.7 MB mobile across the visited fixture cards, excluding browser overhead).
Receipts: `.tmp/library-video-preview/{baseline,optimized}-receipt.json`.

## Resolved issues and build validation

The playback-start timeout reproduced on mobile when a card's video frame was
above the viewport while its Play button remained visible. Visibility now tracks
the containing article, so those controls work; fully offscreen cards still
release their sources. The test fixture's earlier overlapping controls were
also corrected. Retry can decode again even if a previous still exists.

The earlier approval-review limit cleared on the user's authorized continuation.
Disk space was recovered by removing generated caches only: `.next/cache`,
`.next/dev/cache`, and `.next/cache` beneath these `.tmp/` builds:
`explore-preview-release-20261016`, `explore-release-20261016`,
`mcp-explore-drafts-20261014`, `ugc-pilot-public-package-release`, and
`ugc-plugin-oauth-acceptance-20261017`. Resolved paths were checked within this
workspace before deletion. Source, media and release artifacts were preserved.

The default build previously failed starting a Turbopack CSS worker. The
supported `npm run build -- --webpack` fallback passed in full after freeing
space, including TypeScript, prerendering and the postbuild native decoder bundle
check. Log: `.tmp/library-video-preview/build-webpack.log`. Configuration was
not changed to switch the deployment bundler; the default Turbopack build has
not been requalified.

The mobile check is a browser viewport check, not physical iPhone/Safari testing.
Authenticated production acceptance must use the real production domain after
a separately authorized deployment; it has not been performed for these changes.
