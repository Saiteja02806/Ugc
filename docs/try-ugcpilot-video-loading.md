# Try UGCPilot background video loading

Investigated on 30 September 2026 at `https://getugcpilot.com/try-ugcpilot`.

## Finding

A fresh browser context with its cache disabled reproduced text appearing at
2,612 ms and the first background video frame becoming available at 7,852 ms.
These are observations from one production run, not a guaranteed load time.

The current GCS release is
`https://storage.googleapis.com/ugcsaas-media/try-ugcpilot/releases/2026-09-20/371b35d6d2b687c3a9eb924d78451ada224c6143`.
Its first MP4 is 4,003,557 bytes, with H.264 video at 720 × 1280 and a duration
of 8.167 seconds. Its MD5 matches the original local demonstration asset.
The browser requests the file's beginning, then its end, then its beginning
again to read the playback metadata and obtain the first frame. The original
MP4 stores its `moov` metadata after the `mdat` video data.

The page also eagerly fetched the muted audio track and metadata for both
hidden cards, and had no poster images to show while decoding the video.

## Change

- Add matching WebP first-frame posters for all 29 cards. Their combined size
  is 670,738 bytes, and the active poster is preloaded at high priority.
- Preconnect to the configured external media origin.
- Keep automatic preload for the active video and metadata preload for the
  next card. Defer the third card's video until it advances in the deck.
- Defer the independent audio track while sound is muted.
- Prepare every MP4 with FFmpeg `-map 0 -c copy -movflags +faststart`.
  This changes the container layout without re-encoding the footage. The
  preparation script checks that `moov` precedes `mdat` and compares SHA-256
  hashes of the encoded streams before and after for every file.

The [FFmpeg documentation](https://ffmpeg.org/ffmpeg-formats.html#mov_002c-mp4_002c-ismv)
describes fast start, and [the video element documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video#poster)
describes displaying a poster before a video frame is available.

## Validation

- All 29 remuxed MP4s passed metadata-order and encoded-stream equality checks.
- ESLint for the changed component and media preparation script passed.
- TypeScript `tsc --noEmit --incremental false` passed.
- The existing browser-session tests passed (2 tests).
- Browser checks at 1440 × 1000 and 390 × 844 passed: guide dismissal,
  playback, audio enable/mute, Skip, keyboard Post, advancing to the third
  card, matching posters, and restoring the deck after refresh. No page
  JavaScript errors or framework error overlay appeared. The initial request
  list contained only the first two videos, with no audio or third video.
  The browser routed video requests to the prepared local streaming files.
- An isolated, cache-disabled comparison on the same local server, with a
  simulated 1.6 Mbps connection and 150 ms latency, measured first-frame
  readiness at 1,208 ms for the original and 947 ms for the remux. The
  matching poster loaded at 364 ms. Initial video requests fell from three
  to one. These fixture measurements isolate media startup; they are not
  production page-load forecasts.

## Release the fix

The application source, posters, and preparation script are ready in the
worktree. Production has not been deployed or had its media modified by this
investigation. Deploying the frontend alone supplies the early visual preview
and defers competing requests; the streaming fix also requires releasing the
prepared MP4s.

1. Prepare a complete media release from the original local pool:

   ```sh
   node scripts/prepare-try-ugcpilot-media.mjs
   ```

   Defaults: input `public/try-ugcpilot/media`, output
   `.tmp/try-ugcpilot/streaming-media`, posters `public/try-ugcpilot/posters`.
   During this investigation the output was explicitly set to
   `public/try-ugcpilot/media/streaming` for browser verification. Both media
   output locations are ignored by Git. The original inputs remain intact.

2. Upload the output's `videos/` and `audio/` to a **new public GCS release
   prefix**, preserving their filenames and folder structure. Use the same
   public-read policy as the existing demonstration release and long-lived
   caching for these versioned assets. Keep the existing release for rollback.
   Do not upload originals from the parent input directory in place of the
   prepared output.
3. Set the existing `NEXT_PUBLIC_TRY_UGCPILOT_MEDIA_BASE_URL` to the new HTTPS
   release root before building/deploying the app. Include the tracked poster
   files and frontend change in that deployment.
4. Verify the real production domain in a fresh browser: posters appear with
   the text, active video playback works after the guide is dismissed, audio
   starts on request, and swipes preserve the matching backgrounds. Inspect
   first-video network requests to confirm the new release URL is used and no
   end-of-file metadata round trip is needed.

No new environment variable or video format is required. The page still uses
the same silent H.264 videos and the same independently controlled audio.
