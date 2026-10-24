# Hook source-voice v5: twelve paid tests — 23 October 2026

Status: all twelve requested OpenAI calls completed. The active app still uses v2; no deployment or automatic switch. V5 retains more of the source's voice than rejected v4 in this sample, but it does **not** consistently match the illustrative drafts the user approved. It is not ready for promotion without further creative review.

## Conditions and evidence

Used the exact saved twelve cases, historical business context, user messages, model (`gpt-5.6-luna`), low reasoning effort and 4,000-token completion limit from earlier comparisons. Only the system prompt changes to the approved v5 candidate. These twelve cases contain seven distinct source texts. The same existing legacy-tail normalization was applied before prompting. The illustrative drafts were **not** added as few-shot examples or reference answers.

This round made exactly twelve new requests, with SDK retries disabled and frozen request IDs saved before submission. All completed once; all responses report the requested model and pass the existing length/block validator. Reported usage: 13,920 input tokens + 2,076 completion tokens = 15,996 total tokens. No invoice cost is inferred. No app account remix receipts, media jobs or edits were created.

Exact strings, frozen prompts, provider response IDs, usage and validation results: [v5 results](hook-remix-source-voice-v5-results-2026-10-23.json). Earlier v2 baselines and rejected v4 outputs in that file are copied from completed prior runs; no new baseline/v4 requests were made. This is an unblinded editorial review, not an audience test or a randomized concurrent comparison. These sources were used to develop the prompt and are not held-out evaluation data.

## Complete comparison

Line breaks are represented by `<br>`. All twelve results are included, including weak ones.

| Source / saved case | Rejected v4 output | New paid v5 output | Source-voice assessment |
| --- | --- | --- | --- |
| POV: you found a way to<br>make your texts point you<br>back to God<br>`06e7e484` | POV: AI drafts SaaS posts for approval | POV: you found a way to<br>make your content point you<br>back to posting | Opening rhythm returns, but the adapted meaning is awkward and circular. **Fails naturalness/semantic fit.** Keeping sentence shape alone is insufficient. |
| pov: you’re dating an IT guy<br>`c752e103` | POV: AI drafts your SaaS posts | pov: you’re dating a SaaS founder with UGCPilot | Keeps lowercase POV and the dating scenario. Brand insertion is clumsy; weaker than the reviewed calendar-personification draft. Partial preservation, not a strong finished line. |
| Computer Science students!!<br>This website is EVERYTHING<br>`12d3aa3f` | SaaS founders: AI content, approved | SaaS founders!!<br>This app is EVERYTHING | Restores the two-beat callout and excited exaggeration. Mostly an audience/tool word swap, so limited business-specific creativity. |
| no way this can HELP<br>you get through your<br>RESEARCH! 😭<br>`20850ea9` | No way AI can HELP<br>you market your SaaS! 🤯 | no way this can HELP<br>you market your<br>SAAS! 😭 | Informal casing, stress, three-line cadence and emoji survive. “Market your SaaS” remains broad and less relatable than a concrete situation. |
| 3 years of video editing<br>and NOW i find this??? 😳<br>`4aba6844` | Hours spent marketing your SaaS—then AI drafts your next post 😳 | All this time marketing my SaaS<br>and NOW i find this??? 😳 | Restores the late-discovery NOW punchline. **Still implies unsupported personal experience**, despite dropping the number. Not acceptable as a factual testimonial. |
| Computer Science students!!<br>This website is EVERYTHING<br>`aa5f006b` | SaaS founders!!<br>This AI makes Instagram content ready to post | SaaS founders!!<br>This website is EVERYTHING | Restores the source's excitement and rhythm; minimal topic substitution. Same weakness as the other audience-callout cases. |
| POV you married the IT guy<br>`2d0fd0e9` | POV your AI marketing partner creates tomorrow’s posts | POV you married the app that makes your content | Keeps the marriage joke through clearly playful app personification. Closer to the requested creative direction than a generic partner/feature caption, though longer and still functional in its ending. |
| POV you married the IT guy<br>`012d65ba` | POV your AI content partner gets your SaaS | POV you married the app that markets your SaaS | Again preserves the marriage setup. Business relevance is clear but the ending is generic; this is not evidence of broad creative variety. |
| Computer Science students!!<br>This website is EVERYTHING<br>`e9116f48` | SaaS founders!<br>AI content, ready to review | SaaS founders!!<br>This website is EVERYTHING | Preserves callout, double exclamation and hyperbole. Exactly matches the other website-callout v5 output; source similarity explains repetition but not creative improvement beyond audience substitution. |
| HOW is this even LEGAL?!?<br>😭<br>`292d844b` | WHY write SaaS posts manually? 😭 | HOW is marketing my SaaS even this EASY?!?<br>😭 | Recovers HOW, emphatic punctuation and the reaction emoji. **Loses the deliberately extreme LEGAL punchline**, replacing it with a conventional ease claim. First-person wording should not be presented as a verified customer result. |
| HOW is this even LEGAL?!?<br>😭<br>`1e07a767` | AI writing your SaaS posts?! 🤯 | HOW is posting for your SaaS even this easy?!?<br>😭 | Closer sentence rhythm, but the same softening to ease instead of outrageous disbelief. The approved cheat-code illustration is not reproduced. |
| HOW is this even LEGAL?!?<br>😭<br>`109601ce` | HOW does AI make SaaS content this simple?! 😳 | HOW is posting for your SaaS this easy?!?<br>😭 | Same pattern: surface voice returns, strongest comic exaggeration does not. Not a full source-faithful success. |

## What the results establish

- V5 stops the repeated AI-feature framing: AI appears in 0/12 v5 outputs versus 11/12 rejected-v4 outputs. That is an observed wording change, not a quality metric by itself.
- Marriage personification, audience-callout energy, NOW emphasis, informal casing and source-like punctuation survive more often. The marriage cases are the clearest examples of retaining a social setup.
- It still often falls back to literal topic substitution. The faith metaphor loses coherent meaning; the dating case inserts the brand awkwardly; the regret case still borrows an unverified experience; all three LEGAL cases dilute the punchline. Passing JSON/character checks catches none of those editorial failures.
- The manually drafted examples were direction-setting proposals, not a prediction of provider behavior. These paid outputs demonstrate the gap between the approved target style and what this exact prompt/model currently returns.

Keep v5 as an experimental candidate. Do not replace the active prompt or claim that the twelve technical passes qualify its writing. Any further change or provider round is separate work; no extra request is queued and the twelve-call authorization is fully used.

## Local checks

The runner rejects changed model/context/user messages before submission. It freezes prompt/request identities, preserves prior experiment files and does not resubmit completed or uncertain work. Scoped lint passes. Post-run integrity checks verify twelve distinct completed request IDs, all twelve outputs against the application's validator, prompt bytes against the unchanged v5 builder, and no new candidate import in the active Remix API. These checks establish experiment integrity, not writing quality or hosted acceptance.
