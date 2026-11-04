# Character request contract: causes, limits and repair design

3 November 2026. Follow-up to the exact-output audit. Scope: negative instructions, structured selections, reference capacity. Resolution wording is explicitly deferred by the user. Investigation and non-build boundary checks only; no application implementation, paid generation, provider mutation, build or deployment.

## What is proven

The actual ten-reference job `96da54d9-73ee-4bf6-8f44-7fc7766eb80f` completed. Its 2,848-character prompt exactly reconstructs from the recoverable choices, and its ordered reference files are correct. Missing structured UI metadata does **not** mean its positive choices were all missing from the provider input. The missing data affects completeness, verification, recovery and future correctness; negative instructions really were absent.

The integration boundaries explain the omissions without assuming developer intent:

1. The compiler returns `prompt`, `negativePrompt`, display pills and a reference path. The workspace uses only `compiled.prompt` plus reference-role text for the generation instruction. It never sends `compiled.negativePrompt`.
2. The workspace serializes a generic custom generation request: mode, model, count, prompt, idempotency key and reference asset IDs. It does not serialize the trait selection state.
3. `CharacterGenerateRequestSchema` is strict and has neither a negative-prompt field nor a structured studio-selection field. In a controlled check it rejects either extra field. Adding them only to the frontend would break admission, not complete the fix.
4. The generation service freezes prompt and reference IDs/URLs in the job JSON; it cannot freeze fields it never receives or validates. Its fingerprint likewise includes the old generic request fields, not a structured studio snapshot.
5. The provider adapter builds text and ordered image parts. There is no separate negative-prompt mapping in this path. The omission occurs in our integration, before the API receives anything; no evidence shows OpenRouter filtering out a transmitted negative prompt or UI state.

Git inspection confirms the mismatch exists in committed trait-studio integration as well as current source. The trait compiler was connected to the pre-existing prompt-driven API contract without extending that contract for the additional return fields. This is the concrete structural cause. The historical author's reasoning is not independently recorded and is not guessed.

## Why the model can still generate an image

The model consumes text and images, not a React selection object. Most meaningful choices already became positive text or image references. That is enough for generation, and explains why the uploaded face, bedroom, curls, headphones and headband are present. However, the system currently has no complete immutable record linking each selected UI option to its actual provider representation, and no guarantee that all computed restrictions are included.

An omitted or unexpressed field cannot influence the model. An expressed field can still be followed imperfectly. These require different fixes: complete request contracts for omission, clear authority/role instructions and visual acceptance for imperfect model compliance. Storing a selection object alone improves auditability but does not improve generation unless it governs the compiled request.

## Reference limits: application versus provider

Fresh public GETs returned HTTP 200 for OpenRouter's model and endpoint capability metadata, without an API key or generation call:

- `/api/v1/images/models`: `google/gemini-3-pro-image` advertises `input_references` 0–14.
- `/api/v1/images/models/google/gemini-3-pro-image/endpoints`: both listed Google AI Studio and Google Vertex endpoints advertise 0–14.
- `/api/v1/models/google/gemini-3-pro-image/endpoints`: existing chat-completions endpoint metadata does not advertise a separate `negative_prompt` parameter or a numeric image-count field. Image input is part of its multimodal architecture; a generic `supports_image_reference: false` metadata flag must not be misread as proof it rejects all image parts, given the actual successful job and image-generation capability records.

Google's documentation also describes Gemini 3 Pro Image as accepting up to 14 total inputs and distinguishes that from high-fidelity character/object consistency guidance. Fourteen is a supported input capacity, **not a promise that fourteen portraits will all contribute independent traits perfectly**. [Google reference-image guidance](https://ai.google.dev/gemini-api/docs/image-generation#use-14-images), [OpenRouter model capability discovery](https://openrouter.ai/docs/guides/overview/multimodal/image-generation).

| Layer | Current behavior | Failure location |
| --- | --- | --- |
| UI reference collection | Stops adding at ten total, or nine catalog images when an uploaded face occupies the first slot | **Silently discards later images before a request is made** |
| Preparation API | Accepts 1–10 registered trait IDs | Rejects larger batches with 400; no silent truncation here |
| Character request schema | Maximum ten unique total references, including saved and uploaded sources | Controlled check: ten accepted, eleven rejected |
| Character worker | Explicit maximum ten references | Rejects over-capacity character jobs before submitting |
| Shared worker context parser | Maximum fourteen | Not the effective character limit; character-specific guard is stricter |
| Shared worker download budget | 25 MiB/image and 50 MiB combined | Additional byte constraints, separate from image count |
| Current OpenRouter payload builder | Retains fourteen supplied image parts in a controlled construction check | Does not itself truncate to ten |
| Provider advertised capability | Fourteen for this model | Not live-tested with eleven to fourteen images during this audit |

Your exact job had ten inputs and completed; the API did not reject it. The independent counterexample adds a head-shape photo to your choices: the collector drops the headband image but leaves its text instruction. Backend receives only the already-shortened list and therefore cannot detect the missing selected image from its current request shape.

## Correct repair, in order

### 1. Freeze a versioned studio request and compile it server-side

Add an optional versioned `characterStudio` request to the generic API; require it for the new trait-studio flow while retaining old generic requests and historical retries. Validate all category IDs, framing, accessory uniqueness and uploaded face ownership. A browser blob URL, arbitrary prompt snippet or client-supplied owner is not authoritative.

The server resolves registered canonical snippets and owned uploaded identity metadata, compiles the full instruction, and freezes a receipt in the existing job JSON. This should include:

- Selection IDs for every section, including keep/none/as-shown values.
- Owned uploaded identity asset ID; avoid relying on its transient local upload ID.
- Compiler/contract version, catalog source versions and selected reference roles.
- Positive instructions, restrictions and the exact final provider prompt.
- Unique ordered reference asset IDs plus all roles each image serves.
- Model/provider and the capability limit applied at admission.

The same validated receipt must drive preparation, admission, provider payload and history—not independently rebuilt lists that can diverge. Existing JSON job storage can carry this optional receipt; a new relational schema is not inherently required. Confirm JSON types/RPC serialization and worker compatibility before implementation.

Include the new receipt/semantic content in idempotency fingerprints for new-version requests. Preserve fingerprints and frozen prompts for previously accepted requests byte-for-byte. A changed choice cannot silently reuse an earlier paid request ID. History should display the frozen receipt, not today's registry or defaults.

### 2. Deliver restrictions through the supported model interface

Do not add an assumed Stable-Diffusion-style `negative_prompt` property and hope this Gemini route honors it. Neither inspected OpenRouter Gemini capability record advertises that separate parameter. Google recommends semantic negative instructions expressed within the scene description. [Google prompting guidance](https://ai.google.dev/gemini-api/docs/image-generation#best-practices).

Compile a concise constraints section into the actual text sent to Gemini, using positive framing where possible: complete visible head for Half; complete body and feet for Full; natural matte skin; clean scene with no unwanted studio equipment. Ensure restrictions do not contradict selected accessories, hairstyle or framing. Persist the source restrictions separately for audit, but verify they occur once in the final model text. Apply final length validation after combining instructions and roles, before credits are reserved.

This is necessary transport wiring, not a guarantee of model compliance. Keep/none options also need explicit semantics: an omitted outfit instruction is not the same as preserving the uploaded garment. Do not silently redefine old receipts.

### 3. Replace silent dropping with complete model-aware planning

Collect **all** selected image-based traits first, deduplicate by stable source identity, preserve their associated roles, then calculate required capacity. Never stop collecting when a counter reaches a threshold.

Use one model/provider-aware capability policy across the new studio planner, preparation endpoint, character schema and worker. Gemini 3 Pro's advertised limit supports a planned increase to fourteen, while other models retain their verified limits. Do not globally raise a shared constant for every model.

Update the worker and route validation together; changing the UI to fourteen while the worker still rejects eleven would turn a silent omission into a failed paid job. Keep the existing byte budgets or explicitly measure and adjust them separately. Count an uploaded face as one of the fourteen, not an additional fifteenth input.

If deduplicated selections exceed the verified capacity, block before catalog preparation and paid admission with a precise message identifying count and choices to remove. Never silently select a subset or automatically spend multiple generations. Even fourteen may not cover every possible combination; honest overflow handling remains necessary.

Use explicitly named image labels near each image or a consistent role table, and state identity/trait override priority. Avoid treating all portrait references as alternative identities. Cropping secondary references to relevant feature regions is a possible later quality improvement, requiring its own visual review; it is not necessary to fix the current omission bugs.

### 4. Prove the complete contract before release

Required non-paid checks:

- Every selected field appears in the frozen receipt and maps to final text/reference or an explicit intentional no-change behavior.
- Restriction section reaches the constructed provider payload exactly once; no unsupported field is silently assumed.
- Ten, eleven, thirteen and fourteen Gemini references survive UI planning → API → worker payload in the same order. Fifteen rejects before credit reservation and dispatch. Uploaded face and combined saved/uploaded references count correctly.
- Deduplicated shared-source roles remain intact; invalid category IDs, forged owner/asset IDs, duplicate references and stale catalog versions fail closed.
- Changed selections affect new-version fingerprints; uncertain retries reuse the exact frozen receipt and do not reserve twice. Old jobs recover without recompilation under new defaults.
- Only a separately authorized paid canary can prove actual live eleven-to-fourteen acceptance on the existing chat route; capability metadata and a mocked payload do not substitute for that test.
- Visual review checks user-selected traits independently. Successfully delivering every instruction is necessary, but is not proof of perfect output.

## Evidence and scope

Fresh controlled boundary checks passed: schema accepts ten, rejects eleven, rejects currently unsupported negative/selection keys; payload builder retains fourteen image parts; collector reproducibly omits the final accessory at the current nine-catalog cap. No POST was made to a provider. Evidence: `.tmp/character-contract-audit/boundary-proof.json`, public capability responses and `prove-boundaries.mjs`. Prior exact image evidence remains in `.tmp/character-output-audit/`.

Sources read: current and historical compiler/workspace/schema/service, preparation API, worker input/context/download/adapter, public official capability endpoints and Google/OpenRouter documentation. No application source changed in this investigation. Documentation/ledger updates only. Resolution/copy changes are deferred, as requested. Existing UI, paid jobs, credits, cloud configuration and historical receipts remain unchanged.
