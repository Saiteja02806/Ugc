# Creator account identity prompt audit

The user reports that Recreate retains the source performer's appearance instead
of reproducing the selected influencer. This audit covers both private Hook
accounts and the private TikTok slideshow collection. No production mutation,
new image generation, retry, prompt-default change or deployment was performed.

## Production evidence

The completed Creator Account 1 clip 6 request uses Gemini 3 Pro, prompt v4,
the approved later source frame and two selected owned face images. The saved
prompt hash exactly matches the current compiler. The three saved URLs are
ordered source scene, main face, supporting face; both face assets are ready.
There are no extra user instructions overriding facial guidance. The provider
operation is complete and its output is persisted.

Inspection of the existing source, inputs and output supports the reported
quality concern: the result remains very close to the source's visible face
appearance, while removing the overlay and changing the hand/pencil position.
This is a qualitative image-generation review, not biometric identification or
proof of a particular internal model failure. Source retention versus blending
cannot be established from one result.

An offline replay through the real Pro adapter uses the saved prompt and actual
three input images. It verifies every image byte, adjacent role label, source
hash, prompt hash, image order, model and 2K output setting. Google transport is
replaced with a synthetic response; all network requests are blocked. This
establishes current serialization, not an independently captured historical
provider wire request and not a new quality evaluation. Sensitive receipts and
images remain under ignored `.tmp/creator-prompt-audit-20261024/`.

The two older failed creator requests are a separate, previously repaired v3
model-routing issue. They failed before submission. They do not explain this
completed output's appearance.

## Prompt findings

Both Hook accounts share the normal v4 starting-image compiler. There is no
creator-specific fallback that discards face photos or silently uses v5/v6.
V4 tells the model to photograph the influencer in Image 2, use Image 3 onward
as views of that same person, and take scene/pose guidance from Image 1.
It explicitly prioritizes recognizable likeness over source facial geometry.
However, its source label does not expressly exclude the source face as an
identity input, and “as a guide” / “Compose the scene naturally” permit scene
interpretation. These are candidate wording weaknesses, not demonstrated causes.

The existing v4 release was based on a user-approved sample. Prior v5 trials
already found that stronger scene-preservation language could accompany more
source-like appearance. Merely switching to a stricter experimental prompt is
not a verified correction. Existing accepted requests must keep their frozen
prompts and labels for recovery.

The sensible next quality experiment is a separately versioned identity-focused
candidate: explicitly restrict the source to scene/performance, assign facial
appearance exclusively to the chosen person images, and test against unchanged
v4 with identical inputs. Evaluate likeness, scene, pose, occlusion and text
removal separately across both creators. No such paid experiment is queued by
this audit, and no claim of a repaired likeness result is made.

## TikTok slideshow distinction

All ten private creator sets use the ordinary slideshow generation path.
They do not use the Hook starting-frame prompt. The planner assigns uploads to
individual output slides, including a `person` role, and preserves the applicable
user instructions. The final prompt otherwise emphasizes preserving the base
slide and unrequested details. Selecting a collection alone does not request
identity replacement or import the Hook's main/supporting-face selection.

A regression case verifies that an explicit request to use main/supporting face
uploads on each selected slide preserves both images, their `person` roles,
source-first order and exact replacement instructions. It tests compilation of
an assigned plan, not live planner understanding or generated likeness. No
production slideshow generation for this pilot owner was found in the queried
24 October window; there is no completed slideshow likeness sample to judge.

## Validation

- 54 application tests pass, no skips, including all twelve creator API paths
  across Pro, Flash and Seedream. Added assertions cover main-photo reordering,
  exact selected URLs, main/support roles and the current likeness instruction.
- 135 worker image tests pass, no skips; compilation succeeds. This includes
  all twelve private source PNGs through both real Gemini adapters with mocked
  transport, legacy recovery and rejected source/model mismatches.
- 36 creator/model parity simulations pass with zero network or paid calls.
- Saved production request replay passes with exact prompt and image bytes.

These checks establish input and prompt integrity, not reliable face replacement.
The earlier delivery/parity checks must not be described as likeness acceptance.
