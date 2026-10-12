# Application generation options

Use discovered `get_generation_options` and `get_entitlements` for access, model availability, supported formats/quality/durations, reference limits and spendable credits. These are reads; no sample generation is needed. The original V1 tools retain their old contract. If advanced creation is unavailable, explain the limitation for the requested settings. Do not downgrade a chosen model, omit references or shorten a duration without the user's instruction.

For requested generation use `generate_image_with_options` or `generate_video_with_options`. Select from the actual returned model/format limits. When the user leaves the model unspecified, existing defaults are Nano Banana for Studio images, GPT Image for slideshow images and Google Omni at 720p for videos; use them only if supported and appropriate to the requested deliverable. Honor requested quality, exact prompt, aspect ratio and count. Estimate image credits as image cost × count, and video credits as credits per second × billed duration × count. Gallery/video editing may derive billed duration from the server-measured source; communicate that estimate before submission if it changes the requested budget.

## Owned reference roles

Inputs take saved asset IDs, never caller-supplied provider/storage URLs. Resolve ready owned files through media tools. Private audio-library IDs are separate from generic media references; a supported ready editing snapshot is required where the application accepts an audio reference. Character/avatar IDs are not interchangeable with image asset IDs.

- Studio images accept one image reference. Slideshow images accept ordered style references, ordered attachments and an optional existing image edit target. The combined reference limit includes every role. Reusing an image across roles does not change its meaning.
- Video reference limits depend on both model and format. Use `format_limits`, including total reference count and ordinary/edit source duration limits. Read each selected file's actual metadata. Google Omni uploaded/gallery video editing is a Hook/Wall-of-Text workflow with one optional image and a source up to ten seconds; it is not a Studio-video reference capability.
- A server-resolved gallery reference uses its registered identity and measured duration. Paired soundtrack provenance is derived by the application; arbitrary URLs or a caller-supplied soundtrack object are not accepted.

This generates images/clips. Exact editable text, demo composition and output export remain separate Edit/finishing steps. Generating slideshow images does not render finished slide text or establish complete Carousel access.

## Submission and interrupted-response recovery

Before submission, save a fresh random UUID `client_request_id` and the exact tool/input locally when the host supports durable files, or retain them in the conversation. Use the same UUID and complete input only for that intentional request. After an uncertain response, read `get_generation_request` with `kind` and the saved UUID; it does not reserve credits or dispatch jobs. Unconfirmed is not proof that no work was accepted.

Read the returned jobs with `get_job`, then retrieve completed output IDs with `get_asset` and the existing local download helper. A queued receipt is not a finished or downloaded file.

When resubmitting an authorized matching request, reuse the exact original UUID and arguments. Accepted children reuse their atomic credit reservations; a still-queued delivery may be recovered. Partial batches may continue only while new creation is enabled and access/references remain valid. Resolved references, measured source timing and price must still match the frozen siblings. On a conflict, report the saved jobs and reason; do not mint a new ID, switch references or charge for a replacement automatically. Existing request reads remain available after plan/gate/reference changes. Terminal retry/cancel remains the separate revision-aware operation workflow.
