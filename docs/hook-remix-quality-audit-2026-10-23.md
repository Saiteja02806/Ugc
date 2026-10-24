# Hook remix quality audit — 23 October 2026

Follow-up: the user subsequently authorized the local prompt improvement and two provider-test rounds. See [the completed comparison](hook-remix-prompt-review-2026-10-23.md) for all results and remaining limitations. This audit below records the earlier read-only findings.

The saved results support the user's complaint: several Hook remixes adapt the topic but lose the source's interest, specificity or natural phrasing. The strongest explanation supported by this audit is an overly literal adaptation brief combined with weak editorial acceptance criteria. A model change alone has not been tested and cannot be called the fix.

This is an audit. Application prompts, models, account settings and saved receipts were not changed. No new provider requests, video renders or deployments were submitted.

## Evidence scope

Read the connected account's complete available text-remix history: 12 completed Hook requests from 16–23 October. Recovered each immutable source/output through the application MCP and checked model, prompt version, instructions and saved business profile through an owner-filtered read-only database query. All use `gpt-5.6-luna`, business profile version 2 and empty additional instructions; six use prompt version 1 and six version 2. The saved business-context digests are identical. These are one account's results, not a representative performance benchmark.

Exact source/output strings, timestamps and request keys: [saved evidence](hook-remix-quality-samples-2026-10-23.json). `source.model: user-text` does not prove someone changed the reference: the website also supplies unchanged source blocks through that path.

## Source versus generated copy

Line breaks below are represented with `<br>`; exact strings remain in the evidence file. Editorial judgments describe the writing, not measured retention or reach.

| Request / date | Source | Saved generated output | Finding |
| --- | --- | --- | --- |
| `c752e103` / 23 Oct / v2 | pov: you’re dating an IT guy | pov: you’re a SaaS founder using UGCPilot to create your marketing content | A six-word scenario becomes a twelve-word product description. It loses the relationship-based humor and adds the audience, brand and generic function in one line. |
| `06e7e484` / 23 Oct / v2 | POV: you found a way to<br>make your texts point you<br>back to God | POV: you found a way to<br>make your content point people<br>to your SaaS | The sentence scaffold survives, but the spiritual-purpose metaphor becomes vague promotional language. No concrete content problem or distinctive product mechanism appears. |
| `12d3aa3f` / 22 Oct / v2 | Computer Science students!!<br>This website is EVERYTHING | SaaS founders!!<br>This tool is EVERYTHING | Audience/topic substitution preserves energy but gives no reason to care about this particular tool. The earlier v2 request `aa5f006b` similarly says “This platform is EVERYTHING.” |
| `20850ea9` / 19 Oct / v2 | no way this can HELP<br>you get through your<br>RESEARCH! 😭 | no way this can HELP<br>you get through your<br>CONTENT CREATION! ✨ | Emoji adaptation works here. The wording remains a near-direct noun replacement; “get through your content creation” is awkward and generic. |
| `4aba6844` / 19 Oct / v2 | 3 years of video editing<br>and NOW i find this??? 😳 | 3 years of SaaS marketing<br>and NOW I find this??? 🚀 | Keeps the discovery/regret mechanism, but transfers a three-year personal-experience claim without supporting evidence. The prompt already prohibits inventing personal experience; preserving a source claim is not proof that the business may claim it. |
| `2d0fd0e9`, `012d65ba` / 16 Oct / v1 | POV you married the IT guy | POV you let UGCPilot handle your content | Same result on two requests; brand insertion replaces the relationship joke with a generic delegation statement. This does not prove cached or incorrect response delivery. |
| `109601ce`, `1e07a767`, `292d844b` / 16 Oct / v1 | HOW is this even LEGAL?!? 😭 | HOW are SaaS founders still doing this manually?!? 😭 / HOW is this even AUTOMATED?!? 😭 / HOW is this much CONTENT even POSSIBLE?!? 😭 | Vague “this” lacks a concrete object without a matching demonstration. These older emoji choices predate v2; do not present them as evidence that the current contextual-emoji instruction never works. |
| `e9116f48` / 16 Oct / v1 | Computer Science students!!<br>This website is EVERYTHING + final-frame coding caption | SaaS founders!!<br>This app is a game changer + final-frame marketing caption | Generic hype. This legacy receipt also contains the known screen-cut tail; current application normalization removes that tail without regenerating the receipt. |

## Implementation findings

1. **The brief rewards small wording changes more strongly than a convincing adaptation.** [remix-text-prompt.ts](../lib/explore/remix-text-prompt.ts) begins with “smallest useful changes” and preserving sentence sequence, tone and approximate length. It does not explicitly require identifying the source's persuasive mechanism, a specific audience tension or a demonstrable payoff. The observed noun substitutions fit this instruction. This is a supported contributing explanation, not an experimentally isolated cause.
2. **Valid JSON is treated as acceptable copy.** [reference-text.ts](../lib/explore/reference-text.ts) checks block count, strings and character limits. All twelve saved outputs pass. It does not evaluate specificity, natural phrasing, source-mechanism fit or whether a personal claim has evidence. These require editorial/semantic review rather than a blanket banned-word list.
3. **Short-source expansion is much larger than “130%” suggests.** The validator permits `max(80, ceil(sourceCharacters × 1.3))`. The IT-guy source has 28 characters; its 74-character output passes the 80-character allowance despite being 2.64 times as long. `remixTextPrompt` sends text but no source timing or selected clip duration. A duration-aware reading budget is absent. The 3.466-second source interval is context, not proof of the finished video's display time: application timing may scale to the selected clip.
4. **Useful context exists, but the brief does not prioritize it.** Saved context includes daily ready-to-post content, tailored business analysis and human approval. Several outputs use none of these specifics. The same payload also includes carousel structures, CTA ideas and “effortlessly” suggestions alongside explicit “No effort required”/guaranteed-growth restrictions. This creates an avoidable context-quality risk; these receipts do not prove those auxiliary fields caused a particular output. Use a compact Hook-specific context projection with restrictions taking priority.
5. **The single editable box has an ambiguity when modified.** [remix-text-section.tsx](../components/explore/remix-text-section.tsx) sends changed text as both the source block and additional instructions. A user mixing source prose with guidance gives the model an unclear boundary. This did not cause the twelve sampled results: their additional instructions were empty. Preserve the single-box product decision while separating source/guidance internally before generation.
6. **No observed text corruption in the tested application mapping.** All twelve recovered outputs passed through the actual Apply function and JSON serialization with exact wording preserved, subject to the documented legacy tail normalization. All twelve saved sources also match the current local catalogue after that normalization. This is evidence against a general wrong-source/word-mutation explanation for this sample. It is not visual acceptance of hosted finished videos or a full live UI check.

## Recommended change

Give Hook remix its own writing brief: identify the source's mechanism (discovery, helpful partner, audience callout, regret, surprise), retain its emotional purpose, and rebuild the scenario around one grounded business problem or feature. Prefer a natural hook over preserving the original noun sequence. Include brand names only when they improve the line. Treat unsupported numbers, personal histories and results as claims to remove or recast, even when present in the reference.

Include source block timing and the selected clip's display budget, with language-aware brevity guidance. Keep the existing output shape, account ownership, immutable request recovery and explicit Apply step. Do not rewrite historical receipts or automatically submit paid retries. Scope the prompt change to Hook initially because Wall of Text and slideshows share the current prompt but require different pacing.

Illustrative human-written directions, **not new application outputs or proven winners**:

| Existing weak direction | Candidate direction | Purpose |
| --- | --- | --- |
| SaaS founder using UGCPilot to create your marketing content | POV: your app's next post is already drafted | Short, concrete relief scenario without listing audience, brand and feature. |
| 3 years of SaaS marketing and NOW I find this | Still making every SaaS post from scratch? | Keeps the effort/regret tension without an unsupported biography. |
| SaaS founders!! This tool is EVERYTHING | SaaS founders: turn your app into your next post | Connects the audience to a concrete tailored-content use case. |

Before choosing a replacement prompt, compare baseline and candidate on the same saved inputs, including repeated runs, with a fixed rubric: mechanism, business specificity, natural phrasing, claim grounding and readability. Include relationship/faith metaphors, generic hype, experience claims, non-English instructions and manual edits. Separate prompt changes from any model comparison so their effects remain interpretable. This audit did not submit that experiment and makes no causal performance claim.

## Checks and remaining gaps

The actual-receipt audit accepts and round-trips all 12 outputs and confirms their current source text. Evidence is in `.tmp/hook-remix-quality-checks.json` and `.tmp/hook-remix-quality-catalog-checks.json`; reproducible runner: `.tmp/hook-remix-quality-audit.mjs`.

The wider local regression run has **37 passing and 2 failing tests**. Record failures rather than claiming a clean suite:

- `remix-source-api.test.mjs` assumes ordinary generated-media reads never fetch their job. The current media route fetches generated-media jobs for metadata before the optional Remix branch. The assertion fails before its later unrelated-owner checks; this run does not establish those later checks. No media route was changed in this audit.
- `remix-text-catalog.test.mjs` compares an inventory of 283 references with 296 current references. The inventory helper omits nine current Hook references and four slideshow references. Independently, all twelve sampled Hook sources resolve and match current caption text; inventory drift does not explain their weak wording. No catalogue/test expectations were changed to conceal the mismatch.

The stored provider model name/version metadata does not retain the exact historical system-prompt bytes or token/response diagnostics. Current v2 source and stored v2 receipts align, but the provider's exact historical wire request was not recovered. Hosted rendered-video text, font/layout and audience performance remain outside this audit. Deployment stays paused.
