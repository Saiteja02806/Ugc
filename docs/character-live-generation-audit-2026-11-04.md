# Real character generation and visual audit — 4 November 2026

**Result: real backend generation PASS; complete visual adherence FAIL.** Ice Blue eyes were rendered brown, and an earring appeared despite No accessories plus explicit jewellery exclusions. Do not describe this workflow as fully faithful based on passing software tests.

## Actual execution and cost

- Connected account was independently identified through the UGC Pilot profile. Account access and 1-credit image cost checked through both connector and application. One image requested and generated; no automatic second attempt.
- Job: `f352b17c-7be8-4b8c-b512-0070efe1aaf8`.
- Request: `aa65bdb0-1bfa-49c5-a876-52947fa063e9`; output asset: `6aa234ae-9797-4c2b-956a-aa4a0fc4685c`.
- Gemini 3 Pro via production OpenRouter worker; one provider operation, `output_persisted`; one credit reservation, amount 1, `committed`. Credits 715 → 714.
- Admitted 4 November 2026 **01:27:06.977 IST**; completed **01:27:50.190 IST**. Admission-to-completion **43.213 seconds**. Production database timestamps are retained as UTC in the ignored receipt.
- Nine real owner-scoped ready catalog images prepared/retrieved through the actual preparation service and live storage. Actual application schema, compiler, reference verification, credit reservation RPC and durable job service used. Actual Cloud Tasks job delivered to the existing hosted worker and paid provider, which persisted the output in real storage. Character history subsequently contains the exact output asset.
- Final image 720×1280; original provider source 1536×2752. Both downloaded and inspected. Original output preserved; a separate face crop was created only for inspection.

## What this proves, and its boundary

This was **not a unit test or mocked provider**. The current local application service was invoked using existing server credentials for the independently verified connected owner. Live Google storage/Cloud Tasks transports used existing gcloud credentials; no IAM/config changes. Queue destination was checked with a read-only production service description, and create-task/actAs permissions checked before credit reservation.

The connector's generic image tool supports only one reference, so it could not exercise this character contract. The browser remains signed out. This test therefore verifies local repaired admission → live backend queue/worker/provider → persisted image/history, **not a deployed browser click-through or deployed availability of the repair**. No builds, dev servers, browser bundling, deployment, application code changes or replacement generator were used.

## Transmission and persistence evidence

All checks below passed against the real durable job:

- Stored structured selection deep-equals the submitted selection.
- Stored negative prompt equals compiler restrictions plus the extra exclusions.
- Version 1 compiler receipt retains all nine ordered trait/role/asset/source-hash bindings.
- Full 3,383-character job prompt equals both output `prompt` and application `effectivePrompt` without truncation.
- Reconstructing the actual worker request fingerprint from model, route, generation ID, output key, full prompt and all ordered reference URLs exactly matches the production provider-operation fingerprint: `1f5ddea2c56a9b16bbb90d1ae4d19e8f27ef272f087d65ff8461fb57535b9e57`.
- The API/worker accepted nine references and this prompt length. There is no indication of reference-limit rejection or prompt truncation in this sample.

These are application/worker receipts and code-path evidence, not an independent capture of the provider's HTTP body or a model-side explanation of its visual decisions.

## Every selected choice

| Choice | Requested | Visual assessment |
|---|---|---|
| Character | Extreme, third character | PARTIAL: moustache, strong brows and prominent ears remain, but the distinctive facial geometry/exaggeration is not faithfully preserved; other face references appear influential. |
| Background | Bedroom | PASS: floral duvet, lavender pillow and neutral room; chair moved to side. |
| Gender styling | Male | Compatible masculine character presentation. |
| Ethnicity option | Middle Eastern | Text and reference forwarded. Ethnicity cannot be established from generated appearance. |
| Age | Adult (25) | Adult appearance compatible; exact age not visually verifiable. |
| Skin tone | Light Olive | Broadly compatible under room lighting; not an exact measured colour match. |
| Head shape | Keep head shape | PARTIAL/uncertain alongside identity drift; exact source geometry is not locked. |
| Neck | Natural Athletic | Broadly compatible; jacket hides much of the neck/shoulder anatomy. |
| Eye shape | Vibrant Open | Eyes are open/alert, but shape is influenced by the overall face; exact match not established. |
| Eye colour | Ice Blue | **FAIL: both irises appear brown in the original-resolution face inspection.** |
| Hairstyle | Textured Crop | PASS: short textured crop, replacing the identity reference's tall split-colour hairstyle. |
| Hair colour | Platinum Ash | PASS: silvery/platinum hair with darker roots. |
| Outfit | 2025 Leather Jacket | PASS broadly: collared zip leather jacket, denim and light sneakers; exact seams/fit are not identical. |
| Outfit colour | Red | PASS: jacket changed from brown reference to red. |
| Height | Tall / Statuesque, ~5'11 | Long-legged proportions compatible; absolute height cannot be measured without scale. |
| Build | Natural / Casual | Broadly compatible; layered clothing limits precise comparison. |
| Accessories | None | **FAIL: silver hoop earring visible on image-right ear.** |
| Framing | Full | PASS: head, both legs, both shoes and floor visible. |

## Negative instructions

Compiler negatives plus explicit glasses, sunglasses, headphones, headbands, earrings, necklaces, hats, readable text, logos and watermarks were present in the actual model prompt.

Visible pass examples: whole body retained; no floating head, missing feet, extra person/obvious extra limbs, glasses, headphones, headband, hat, necklace, studio lighting gear, readable text, logo or watermark observed. This is visual inspection of one sample, not a guarantee for every negative or every future generation.

**Earrings/no-jewellery/no-accessories fail.** Forwarding the negative text is repaired, but semantic instructions are not a hard output constraint.

## Evidence-backed remaining risks

1. **Conflicting eye instructions:** `lib/characters/influencer-registry.ts:214` embeds “dark expressive almond eyes” in the ethnicity snippet, while the independent Ice Blue option at line 524 requests sky-blue eyes. Both occur in this exact frozen prompt. The eye-shape photo also has green irises and several other person references have brown eyes. This demonstrates competing inputs; it does not independently prove which one caused the brown result.
2. **Secondary-reference leakage:** prepared reference 3 (ethnicity) visibly contains a silver hoop on the same side as the generated earring. Outfit reference 6 contains a necklace, which was successfully omitted. Reference-role instructions therefore do not reliably isolate unrelated accessories. Copying from reference 3 is a plausible explanation, not a proven causal trace.
3. **Identity blending:** a face anchor plus ethnicity/neck/build/hair person photos can compete. One successful request and a moustache do not establish exact identity preservation.

A follow-up repair should remove cross-category eye/hair/accessory instructions from demographic snippets, make independent selected traits explicitly authoritative over unrelated reference details, and validate generated outputs before accepting them. Consider neutral/cropped role references only within a separately reviewed scope, preserving original catalog/history. A further paid canary requires a new intentional test; none was automatically submitted here.

## Artifacts and incident

Ignored private evidence: `.tmp/character-e2e-20261104/run.mjs`, `receipt.json`, `prompt.txt`, `ref-1.jpg` through `ref-9.jpg`, `output.png`, `provider-source.png`, `face-inspection.png`. No credentials or tokens were written into these artifacts. Earlier sandbox-blocked gcloud/history reads were rerun with approved normal credential/network access, not treated as product failures.

Incident `UGC-GEN-20261104-CHARACTER-VISUAL-ADHERENCE` remains OPEN. No application fix was made during this requested test. Existing no-accessory default and forwarded restrictions remain distinct from whether a generative model obeys them in pixels.
