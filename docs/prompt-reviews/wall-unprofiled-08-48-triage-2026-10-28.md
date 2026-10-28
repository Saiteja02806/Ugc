# Wall source-layout triage: selected 08–48

Scope: 14 source-hash-matched records 08, 09, 10, 11, 13, 27, 37, 42–48. Inspected decoded opening and 80% frames (two frames per reference) as side-by-side sheets in `outputs/wall-review-agent-a/`. This is preliminary visual triage, NOT full-video or frame-by-frame review, not calibrated layout profiles, and not evidence of actual Remix output fit. Source records, hashes and durations are in `outputs/wall-layout-batch-20261028/all-source-review-inventory.json`. Existing reviewed source records contain prior sampled caption evidence; this pass does not independently verify the historical coverage. No code changes, model calls, video generation, or deployment.

| Ref | Observed opening and 80% layout | Review concern / next action |
|---|---|---|
| 08 | Six centered light-pink lines in lower-middle; image changes behind fixed text. | No longer in local selectable Wall list; verify retirement before investing effort. |
| 09 | Seven centered light-pink lines in lower-middle. | No longer in local selectable Wall list; verify retirement before investing effort. |
| 10 | White outlined centered heading plus six numbered paragraphs, occupying upper and middle area with blank separators. | Dense structured list; final item source record wording “using natural write” merits transcription check against source. |
| 11 | Tall central white outlined list, apparent static caption across a change of shot. | 18 source lines; check line spacing and legibility over bright second shot. |
| 13 | Yellow centered paragraph on lower-middle, no obvious outline. | Poor contrast over the light shirt; psychology claims are not business evidence. |
| 27 | Small two-line title near top and ten-item list in center, widely separated. | Two regions required; single block cannot safely reproduce gap. |
| 37 | Seven yellow central lines, original ends mid-sentence “how little is”. | Ask user to review intended copy; do not invent source words. |
| 42 | Three white lines in lower-middle; source duration 63.56s. | Existing Wall source rules in WALL_TEXT_CONTEXT.md concern a distinct Wall/audio pipeline and cap sources at 60s; confirm applicability to Explore before assuming it blocks this reference. |
| 43 | Three central white bold lines. | Text is short relative to typical Wall; maintain reference-specific sizing, check contrast. |
| 44 | Nine centered white lines lower-middle. | List of prices and metaphor is source copy, not verified business fact. |
| 45 | Nine centered white lines around mid/lower frame on a moving subject. | Avoid converting optimistic source claim into unverified business promise; review contrast. |
| 46 | Four centered pale yellow lines in lower-middle. | Sensitive subjective claim; adapt to grounded business context. |
| 47 | White centered spaced heading, five numbered sections and ending; large central coverage. | Dense multiline structured output requires length, wrapping and overlap checks. |
| 48 | Small white heading and bulleted paragraphs in center. | Text overlays both bright skin and dark clothing; check contrast, sensitivity and factual grounding of psychological statements. |

All 14 need actual source-specific measured bounds, opening-to-ending temporal validation, source-vs-render visual check and representative Remix text, editor save/recovery/overflow tests before layout assignment. Source-specific readability over actual footage remains unverified.

## Temporal sampling follow-up

For the 12 locally active candidates below, I inspected the generated contact sheets at approximately 0.25-second intervals from the opening to the last extracted sample. This is sampled evidence, not an inspection of every encoded frame. Exact transitions shorter than the sampling interval and the final unsampled fraction remain unverified. Artifacts and timestamp manifests are under `outputs/wall-review-agent-a/temporal/wallNN/`.

| Ref | Samples inspected (approximate timestamps) | Temporal finding and remaining concern |
|---|---|---|
| 10 | 22, 0–5.25s | The numbered layout appears static in sampled frames. Verify the transcription of the final entry at native resolution. |
| 11 | 20, 0–4.75s | Text appears static while the footage changes shot around 3.5s; test readability against both shots. |
| 13 | 40, 0–9.75s | Yellow paragraph appears static; contrast over light clothing needs render review. |
| 27 | 24, 0–5.75s | Title and list appear static in distinct, widely separated regions; one ordinary text box is not a faithful representation. |
| 37 | 26, 0–6.25s | Caption appears static; source text ends mid-sentence and requires review. |
| 42 | 253, 0–63.00s | Caption appears unchanged in sampled frames throughout the long looping footage. Do not infer permission to trim; verify the applicable duration limit separately. |
| 43 | 25, 0–6.00s | Three-line caption appears static in sampled frames; short text still needs reference-specific bounds. |
| 44 | 25, 0–6.00s | Multi-line block appears static in sampled frames. Preserve line structure where practical and check readability. |
| 45 | 51, 0–12.50s | Caption appears static over moving footage; check contrast over the changing background. |
| 46 | 23, 0–5.50s | Four-line caption appears static over changing facial expression. |
| 47 | 24, 0–5.75s | Dense numbered list appears static; legibility and structure require realistic longer-remix testing. |
| 48 | 63, 0–15.50s | Dense caption appears static; contrast across skin, hair and clothing needs review. |

This establishes temporal triage, not ready-to-use placement. Safe implementation still requires measuring normalized source bounds and typography for each item, matching the current renderer's capabilities (especially Wall 27's separated regions), checking representative short and long remix outputs, then testing draft creation, editing, saving, reopening and full-duration preservation. I did not edit the runtime, assign a profile, generate media, or test browser/export behavior.
