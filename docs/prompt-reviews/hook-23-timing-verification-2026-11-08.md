# 23 Hook timing verification — 8 November 2026

## What this is

The 23 Hook recreation plans that previously had no `PHASE` timeline now have
one. The clocks were authored from the existing **0.25-second contact sheets**
for each source. The action, camera and ending text is unchanged; only the
`PHASE [start–end]` prefixes were added.

The table shows two clocks:

- **Source-clock intervals** — where each beat sits in the original video.
- **Submitted-prompt intervals** — what the backend actually sends after
  multiplying by `min(source, output)` and appending a final hold when the
  source is shorter than the selected output.

## The 23 clocks

| Reference | Source | Output | Source-clock intervals | Submitted-prompt intervals |
|---|---|---|---|---|
| Hook 12 | 2.43 s | 4 s | 0–1, 1–1.75, 1.75–2.43 | 0–1, 1–1.75, 1.75–2.43, hold 2.43–4 |
| Hook 15 | 8.63 s | 8 s | 0–1.2, 1.2–3, 3–5.67, 5.67–6, 6–8.63 | 0–1.11, 1.11–2.78, 2.78–5.25, 5.25–5.56, 5.56–8 |
| Hook 19 | 2.97 s | 4 s | 0–0.5, 0.5–2.25, 2.25–2.97 | 0–0.5, 0.5–2.25, 2.25–2.97, hold 2.97–4 |
| Hook 20 | 3.23 s | 4 s | 0–1.25, 1.25–2, 2–3.23 | 0–1.25, 1.25–2, 2–3.23, hold 3.23–4 |
| Hook 26 | 3.37 s | 4 s | 0–1, 1–2, 2–3.37 | 0–1, 1–2, 2–3.37, hold 3.37–4 |
| Hook 30 | 2.17 s | 4 s | 0–0.75, 0.75–1.6, 1.6–2.17 | 0–0.75, 0.75–1.6, 1.6–2.17, hold 2.17–4 |
| Hook 35 | 3.5 s | 4 s | 0–1.25, 1.25–2.25, 2.25–3.5 | 0–1.25, 1.25–2.25, 2.25–3.5, hold 3.5–4 |
| Hook 39 | 3.9 s | 4 s | 0–1.75, 1.75–2.75, 2.75–3.9 | 0–1.75, 1.75–2.75, 2.75–3.9, hold 3.9–4 |
| Hook 46 | 2.4 s | 4 s | 0–1.5, 1.5–2, 2–2.4 | 0–1.5, 1.5–2, 2–2.4, hold 2.4–4 |
| Hook 47 | 2.77 s | 4 s | 0–1.75, 1.75–2.25, 2.25–2.77 | 0–1.75, 1.75–2.25, 2.25–2.77, hold 2.77–4 |
| Hook 50 | 2.8 s | 4 s | 0–1.25, 1.25–2, 2–2.8 | 0–1.25, 1.25–2, 2–2.8, hold 2.8–4 |
| Hook 52 | 3.47 s | 4 s | 0–1, 1–1.5, 1.5–3.47 | 0–1, 1–1.5, 1.5–3.47, hold 3.47–4 |
| Hook 64 | 3.03 s | 4 s | 0–1.75, 1.75–2.25, 2.25–3.03 | 0–1.75, 1.75–2.25, 2.25–3.03, hold 3.03–4 |
| Hook 71 | 3.1 s | 4 s | 0–1.25, 1.25–2, 2–3.1 | 0–1.25, 1.25–2, 2–3.1, hold 3.1–4 |
| Hook 84 | 5.73 s | 4 s | 0–1, 1–4, 4–5.73 | 0–0.7, 0.7–2.79, 2.79–4 |
| Hook 85 | 6.1 s | 4 s | 0–1.5, 1.5–4.75, 4.75–6.1 | 0–0.98, 0.98–3.11, 3.11–4 |
| Hook 89 | 2.9 s | 4 s | 0–1.25, 1.25–2.25, 2.25–2.9 | 0–1.25, 1.25–2.25, 2.25–2.9, hold 2.9–4 |
| Hook 93 | 2.8 s | 4 s | 0–1.25, 1.25–2, 2–2.8 | 0–1.25, 1.25–2, 2–2.8, hold 2.8–4 |
| Hook 94 | 4 s | 4 s | 0–0.75, 0.75–2.25, 2.25–4 | 0–0.75, 0.75–2.25, 2.25–4 |
| Hook 96 | 2.93 s | 4 s | 0–1, 1–1.75, 1.75–2.93 | 0–1, 1–1.75, 1.75–2.93, hold 2.93–4 |
| Hook 100 | 3.8 s | 4 s | 0–1, 1–2.25, 2.25–3.8 | 0–1, 1–2.25, 2.25–3.8, hold 3.8–4 |
| Hook 101 | 3.83 s | 4 s | 0–1, 1–2.25, 2.25–3.83 | 0–1, 1–2.25, 2.25–3.83, hold 3.83–4 |
| Hook 104 | 3.4 s | 4 s | 0–1.75, 1.75–2.5, 2.5–3.4 | 0–1.75, 1.75–2.5, 2.5–3.4, hold 3.4–4 |

## Reading the table

- **20 plans** have a source shorter than the output. Their action plays at
  source speed and a final hold fills the rest. The initial trim removes the
  hold, so the delivered clip is the source length.
- **Hook 15, 84 and 85** have a source longer than the output. The whole source
  action is compressed into the output; there is no hold. Hook 15's cut lands at
  5.25 s in the 8 s output; Hook 85's hand-to-cheek reveal lands at 3.11 s.
- **Hook 94** has source equal to output; the action fills the clip.
- **Hook 19 and 84** remain `needs_decision`: Hook 19 has no performer at t=0;
  Hook 84 shows only eyes/brows at t=0. The clock does not unblock them.
- **Hook 28** was removed from the references.

## Verification

| Check | Result |
|---|---|
| Plans with a numeric timeline | 106 / 106 |
| Gaps or overlaps | 0 |
| Real compile of the 23 | 23 / 23 |
| Prompt/motion tests | 52 / 52 |
| API duration/timeline tests | 51 / 51 |
| App TypeScript | clean |
| Worker build | clean |

## Limits and next step

- Boundaries are estimated from 0.25 s contact sheets, not native-frame exact.
  They are suitable for a first controlled generation, not a frame-exact claim.
- The model may not obey the clock precisely. A controlled generation is needed
  to measure action order, pacing, camera and ending against the source.
- Recommended pilot: one short source (Hook 12), one cut source (Hook 15), one
  long compressed source (Hook 85), using the same approved-frame/model settings
  the user intends to ship. Do not bulk-generate the 23 before the pilot.

No paid generation, provider call or deployment was performed.
