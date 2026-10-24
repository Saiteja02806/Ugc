# Slideshow Recreate asks for copy despite saved business context

Read-only investigation, 23 October 2026. No runtime change or deployment.

The exact user-reported message was found in production planning receipt
`ce5b0010-c663-4e5a-b018-7a015812b4c5`, created at 12:44:47 UTC (18:14:47 IST).
Two preceding attempts at 12:44:06 and 12:44:36 UTC show equivalent copy requests.
All three use `gpt-5.6-luna`, six targets, zero planned slides and one clarification.
The persisted input fields are only model, images, prompt, version and targetIds.
Neither businessContext nor slideshowBusinessContext is present.

The stored user request explicitly asks to recreate the reference for UGCpilot,
adapt its content/messaging to the business context, and preserve structure/layout.
The corresponding applied profile is UGCPilot version 2, created 10 September and
last updated 21 September. It contains a 140-character product summary, three
value propositions and an audience entry. The profile existed before these attempts.
No unrelated account data, secrets or full profile contents were retrieved.

## Causal chain

1. `lib/ai-studio/image-generation-api.ts` loads and validates the owner's applied
   profile into `slideshowBusinessContext` before entering named-image planning.
2. `resolveSlideshowNamedContext` returns only version, user prompt, named images
   and target IDs. Its input/output type has no business context field.
3. The API calls `planSlideshowRequest(owner, key, named)` without the loaded
   snapshot. The planning service serializes the same limited input for its durable
   hash/receipt and sends originalRequest, targetIds, image names and pixels to
   the model. The business name in the user's sentence is not a product profile.
4. `SLIDESHOW_REQUEST_PLANNER_SYSTEM` additionally states “Do not invent business
   copy” and instructs clarifications for uncertainty. The observed response
   follows this combination: no facts and a blanket prohibition on writing copy.
5. Returned clarifications produce HTTP 422 before image-credit reservation and
   dispatch. Although subsequent image jobs receive the saved context, this
   request never reaches that stage. Completed planning status means the model
   answered successfully; it does not mean image generation completed.

This confirms an application handoff defect and overly broad planner instruction,
not a missing Settings profile or a need for the user to manually author six slides.

## Correction scope

Supply the validated, server-frozen business snapshot to the planner and include
its profile identity/version/facts in the durable input and payload hash. Never
accept browser-supplied business facts as authoritative. This keeps plan creation,
recovery and downstream image work tied to the same business context.

Clarify that an explicit adaptation request authorizes writing relevant replacement
headings/checklist copy grounded in supplied facts while preserving the reference's
structure/tone and unrelated visuals. Distinguish this from inventing results,
statistics, guarantees, health claims or unsupported product capabilities. Ask only
for genuinely missing facts or conflicting/ambiguous changes.

Required checks include the actual API-to-planner context boundary, captured model
message, durable hash/profile-version conflicts, six health-to-software targets,
exact supplied-copy preservation and narrow visual-only edits. Existing tests check
context in image jobs and planner pixel/target assignment but miss business facts
in the planning message. No new model call was made to reproduce generated wording.

Completed clarification receipts are immutable and recovery reuses them. A future
fix must preserve that contract rather than silently rerun paid planning against
the old request key. Deployment is still paused.
