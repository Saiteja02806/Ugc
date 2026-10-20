# Prompt clarity implementation review — 25 September 2026

## Follow-up: fresh local output review

Verdict: the changes help, but the broader test does **not** justify calling the clarity issue solved. Most returned text is understandable at a basic level; several outputs still sound padded, circular, or unnatural. Some facts lose important conditions before the writer receives them.

Ran the current extraction → fact snapshot → planner → assigned-fact writer → existing validation code locally, using live model calls and synthetic inputs. No application prompts or runtime behavior were changed during this follow-up. This run tested five businesses, generated 50 planning ideas, and requested 25 Wall outputs (five nonconsecutive ideas from each ten-item chunk). It made 24 model requests including retries.

| Synthetic business | Plan ideas | Returned Wall outputs | Result |
| --- | ---: | ---: | --- |
| PostBench: social posting | 10 | 5 | Understandable approval/scheduling copy, but two circular product descriptions |
| ContextDraft: jargon-heavy description | 10 | 0 | Batch threw after candidate 1 exhausted layout-fit repair; no final batch returned |
| BatchNote: limited free-plan drafts | 10 | 5 | Generally clear; some repeated approval wording |
| Morning Loaf: bakery | 10 | 5 | Concrete ordering details, but one circular and incompletely qualified pickup message |
| SlotNote: appointment requests | 10 | 5 | Clear request/confirmation distinction, but padded wording and a repeated email sentence |

The failed batch does not establish that all five individual cards failed. Its error was `Wall-of-text Writer could not repair candidates: 1:layout_fit.` Readability review below covers only the 20 returned outputs. These are editorial judgments, not measured human-reader comprehension scores.

### Examples that work

“For freelance writers, BatchNote’s mobile app can turn notes into up to three draft posts per month on the free plan, with approval required before publishing.”

“SlotNote helps independent hairdressers manage requests: clients use a booking link to ask for a time, then the hairdresser reviews and confirms each request before the appointment is booked.”

Both identify the person, action, and important limits without requiring the reader to see the planning notes.

### Five returned messages clearly needing revision

1. PostBench: “For SaaS founders, product work can make regular Instagram posting difficult. PostBench is an Instagram publishing tool for the publishing work that sits alongside running a product.” The second sentence is circular and adds little useful explanation.
2. PostBench: “Running a SaaS product can put regular Instagram posting alongside the work of managing the product. PostBench is an Instagram publishing tool for that publishing task.” The thought is unnecessarily indirect and repetitive.
3. Morning Loaf: “An online sourdough order can connect directly to the next day: Morning Loaf offers online ordering for next-day sourdough pickup, so the collection day follows the order by one day.” “Connect directly to the next day” is unnatural, the ending repeats “next-day,” and the selected extracted fact omitted the 4 pm cutoff and available pickup days.
4. SlotNote: “When a client is ready to arrange a hair appointment, the booking link provides a clear place to request a preferred appointment time instead of leaving the request without a defined starting point.” The final contrast is vague and unnecessary.
5. SlotNote: “Once a hairdresser confirms an appointment request, the client receives an email about that request, with the email being sent after the hairdresser’s confirmation.” The same timing fact is stated twice. The meaning is understandable, but the writing is not natural.

Other outputs also repeat information to varying degrees. These five are the clearest revision cases, not a claim that the remaining fifteen are flawless.

### What the code review explains

- These sentences are model output, not text added by layout processing.
- Fact-assigned candidates bypass the separate AI reviewer in `generate-trending-wall-text-ideas.ts`. Deterministic checks do not reliably detect circular explanations or missing semantic conditions.
- The planner can repeat the same observation in different words. Exact-duplicate tests do not establish meaningful variety.
- The writer already forbids padding and restating a capability, yet this run produced both. Adding another generic “write clearly” instruction alone is therefore not a demonstrated solution.
- The current 24-word minimum may encourage expansion of a simple fact. This is a hypothesis, not an experimentally isolated cause. It concerns padding, not video duration or how quickly users read.
- Extraction still sometimes drops qualifications in standalone facts or adds an inferred effect: the appointment example expanded “mark times as unavailable” into “so clients do not request them.”

Recommended next experiment, not implemented: compare the current prompt against one with a few concrete bad-to-good examples for these failures, while keeping the same source facts and evaluating final copy separately from planner labels. Independently test whether the minimum word requirement causes padding. Preserve all conditions in each standalone selected fact. Do not declare the issue fixed until repeated fresh outputs support that conclusion; a small real-reader test would measure the actual goal more directly.

Verification rerun: Business Context 20 tests, Wall suite 161 tests plus 11 behavior tests, and worker planner 12 tests passed (204 total). Worker build passed. Full application typecheck still fails only at the previously reported unrelated `generation-jobs.test.ts:64` fixture. No full 200-item plan, browser/deployed flow, or human-reader study was performed. Raw local results are in `.tmp/wall-clarity-review/broad-review-results.json`.

## Scope

Implemented the prompt-only approach: clearer Business Context extraction, clearer fact-first planning, and clearer Wall-of-Text writing. No additional model-call checker, approval gate, two-version fact storage, or review UI was added. Existing unrelated worktree changes were preserved.

- Website, typed-description, and AI-IDE extraction share the same factual-writing instructions. The AI-IDE report template also asks for plain language.
- Factual descriptions use complete sentences; names, audience categories, enums, and search keywords may remain concise labels.
- Instructions require source-supported meaning, explicit subjects, preserved qualifications, and omission of ambiguous claims rather than guesses.
- Planner v16 applies the clarity instructions to initial chunks and single-idea repairs. Neutral practical observations are permitted; editorial variety must not require invented scenes or emotions.
- Writer v27 explains the assigned fact in everyday language and checks standalone meaning. Retry instructions distinguish clarity from layout-fit problems.
- Fact selection, schemas, plan size, existing validators, and Business Context review behavior are unchanged. Existing saved context and plans are not rewritten automatically.

## Bounded live evaluation

Used synthetic website text, a jargon-heavy typed description, and a qualified mobile-app description. Compared pre-change and revised extraction, one ten-idea planner chunk per variant, and three Wall outputs per variant. Then reran the revised extraction fixtures, ten-idea chunk, and three Wall outputs after refining the prompts. These were real model calls with the existing generation/validation code, not production data or website scraping.

Observed improvements:

- Given the ambiguous phrase “Takes long time,” the old extraction invented “Creating content takes a long time.” Revised extraction omitted that interpretation and recorded the missing information.
- Revised extraction retained free-plan and monthly draft limits, approval requirements, and warnings against unsupported growth claims in the qualified app example.
- An intermediate revised Wall output still said “an unspecified topic” and “tailored content ideas.” The final instructions explicitly favor the concrete input and action instead of that shorthand.
- One final Wall output read: “Before any post is published, a human must approve it. ContextDraft requires that approval for every post, keeping the publishing decision with a person.”
- All nine sampled Wall outputs across the baseline, intermediate, and final runs passed the existing layout and text validation. Passing those validators is not proof of readability or factual accuracy.

## Remaining limitations

The sample supports improvement, not a guarantee of human comprehension. There was no human-reader study, full 200-idea run, or deployed acceptance test.

Some final planner ideas still repeated the same observation in different wording. Some extraction phrasing still weakened a requirement (“can approve” rather than “must approve”), even though the required approval was retained in another fact. A separate draft-editing fact did not retain the original “may need editing” qualification. Prompt instructions reduce these risks but do not enforce semantic equivalence. Existing Business Context review remains important, including for manually edited facts, which do not pass through extraction prompts.

## Verification

- Business Context tests: 20 passed.
- Wall tests: 161 passed, plus 11 posttest behavior checks.
- Worker content-plan tests: 12 passed.
- Worker build and targeted ESLint: passed, including after final prompt refinements.
- Final focused schema/grounding checks: 20 passed after refinements.
- Targeted diff whitespace check: passed.
- Full application typecheck: blocked by an existing unrelated fixture error at `lib/reaction-format/generation-jobs.test.ts:64`; its `BackgroundJobRecord` is missing required fields. That file was not changed.

No changes were pushed or deployed. A broader multi-business output evaluation and real-reader review remain necessary before claiming consistent clarity across all 200 ideas.
