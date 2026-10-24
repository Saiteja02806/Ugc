# Explore Slideshows flow recheck — 15 October 2026

This is the initial naming-only audit. Its generation-count and history findings
describe the earlier implementation. The later user correction and implementation
are recorded in [the versions/history report](explore-slideshow-versions-and-history-2026-10-15.md),
which supersedes those parts of this report.

## Outcome

The numbered reference labels were corrected locally for all 58 catalogue
slideshows: Fitness, Goal Tracker, Interview App and the other topic names.
The source manifest is unchanged. IDs, slide order, media URLs, reference text
provenance and Hook/Wall labels remain unchanged.

The implementation supports building and editing an owned slideshow. Local
checks passed, but this is **not authenticated production acceptance**. Navigating
to `https://www.getugcpilot.com/explore/slideshows` redirected the checked browser
to `https://getugcpilot.com/sign-in`. No paid generation, scheduling or publication
was submitted. Provider execution, deployed rollout flags and real account
save/reload still need verification in an authenticated production session.

## Section and action preservation

| Entry | Before | After |
| --- | --- | --- |
| References | Numbered topic titles; Recreate and reference preview | Clean topic names; same IDs, actions and media |
| Create | Reference selection, image attachments, prompt, model, ratio and quantity | Unchanged |
| Generated results | Explicit image selection enters Edit slides | Unchanged |
| Edit slides | Preview, text/Remix, appearance, sequence and image actions | Unchanged |
| Save / Schedule | Save the owned sequence, then schedule that result | Unchanged |

This change does not rearrange buttons, resize previews or alter editor behavior.
No new laptop layout or visual-comprehension acceptance is claimed. Fresh
1280×720, 1366×768 and 1536×864 top/scrolled screenshots remain outstanding.

## Flow traced and locally checked

| Boundary | Evidence and practical behavior |
| --- | --- |
| Reference selection | `recreate-catalog.ts` supplies topic names to gallery/picker/dialog callers. Actual catalogue mapping is exercised for every imported non-Hook item. Original manifest hash and media-order checks still pass. |
| Generation request | `ImageGenerationStudioPanel` submits model, ratio, prompt, quantity, layout references, instruction attachments and optional regeneration target. API tests confirm requested job counts and stable replay identities, ownership validation and billing rejection before invalid requests. |
| Result recovery | Shared pending-request, image-history and session tests cover reload, late completion, uncertain acknowledgment and owner isolation. No replacement paid jobs are silently submitted by recovery. |
| Add to editor | Use image resolves ready owned media before calling the slideshow editor. Reference pixels are not automatically copied into the output sequence. |
| Edit | Executed component tests cover reorder/remove, replacement/recreation, previous-image retention, stable text association, immediate overlays and portrait/landscape proportions. SVG is rendered into PNG pixels in a local test. |
| Save | Edited text is rendered/uploaded, then POSTed to `/api/explore/slideshows` with the exact sequence and idempotency key. Tests cover ready owned images, ordering, rejection, interrupted saves, retries, verified reload and preservation of newer edits. Database/service boundaries are stubbed. |
| Schedule entry | Pending upload/save blocks scheduling. Changing a saved slide invalidates the previous output; save again before scheduling. Image-only output avoids video preparation. Schedule input validation covers account selection and zoned date/time. Actual publication was not attempted. |

## Restrictions and open acceptance

- A saved slideshow contains **2–10 images**. Some catalogue references contain
  11 or 12 slides; they are guidance, not a promise to save that full size.
- Quantity requests image outputs/versions using the submitted instructions.
  Choosing several reference slides does not generate a complete ordered story
  automatically. Users add their selected results to the sequence.
- The current composer blocks prompt-only scratch generation with no reference,
  instruction attachment or regeneration image. Uploaded output images can still
  be assembled without a catalogue reference. This is a functional restriction,
  not proof of a complete scratch-creation flow.
- Added text is editable; existing pixel text needs Recreate or Replace image.
- Saving requires authentication/access and `EXPLORE_SLIDESHOW_SAVING_ENABLED`.
  The deployed flag was not verified through the signed-out browser.
- Provider failures, queue execution and real production Library persistence
  cannot be certified from these stubbed tests. The earlier five automated
  Carousel jobs are a separate flow and were not diagnosed by this audit.

## Validation

137 checks passed across these suites, without paid provider calls:

```text
scripts/explore-recreate-catalog-contract.test.mjs
scripts/explore-slideshow-editor.test.mjs
scripts/explore-slideshow-text-tools.test.mjs
scripts/explore-slideshow-actions.test.mjs
scripts/slideshow-draft.test.mjs
scripts/slideshow-image.test.mjs
scripts/slideshow-api.test.mjs
lib/explore/slideshow-preparation.test.ts
lib/ai-studio/image-generation-api.test.mjs
scripts/simple-workflow-schedule.test.mjs
lib/ai-studio/image-presentation-ui.test.mjs
scripts/explore-reference-images.test.mjs
lib/ai-studio/pending-generation.test.mjs
lib/ai-studio/generation-session.test.ts
lib/ai-studio/image-history.test.ts
```

The separate generic workflow-generation-recovery suite also passed 18 checks;
it is not included in the slideshow total above. TypeScript (`--noEmit
--incremental false`), targeted ESLint and patch whitespace checks passed.
