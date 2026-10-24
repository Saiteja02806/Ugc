# Reference prompt and source-length audit

**Superseded rounding detail:** the subsequent user clarification now requires
nearest-second auto-selection (3.3 → 3; 3.5 → 4), with the existing three-second
minimum. UI selection, submission and new server credit reservations use this
rule. Duration displays the selected whole second, with actual reference length
and source-timing behavior in the hint. The historical ceil examples below
describe the previous implementation. No source trimming/stretching or rewrite
of existing admitted jobs was added. See the latest Explore context entry.

16 October 2026. Follow-up implemented locally; not deployed by this task.

The user reported oversized Remove prompt text and an ambiguous 3.7-second
Duration field in Hook Create. The same duration ambiguity applies to Wall's
shared Omni composer. The investigation found that the request wiring already
joins the two visible prompt fields correctly and distinguishes Omni edit mode
from fresh generation. No provider timing or billing policy was changed.

## Prompt path

`VideoGenerationStudioPanel` calls `combineReferenceVideoPrompt(referencePrompt,
prompt)`, normalizes the joined string, and stores/sends that exact request through
`submitPendingGeneration`. The server queues it as direct `hookIdea`; Wall appends
its existing clean-background/no-overlay instruction. The worker passes the
direct prompt to the provider. Omni adds source/reference role declarations and
its preservation instruction around the supplied prompt without discarding the
reference paragraph or user instructions.

Editing the reference paragraph changes the payload. Remove prompt sends only
the user's instructions and keeps the source video attached. Switching references
changes the suggestion and retains the separate user input. Pending-request
recovery uses the already combined stored request rather than appending the
suggestion twice. Prepared reference performance paragraphs currently belong to
the Hook catalogue; these tests do not invent or roll them out to Wall references.

## Duration path

| Mode | Display / submission |
| --- | --- |
| Omni with a source video | Reference length, e.g. 3.7 sec or 6.7 sec; uses source timing |
| Fresh prompt/image generation | User-selected supported whole-second output length |
| WAN with a source reference | Source guides generation; user-selected supported output length stays independent |

For gallery edits the server independently resolves the trusted reference length.
For uploaded edits it validates the owned source. The admission duration rounds
up to whole seconds with a three-second minimum for the existing credit policy:
3.7 seconds means four billed seconds; 6.7 means seven. The original fractional
length remains in `referenceVideoDurationSeconds`.

The Omni adapter sends actual video bytes, any selected appearance images, the
combined prompt and `generation_config.video_config.task = edit`. It deliberately
omits `response_format.duration` and `aspect_ratio` in edit mode. It does not ask
the provider to invent a fresh 3.7-second or 6.7-second video. After generation,
the worker measures the MP4 duration, requires it within 0.25 seconds of the source
and persists the measured duration. A rounded four/seven-second replacement that
differs by 0.3 seconds fails before storage. No silent stretching or automatic
trimming was introduced. Current app Omni source edits are limited to ten seconds.

[Google's official Omni guide](https://ai.google.dev/gemini-api/docs/omni#edit_your_own_videos)
documents uploaded-video editing and distinguishes a primary source from a video
used only as reference. Our source-timing request and tolerance are verified from
our adapter and tests; documentation alone is not proof of frame-exact output.
[Runway's official input guide](https://docs.dev.runwayml.com/assets/inputs/)
documents WAN reference inputs and independent generated duration. Models should
retain their own supported settings. If exact timing is later needed for fresh
generation, generating a supported longer clip and explicitly trimming it is a
separate product behavior; this task did not silently enable it.

## Changes and evidence

- Changed the misleading Duration label to **Reference length**, with the compact
  **Uses source timing** hint. The billing explanation is available on the field.
- Reduced Remove/Restore prompt to **12px** and reference text to **13px**. The
  desktop action remains 32px tall and coarse-pointer targets remain 44px.
- **101 application tests passed**, covering actual rendered-component callbacks,
  exact submitted prompt, removal/editing, fractional Hook/Wall requests, WAN,
  API admission and atomic batches.
- **12 Omni provider tests passed**, including actual decimal-source MP4 bytes,
  both prompt paragraphs and absence of a forced rounded duration.
- **14 worker/header checks passed**, including measured fractional results and
  rejection of a rounded mismatch before upload. Provider/network boundaries are
  mocked. No paid generation was submitted.
- Worker build, application TypeScript and targeted ESLint passed. Logs are
  `outputs/explore-reference-prompt-duration-tests.log`,
  `outputs/explore-reference-duration-provider-tests.log`,
  `outputs/explore-reference-duration-worker-tests.log`,
  `outputs/explore-reference-duration-worker-build.log`,
  `outputs/explore-reference-duration-typecheck.log` and
  `outputs/explore-reference-duration-lint.log`.
- A 1280×720 isolated style fixture renders the current prompt and duration JSX
  fragments with the application stylesheet. Browser computed sizes confirm
  12px actions, 13px text, 32px desktop targets and no overflow in 344px cards.
  Screenshot: `.tmp/reference-prompt-font-review/hook-wall-reference-length-1280.png`.
  It illustrates shared styling; it is not the entire page, authenticated product
  acceptance, or evidence of a real Wall catalogue performance prompt.
- Real authenticated production prompt submission and generated-output quality
  remain unverified. These follow-up source changes require deployment.
