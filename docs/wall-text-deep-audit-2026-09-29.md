# Wall of Text clarity audit — 29 September 2026

## Decision

The current prompts usually produce understandable everyday language. Keep the implemented plain-language instructions, the option to use two planning sentences, and the approved-fact handoff. The results support continuing with reviewed output. They do not support signing off every automatically accepted card as clear and complete without review.

The remaining material problem is incomplete meaning: a readable sentence sometimes omits an approval requirement, a plan limit, or an exception. One technical example also assumes that a nontechnical reader understands “encryption.” Reusing approved facts is acceptable and was not scored as a defect. Reading speed, novelty, and repeated core meaning were not acceptance criteria.

This was a local audit of current code with live model calls and synthetic business inputs. It was not a study with real readers or acceptance testing on the deployed production site. No application prompts, production records, or deployments were changed during the audit.

## Evidence and scope

| Run | Planning output | Final text returned | Result |
| --- | ---: | ---: | --- |
| Eight business cases | 80 ideas | 40/40 | 39 texts were understandable on their own in my editorial review; one needed a technical term explained. Some readable texts omitted material conditions. |
| Complete plan for one business | 200 ideas | 20/20 sampled | All 20 were understandable in my review. The approval requirements in the sampled publication claims were retained. |
| Conditions saved separately | No planner | 4/4 | Pickup, approval, free-plan limits, and return restrictions survived. |
| Website recovery path | 5 ideas | 1/1 | Readable, but the recovery summary had already lost pickup restrictions. |

Total: 285 generated planning ideas, 65 final texts, and 102 model requests including internal repairs. The full 200-idea run used 20 chunk requests, 42 individual planning repair requests, and 3 writer requests. It completed without an application-level failure. This confirms one complete planning run, not full-scale reliability for every business or a review of 200 final posts.

The 20 scale samples were selected before seeing their output: positions 5, 15, 25, through 195. Broad samples used positions 1, 3, 5, 7, and 10 from each ten-idea chunk. Every returned final text was read against its source and saved facts. These editorial judgments are not measured user comprehension percentages. There was no fresh before/after control in this audit, so it establishes current behavior rather than a numerical improvement rate.

Current versions: planner `wall-text-content-plan-reader-profiles-v17-complete-ideas`; writer `wall-text-writer-prompt-v28-preserve-conditions`. Both used the configured `gpt-5.6-luna` model; writer reasoning was `medium`. Recorded hashes confirm the audited prompt, snapshot, planner, and generation files did not change during the runs.

## What worked

The website, typed-description, and mobile-app extraction paths use the shared fact-writing rules. Typed reanalysis calls the same description analyzer. The planner receives the approved fact snapshot and selects a fact ID; the writer receives that fact and the snapshot as qualification context. Measured layout validation runs on the final wording. All 65 returned cards passed the current generation and layout gates.

Examples of actual output:

> When a teammate needs to view a file but not change it, FileNest lets a small business owner give that teammate read-only access instead.

The reader is told what “read-only” means.

> For independent hairdressers, an appointment request is still a request, not a booking. With SlotNote, clients request a time through a booking link, and the hairdresser confirms it before the appointment is booked.

The reader can distinguish requesting a time from having a confirmed appointment.

> Customers can order sourdough online for next-day pickup. Orders must be placed by 4 pm, and pickup is available Tuesday through Saturday from 8 am to noon.

The separately stored deadline and collection hours were preserved in this focused probe.

The one-fact NoteBox case also returned five understandable cards. They reused the same fact, as expected. That was acceptable under the requested standard.

## Findings that matter

### 1. Final text sometimes omits restrictions that are available to the writer

Six broad-run cards warrant revision for missing conditions under the current prompt contract:

| Case and plan position | What happened |
| --- | --- |
| ContextDraft, 5 | Described publishing across accounts without stating that every post requires human approval. |
| BatchNote, 1 and 7 | Described creating drafts from notes without the supported free-plan scope and monthly limit. |
| TrailBag, 3, 5, and 10 | Described the general return option without the personalized-item exception or customer-paid return postage. |

For example, the source explicitly excludes personalized backpacks from ordinary returns unless faulty, but an accepted card said:

> After delivery, a commuter checking an unused backpack can note TrailBag's return condition: it may be returned within 30 days, but only when the original tags are attached.

That is readable, yet can leave a buyer with an incomplete understanding of eligibility. The exception existed in the saved snapshot and was sent to the writer. The extraction and planner also produced some individual claims without all applicable conditions. Supplying the extra context therefore helps but does not ensure the final model uses it.

The free-plan and approval omissions are incomplete qualifications, not evidence that the model explicitly promised unlimited usage or automatic publishing. The personalized-return omission is the clearest example of a missing exception changing how a customer could interpret eligibility.

The acceptance path explains why these cards survive: fact-assigned cards skip the AI reviewer in `lib/trending/generate-trending-wall-text-ideas.ts:285`. `getWallTextGroundingIssue` checks prohibited strings and a narrow set of high-risk words; it does not compare the full meaning with the approved facts. A deliberately incorrect diagnostic sentence saying users can publish without human approval returned no grounding issue. This diagnostic was hand-authored, not a live hallucination, and tested that helper rather than the entire generation pipeline.

### 2. The website recovery path can lose evidence before the writer sees it

`recoverMissingWebsiteFacts` in `lib/website-analysis/analyze-business.ts:157` uses a separate prompt without the shared plain-language and condition-preservation contract.

Given the same bakery source, and a simulated initial analysis missing its required summary, recovery produced:

> Morning Loaf lets customers order sourdough bread online for next-day pickup.

It omitted the 4 pm cutoff, Tuesday–Saturday restriction, and 8 am–noon hours. These were absent from the resulting snapshot. The final text repeated the unqualified next-day pickup claim. The test proves the behavior when recovery is invoked; it does not measure how often real onboarding enters this path.

A second boundary risk affects manually edited or recovered summaries: the schema accepts 500 characters, while the fact catalog silently keeps only 360. A synthetic 420-character summary with a final restriction lost that restriction in the actual snapshot function. The normal extraction prompt asks for a 360-character summary, but that instruction does not enforce the same limit on manual edits or recovery. This was a deterministic boundary probe, not an observed live generated truncation.

### 3. Technical wording can remain unexplained

The technical fixture explicitly served owners without technical training. One final card said:

> FileNest encrypts a file on the user's device before upload, placing the encryption step before the file enters online storage instead of after upload.

The sequence is clear to someone who understands encryption. The meaning of encryption is never explained. The source also supplied the supported explanation that only people with the shared key can read the file. For this audience, the final text should express that meaning in ordinary words. This is the one broad-sample card I would revise for language clarity itself; other editorial awkwardness did not prevent understanding.

## Recommended next changes

Keep the existing architecture and target two specific places:

1. **Preserve complete source facts in every path.** Apply the existing shared extraction rules to website recovery. Align accepted summaries with the snapshot boundary so a required restriction cannot be silently cut off. Validate a complete, suitably sized fact before approval rather than relying on truncation. Any change to snapshot storage rules must stay consistent with database snapshot reconstruction.
2. **Check final meaning before accepting a card.** Compare the final wording with its assigned fact and applicable restrictions in the approved snapshot. Check whether the intended reader can understand technical terms. Return specific missing details to the existing targeted repair loop and check the repaired text again. A check of meaning is needed because the current prompt already asks for these behaviors and the live run still missed them. Test this narrowly against the observed failures; adding a reviewer is not itself proof that all errors are eliminated.

These address the already agreed goals of clarity and preserving conditions. No new normalization screen, duplicate-fact storage, or anti-repetition project is required by these results. Existing saved contexts and plans keep their prior wording; changes apply when their relevant generation runs. Production readiness still requires checking the deployed flow on the real domain.

## Verification details and artifacts

Worker build passed. The 161-test core Wall suite passed when run serially; 11 behavior tests, 2 condition-handoff tests, and 15 planner tests passed: 189 tests total. An initial parallel core-suite attempt had a native child-process crash (`3221226356`) in a render test with no stderr. Its 47-test file passed in isolation, and the complete core suite then passed serially. The precise native crash cause was not established. This does not change the text-quality findings.

Local evidence is saved under `.tmp/wall-clarity-audit-2026-09-29/`:

- `audit.mjs`: reusable audit harness, restricted to model API requests.
- `broad.json`: original inputs, extracted context, 80 ideas, 40 cards, layouts, request outputs, and usage.
- `scale.json`: the full 200-item plan, 20 sampled final cards, and all internal repair responses.
- `probes.json`: four separate-condition probes, the deliberately incorrect grounding probe, and summary truncation probe.
- `recovery.json`: website recovery source, recovered summary, five ideas, and final card.

The `.tmp` artifacts are local and may be ignored by Git. No production database reads or writes were made. Website inputs were supplied page text, not live crawls. Browser authentication, feed publication, deployment version, and real-user comprehension were outside this local content audit.
