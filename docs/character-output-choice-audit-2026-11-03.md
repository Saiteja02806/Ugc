# Exact character output: choice and generation audit

Audited 3 November 2026. Read-only application/backend investigation: no new generation, paid charge, build, deployment, job retry or application-code fix.

## Conclusion

The supplied image is the output of job **96da54d9-73ee-4bf6-8f44-7fc7766eb80f**. Downloaded output and attachment have identical decoded RGB pixels; their PNG encodings differ. This is an exact pixel match, not a guess from similar appearance.

**The recoverable choices were included in the saved prompt, and all ten references were correctly supplied to the job in the intended order. That does not mean every requested visual trait was reproduced exactly.** Curls, bedroom, headphones and headband are visible; the haircut silhouette/eye styling are not exact, height cannot be checked in a seated Half image, and no outfit preservation requirement was submitted. There is also no complete UI selection snapshot, so some unexpressed UI values cannot be recovered retrospectively.

The saved 2,848-character prompt was reconstructed **exactly** from the compiler and recovered traits. It equals the job's input prompt, output prompt and effective prompt. Every one of the nine prepared catalog reference files exactly matches JPEG encoding of the registered source bytes. The uploaded face is first. The historical worker operation fingerprint also matches the recorded prompt, original URL order, provider and output key. No prompt truncation or missing reference was found for this particular request.

## Exact receipt and timing

Connected account ownership was independently checked through the UGC Pilot profile, then all database queries were owner-scoped. Full account identifiers are retained only in ignored audit receipts.

| Event | UTC, 3 Nov | IST, 3 Nov |
| --- | --- | --- |
| Uploaded identity READY row created | 17:29:35.415 | 22:59:35.415 |
| New Hooded/Curls/Slim references created | 17:29:41.823–41.872 | 22:59:41.823–41.872 |
| New headband reference created | 17:29:42.561 | 22:59:42.561 |
| Atomic job/credit reservation and queue timestamp | 17:29:44.314 | 22:59:44.314 |
| Worker started | 17:29:55.689 | 22:59:55.689 |
| Provider-operation reservation created | 17:29:56.202 | 22:59:56.202 |
| Provider success persisted | 17:30:34.410 | 23:00:34.410 |
| Final output persisted | 17:30:35.642 | 23:00:35.642 |
| Job completed / credit settled / influencer recorded | 17:30:35.918 | 23:00:35.918 |
| Cloud Run completion log | 17:30:36.452 | 23:00:36.452 |

Total admitted-job duration: **51.60 seconds**, including approximately 11.38 seconds before worker start and 40.23 seconds worker processing. Browser selection/preparation time before these database timestamps is not fully recorded. Provider `submitted_at` is null, so a precise outbound POST start timestamp is unavailable; do not describe operation reservation time as confirmed provider acceptance time.

Model: `gemini_3_pro`, provider `openrouter`; provider operation ID `gen-1793726998-UufZa2vPfZqK6PjjF2SI`, state `output_persisted`. One batch candidate, one provider operation, one committed **1-credit** reservation. `attempt_count=0`. No evidence of a paid retry for this job.

Generation ID: `798e540a-5d38-478a-bafc-45e58d0546a1`. Asset ID: `2c0ee1fb-4070-4e7d-a26e-a4d942a7f8e8`. Owned media asset is READY, collection `influencer`, with automatic identity metadata. It is not just a local preview.

Queue record: GCP `ai-generation`, message `job-96da54d9-73ee-4bf6-8f44-7fc7766eb80f-attempt-0`. The completion log identifies message handling as `database-recovery`. This supports durable database execution/recovery; it does not establish that this execution was initiated directly by the corresponding Cloud Task HTTP delivery. No worker errors were returned by the targeted job/error query for this time window.

## Recovered choices and visual review

These are values identifiable from the frozen prompt and references. The application does not persist whether each was explicitly clicked versus retained as a default.

| Setting | Recorded instruction/reference | Was it introduced? | Result and limits |
| --- | --- | --- | --- |
| Character | Uploaded `ChatGPT Image Oct 20, 2026, 04_35_34 PM-1.jpg`; UI label truncated to `ChatGPT Image O` | Yes: first image and explicit likeness instruction | Visually similar facial features, brows, nose, lips and skin detail. Different head angle/lighting; exact identity preservation is not established quantitatively. This UI label is the uploaded filename, **not the generation model**. |
| Background | Bedroom with floral bed, lavender pillow and mesh chair | Yes: reference 2 plus room description | Those room objects are visible. Model invents/recomposes window/light/camera details; not an unchanged photograph of the room. |
| Gender | Female instruction | Yes, text | Recorded instruction confirmed; no independent demographic inference is needed from the output. |
| Age | Adult (25) | Yes, text | Exact age cannot be verified from a synthetic portrait. |
| Ethnicity | Middle Eastern | Yes, text and reference 3 | Submission verified. Ethnicity cannot be reliably verified from appearance; it is not treated as a visually proven property. |
| Skin color | Light Olive | Yes, text | Output has warm lighting; precise swatch matching is not established. The prompt uses descriptive color language, not an exact colorimetric constraint. |
| Head shape | Keep head shape | Yes, text; uploaded face is authority | Broadly similar outline. Headband, pose and angle make exact geometric comparison uncertain. No extra head-shape image was requested. |
| Neck | Natural Athletic | Yes, text and reference 7 | Much of neck obscured by hair/pose; not fully assessable. |
| Eye shape | Hooded | Yes, text and close-up reference 4 | Eyelid shape is not an exact reproduction of the reference; visible eyes remain closer to the identity photo. Partial/uncertain compliance, not a dropped instruction. |
| Eye color | Deep Espresso | Yes, text | Result appears hazel/brown in the lighting, rather than a clearly deep uniform espresso. Original identity photo also has lighter/hazel-looking irises. Exact requested color is not visually verified. |
| Hairstyle | Voluminous Curls | Yes, text and reference 5 | Curl texture is clear. Reference's rounded volume, front fringe and silhouette are not exactly reproduced; headphones/headband flatten or obscure those areas. Partial compliance. |
| Hair color | Keep hair color | Yes, explicit preservation instruction | Dark brown remains broadly consistent with uploaded reference. Highlights/lighting differ. Hairstyle-reference color is not supposed to override identity color. |
| Outfit | No specific outfit instruction or image | No outfit override submitted; `No outfit` reproduces this prompt | Model produced a fitted gray sleeveless top. Uploaded identity photo has a gray ribbed top with different neckline/coverage. Current `No outfit` means no wardrobe instruction, **not guaranteed preservation of the original clothing**. |
| Outfit color | No color instruction | Not independently recoverable | Compiler applies outfit color only if an outfit image is selected. Default `As shown` reproduces this receipt, but another unexpressed color value would too; exact UI value cannot be proven. |
| Height | Tall / Statuesque, ~5′11″ and elongated proportions | Yes, text and reference 8 | Seated Half photograph does not expose whole-body proportions or any scale reference. **Cannot verify height.** |
| Build | Slender / Slim | Yes, text and reference 6 | Lean visible arms/upper body are broadly compatible; complete body proportions cannot be judged from this pose/crop. |
| Accessories | Matte Black Headphones + Athletic White Headband | Yes: text and references 9,10 | Both clearly visible. This job explicitly includes both; the later “No accessories” default must not rewrite this historical request. |
| Framing | Half; head through waist, legs/feet outside picture | Yes, text twice; output ratio 9:16 | Seated head-to-waist composition with no feet, compatible with Half. Considerable empty headroom is not specifically requested; headroom/camera-distance limits are absent. This was **not a Full-body request**. |

The reconstructed selection is consistent with all evidence, but the missing original UI snapshot prevents claiming every field is uniquely known. In particular `outfit_color_as_shown` is a reconstruction, not an independently stored selection receipt. The uploaded trait's original timestamp-based local ID is also unrecoverable; the durable owned uploaded asset ID is known.

## Exact reference order

| Position | Role | Prepared asset ID | Byte verification |
| --- | --- | --- | --- |
| 1 | Uploaded face | `1cf250db-c39a-4a46-9e67-11236e789fab` | Downloaded/inspected; 1024×1280 owned JPEG. Original pre-upload file not independently available. |
| 2 | Bedroom | `433f68f3-39df-58a3-a0c7-d56a293b963d` | Exact registered-source JPEG, 98193 bytes |
| 3 | Ethnicity | `a2a9c04d-574a-5f40-a5df-71142009bde4` | Exact, 204637 bytes |
| 4 | Hooded eyes | `ef0a5694-2d86-57e5-a8a8-45497a3e5d1a` | Exact, 35395 bytes |
| 5 | Voluminous curls | `a3b37987-00ac-5323-a54b-2760791de2be` | Exact, 96000 bytes |
| 6 | Slim build | `566167ea-6d6b-5b03-a593-b39867703da2` | Exact, 82181 bytes |
| 7 | Neck | `c967f06c-167a-5172-a31a-4e26732ae3ea` | Exact, 152792 bytes |
| 8 | Height | `ce50dc32-422e-56cc-a3f8-e0854fa8827a` | Exact, 52556 bytes |
| 9 | Headphones | `a0bbb41c-3566-5c2f-ad09-65b3ab15c5c8` | Exact, 219597 bytes |
| 10 | White headband | `604238ee-4398-59c0-ae08-eed77a135fdc` | Exact, 178198 bytes |

The older prepared Bedroom/Ethnicity/Neck/Height/Headphone references predate this request and were reused. Four new catalog rows plus uploaded face were created shortly before admission. Their earlier creation time is expected cache reuse, not evidence of stale trait substitution. Every asset URL matches the corresponding saved position.

## Step-by-step generation flow

1. **UI state and uploaded face.** Dock stores selected trait IDs and custom uploaded file. Custom photo becomes the primary character reference. Filename is shortened to form a display label/snippet.
2. **Compile text.** `compileInfluencerPrompt` emits room/framing, demographic instructions, face/eyes, hair, optional outfit, physique, accessories and realism. It also computes a separate negative prompt.
3. **Prepare references.** Uploaded face is resized to a maximum 1280-pixel side and uploaded as an owned image. Registered image-based choices are collected in role order. With a custom face, nine catalog slots remain. This job uses exactly nine, so neither accessory was omitted. Ready owned catalog JPEGs are reused; missing ones are encoded/saved.
4. **Combine request.** The workspace appends a reference-order line and sends one custom request with Gemini 3 Pro, count 1, prompt, idempotency key and ordered owned reference IDs. Numeric/description-only choices such as eye color have no separate reference image; they are carried in text.
5. **Server validation/admission.** Generation service validates schema/ownership/readiness/trusted URLs and credit availability. Atomic reservation creates the durable image job and one credit reservation. Input freezes the prompt and references; this job has no selected prompt skills, video source or business profile context.
6. **Worker execution.** Runtime claims job, reserves an OpenRouter provider operation and reads the ordered references. Character custom generation uses **one combined image generation call**, not the Hook scene/face-swap multi-stage pipeline. There is no separate face-only correction pass or automatic trait-by-trait acceptance/regeneration here.
7. **Provider request construction.** The adapter builds text plus ten ordered base64 image parts, requests `google/gemini-3-pro-image`, image modality and (on the current character path) 2K/9:16 configuration. Image roles are described in the text; the images are not masked into strict feature-only regions. Saved DB operation, fingerprint and code corroborate the path; a full original outgoing HTTP body is not retained, so an independently captured provider transcript is **not** claimed.
8. **Stage provider output.** Original source image is 1536×2752 PNG. It already contains the same headband, headphones, hairstyle, pose, clothing and large headroom. Visual discrepancies were not introduced by the UI thumbnail system.
9. **Final processing.** Normal character output processing resizes with `fit: cover`, attention position, to 720×1280 PNG. Re-running that operation on the saved source reproduced the final decoded pixels exactly. The original ratio is close to 9:16, so only a thin vertical trim is needed; this does not explain broad composition decisions already present in the source.
10. **Persist, bill, show result.** GCS output and owned influencer media record become READY, job completes, one credit commits and polling exposes the result. Completion is confirmed by DB and a Cloud Run log. The attached clipboard image is a re-encoded copy of that same final output.

## Issues found and recommended repair boundaries

1. **Missing structured choice receipt.** Save an immutable selection snapshot with stable trait IDs, original role mapping, source content versions and original/merged prompt distinction. Current prompt reconstruction is exact but not uniquely reversible for ignored fields. Validate ownership and fingerprint any new fields; never backfill guessed values into historical jobs.
2. **Negative prompt is dead in this path.** The compiler creates it, but the workspace sends only `compiled.prompt`; job schema/provider payload has no negative prompt. Useful restrictions should be included in the supported instruction text or a genuinely supported provider field. Simply displaying or computing negatives does not send them. This omission does not by itself prove why a particular visual trait differed.
3. **Silent reference truncation at capacity.** A controlled counterexample using this same selection plus `head_oval` exceeds the nine catalog slots and removes the headband image while its text instruction remains. This actual job is unaffected: both accessories are present. Reject or explicitly explain over-capacity choices instead of silently dropping image references; deduplicate before applying capacity. Test original role order, custom-face capacity and all selected accessory references.
4. **Conflicting authorities and weak visual enforcement.** Uploaded identity, generic ethnicity face, eye close-up, hairstyle portrait, body/neck/height and accessory portraits all appear together. Text roles help, but they do not physically isolate face, eyes, hair and clothing. Ethnicity snippet also specifies almond eyes while the selected eye trait requests hooded eyes. Headband/headphones conflict with the rounded curls/fringe silhouette. Clarify user-selected trait priority and retain explicit roles; visual QA must distinguish prompt presence from generated compliance. Avoid promising exact identity or ethnicity validation from appearance.
5. **Wardrobe ambiguity.** No outfit currently omits outfit instructions; it does not preserve the source shirt. Define an explicit keep/automatic clothing policy and test it before changing semantics. Outfit color is ignored without an outfit image; the UI should communicate that rather than imply an applied choice.
6. **Inaccurate resolution wording.** UI mentions 4K and loading text mentions 8K; those words and “8k raw photo” prompt language do not establish output resolution. This asset is **720×1280**, with a **1536×2752** provider original. Preserve a higher-resolution output or correct the product wording; distinguish model request size from final stored delivery size.
7. **Weak deployed-source provenance.** Completion log identifies revision `ugc-ai-generation-worker-r-52cd8589` and image digest `sha256:31918390169ac2fb02894116da4f291b6644dfcf935e445512e89d096fcddfcd`. Its release label points to `0a8bc1b`, whose committed worker source does not contain the observed OpenRouter character path. Treat the label as stale/insufficient source proof. The historical operation fingerprint matches when `mode` is omitted; current code includes `mode`. Initial attempt to compare using the current fingerprint failed, then the historical field set matched. No runtime defect is inferred from that format difference alone. Capture the real immutable source/dirty-tree artifact at deployment.

These are audit findings and proposed repairs, **not application fixes performed during this request**. Existing historical jobs and assets must remain immutable.

## Evidence, checks and limits

Ignored evidence directory `.tmp/character-output-audit/` contains matched job, owner-scoped assets/operation/credit receipts, original reference files, provider source, frozen prompt, job timestamps, exact reconstruction/fingerprint/output checks and the independent capacity counterexample. Credentials/tokens were not printed or saved. The complete frozen prompt is in `frozen-prompt.txt`.

Checks actually executed: connected profile read; owner-scoped SELECTs; actual cloud image downloads; target RGB comparison; all nine catalog encoding comparisons; exact compiler reconstruction; input/effective-prompt equality; historical worker fingerprint comparison; exact final pixel reproduction; read-only Cloud Run logs/revision inspection. Source path reviewed through workspace, compiler, ordered references, admission service, worker, adapter, output processing and reference downloader. No test/build/provider submission was substituted for an actual receipt.

Visuals actually inspected: attached output, downloaded uploaded-face reference, Bedroom, Hooded-eye close-up, Voluminous Curls and full provider original. Other catalog images were verified through source bytes/metadata, not claimed as individually visually inspected. Detailed age/height/body proportions and protected demographic properties cannot be certified from this portrait. Exact original UI click history and full outgoing provider HTTP transcript are unavailable.

Application source unchanged by this audit. Changed documentation: this report plus append-only `docs/ai-context/clear.md` / `EXPLORE_CONTEXT.md`. Skills consulted: context-memory, generation/prompt audit and Supabase; relevant current contracts and source history reviewed. No claim of a fresh complete read of megabyte historical context. Incident `UGC-GEN-20261103-CHARACTER-CHOICE-AUDIT`.
