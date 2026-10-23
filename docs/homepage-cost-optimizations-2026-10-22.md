# Homepage cost optimizations — local implementation, 22 October 2026

Ready for review following local validation. **Not pushed or deployed.** Existing
unrelated worktree changes remain in place. No production configuration, account
data, billing settings, media storage, generation worker or database changed.

## 23 October 2026 — middle hero hook replacement (local)

- The middle hero now uses the supplied `landing_page/middle (online-video-cutter.com).mp4`,
  labelled **Hook video** with matching accessible playback labels. The existing
  poster matches this clip's opening frame and remains in use.
- Offline preparation produces `hookDemo.3624566c2f89f78a.mp4` (168,920 bytes).
  The internal manifest key remains `hookDemo`; caching follows the new hashed URL.
  The talking-head asset is byte-identical to its previous prepared version.
- Local checks passed: full FFmpeg decoding, all 83 frames at 30 fps, 2.767-second
  duration, H.264/yuv420p, silent output, fast-start metadata and filename hash.
  Scoped lint, browser-script syntax and whitespace checks passed. The historical
  production-mode browser results below have not been rerun for this revision.
  No push or deployment occurred.

## Implemented

- `app/page.tsx` no longer reads a request cookie. The shared HTML starts with the
  signed-out CTA; existing client auth actions reconcile the browser's session
  after hydration, retaining signed-in and email-verification destinations.
- `app/layout.tsx` keeps all existing font files, CSS variables and weights, with
  preloading disabled for editor/monospace fonts. The primary Geist normal and
  italic faces still preload. Other fonts are fetched when rendered text uses
  them, preserving legacy browser/worker typography.
- Both hero videos have smaller, silent, full-duration H.264/yuv420p variants.
  They retain every frame and the original frame rates, with fast-start MP4
  metadata. Existing original files, posters and their URLs are preserved.
- `LandingPreviewVideo` gates loading on viewport visibility, foreground state,
  connectivity and desktop eligibility. Reduced-motion and Save-Data users see
  posters until explicitly choosing Play. Accessible pause/play controls retain
  an explicit pause across tab visibility changes. Sources and decoders are
  released on pause, hidden/offline/offscreen transitions and unmount.
- The hero slideshow respects reduced motion, Save-Data, visibility, connectivity
  and the desktop breakpoint; its existing manual navigation remains available.
- The new video filenames contain content hashes. `next.config.ts` applies a
  one-year immutable cache policy only to the two manifest entries, preserving
  existing media policies and website/MCP routing.
- `scripts/prepare-landing-previews.mjs` reproduces the two variants offline,
  verifies full decoding, and writes their content-hashed asset manifest. No
  remote media upload, provider request or paid generation is involved.

## Size and media verification

| Clip | Original bytes | New bytes | Frames / frame rate | Duration |
| --- | ---: | ---: | --- | --- |
| Talking Head | 6,212,902 | 1,511,275 | 317 / 24 fps | 13.209 seconds |
| Hook + Demo | 2,466,545 | 750,177 | 312 / 30 fps | 10.400 seconds |
| Total | **8,679,447** | **2,261,452** | | |

The combined complete resources are **73.94% smaller**. A cold mobile visit only
requests the 750,177-byte center clip. These are file-size and local request
observations, not a claim of a 74% hosting-bill reduction. Actual transfer depends
on playback, byte ranges and cache reuse.

Both files passed full FFmpeg decoding and checks for H.264, yuv420p, no audio,
unchanged duration/frame count/frame rate, matching filename hashes, and `moov`
metadata before `mdat`. SSIM compared against the originals scaled to the new
dimensions was approximately 0.9834 and 0.9921 respectively. Desktop/mobile
screenshots were visually inspected. Original media is retained, so this change
reduces requested video bytes rather than reducing the stored originals.

## Verification

**Production build:** `npm run build` passed, including application TypeScript,
171 static-page generations and the existing native Hook decoder runtime/bundle
checks. Build output now marks `/` as static. The build passed again after fixing
a browser-discovered pause-control race.

**Production-mode local integration:**
`node scripts/landing-performance.browser.cjs` passed all 15 recorded groups:

1. Homepage is prerendered, cacheable and byte-identical with/without the session
   cookie; only the two primary sans font faces preload.
2. Both content-hashed videos return matching lengths, immutable caching headers
   and correct HTTP 206 byte-range responses.
3. Desktop hydration and video decoding/playback work without editor-font
   transfers, hydration errors, page errors or horizontal overflow.
4. Pause releases the source, remains paused across visibility changes and Play
   resumes successfully.
5. Hidden/offline/offscreen transitions release sources; returning resumes
   eligible playback.
6. Resizing to mobile excludes the desktop clip while preserving center playback
   and layout fit.
7. All six existing root editor font families load on demand at the exact legacy
   weights, including Arial's retained 500-weight compatibility face.
8. A cold mobile context requests only the center clip.
9. Reduced-motion contexts make no automatic hero-video requests, keep the
   slideshow still and support explicit Play.
10. Save-Data contexts behave the same way.
11–15. Actual auth actions hydrate with the correct CTA labels/destinations for
   signed-out, verified, unverified, restoring-cookie and stale-cookie states.

The auth cases use the real auth-action components with an isolated mocked auth
store and render/hydrate cycle. They do not log in to a real account or claim
production authentication acceptance. Hidden/offline/preference cases are
controlled browser fixtures against the actual local production homepage.

**Font/editor regressions:** all seven checks in
`scripts/explore-text-fonts.test.mjs` passed, including real video exports,
font/weight distinction, exact Unicode, preset changes and save/reopen. The
existing `scripts/explore-text-fonts.browser.cjs` suite passed at 1366px, 1536px
and 390px, covering all 12 bundled choices, drag/keyboard/touch positioning,
presets, emoji and saved drafts. Renderer modules were not changed by this work.

**Static checks:** scoped ESLint and diff whitespace checks passed for the changed
application/configuration and new preparation/browser scripts.

The first integration attempt incorrectly assumed font preloads would always
be in HTTP response headers; the test now inspects headers and static HTML. The
next attempt found a real control race: removing a video source can cancel its
queued `pause` event. The control now derives its state from both playback and
whether the source is eligible, and the pause/resume check passes.

## Local evidence and release boundary

Ignored local receipts:

- `.tmp/landing-performance-build.log`
- `.tmp/landing-performance-browser/receipt.json`
- `.tmp/landing-performance-browser/homepage-desktop.png`
- `.tmp/landing-performance-browser/homepage-mobile.png`
- `.tmp/landing-preview-media-checks.json`
- `.tmp/explore-text-fonts-browser/`

The browser suite starts and stops its own temporary production server and
isolated auth fixture. No existing preview server is stopped.

Deployment remains paused at the user's request. After a separately authorized
release, verify the real production domain's shared homepage cache headers,
font requests, video delivery/playback and authenticated navigation. Local checks
do not establish live CDN savings or acceptance of other in-progress features.
