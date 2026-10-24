# Seedream starting-frame pilot — 23 October 2026

User authorized Seedream 5.0 Pro first and deferred GPT 2.5 Sunburst. Six fresh requests completed using bytedance-seed/seedream-5-0-pro through OpenRouter, 1K, 9:16, one output per call. Each of the three prior source frames (held glasses, pink keyboard, drink can) uses current v4 and candidate v5 with the same selected person's main and two supporting photos. Source/photo hashes and frozen prompt inputs are under outputs/recreate-ui-preview/prompt-test-seedream. The base prompt text is identical to its paired Gemini request; the same ordered image-role labels are appended as text for Seedream. Prompt lengths remain under 4,000 characters.

## Access, transfer and receipts

Google Cloud Secret Manager openrouter-api-key version 1 supplied an existing regular inference key, read into memory without printing or changing local environment files. Existing local .env.local contained a management key. Earlier checks had submitted no paid images.

Local signing failed before provider submission: the initial 3,600-second link exceeded the helper's 600-second maximum, and correcting that exposed local ADC lacking client_email for signing. Both pre-submission source uploads were cleaned up (same object key, deletion confirmed after each attempt). Automatic approval review rejected changing to public reference URLs because of broader image exposure; the rejected patch was not applied. The successful test sends original bytes privately as base64 image references over authenticated HTTPS using OpenRouter's documented Image API. No public reference route, storage permissions or IAM settings changed. This local transport differs from the production app adapter's HTTPS URL contract, which remains unverified live for this case.

Sources: https://openrouter.ai/blog/tutorials/image-generation/ and https://openrouter.ai/bytedance-seed/seedream-5-0-pro?view=api . No app generation jobs/credits or deployment were involved. No paid POST was retried. ProviderRequestId was absent in responses; receipts correctly retain null rather than inventing operation IDs. Each intentional request has a fresh local UUID, prompt hash/version, output hash and returned usage cost. Six costs of $0.054 sum to $0.324; the previous conservative listed estimate was $0.342. The returned usage is not an independent billing ledger audit.

## Visual inspection

| Source | Seedream v4 | Seedream v5 |
| --- | --- | --- |
| Held glasses | Keeps room and dark top close to source; glasses move over forehead; facial appearance remains a concern. | Very close to source scene/gesture, but also appears very close to original performer, limiting evidence of selected-person recreation. |
| Pink keyboard | Keeps shelving screen-right and original room arrangement; selected-person resemblance more apparent; framing/pose still differ. | Keeps scene/crop well, but appears to retain source performer's features/styling. |
| Drink can | Keeps beams/window layout close to source and selected-person appearance more apparent, with subject scale/pose changes. | Close source composition, with selected-person features less clear; no consistent advantage established. |

All six omit creator-added captions on inspection. Physical can labels remain printed-looking but exact wording is not verified. Compared with prior Gemini v4 samples, Seedream v4 follows scene/clothing more closely here. This does not establish an overall winner: Seedream uses 1K and Gemini used 2K; model image conditioning/label transport differs; outputs have no fixed seed, and only one selected-person set with one image per condition was tested. No biometric or OCR scoring was used. Inspect resemblance against main/support photos, not only source-scene similarity. Do not promote v5 or claim catalogue-wide reliability from these samples.

## Review artifacts

Local comparison http://127.0.0.1:8197/comparison-seedream includes source/main/support photos plus previous Gemini and fresh Seedream results for each prompt. Original images open on click. Six section screenshots captured with headless Edge; every image loaded and no page errors. Files, inputs and receipts stay in outputs/recreate-ui-preview/prompt-test-seedream. These are local test artifacts, not production app history entries. Deployment remains paused and GPT Sunburst has not been called.
