# Explore cover compression review — 4 November 2026

Prepared five smaller local review copies. The active cover assets and application references are unchanged. No deployment or production build.

## Files and validation

| Cover | Current bytes | Candidate bytes | Reduction |
| --- | ---: | ---: | ---: |
| Talking Head + Demo | 650,474 | 269,855 | 58.5% |
| Hook video | 737,373 | 282,413 | 61.7% |
| Text on screen | 495,674 | 190,829 | 61.5% |
| Slideshow | 703,185 | 332,045 | 52.8% |
| AI character | 1,304,522 | 513,371 | 60.6% |
| Total | 3,891,228 | 1,588,513 | 59.2% |

Current files were already H.264 Main,960×540,30fps, approximately440–804kbps, silent and fast-start. The candidates are H.264,768×432,30fps,CRF28,medium preset,full-range color retained,silent,fast-start. Durations/frame counts remain10s/300,9s/270,9s/270,7s/210,15s/450. No cropping, content replacement, speed change or timeline edits. Pixel count per decoded frame decreases36%; actual device CPU/GPU savings are not established from that arithmetic.

Every candidate fully decoded with FFmpeg exit0. FFprobe verifies dimensions,fps,duration,framecount and no audio. MP4 moov precedes mdat for all5. Original file SHA256 values still match the hashes frozen before encoding.

Matched source/candidate stills at1s and4s were manually inspected at384×216 card display size. Text and imagery remain comparable at that size; additional lossy compression is not pixel-identical. Full-duration SSIM at the same384×216 size ranges0.991493–0.995574. SSIM does not replace subjective quality review, especially for small text, larger cards or high-DPI displays. Those larger-size/browser/device conditions are NOT VERIFIED.

All candidates and exact source hashes/settings/results:

`C:/Users/chund/OneDrive/Desktop/UGC/.tmp/explore-cover-candidates-20261104/`

- `talking-head-demo-promo-04f4bca2ef42-768x432.mp4`
- `hook-video-promo-8b8fa82f32cd-768x432.mp4`
- `wall-of-text-promo-034d99c3ae14-768x432.mp4`
- `slideshow-promo-872636fa69c6-768x432.mp4`
- `ai-character-promo-a9175c67de7d-768x432.mp4`
- `results.json`, `quality.json`, `comparison.png`, matched sample PNGs.

## Actual local playback evidence

Actual locally compiled Explore in isolated headless Chrome,1440×1000. No signed-in dependencies are required for these decorative public covers. No application code or media was overwritten.

First comparison: posters-only/reduced motion versus all5 active videos,8.2-second observation windows. Video-on p95 requestAnimationFrame gap33.6ms; posters16.8ms. No >50ms JavaScript long tasks recorded in either observation. Five videos were playing; no media errors. This single short ordered sample suggests playback can contribute rendering load on this machine; it does not prove the recurring production loading root cause. Initial server compilation/rendering delays occurred before the observation windows and must not be attributed to video playback. Six video `waiting` events were observed during playback; these can occur at loop boundaries and are not proof of network stalls.

Second comparison served original and candidate MP4 bytes through the same temporary browser interception, keeping the page and video behavior unchanged. Both samples had all5 videos playing without media errors. End-of-observation cumulative playback-quality counters: original43dropped/2239total frames; compressed5dropped/2202total. These include startup frames; they are not clean per-window deltas. Both p95 frame gaps were33.4ms, and both had0JavaScript long tasks. Therefore do NOT claim a proven overall rendering or load-time speedup. The candidate is conclusively smaller; fewer drops in this one sample need repeated device-specific validation.

The probe's readyMs includes explicit7.5-second warmup waits, and the initial run includes development compilation. Those readyMs values are NOT click-to-ready performance measurements. An initial attempt timed out waiting for exactly5playing videos; it was rerun to record actual states rather than treating that assumption as success. No result from the failed attempt is presented as a passing sample.

Raw evidence:

- `.tmp/explore-cover-codecs-20261104.json`
- `.tmp/explore-cover-playback-comparison-20261104.json`
- `.tmp/explore-cover-candidate-playback-20261104.json`
- `.tmp/explore-cover-candidate-compression-20261104.log`
- `.tmp/explore-cover-candidates-20261104/quality.json`

## Limits and completion receipt

Compression can reduce initial transfer and may reduce decoding work; it does not repair profile/API gating, eager history reads, duplicate entitlement reads or the reproduced private-gallery late-failure defect in the separate deep audit. Production root cause remains OPEN.

Prepared review copies only, preserving every active cover hash and source/poster reference. No palette, layout, autoplay policy, workflow controls, generation, scheduling, database or hosting changes. Rollback for this evaluation is simply removing its own ignored temporary artifacts; do not discard unrelated work.

Intentional repository changes in this continuation: this report and an append-only note in docs/ai-context/clear.md. Candidate videos/scripts/results remain ignored `.tmp` artifacts and are not wired into the application or included in a release. Preflight sources actually read: context-memory/immutable-contracts skills, existing Explore loading audit/context/incident entries and current cover source definitions. This evaluation did not reread the entire large historical ledgers and made no application-code edits.

VERIFIED: local size reduction, full decode, structural media preservation, matched card-size visual samples, unchanged active file hashes, actual local playback of all5 candidates via interception. NOT VERIFIED: statistically reliable improvement, the real signed-in Slideshow load, production activation, larger/high-DPI readability, or elimination of application lag. No deployment.
