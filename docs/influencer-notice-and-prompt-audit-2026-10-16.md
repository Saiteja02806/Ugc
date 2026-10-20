# Influencer notice and prompt audit — October 16, 2026

## Notice fix

The workspace removal notice previously stayed in React state until another
action cleared it or the screen unmounted. It had no timer or close control.
It now has an accessible × button and dismisses automatically after three
seconds. Repeating the same action creates a fresh notice and restarts the
timer; cleanup cancels the previous timer on replacement, dismissal or unmount.
Only transient workspace notices use this behavior. Errors, unresolved reference
messages and uncertain-request recovery controls retain their existing behavior.
Removing a result still preserves its saved image, History and selected references.

This UI fix is local and has not been pushed or deployed by this task.

## Prompt trace

The current AI influencer flow does **not** add an application master prompt,
system instruction, business profile, character specification, aesthetic preset,
identity-preservation paragraph or prompt-enhancement/planning call.

1. `components/characters/character-workspace.tsx` submits `mode: custom`, the
   selected model/count, owned reference IDs and the user's trimmed prompt.
2. `lib/characters/schema.ts` accepts only the custom mode and a strict request
   shape. Assisted mode and arbitrary planner/business fields are rejected.
3. `lib/characters/generation-service.ts` stores the same text in each job with
   `characterVersion: 2`, `promptSource: user` and null business-profile IDs.
   Saved influencer metadata is not appended to the prompt.
4. `worker/src/jobs/generate-image.ts` trims surrounding whitespace and forwards
   that text. Its slideshow-specific wrappers are conditional on slideshow job
   fields, which the influencer endpoint does not create.
5. `worker/src/lib/openai-image.ts`, `gemini-image.ts` and `seedream-image.ts`
   pass the text directly to the selected image API, alongside selected images.

Historical version-1 records can contain prebuilt planner text. Their existence
does not mean new version-2 requests invoke that planner. Recovery can still
execute an old admitted job using its original stored input.

## Live backend check

A read-only Cloud Run check found 100% ordinary service traffic on
`ugc-ai-generation-worker-r-cdf8c936`, commit
`cdf8c9361d59b74c4a97c00592de6ad3f29370e5`, with image digest
`sha256:9b98fe7679f0b4ea1c8448b87d55994a79a2eb23a0303afa0cb86337467147d4`.
The relevant committed prompt/provider files have no changes between that release
and HEAD. Concurrent local slideshow-wrapper edits were inspected separately;
they do not change the influencer path and were not edited by this task.

| UI model | Current provider/model selection |
| --- | --- |
| ChatGPT Image | OpenAI; live `OPENAI_IMAGE_MODEL=gpt-image-2` |
| ChatGPT Image 2.5 Sunburst | OpenAI; explicit `gpt-image-2.5-sunburst` |
| Gemini 3 Pro | Google; explicit `gemini-3-pro-image` |
| Nano Banana 2.1 | Google; live `GEMINI_IMAGE_MODEL=gemini-3.1-flash-image` |
| Seedream 5.0 Pro | Runway; explicit `seedream5_pro` |

## What can affect results without changing the prompt

- Selected or uploaded reference images are additional visual input. Workspace
  card removal does not clear an explicitly selected reference; remove its
  composer thumbnail or use Clear references to change that input.
- Each model has different request settings: Nano Banana requests 1K output,
  Gemini 3 Pro requests 2K, Seedream uses a 768:1376 portrait ratio, and the
  influencer OpenAI path requests 1024×1536. No explicit quality setting or fixed
  random seed is supplied in these adapters.
- The worker normalizes influencer output to **720×1280** using Sharp's
  `fit: cover`, `position: attention`. In particular, the OpenAI 2:3 source is
  cropped to 9:16, which can remove content near the sides and change framing.
  It does not rewrite prompt text. No output-size/cropping change was made here.
- Provider-internal behavior is not exposed by the application's source. This
  audit establishes what our application sends; it cannot rule out internal
  provider processing or attribute a particular quality difference without the
  corresponding source result, delivered image, model and reference selection.

## Verification and limits

- 41 character generation/identity tests passed, including unchanged prompts,
  rejection of planner additions, ownership, reference order and retry behavior.
- Five existing worker/provider-boundary tests passed with stubbed providers,
  covering all influencer models, long prompts and ordered references. They
  execute the existing compiled worker; source inspection separately checked
  the deployed commit and current source paths. No worker rebuild was required.
- Full application TypeScript and scoped ESLint passed.
- The real-component browser fixture passed desktop/mobile generation,
  uploads/paste/drop, History, saved references, downloads and recovery checks.
  It additionally verifies immediate × dismissal, exactly three seconds of
  controlled-clock lifetime, and restarting that lifetime for a repeated notice.
  The mobile screenshot was visually inspected at
  `.tmp/character-reference-browser/dismissible-notice-mobile.png`.
- The first browser attempt could not launch Edge inside the sandbox. The
  successful run used the approved external browser launch. Controlled-clock
  fixture timing was adjusted to let dialog exit animations finish.
- No customer generation, paid provider call, production data mutation or
  deployment was performed. Signed-in production acceptance of the notice is
  pending deployment; fixture success is not production acceptance.
