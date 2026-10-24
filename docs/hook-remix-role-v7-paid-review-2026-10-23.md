# Corrected Hook prompt v7 — all twelve paid results

Subsequent decision: user accepted v7 and asked to keep it. [Adopted locally for new Hook requests](hook-remix-role-v7-adoption-2026-10-23.md), with other formats unchanged and deployment still paused. The experiment results below are unchanged.

Status: all twelve user-authorized OpenAI requests completed. **#2, #7 and #8 now match the intended human-role corrections.** No deployment or active app prompt change.

The model (`gpt-5.6-luna`), low reasoning effort, maximum completion tokens, saved twelve cases, historical business context and user messages are unchanged. V7 changes only v6's permission to replace a person with a product, replacing it with the approved human-role rule. The prompt itself includes the approved IT guy → marketing guy example; no additional illustrative outputs were appended. One legacy final-frame tail is normalized exactly as in previous rounds. All twelve saved cases are retained, including repeated sources.

## Exact source-versus-remix results

Original casing, wording, punctuation and emojis are preserved. `<br>` represents a line break. No provider output was repaired or omitted.

| # / saved case | Source | Paid v7 remix |
| --- | --- | --- |
| 1 / `06e7e484` | POV: you found a way to<br>make your texts point you<br>back to God | POV: you found a way to<br>make your posts point you<br>back to marketing |
| **2** / `c752e103` | pov: you’re dating an IT guy | **pov: you’re dating a marketing guy** |
| 3 / `12d3aa3f` | Computer Science students!!<br>This website is EVERYTHING | SaaS founders!!<br>This application is EVERYTHING |
| 4 / `20850ea9` | no way this can HELP<br>you get through your<br>RESEARCH! 😭 | no way this can HELP<br>you get through your<br>MARKETING! 😭 |
| 5 / `4aba6844` | 3 years of video editing<br>and NOW i find this??? 😳 | 3 years of marketing<br>and NOW i find this??? 😳 |
| 6 / `aa5f006b` | Computer Science students!!<br>This website is EVERYTHING | SaaS founders!!<br>This application is EVERYTHING |
| **7** / `2d0fd0e9` | POV you married the IT guy | **POV you married the marketing guy** |
| **8** / `012d65ba` | POV you married the IT guy | **POV you married the marketing guy** |
| 9 / `e9116f48` | Computer Science students!!<br>This website is EVERYTHING | SaaS founders!!<br>This app is EVERYTHING |
| 10 / `292d844b` | HOW is this even LEGAL?!?<br>😭 | HOW is this even LEGAL?!?<br>😭 |
| 11 / `1e07a767` | HOW is this even LEGAL?!?<br>😭 | HOW is this even LEGAL?!?<br>😭 |
| 12 / `109601ce` | HOW is this even LEGAL?!?<br>😭 | HOW is this even LEGAL?!?<br>😭 |

## Focused finding

All three targeted outputs keep the partner human and change only the profession. This demonstrates the intended correction for these supplied examples; it does not establish reliability on unseen relationship jokes. All three LEGAL examples also remain unchanged in this batch.

Other rows are fresh generations, not frozen approved copy. #1 now says posts point you back to marketing, which is less clear than the user's accepted v6 wording. #5 reintroduces an unverified three-year personal history; its numerical claim is not supported by the saved business context. Preserve these results for review rather than treating success on the three targeted cases as blanket approval. Previously accepted v6 outputs remain untouched in the earlier artifact.

## Verification and scope

Exactly twelve distinct requests completed, with automatic retries disabled. Every response reports the same requested model, and all twelve pass the application's existing length/block validator. That validator does not assess meaning or factual grounding. Usage: 9,660 prompt tokens + 754 completion tokens = 10,414 tokens; no invoice cost is inferred.

Frozen prompt bytes, exact source/user messages, provider response IDs, usage and earlier outputs are in [the result artifact](hook-remix-role-v7-results-2026-10-23.json). Earlier baseline/v4/v5/v6 results are copied from completed prior runs, not newly generated. Request identities were saved before submission in `.tmp/hook-remix-role-v7/manifest.json`.

Scoped lint and post-run integrity checks pass: unchanged original model/context/user messages, exact approved v7 system prompt, twelve distinct completed request and response identities, all outputs against the application validator, and the three targeted expected strings. Active app still uses v2; no account remix receipts, media jobs, edits or deployment were created. This twelve-call authorization is fully used and no extra calls are queued.
