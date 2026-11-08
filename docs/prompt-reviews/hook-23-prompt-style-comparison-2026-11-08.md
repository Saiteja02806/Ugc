# 23 Hook prompts vs the existing timed prompts — style comparison

Date: 8 November 2026. Read-only comparison of the 23 newly timed Hook plans
against the 83 plans that already had `PHASE` timelines.

## Summary

| Measure | New 23 | Existing 83 |
|---|---|---|
| Average beats / timing steps | **3.09** | **6.05** |
| Beat-count range | 3–5 | 3–12 |
| Plans with only 3 beats | **22 of 23** | 4 of 83 |
| Average longest single interval | **46.4% of source** | 35.8% |
| Longest single interval | 63.3% | 81.0% |
| Average compiled prompt length | 1,862 chars | 2,089 chars |
| Camera, ending, constraints present | 100% | 100% |
| Same `OPENING STATE / PHASE / CAMERA / ENDING STATE / CONSTRAINT` sections | 100% | 100% |
| Fraction decimal places | mostly 6 | mostly 16–17 |

## What matches

- The section order and labels are identical.
- Every plan has an opening state, camera clause, ending state and constraints.
- Every plan uses `PHASE [start–end]:` with an en dash and a trailing colon.
- Every plan is contiguous from 0 to 1 with no gaps or overlaps.
- Every plan compiles through the same source-scaled path; source shorter than
  output adds `FINAL HOLD`, source longer compresses.
- Prompt length remains in the same range (new 1,457–3,234; existing
  1,555–3,107).

## What differs

**Granularity.** The new 23 are written in 3 steps (except Hook 15 with 5). The
existing set averages 6 steps and often splits a short action into 4–8 beats.
The new plans therefore leave one timing step covering a large part of the
video:

| Reference | Beats | Longest step | What the long step covers |
|---|---|---|---|
| Hook 19 | 3 | 59.0% (0.50–2.25 s) | Reveal performer, glance, close eyes, tilt head |
| Hook 46 | 3 | 62.5% (0.00–1.50 s) | Hold covered mouth, small eye/head moves, close eyes |
| Hook 47 | 3 | 63.3% (0.00–1.75 s) | Bring glasses onto nose, open eyes, hold |
| Hook 52 | 3 | 56.7% (1.50–3.47 s) | Cover nose/mouth, hold, small eye closures, glances |
| Hook 64 | 3 | 57.7% (0.00–1.75 s) | Startled close-up, camera retreat begins |
| Hook 84 | 3 | 52.3% (1.00–4.00 s) | Puzzled brow stare and small eye movements |
| Hook 85 | 3 | 53.3% (1.50–4.75 s) | Hold covered-mouth stare through most of the clip |
| Hook 104 | 3 | 51.5% (0.00–1.75 s) | Gaze up, widen eyes, open mouth, keep phone |

Eleven more plans have a longest step of 40–50%: Hook 12, 26, 39, 50, 71, 89,
93, 94, 96, 100, 101. Three are below 40%: Hook 20, 30, 35. Hook 15 already has
five steps around its cut.

**Decimal precision.** The new fractions use 6 decimals (for example
`0.410849`), while most existing plans use 16–17 (`0.586666666667`). This is
cosmetic: the compiler converts to seconds rounded to 2 decimals, so the output
does not change. No edit is required.

## Recommendation

The new prompts are **valid and structurally consistent**, but they are **coarser
than the established style**. If we want the 23 to match the other prompts:

1. Split the 22 three-step plans into **4–6 steps** at the natural sub-action
   boundaries already described in their text, using the same 0.25 s sheets.
2. Start with the eight plans whose longest step is over 50% (Hook 19, 46, 47,
   52, 64, 84, 85, 104).
3. Keep the existing action wording; split clauses into separate timed steps
   rather than inventing new actions.
4. Do not change the decimal precision; it has no output effect.

This is a **granularity refinement**, not a format fix. The current clocks are
usable; the refinement makes the 23 behave like the rest of the catalog.

No paid generation, provider call or deployment was performed.
