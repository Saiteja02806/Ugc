# Hook remix prompt comparison — 23 October 2026

Status: **rejected by the user for losing the source's voice**. Experimental v3/v4 prompts are disconnected from the active local API; it again uses the pre-experiment v2 prompt/version. Nothing was deployed. See [the source-voice review](hook-remix-source-voice-review-2026-10-23.md) for the corrected all-case assessment. The 36-call experiment below remains historical evidence; passing length/structure checks did not qualify the creative results.

## What changed locally

Hook now has a separate writing brief in `lib/explore/remix-text-prompt.ts`, selected by the server from the verified source format. Wall of Text and slideshows retain the exact v2 prompt. Existing v1/v2 receipts still recover without another provider request. The output JSON shape, user payload, model and validation remain unchanged.

The brief preserves the source's emotional setup while rebuilding it around one grounded business detail. It discourages generic praise, feature lists, mechanical brand insertion and unsupported source claims. Hook v4 further requires present-tense audience framing when speaker experience is unverified, distinguishes an AI partner from a human service team, clarifies emoji intent, and prepends the exact per-source aggregate character budget with a counting margin.

## Completed comparison

The user explicitly approved sending the twelve saved examples and UGCPilot business context to OpenAI for 24 billable text requests. These used the original model `gpt-5.6-luna`, low reasoning effort, 4,000 maximum completion tokens, the same historical business context and identical user messages in both conditions. The only paired-condition change was the system prompt. Calls alternated condition order by case; all outputs were retained. One legacy screen-cut tail was normalized equally before both conditions, matching current application behavior.

There is one fresh v2 baseline and one fresh v3 candidate per saved case. Duplicate source texts remain separate cases, providing a few repeated observations. Historical outputs are retained alongside both fresh results. The provider reported 26,328 total tokens across the 24 completed calls. No automatic retries, account remix receipts or video edits were created.

All twelve baseline outputs pass the application validator; eleven of twelve candidate outputs pass. Validation success is not a quality score. These are editorial observations on one business, without blind judging, audience metrics or a model comparison.

| Source / saved request | Fresh old prompt (v2) | Fresh new prompt (v3) | Review |
| --- | --- | --- | --- |
| “Computer Science students!! This website is EVERYTHING” / `12d3aa3f` | “SAAS founders!! This tool is EVERYTHING” | “SaaS founders!! UGCPilot drafts ready-to-post Instagram content” | More specific; replaces generic hype with a grounded action. |
| Same audience-callout source / `aa5f006b` | “SaaS founders!! This website is EVERYTHING 🚀” | “SAAS founders!! Daily Instagram content, ready for your approval” | Connects the benefit to the human-approval workflow. |
| “POV you married the IT guy” / `2d0fd0e9` | “POV you found the SaaS marketing tool that creates your ready-to-post content” | “POV you found an AI marketing partner 🤝” | Shorter partner framing, although the feature payoff remains broad. The duplicate case produced the same candidate wording. |
| “pov: you’re dating an IT guy” / `c752e103` | “pov: you’re marketing your SaaS with UGCPilot 🚀” | “POV: your SaaS has a content team 🤝” | More like a scenario, but “content team” can imply a human service. Treat as a claim-clarity concern. |
| “3 years of video editing and NOW i find this???” / `4aba6844` | “3 years of marketing and NOW i find this??? 🚀” | “Years marketing my SaaS and NOW I find ready-to-post content??? 😳” | **Fails editorial grounding in both conditions.** Removing the number did not remove the unverified personal history. |
| “POV: you found a way to make your texts point you back to God” / `06e7e484` | “POV: you found a way to make your content market your SaaS” | “POV: you found a way to turn your SaaS updates into ready-to-post Instagram content” | More concrete but **83 characters against an 80-character maximum**. Current application validation rejects it. |
| “HOW is this even LEGAL?!?” / `1e07a767` | “HOW are SAAS founders STILL doing this manually?! 😳” | “HOW is daily SaaS content already ready?! 😭” | Specific object, awkward “already ready” phrasing and questionable inherited emoji. Not an automatic improvement. |

Exact wording, original line breaks, all twelve cases, historical outputs, frozen prompts, provider response IDs, validation errors and token usage are in [the complete comparison](hook-remix-prompt-comparison-2026-10-23.json). This table is a reviewed subset; it does not hide the other outcomes or claim the new prompt wins every case.

## Completed v4 follow-up

The user separately approved twelve additional billable requests with the same saved examples and business context sent to OpenAI. These completed using the identical model/settings/user messages; the v4 system prompt includes each source's actual character budget. No extra baseline calls were made. All provider responses report `gpt-5.6-luna`. Request IDs and frozen wire messages are in `.tmp/hook-remix-prompt-followup/manifest.json`; [complete follow-up evidence](hook-remix-prompt-followup-2026-10-23.json) preserves every output and validation result. Historical receipts and the first comparison are unchanged.

All twelve v4 outputs pass the existing application validator. The previously overlong case now has 38 characters, within its 80-character maximum. The regret case no longer asserts the speaker's years of experience; it uses an audience scenario about time spent marketing. This still assumes hours of effort and should not be treated as a measured customer result. Mean whitespace-separated output length falls from 8.92 words in the fresh baseline to 7.75 in v4; this crude count includes standalone emojis and is not a reading-speed or retention metric.

| Saved case | Fresh old prompt (v2) | Final tested prompt (v4) | Editorial assessment |
| --- | --- | --- | --- |
| `06e7e484` / faith-purpose POV | POV: you found a way to make your content market your SaaS | POV: AI drafts SaaS posts for approval | Concrete and within bounds; loses much of the original emotional setup and feels like a description. |
| `c752e103` / dating an IT guy | pov: you’re marketing your SaaS with UGCPilot 🚀 | POV: AI drafts your SaaS posts | Clearer action, but the relationship humor is largely gone. |
| `12d3aa3f` / student callout | SAAS founders!! This tool is EVERYTHING | SaaS founders: AI content, approved | Avoids empty hype; **approval is ambiguous**. Could sound like AI approves the content. Require human review/rewording before using this line. |
| `20850ea9` / research surprise | no way this can HELP you create your SAAS content! 🤯 | No way AI can HELP you market your SaaS! 🤯 | Preserves disbelief but the benefit remains broad; reads as rhetorical disbelief rather than literal inability. |
| `4aba6844` / three-year regret | 3 years of marketing and NOW i find this??? 🚀 | Hours spent marketing your SaaS—then AI drafts your next post 😳 | Moves away from unsupported autobiography and gives a concrete action; still has an unmeasured effort assumption. |
| `aa5f006b` / student callout repeat | SaaS founders!! This website is EVERYTHING 🚀 | SaaS founders!! This AI makes Instagram content ready to post | More specific, though still promotional. |
| `2d0fd0e9` / married the IT guy | POV you found the SaaS marketing tool that creates your ready-to-post content | POV your AI marketing partner creates tomorrow’s posts | Shorter partner scenario with a content payoff. |
| `012d65ba` / married the IT guy repeat | POV you found the AI marketing copilot for your SaaS | POV your AI content partner gets your SaaS | Relatable partner framing but “gets” remains vague. |
| `e9116f48` / normalized legacy callout | SaaS founders!! This tool is EVERYTHING 🚀 | SaaS founders! AI content, ready to review | Clearer output and explicit review step; a stronger direction than generic hype. |
| `292d844b` / legal disbelief | HOW is this even AUTOMATED?! ✨ | WHY write SaaS posts manually? 😭 | Names the task, but inherited distress emoji is debatable and the structure changes to a direct question. |
| `1e07a767` / legal disbelief repeat | HOW are SAAS founders STILL doing this manually?! 😳 | AI writing your SaaS posts?! 🤯 | Shorter and more concrete; a plausible disbelief hook. |
| `109601ce` / legal disbelief repeat | HOW are SaaS founders still doing this manually?! 🚀 | HOW does AI make SaaS content this simple?! 😳 | Names the category but “this simple” needs a visible demonstration; not clearly better than baseline. |

The twelve follow-up calls reported 17,774 tokens; total across both approved rounds is 44,102 tokens. No price or realized invoice amount is inferred. All requests completed once, with no automatic retries or additional unapproved rounds.

Overall, the revision improves concrete product connection, removes generic EVERYTHING copy in these examples, and controls length. It also becomes more uniform and sometimes less playful. Claim ambiguity and lost humor remain reasons for manual review. These source texts were used to develop the prompt, so they are a regression/evaluation set, not independent held-out proof of general quality. No non-English/manual-guidance provider cases or audience experiment were added. Do not infer a universal win or automatic publishing readiness from the twelve structural passes. Production promotion remains a separate decision after user review.

## Local verification and boundaries

The final v4 implementation passes **36 focused tests**, TypeScript and scoped lint. Checks verify actual short/long source budgets, Hook-only routing and unchanged v2 prompts for other formats, exact saved context/source forwarding, old receipt recovery without regeneration, ownership, source identity and history. Live validation uses the same `validateRemixOutput` function as the application; it does not perform editorial fact checking.

The earlier broad audit's two unrelated failing assertions remain recorded in [the audit](hook-remix-quality-audit-2026-10-23.md). They were not changed to produce a passing run. No end-to-end production, non-English output, changed single-box guidance or rendered-video acceptance is claimed. Website/worker deployment remains paused.
