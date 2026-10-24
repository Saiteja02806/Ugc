# Hook remix v6: minimal word changes

Status: the user subsequently authorized twelve paid OpenAI tests; all completed. See [all source-versus-remix results](hook-remix-minimal-v6-paid-review-2026-10-23.md). The active app remains on the previous v2 prompt; no deployment or automatic switch. All earlier experiment evidence is preserved.

The user clarified that this is a close adaptation, not a new hook inspired by the source. Replace the smallest product-relevant phrase while keeping the sentence, situation, emotion and delivery. The previous instruction not to merely swap a noun was contrary to this requirement: a noun-phrase swap can be exactly the right edit. Do not demand extra creative transformation.

Candidate: [hook-remix-minimal-prompt.ts](../lib/explore/hook-remix-minimal-prompt.ts). Its core instruction is:

> Adapt the source text for the supplied product by changing as few words as possible. Treat the source as a sentence to edit, not inspiration for a new hook.

Keep structure, POV, situation, emotion, humor, rhythm, emphasis, punctuation, line breaks and emojis. Replace only the topic-specific word or short phrase needed for product/audience/use-case fit. Do not add a SaaS-founder character, brand insertion or feature explanation. If the original already works for the product context, leave it unchanged. Unsupported factual history/results still require a narrow correction, not a wholesale rewrite.

## Illustrative edits, not new provider outputs

| Source | Illustrative adaptation | Change |
| --- | --- | --- |
| pov: you’re dating an IT guy | pov: you’re dating your marketing app | Replace the partner noun phrase with an obviously playful product personification. Keep the same subject and dating setup. This is not a real relationship claim. |
| Computer Science students!!<br>This website is EVERYTHING | SaaS founders!!<br>This website is EVERYTHING | Change the audience only. This exact adaptation has occurred in earlier saved results; it is not presented as newly generated or proof of v6 quality. |
| HOW is this even LEGAL?!?<br>😭 | HOW is this even LEGAL?!?<br>😭 | No edit is needed when the product demonstration supplies the context. Retain the playful rhetorical exaggeration; no actual illegality is claimed. |

The audience and rhetorical examples deliberately avoid extra rewriting. They remain review illustrations, not a model reliability claim. The later authorized paid run used the candidate without these examples added to provider input. The candidate remains separate from the active app; no additional provider test is queued.
