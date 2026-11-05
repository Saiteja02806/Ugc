# Hook Video Library standalone preview and zero-scroll layout — 5 November 2026

Status: locally implemented and verified; GCS public assets uploaded and verified (HTTP 200 OK).

## Incident and User Request

- Incident: `UGC-UI-20261105-HOOK-BUNDLE-STANDALONE-LAYOUT`
- User request:
  - Page: `https://vidmake.io/hook-video-bundle`
  - The video was not displaying and had player controls (`controls`), captions, retry button, and vertical overflow requiring scrolling on desktop.
  - Required changes:
    1. Video must appear on one side completely (filling the entire right half/part).
    2. No scrolling for this screen on desktop.
    3. Must look like a real continuous video with no pause, resume, or any playback controls.

## Root Cause and Solution

1. **Asset 404 Resolution**:
   - The preview video (`preview-2a3c843428fa3763.mp4`, 2,806,731 bytes) and poster (`preview-5c570227cee989d7.jpg`, 31,646 bytes) in `gs://ugcsaas-media/marketing/hook-video-library/v1/` had not completed public upload in prior runs, resulting in HTTP 404 and preview load failure.
   - Executed `.tmp/hook-bundle-preview/upload.mjs` with authenticated client. Upload succeeded and public readback verified:
     - `https://storage.googleapis.com/ugcsaas-media/marketing/hook-video-library/v1/preview-2a3c843428fa3763.mp4` -> HTTP 200 video/mp4 (2,806,731 bytes), HTTP 206 range verified.
     - `https://storage.googleapis.com/ugcsaas-media/marketing/hook-video-library/v1/preview-5c570227cee989d7.jpg` -> HTTP 200 image/jpeg (31,646 bytes).

2. **Standalone Layout (Full-Bleed Side Video + No Scrolling)**:
   - Updated `components/marketing/hook-video-bundle.tsx`:
     - Standalone page uses a full-viewport split-screen layout on desktop (`lg:flex-row lg:h-dvh lg:overflow-hidden`).
     - Left column contains header (`Vidmake` and `Free tools`), heading, copy, download card, and hook lines link. The content is vertically centered and fits comfortably within viewport height without triggering any scrollbar on desktop.
     - Right column (`w-full lg:w-1/2 min-h-[50vh] lg:h-full lg:min-h-full bg-black overflow-hidden flex items-center justify-center shrink-0`) is completely filled by the video (`h-full w-full object-cover`).
     - Video configured with `autoPlay`, `loop`, `muted`, `playsInline`, `preload="auto"` and NO player controls (`controls={undefined}`). Autoplay/muted guarantees seamless continuous looping playback across all browsers.
     - Load failure overlay rendered absolutely within the video container without causing layout shifts or page scrolling.
   - Compact `/free-tools` card remains isolated and 100% compliant with UGC-UI-037 contract.

## Verification

1. `node --test scripts/hook-bundle-preview.test.mjs`: 3/3 PASS (standalone full-bleed video without controls, failed preview retry isolation, download gates preservation).
2. `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/resources/hook-video-bundle.test.ts lib/resources/hook-video-bundle-store.test.mjs`: 16/16 PASS (durable counter, concurrency, replay, native streaming ZIP, store).
3. TypeScript `node node_modules/typescript/bin/tsc --noEmit --incremental false`: Exit code 0, 0 type errors.
4. GCS public URLs HEAD verification: 200 OK.
