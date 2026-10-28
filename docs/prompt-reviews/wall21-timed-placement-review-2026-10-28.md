# Wall 21 timed placement — source review

Local analysis only. Source `D:/walloftext/AQNBETW_u1z-YacX6zpmZ0puYEdyRaqUxBb_CyFzU7ZGd6W8-_9VApMmfyMBd_L2RtnvSbuBHu0yYTSwnWuat2mLg8y4GUfw18iniSs.mp4`, SHA-256 `d3ed4f1f5e6c491f83ceab686444d67713e3fc9cfb3d90cabce0215ec0504434`, 720x1280, ~11.35s. Contact sheets of 45 quarter-second samples inspected, plus native frames at approx 0, 3, 4, 5, 5.75, 6.5, 7.5, 8.25, 9.25 and 10 seconds. Original review record contains the precise caption ranges; this pass did not repeat boundary inspection at native frame rate. Text is centered, light with dark outline; approximate vertical coordinates differ by shot.

| Block | Original reviewed interval (ms) | Approx top of source text | Observation |
|---|---|---|---|
| 1 | 0–3067 | 0.45 | Three-line opening |
| 2 | 3067–3933 | 0.59 | Single line over underwater shot |
| 3 | 3933–5033 | 0.76 | Single line lower over seated shot |
| 4 | 5033–5667 | 0.56 | Single line over dining shot |
| 5 | 5667–6600 | 0.59 | Single line over street shot |
| 6 | 6600–7567 | 0.48 | Single line over seated shot |
| 7 | 7567–8233 | 0.48 | Single line over water shot |
| 8 | 8233–9133 | 0.48 | Single line over painting shot |
| 9 | 9133–10000 | 0.48 | Single line over laptop shot |
| 10 | 10000–11134 | 0.70 | Single line over final shot |

Coordinates are estimates from sampled frames, not final calibrated profiles. Preserve individual placements and gaps, and keep any tail after the source caption endpoint; do not use a single static position or stretch the last caption to hide the remainder. If generated duration differs, mapping must account for actual generated content: scaling the timing alone does not guarantee shot alignment. Source-timed overlays are only an initial suggestion for review.

Implementation and renderer/editor acceptance not completed. Auto Wall remains disabled; no generated video, paid model call, deploy or hosted write. See `wall-timed-text-investigation-2026-10-28.md` for schema prototype and design constraints.
