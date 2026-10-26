# Slideshow source request blocked by unnecessary clarification

Read-only production investigation, 25 October 2026. No provider generation,
database mutation, runtime correction or deployment.

## Evidence

The screenshot's exact two clarification strings are stored in plan
`29708ff4-e4fc-470d-bb1d-3aa1ce57214a`, created 12:20:24 UTC / 17:50:24 IST.
It uses gpt-5.6-luna, has six target slides and two uploaded references, and returns
zero planned slides. Neither businessContext nor slideshowBusinessContext exists
in its durable input. Two preceding attempts at 17:49:08 and 17:49:56 IST have
equivalent questions and the same missing context. No private URLs or profile
contents were retrieved for this investigation.

## Trace

1. `lib/ai-studio/image-generation-api.ts` loads the owner's validated saved
   business profile before named-source planning. A request reaching this planner
   therefore passed the profile-loading gate.
2. `resolveSlideshowNamedContext` returns prompt, labelled images and target IDs.
   Its planning input has no business profile field. The API passes that object
   directly to `planSlideshowRequest` and omits the already-loaded snapshot.
3. `slideshow-plan-service.ts` persists/hashes this limited input and sends the
   model originalRequest, targetIds, image labels and actual image pixels. It
   sends no saved product facts. The name UGCPilot in a sentence is not a product
   summary or approved capability list.
4. `SLIDESHOW_REQUEST_PLANNER_SYSTEM` says not to invent business copy and to ask
   when required changes or upload destinations are uncertain. The returned copy
   question explicitly invokes this invention restriction. This repeats the
   documented 23 October defect, whose report was investigation only.
5. The planner also asks which of B/C is primary. The execution schema does not
   require a primary face reference: both uploads can be assigned role person to
   each relevant source. There is no explicit same-person reference-group role in
   planning input. The exact model reasoning is unavailable, but the returned
   question is a planning interpretation, not a provider capability rejection.
6. Any clarification produces HTTP 422 before `reserveBillingCredits` and image
   job dispatch. Saved plan status completed means the planner answered. It does
   not indicate generated images or image-provider failure. The screenshot's
   six-credit label is an estimate, not evidence that six image credits were used.

## Proposed correction

- Include the validated server-owned business snapshot in planner input, model
  message and durable hash. Use the same frozen profile for image jobs. Do not
  accept arbitrary browser facts as the account's approved profile.
- Explicit adaptation instructions should authorize drafting factual replacement
  copy per source slide, retaining source structure/tone and unrequested visuals.
  Forbid unsupported claims, statistics and guarantees rather than all new copy.
- Allow an explicit shared-person instruction to assign both photos to relevant
  slides without demanding per-slide primary selection. Clarify only when the
  intended person/group or requested image purpose is genuinely unresolved; do
  not infer identity equivalence solely from visual resemblance.
- Preserve exact quoted replacement wording and visual-only requests. Keep
  existing clarification receipts immutable: a corrected new request must not
  silently replay a paid model call under the old request key.
- Validate actual API-to-planner profile handoff, recorded model message, profile
  version conflict handling, grounded six-slide adaptation and shared-photo
  mapping. Existing mocked assignment tests do not qualify live model behavior.

## Local checks

Nine request-plan/service tests passed, including the existing test assigning
both face uploads to every target. These check transport, compilation, recovery
and assignments using supplied model outputs. They do not test the planner's
ability to choose those outputs from this request. No fresh paid test was run.

## Correction implemented, 25 October

Source 20228597 supplies the validated server-owned business snapshot as a
separate planner argument. The exact snapshot, configured model and planner
version 2 are stored and hashed with the request. The model message receives
the facts, and queued slide jobs retain the same snapshot. Browser-injected
business facts do not replace the saved profile.

The planning policy now authorizes concrete, grounded replacement copy for an
explicit business-adaptation request. It preserves exact user wording and
visual-only requests, rejects unsupported claims, and treats saved tone/CTA
ideas as context rather than redesign instructions. Shared requests to use the
supplied influencer photos wherever a person appears permit both person views
on applicable slides without a mandatory primary-photo choice. Genuinely
unresolved person/destination conflicts still require clarification.

Validation: 141 tests passed across API admission, plan service, business
snapshots, per-slide compilation, UI submission and private database contracts.
Application TypeScript and scoped ESLint passed. Tests verify that facts reach
the real planning message and both face references reach the intended outputs;
model responses remain mocked. Old completed clarification records remain
immutable and cannot silently incur a new provider call under the same key.

The attempted live-planner test setup was not executed because automatic
approval review could not complete after hitting a usage limit. No live model
quality result, generated slide output or production UI acceptance is claimed.
