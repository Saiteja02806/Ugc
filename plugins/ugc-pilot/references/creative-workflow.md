# Shared creative workflow

## Context and claims

Reuse the product, audience, pain, promise, feature/mechanism, tone, evidence and claims-to-avoid already in the conversation. If the user asks to use their connected business context and the MCP is available, read `get_saas_brand`; use only the connected account. Its structured fields include product_summary, target_audience, main_problem, main_promise, value_propositions, differentiators, brand_tone, claims_to_avoid and missing_info. Treat missing fields as unknown. Do not require a connection for drafting from a usable user brief. Ask one focused question only when product/topic or an essential restriction is absent.

User-stated facts are inputs, not independently verified facts. Do not invent metrics, features, income, downloads, relationships, endorsements, personal results or medical promises. Source examples are inspiration for structures, not evidence for a brand. A fictional first-person scenario must be clearly identified when it could look like a real testimonial. Draft original copy rather than copying creator sentences with a changed product name.

## Output selection

| Requested deliverable | Workflow |
| --- | --- |
| Short hook words / text based on my business | [Hook Intelligence](../skills/ugc-hook-intelligence/SKILL.md) |
| Hook video prompt / emotional reaction direction | [Emotion Hook Director](../skills/emotion-hook-director/SKILL.md) |
| Wall-of-text paragraph / list for a video | [Wall Text Generation](../skills/wall-text-generation/SKILL.md) |
| Footage prompt for wall-of-text / overlay plan | [Wall Text Video Generation](../skills/wall-text-video-generation/SKILL.md) |
| Slideshow copy / slide sequence / semantic JSON | [UGC Native Slideshow](../skills/ugc-native-slideshow/SKILL.md) |
| Generate the actual image or video | [Create UGC Media](../skills/create-ugc-media/SKILL.md) |

These are instructions for the host model, not a keyword router. Use the requested deliverable and conversation context. For an ambiguous “make a hook,” infer text from a copywriting conversation and a prompt from a directing conversation; otherwise ask whether they want words, a prompt, or a generated clip.

Combined requests can complete multiple drafting steps in one response. Generate copy once, select the explicitly chosen option or use the single draft just created when the user requested both copy and prompt, then pass that string unchanged to the director. If several candidates exist and none is selected, ask which to use or clearly pair each requested prompt with its candidate. Do not arbitrarily overwrite user-selected wording.

## Exact text and execution

For a director, selected text is immutable, including Unicode, punctuation, emoji and authorial newlines. Editor visual wrapping may change layout but must not alter the stored string. A prompt-only request should return a prompt, not a generated asset or an invented job. No generation or upload/delete tool is needed for creative drafting. Read-only brand retrieval is optional when relevant.

When the user asks to generate, hand off to Create UGC Media. It checks current access, capabilities, total cost, ownership and retries using the same request ID. The current MCP accepts a prompt of at most 1,000 characters, whole durations 3–10 seconds and counts 1, 2 or 4; discover live aspect ratios and options before submission. Adapt long creative direction into a supported prompt without losing essential constraints; do not silently truncate, change count/duration or submit another paid job on retry. Negative prompts, audio plans and overlay specifications here are creative/editing data, not separate supported MCP arguments.

MCP generation returns footage. Exact overlay composition, slideshow rendering and social publishing are separate operations; this package contains no compositor, Carousel adapter or publishing tool. Do not promise an edited wall-of-text video or exported slideshow from a footage job. A requested duration beyond the live limits needs an explicit supported alternative before generation. Do not fabricate a result URL.
