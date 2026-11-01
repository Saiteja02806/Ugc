# Reference playback audit — 30 October 2026

Reported Reel: https://www.instagram.com/reels/Dd394l1gRWG/
Catalogue ID: explore-paired-hook-ef59f4b5e69bc9e125f8ada7 (Hook 03).

## Confirmed evidence

The current hosted original responds HTTP 200 as video/mp4 and supports ranges. It is 15,489,144 bytes for 3.733333 seconds (33.19 Mbps), encoded H.264 High 4:4:4 Predictive, yuv420p. This unusual profile and extreme bitrate are concrete compatibility/buffering risks, not evidence of a missing link. The specific user's browser failure has not been reproduced, so this is not proof that every intermittent failure has the same cause.

Generated an independent browser preview: H.264 High, yuv420p, no audio, faststart, 848,522 bytes (94.5% smaller). All 109 decoded frame timestamps and the 3.733333-second duration match the original. Full FFmpeg decode passes. Lossy recompression changes pixels; original generation/source objects and soundtrack policy remain unchanged.

The new immutable object was uploaded and verified publicly: HTTP 200, correct byte count/type, and HTTP 206 bytes 0–31/848522. Key: explore/browser-previews/v1/8bb69b91adcf61a3efac29bd53c760de6fabcbeb331217a45aaec1ad62bd9793.mp4.

Local catalogue selection binds the override to reference ID, original storage key and silence policy. A changed source does not inherit this override. No canonical manifest, source SHA, generation prompt or worker behavior changed. Preview is selected by local application code; the production website has NOT been deployed and still needs that release before it uses this mapping.

## Audit limits

Inspected 68 entries from legacy paired, Hook release and Wall Money manifests: 50 locally available preview files probed; 18 unavailable locally. These 50 did not show the same profile/extreme-bitrate condition. This does not cover all active addition/refresh/Talking Head catalogues, private creator media, devices or authenticated live playback. The downloaded reported original was probed separately. Do not describe this as all references fixed.

## Verification and scope

10 reference release/hover tests PASS; TypeScript PASS; scoped ESLint PASS. Existing test verifies original video/source links, silent audio, preview override and archived identities. Read-only preflight PASS; same-session UI clarity/context-memory/immutable-contract/regression procedures applied. Incident UGC-UI-072 records evidence and limits. Browser visual/decoder acceptance NOT VERIFIED; no screenshots claimed. Instagram direct page fetch failed; actual hosted media was inspected instead.

Files: lib/explore/browser-reference-previews.json, lib/explore/paired-reference-library.ts, scripts/hook-reference-release.test.mjs, EXPLORE_CONTEXT.md, docs/ai-context/clear.md, this receipt. Existing unrelated work preserved. Rollback: remove this reference's browser override; original object is intact.

Reproduction: download the original by its catalogue videoStorageKey, then run ffmpeg with `-map 0:v:0 -an -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 20 -preset medium -bf 0 -fps_mode passthrough -movflags +faststart`. Disabling B frames preserved the original final packet's longer display duration; compare all timestamps and duration before accepting. Local evidence is in .tmp/reference-playback-audit/ (source, derivative, audit.json).
