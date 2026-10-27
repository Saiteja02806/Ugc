# Hook 02 normal pilot: provider rejected the starting image

## Outcome

The user explicitly approved one Gemini 3 Pro 2K starting-image test and, only if that image passed visual review, one three-second Gemini Omni video. The image submission returned HTTP 400: `Image generation blocked due to safety violations. Please modify your input and retry.`

No starting image or operation ID was returned. No video was submitted, no paid retry was made and no other reference was changed. The provider did not identify whether a particular image or prompt element triggered its filter. Do not infer the cause or treat this rejection as evidence about the timed animation prompt's quality. That prompt was not sent to video generation.

One image-generation POST was attempted. Actual provider billing is NOT VERIFIED; the receipt's historical `imagePaidPosts=1` counter records a submission attempt, not confirmed charges. Application credits and database records were not changed.

## Evidence and checks

- Read-only Google model lookup succeeded for `models/gemini-3-pro-image`.
- Verified SHA-256 of the canonical source video, stored original t=0 PNG, selected influencer portrait and both prepared prompt files before submission. Source time remains 0; input order was source scene first, influencer identity second.
- Used the existing `buildGeminiImageRequest` worker adapter with `image_size=2K`, aspect ratio 9:16 and explicit reference-role labels. SDK retry attempts were set to one. Credentials were loaded from the existing local environment and were not printed or copied to a credential file.
- A write-ahead local receipt persisted the attempted submission before the provider call. The image gate did not pass; video submission count is zero. No automatic generation retries occurred.
- Operational helper `.tmp/run-hook02-approved-pilot.mjs`: syntax and scoped ESLint PASS. Existing project preflight PASS. The initial sandbox network preflight failed without submitting generation; the approved network-enabled read-only preflight then succeeded.
- Local result receipt was asserted to have exactly one image attempt, no image operation ID, zero video attempts and the recorded HTTP 400 before finalization. Full local receipt: `outputs/hook02-normal-pilot-2026-10-26/generation-receipt.json`. Sanitized releasable receipt: sibling `hook02-normal-pilot-result-2026-10-26.json`.

## Protected contracts and limits

VERIFIED by this isolated trial's inputs/actions: exact source and identity binding; original-t=0 role; explicit image-before-video gate; one-attempt limit; no runtime assignment, application-credit/database write, deployment or UI/scheduling edit.

NOT TESTED: generated opening identity, scene/pose fidelity, caption removal and photographic naturalness; actual provider video input and output; frame-by-frame video similarity; authenticated production application behavior. A fresh build/browser run was not performed because this trial edited no application source.

UGC-VID-015 records the provider rejection; UGC-VID-013 normal prompt fidelity remains OPEN. No normal prompts should be rolled out from this attempted trial. Any further paid test needs a separate user decision under the one-attempt approval.

## Files and preflight receipt

Added this report and sibling sanitized JSON; added ignored operational helper and local generation receipt. Appended EXPLORE_CONTEXT.md and docs/ai-context/clear.md. The prepared image/video prompt files were not modified. No application or worker source was changed.

Context and skill sources read in the continuing pilot: AGENTS.md, EXPLORE_CONTEXT.md, clear.md, nonnegotiables.md; ugc-context-memory, ugc-immutable-contracts, ugc-frame-analysis, ugc-starting-frame, ugc-video-prompt, ugc-opening-frame-prompt and ugc-regression-gate. Scope and source review are documented in `hook02-normal-pilot-plan-2026-10-26.md`.
