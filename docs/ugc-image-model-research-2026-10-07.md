# Image models for human UGC: research brief

Research date: 7 October 2026. Scope: Explore Image Generation, realistic adult creators, creator references, and products held in real-looking everyday scenes. The initial research involved no model integrations, production changes, or paid generations.

**Implementation follow-up, 7 October 2026**

The user selected Nano Banana 2.1. Local source now uses `gemini-nano-banana-2.1` for the Nano Banana worker default and selects Nano Banana in Explore by default, including omitted/invalid model fallback. Explore and Character labels read “Nano Banana 2.1.” The persisted `nano_banana_2` key remains compatible with stored jobs/schema; provider-operation metadata continues recording the actual API model. Worker environment examples, Terraform defaults/example values, and the ignored local Terraform model override were updated. Explicit alternative environment overrides remain supported. Gemini Pro stays independently pinned.

Validation: worker TypeScript build, 14 worker image tests, four focused settings/selector tests, and targeted UI lint passed. An offline smoke check confirmed actual adapter model selection, inline reference preservation, aspect ratio, and image decoding. The broader composer suite passed 25/26; its existing compact textarea height expectation fails against separate current layout work (expected 88, current 64), outside this change. No paid generation completed. Deployment and production acceptance remain pending. The checkout findings below preserve the pre-upgrade research baseline.

**Recommendation**

The user clarified that this screen needs hyper-realistic humans. Select candidates primarily for believable faces, skin, eyes/teeth, hands, and casual phone-camera appearance. Provider reuse, resolution, text rendering, and composition controls are secondary.

The user's final screen shortlist is **Nano Banana 2.1 and Seedream 5.0 Pro only**. Both are now connected in local source, and Nano Banana 2.1 remains the default. FLUX 3 Image is excluded from the selection and planned comparison. The GPT Image variants, MAI-Image-2.6, and Soul 2 remain research background, outside the selected rollout scope.

These are research priorities, not measured acceptance rates in our app.

**Two-model integration follow-up, 7 October 2026**

Explore/shared Image Generation now offers exactly `nano_banana_2` (Nano Banana 2.1) and `seedream_5_pro` (Seedream 5.0 Pro). The existing generation API preserves the chosen model in every queued image job. Seedream uses Runway's documented `seedream5_pro` model at `POST /v1/text_to_image`, with one PNG output per job, optional uploaded image reference, and the existing 1/2/4 quantity choices. Its 1K provider ratios are mapped to the four supported UI ratios, then the existing output renderer produces the exact final dimensions. The installed Runway SDK's generic POST preserves authentication and API-version headers while avoiding a dependency upgrade that could affect video generation. [Runway API reference](https://docs.dev.runwayml.com/api/#tag/Start-generating/paths/~1v1~1text_to_image/post).

The worker reuses the existing Runway credential and provider-operation ledger, so no database migration is needed. Accepted task IDs are saved before polling; retries retrieve the same task or staged image. Terminal failures and uncertain submissions cannot create a second paid request. Runway's daily credit guard includes Seedream's five-credit 1K images alongside existing video usage. Historic GPT/Gemini jobs and Character model choices remain supported by the worker.

Validation is reproducible with `npm run test:image-generation`: real API parsing/queue payloads and actual Runway SDK requests are exercised with offline mocks, along with both image providers, output dimensions, credit accounting and recovery behavior. Targeted frontend lint and selector checks passed. The full project typecheck currently reports errors in unrelated Explore workflow files (missing finishing/audio modules and an `invalidDemoAudio` prop mismatch); none reference this integration. No paid generation was run, and this local change has not been deployed. A read-only visit to the production Image Generation page redirected to sign-in, so authenticated production acceptance remains pending.

**Human-realism evidence, 7 October 2026**

Arena's 6 October category rankings are more relevant than its overall leaderboard:

| Model | Portraits rank | Photorealistic & Cinematic rank | Preliminary results |
| --- | --- | --- | --- |
| GPT Image 2.5 Sunburst | 1 | 1 | Yes |
| GPT Image 2.5 Flare | 2 | 2 | Yes |
| GPT Image 2, medium | 3 | 3 | No |
| MAI-Image-2.6 | 4 | 5 | No |
| Nano Banana 2.1 | 6 | 4 | Yes |
| Seedream 5.0 Pro | 10 | 10 | No |

Sources: [Arena Portraits](https://arena.ai/leaderboard/text-to-image/portraits), [Arena Photorealistic & Cinematic](https://arena.ai/leaderboard/text-to-image/photorealistic). Neither category lists FLUX 3 or Soul 2; absence is not evidence of worse quality. Rank confidence ranges overlap, especially for the newer models.

Arena measures human preference in image comparisons, not a dedicated UGC realism pass rate. Portraits can include stylized work; cinematic imagery can look unlike casual phone footage. These rankings support candidate selection but cannot establish hands, identity across scenes, or product-contact reliability. [Arena image evaluation](https://help.arena.ai/articles/1626988163-arena-how-to-use-image-generation).

I visually inspected OpenAI's published Flare and Sunburst outputs for the same candid elderly-sailor prompt. Both show photographic facial lines, weathered skin, hair, cloth, and daylight. They are selected vendor examples; they do not establish failure rates, and partially obscured fingers limit anatomy assessment. [Prompt and model examples](https://developers.openai.com/api/docs/guides/image-prompting).

For Seedream, the provider specifically claims improved facial lines, rough skin details, soft matte facial lighting, and coherent body/clothing/environment lighting. Its street-window example was inspected, but that is not sufficient to judge an unobstructed human face. These claims plus category preference results justify a controlled portrait comparison. [Seedream portrait claims](https://seed.bytedance.com/en/blog/beyond-generation-it-understands-design-introducing-seedream-5-0-pro).

FLUX 3's official gallery includes studio and fashion portraits. This establishes relevant examples, not comparative superiority for ordinary people in household lighting. [FLUX 3 gallery](https://bfl.ai/models/flux-3-image).

Further evidence: Astria's October 4 test used the same person, dress, bag, scene brief, and requested 2K tier across four models, with one output each. Its reviewers preferred FLUX 3 for photographic naturalness. The comparison used Nano Banana 2, not 2.1, and cannot establish general superiority. [Firsthand test](https://astriaai.github.io/articles/flux-3-image-review/).

I inspected the published FLUX output: flash lighting, hair, fabric, and the cluttered bar give it a plausible photographic appearance. Fine skin detail and recurring hand/identity reliability cannot be established from this single image. [Inspected FLUX sample](https://astriaai.github.io/articles/img/model-benchmarks/2026-10/flux-3-sloane-dress.webp).

Research assessment: FLUX 3 has promising human-image evidence, but it has not passed our casual phone-camera UGC cases, and the absence of a large comparative portrait evaluation prevents a reliability claim. The user excluded it from the final shortlist. Fuser's firsthand comparison supplies additional editing evidence, but its product/text tasks do not establish human realism. [Fuser test scope](https://fuser.studio/articles/flux-3-vs-flux-2).

MAI-Image-2.6 has documented text-to-image and reference editing APIs through Microsoft Foundry. It deserves screening on quality evidence, despite needing another provider integration. Foundry labels the model preview, so deployment availability and service terms need checking before a production choice. [MAI model](https://microsoft.ai/models/mai-image-2-6/), [Foundry API and availability](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/use-foundry-models-mai-image).

**Verified checkout behavior**

The inspected checkout was at HEAD `d7414877ccdca40d5b77510f6563eba6e6c5a1d5`, with existing uncommitted project work. Findings describe saved source, not verified production environment overrides.

| Surface | Verified behavior | Source |
| --- | --- | --- |
| Explore/shared image panel | Offers `nano_banana_2` and `gpt_image`; initial selection and parser fallback are `gpt_image`. One reference image, quantities 1/2/4, ratios 4:5/1:1/9:16/16:9. | [Settings](<C:/Users/chund/OneDrive/Desktop/UGC/lib/ai-studio/generation-settings.ts:10>), [panel](<C:/Users/chund/OneDrive/Desktop/UGC/components/workspace/ugc-chat-workspace.tsx:228>) |
| GPT Image | Default API model `gpt-image-2`, overridable with `OPENAI_IMAGE_MODEL`; direct Images generate/edit API; quality omitted. | [OpenAI adapter](<C:/Users/chund/OneDrive/Desktop/UGC/worker/src/lib/openai-image.ts:6>) |
| Nano Banana 2 | Default `gemini-3.1-flash-image`, overridable with `GEMINI_IMAGE_MODEL`; Interactions API, default 1K, requested aspect ratio. | [Gemini adapter](<C:/Users/chund/OneDrive/Desktop/UGC/worker/src/lib/gemini-image.ts:7>) |
| Gemini 3 Pro Image | `gemini-3-pro-image` already supported by the worker and Character workflow, with 2K requests. It is absent from Explore's two-model enum. | [Worker](<C:/Users/chund/OneDrive/Desktop/UGC/worker/src/jobs/generate-image.ts:33>), [Character panel](<C:/Users/chund/OneDrive/Desktop/UGC/components/characters/character-workspace.tsx:16>) |
| Delivered image | OpenAI maps portrait ratios to 1024×1536 and landscape to 1536×1024; common processing uses an attention-based cover crop. Final 9:16 is 720×1280. | [Provider size](<C:/Users/chund/OneDrive/Desktop/UGC/worker/src/lib/openai-image.ts:75>), [output processing](<C:/Users/chund/OneDrive/Desktop/UGC/worker/src/lib/image-output.ts:30>) |

Two issues should be resolved when implementation is authorized. The OpenAI edit request sends `input_fidelity: "high"`, while current GPT Image 2 documentation says to omit that parameter because high fidelity is automatic. This is a documented request mismatch; no live failure was reproduced. Also, explicit quality and native aspect ratios are necessary for a fair comparison: cropping can remove fingers or packaging. [OpenAI generation guide](https://developers.openai.com/api/docs/guides/image-generation).

**Candidates and evidence**

Reference limits below describe provider capabilities. Explore currently supplies only one image. More references do not guarantee identity or product fidelity.

| Candidate and API identity | Why test it for UGC; limits of evidence | References and integration effort |
| --- | --- | --- |
| **Nano Banana 2.1** — Google `gemini-nano-banana-2.1` | Google claims improved realism, instruction adherence, text, and consistency across edits. Flash-level speed is vendor positioning, not measured UGC latency. | Up to 14 inputs, with documented roles for up to four characters and ten objects. Low relative effort: reuse Google credentials, but verify the current Interactions request/response contract rather than assuming an environment-variable swap suffices. [Model](https://ai.google.dev/gemini-api/docs/models/gemini-nano-banana-2.1). |
| **GPT Image 2.5 Flare / Sunburst** — OpenAI `gpt-image-2.5-flare` / `gpt-image-2.5-sunburst` | Flare is positioned for fast everyday generation; Sunburst for greater editing precision. Published prompting examples cover person-preserving wardrobe/location edits and product labels. They demonstrate selected cases, not failure rates or superiority for phone photos. | Direct generate/edit APIs; up to 16 image inputs in the edit reference. Low relative effort for basic generation; multi-reference UI and explicit quality need work. Pin dated snapshots, including `-2026-09-08`. [Flare](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare), [Sunburst](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst), [edit reference](https://developers.openai.com/api/reference/resources/images/methods/edit), [published examples](https://developers.openai.com/api/docs/guides/image-prompting). |
| **FLUX 3 Image** — BFL `flux-3-image` | New family candidate for reference-guided scenes and composition. Do not transfer FLUX.2 gallery evidence to this model. Natural skin, hands holding products, and creator consistency remain unmeasured here. | Up to ten references; native requested ratios; grounding and bounding-box controls. Medium/high effort: new adapter, credentials, durable submission/polling, signed-result download, provider schema changes. Also available through fal and Replicate, with different schemas. [BFL API](https://docs.bfl.ai/flux_3/flux3_image_overview), [fal](https://fal.ai/models/blackforestlabs/flux-3/text-to-image/api), [Replicate](https://replicate.com/black-forest-labs/flux-3-image). |
| **Seedream 5.0 Pro** — BytePlus `dola-seedream-5-0-pro-260628` | ByteDance describes photographic lighting, skin texture, material rendering, and precise edits. The published page was readable, but its human samples did not render during browser inspection; no visual ranking is claimed. | Native API supports up to ten references and precise regions. BytePlus direct, fal, and Runway are documented options; verify feature parity per route. Medium effort through existing Runway SDK/provider infrastructure, higher for a new direct provider. [Provider announcement](https://seed.bytedance.com/en/blog/beyond-generation-it-understands-design-introducing-seedream-5-0-pro), [native API](https://docs.byteplus.com/zh-CN/docs/modelark/image-generation-api?redirect=1), [fal edit API](https://fal.ai/models/bytedance/seedream/v5/pro/edit/api). |
| **Soul 2** — Higgsfield `higgsfield-ai/soul/v2/standard` and `.../image-to-image` | Portrait/fashion specialization makes it a useful test candidate. Editorial positioning may work against candid phone-camera appearance; product and anatomy performance are unmeasured. | One general image reference; optional trained Soul ID. 720p/1080p, including 9:16 but no native 4:5. Existing Higgsfield SDK/credential pattern reduces basic adapter effort; persistent identity training adds substantial lifecycle work. [Text API](https://open.higgsfield.ai/models/higgsfield-ai/soul/v2/standard/api-reference), [reference/Soul ID API](https://open.higgsfield.ai/models/higgsfield-ai/soul/v2/image-to-image/api-reference). |
| **Second-round controls: Gemini 3 Pro Image; FLUX.2 Pro** | Pro checks whether the existing premium Google path helps identity/product tasks. In BFL's FLUX.2 gallery, inspected portraits visibly showed freckles, flyaway hair, and detailed facial texture; these were editorial examples, not a hands/product benchmark, and the sample variant was not established. | Google Pro supports up to 14 references with character/object/style roles. BFL Pro supports eight API references; prefer pinned `flux-2-pro` over evolving preview for repeatability. [Google guide](https://ai.google.dev/gemini-api/docs/image-generation), [FLUX.2 overview/gallery](https://docs.bfl.ai/flux_2/flux2_overview), [editing API](https://docs.bfl.ai/flux_2/flux2_image_editing). |

No inspected source establishes comparative anatomy reliability, repeated creator identity, or a production p95 latency for these UGC cases. Vendor terms such as “realistic,” “fast,” and “precise” should remain hypotheses until tested.

**Published cost signals**

USD, standard processing, checked 7 October 2026. These are provider prices, not UGC Pilot user credits. Resolution buckets are not identical pixel counts. Input/reference/thinking charges, retries, storage, and processing can change total cost.

| Model / route | Published price signal |
| --- | --- |
| Google Nano Banana 2.1 | Image output: $0.0336 at 1K, $0.0504 at 2K, $0.113 at 4K; input and thinking extra. |
| Existing Google Nano Banana 2 | Image output: $0.067 at 1K, $0.101 at 2K, $0.151 at 4K; input and thinking extra. |
| Google Gemini 3 Pro Image | Image output: $0.134 at 1K/2K, $0.24 at 4K; input and thinking extra. [Google pricing](https://ai.google.dev/gemini-api/docs/pricing). |
| OpenAI Flare/Sunburst direct | $5/M text-input tokens, $8/M image-input tokens, $30/M image-output tokens. Equal token rates do not imply equal cost per output. Use each model's usage/estimator; the GPT Image 2 calculator cannot estimate 2.5 consumption. [Flare pricing](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare). |
| BFL FLUX 3 Image | 1K list $0.048; current launch rate $0.024. Use list price for sustainable economics; the published promotion ends 8 October 2026 at 15:00 UTC. [BFL pricing](https://bfl.ai/pricing). |
| Seedream 5.0 Pro via Runway | Five credits/1K output ($0.05); nine/2K ($0.09), at $0.01 per credit. Route-specific capabilities/defaults require checking. [Runway pricing](https://docs.dev.runwayml.com/guides/pricing/). |
| Seedream 5.0 Pro via fal | Explicitly tentative: $0.0675 for output area ≤1536²; $0.135 up to 2048². First reference free; each additional reference $0.0045. [fal pricing](https://fal.ai/models/bytedance/seedream/v5/pro/edit). |
| Soul 2 / Soul ID | Displayed $0.0032/720p, $0.0057/1080p; Soul ID $2.50/request. Recheck actual billing before funding a run; amortize identity training separately. [Higgsfield model pricing](https://open.higgsfield.ai/models/higgsfield-ai/soul/v2/image-to-image/playground). |

BytePlus's indexed native pricing indicated $0.045 for smaller Pro outputs and $0.09 for larger ones, with extra-reference fees. Its pricing page returned an internal server error during direct browser verification, so these figures are provisional and excluded from the primary budget comparison. [BytePlus pricing](https://docs.byteplus.com/en/docs/modelark/model-pricing?redirect=1).

The app currently uses a shared image-credit policy, rather than verified model-specific provider cost accounting. A future rollout needs explicit model/version/quality/size logging and an intentional credit policy. Existing submission fencing should be retained to prevent duplicate paid work after an uncertain response. New BFL/BytePlus/fal provider identities would also require updates to the provider type/database constraints; Higgsfield and Runway already exist as provider identities. [Credit policy](<C:/Users/chund/OneDrive/Desktop/UGC/lib/billing/generation-credit-policy.ts:1>), [submission reservation](<C:/Users/chund/OneDrive/Desktop/UGC/worker/src/jobs/generate-image.ts:99>), [provider types](<C:/Users/chund/OneDrive/Desktop/UGC/worker/src/types.ts:328>).

Midjourney is not an initial integration candidate: its official policy says it has no generally available API and prohibits unauthorized automation. An unofficial wrapper is unsuitable for this app. [Midjourney policy](https://docs.midjourney.com/hc/en-us/articles/32013696484109-Community-Guidelines).

**Human-first benchmark proposal — pending spend authorization**

Human pilot: two arms × the first four cases below × three independent outputs = **24 images**. Arms: Nano Banana 2.1 and Seedream 5.0 Pro, subject to route availability and an approved budget. No other model arms are planned. This tests controlled model settings rather than establishing a winner from selected gallery examples.

Prepare an identical reference pack for all models: three consenting adult creators with different skin tones/ages, plus owned product photos of a labeled bottle and a coffee pouch. For the three repetitions of cases 3/4, pair the same creator/reference across both scenes; use a different creator for each pair. Preserve source files and hashes. These files have not been selected or uploaded.

Use these original prompts, with the same wording across arms:

1. **No reference, daylight:** “A 30-year-old South Asian woman in a plain gray T-shirt talking to her phone camera in an ordinary bathroom. Chest-up, one hand naturally resting on the counter, fingers visible. Slightly uneven window light, believable pores and small skin imperfections, flyaway hair, everyday room clutter. Casual smartphone video still, vertical 9:16, ordinary sharpness, no beauty filter or studio lighting.”
2. **No reference, low light:** “A 55-year-old Black man seated on his living-room couch at night, smiling mid-sentence to his phone camera. Warm household lighting, natural forehead and smile lines, believable teeth, slight phone-camera grain, plain casual shirt, ordinary background. Chest-up vertical 9:16 smartphone video still, no retouching or cinematic lighting.”
3. **Creator reference, indoor:** “Use the referenced adult as the creator. Preserve their face, age, skin tone, hairstyle, and distinctive features. They are talking to a phone camera at a home-office desk beside a window, wearing a plain navy T-shirt, one hand gesturing with fingers visible. Natural skin texture and everyday lighting. Vertical 9:16 casual smartphone video still.”
4. **Same creator, outdoor:** “Use the referenced adult as the same creator. Preserve their face, age, skin tone, hairstyle, and distinctive features. Outside a neighborhood cafe, three-quarter view, laughing naturally with teeth visible, one hand adjusting sunglasses. Overcast daylight, ordinary phone-camera detail, natural skin texture. Vertical 9:16 casual smartphone video still.”
5. **Bottle reference:** “An adult creator in an ordinary kitchen holds the referenced bottle beside their face with a natural, clearly visible grip. Preserve the bottle's exact shape, cap, colors, logo, and label lettering. The label faces the camera and is readable. Chest-up, window light, realistic hands and skin texture, vertical 9:16 casual smartphone video still, no studio setup.”
6. **Pouch reference:** “An adult creator at a breakfast table begins opening the referenced coffee pouch with both hands. Preserve the pouch's shape, colors, logo, and label lettering; keep the front label visible and readable. Show believable fingers, joints, and contact with the packaging. Ordinary morning light, natural skin, vertical 9:16 casual smartphone video still.”

Controls: request native 9:16 near one megapixel; use 720×1280 where supported, otherwise the nearest documented native bucket. Record actual pixels. OpenAI quality must be explicit (`medium` for the pilot); other model settings must be recorded, including thinking. Disable optional search/grounding and prompt enhancement where supported, and record unavoidable transformations. One output per paid request, fixed prompts, no cherry-picking or silent retries. Seed values are repeatability metadata, not matching random states across models.

Keep every raw output and a 720×1280 delivery preview using the app's processing. Inspect skin/eyes/teeth/fingers at full resolution and authenticity at phone viewing size. Blind model names and randomize order. Have three raters score 1–5 for phone-photo authenticity (35%), skin and facial detail (25%), anatomy (20%), identity (15%), and instruction adherence (5%). Renormalize when identity is inapplicable; report dimensions separately as well as the composite. Wrong identity and unusable anatomy are critical failures regardless of beauty score.

Report acceptance rate, failure types, and **total provider spend divided by accepted outputs**, including all rejected paid samples. Measure submission-to-result and submission-to-delivered-asset time separately; include errors/timeouts. The human pilot has only 12 outputs per arm, so tail latency and close quality differences remain exploratory. Expand finalists before changing a default on quality grounds.

Second round: run product cases 5/6 on the selected models, then test the same person plus product references together and a background edit that must preserve face/hands/label. Add product fidelity to the scoring and treat changed packaging/text as a critical failure. Keep evaluation within the two-model selection.

Before any paid round, calculate an explicit budget ceiling from the selected route, quality, dimensions, references, and allowed retry count; obtain authorization for both spend and reference uploads. This research authorizes neither. No production acceptance claim is made; an eventual integrated user flow must be verified at `https://www.getugcpilot.com`.
