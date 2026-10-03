# AI Studio model routing

Image options are **GPT Image** (`gpt_image`, existing OpenAI route) and
**Gemini 3 Pro** (`gemini_3_pro`, Google `gemini-3-pro-image`). Gemini 3 Pro
uses Gemini 3 Pro Image, rather than the previous Gemini 3.1 Flash Image
model labelled Nano Banana 2.

Google image requests use 2K resolution, one output per durable job, the selected
ratio and prompt, and optional uploaded HTTPS image data. The existing
`GEMINI_API_KEY` is shared with Omni Flash 1.1; the Gemini 3 Pro model is selected
explicitly, independently of the legacy `GEMINI_IMAGE_MODEL` setting. Existing
output processing retains exact app dimensions and app image credit policy.
Interaction IDs are saved immediately after acceptance. Recovery retrieves the
saved interaction or staged source without another paid submission. Terminal
failures do not permit automatic paid retries. SDK automatic submission retries
are disabled. Existing Nano Banana jobs keep their original Gemini recovery
path, while new requests for that removed option return a refresh message
before reserving app credits.

AI Studio's image composer, API, and worker do not impose an app character cap
on image prompts. The full trimmed instruction is sent to the selected provider;
blank prompts remain invalid. The shared chat composer does not display a
character counter. Video provider constraints remain enforced with plain
validation messages, and each provider's own input limits still apply.

Video options are **Kling 3.0** (Runway), **Omni Flash 1.1** (Gemini), and
**Seedance 2.5** (OpenRouter). Seedance is gated by
`NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE=true` and remains unavailable until the
worker, database migration, and inference-key configuration pass release verification.
Explore's Recreate selector carries the same model into AI Studio.
New Seedance jobs freeze `provider: "openrouter"`; accepted legacy Runway or
Higgsfield jobs retain their original recovery adapter. See
[the OpenRouter integration and release checklist](ai-studio-openrouter-seedance.md).

## Seedance investigation, 2026-10-02

All four saved Runway Seedance failures examined had accepted task IDs and
returned `INPUT_PREPROCESSING.SAFETY.THIRD_PARTY`, with the model provider's
content moderation message. Duration, quality, reference counts, and request
fields were valid. This is upstream moderation, rather than a malformed request
or authentication error. Every examined request included reference images.
Realistic human references are a plausible trigger, consistent with Runway's
Seedance guidance, but the API does not identify the exact offending input.
Earlier Higgsfield insufficient-credit failures are a separate issue.

Do not alter moderation settings or automatically retry rejected content.
The user subsequently requested restoring Seedance through OpenRouter. This
does not establish that reference-image moderation has changed. The user
explicitly declined paid generation tests on 2026-10-03; live output and
moderation behavior remain unverified by this release.

## Validation and release order

The direct Google implementation passed 19 image-provider, output-processing,
and worker recovery tests, worker compilation, and lint checks. The prior
application API and UI checks remain valid: Gemini 3 Pro uses the same public
model identifier and layout. Local browser checks confirmed that identifier
reaches the API and that prompt, preview, and composer fit 1366 x 650 and
1440 x 900 viewports.

A live request with the existing production worker's Google Secret Manager key
succeeded on `gemini-3-pro-image`: source 1536 x 2752, processed output 720 x
1280 PNG. The local checkout's `GEMINI_API_KEY` differs from that production
key and returned HTTP 429 with a zero-request Free Tier allowance for this
model. Preserve the current production secret reference during deployment;
do not replace it with the local checkout's key.

Deploy the generation worker before enabling the new option in the web app.
The previous worker treats unknown image models as GPT Image, so deploying
the web app first could route Gemini 3 Pro requests to the wrong provider.
Verify the immutable worker image and ready revision before publishing the web
commit. Preserve all existing provider secret references and non-release
configuration, then verify the production domain points to that web commit.

Official references:

- [Google Gemini 3 Pro Image](https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image)
- [Google image generation](https://ai.google.dev/gemini-api/docs/image-generation)
- [Runway moderation](https://docs.dev.runwayml.com/api-details/moderation/)
- [Runway task failures](https://docs.dev.runwayml.com/errors/task-failures/)
- [Seedance reference-input restrictions](https://help.runwayml.com/hc/en-us/articles/50488490233363-Creating-with-Seedance-2-0)
