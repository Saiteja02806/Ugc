# Reference audio validation and hover — 30 October 2026

## Observed cause

Public Laura voice ID FGY2WhTYpPnrIDTdsKH5, named Laura - Enthusiast, Quirky Attitude, returns audio/mpeg, 16,527 bytes. FFprobe and an actual Edge HTMLAudioElement independently report **1.996916 seconds**. It is below Seedance's existing two-second minimum. This is a verified public demo measurement, not a recovered copy of the user's private selected file.

Voices → Use sample downloads the complete provider demo through the authenticated voice-sample route, validates MIME/MP3 data, constructs a File and reads its actual duration. There is no fixed sample length and no truncation in this path. Uploaded and saved recordings likewise use the complete selected file. The picker previously enforced only the maximum while Generate enforced the minimum. That allowed a selected reference which could never pass submission. This blocked state is not sent to the generation model; no hosted paid job receipt was inspected.

## Changes

Workflow audio upload and voice/saved sample selection now receive the model's minimum as well as maximum duration: Seedance 2–30 seconds, WAN 1–15. Reject undersized files before replacing the prior attachment. The error includes the measured duration (floored to milliseconds, so 1.996916 is not misleadingly rounded to 2). Existing accepted media stays visible after a failed replacement. No silence padding, resampling, invented duration, provider-limit relaxation or paid generation is added. Laura's current demo remains too short; use a genuinely longer voice recording or another qualifying demo.

Hover highlights now use the rounded outer tile border instead of an inset shadow on its square inner deck. Person-strip highlighting and keyboard focus remain available. Selection, remove/replace, Sound, Demo audio and source/identity roles are preserved.

Files changed for this request:
- components/explore/workflow-reference-preview.module.css
- components/explore/workflow-audio-reference.tsx
- components/explore/workflow-saved-audio-choices.tsx
- components/explore/use-local-workflow-media.ts
- lib/ai-studio/video-reference-policy.ts
- scripts/workflow-bookmarked-audio.test.mjs
- scripts/talking-head-references.browser.cjs
- EXPLORE_CONTEXT.md; docs/ai-context/clear.md; this receipt.

## Evidence

42 audio/parent/client-to-real-API admission tests PASS; 32 creation/frame regression tests PASS. Boundary cases 1.996916, 2 and 5 seconds verify invalid selection rejection, prior-reference preservation, exact accepted MP3 bytes/type and duration. Existing owned-image-plus-voice API tests confirm audio URLs and asset IDs stay in the audio role with Sound on. Provider submission is mocked; this is not hosted paid acceptance.

Real-component browser fixture PASS at1366,1536 and390px: single outer hover highlight, no inner shadow, two-line name, no plus overlap, removal and Sound controls. Mobile screenshot inspected. Artifacts: .tmp/talking-reference-browser/selected-audio-name-{1366,1536,390}.png. Actual public MP3 and browser duration receipt: .tmp/reference-audio-audit/. The fixture uses a long generic filename, not the actual Laura demo.

Preflight script PASS. Same-session context-memory, immutable-contracts, UI-clarity and regression procedures applied; incidents UGC-UI-074 and UGC-VID-034-AUDIO appended without deleting prior history. TypeScript/scoped lint PASS before the final presentation-only selected-state priority adjustment; final checks recorded in ledger. No deployment, billing, provider generation or user-record mutation. Authenticated hosted selection and final generation NOT VERIFIED. Rollback limited to these scoped selection validations and tile styling.

## Five-second voice-context policy follow-up

User explicitly requested a minimum five-second Seedance voice reference. Connected provider documentation verified on30October2026: https://test.reapi.ai/docs/seedance-2-5 documents WAV/MP3, each2–30seconds and at most15MB, combined30seconds. UGCPilot currently attaches one audio reference. Output duration is a separate setting.

New application Seedance audio policy is **5–30seconds**, a product requirement stricter than the provider's2seconds. WAN audio and Seedance reference-video minimums are unchanged. Shared getVideoReferencePolicy.minAudioDuration now drives picker and getVideoTimedReferenceError, including owned-asset server admission before job reservation. Provider worker limits and old job receipts are unchanged. Recordings are sent whole: a10second recording remains10seconds. No automatic cut to2or5seconds, silence padding, repetition, resampling or paid generation is introduced. Laura's current1.996916second demo remains unusable; the user needs a longer actual recording or qualifying demo. Longer duration may offer more context but does not guarantee quality or voice fidelity.

Files changed in this follow-up: lib/ai-studio/video-reference-policy.ts, components/explore/workflow-audio-reference.tsx, lib/ai-studio/video-reference-policy.test.ts, scripts/workflow-bookmarked-audio.test.mjs, scripts/workflow-generation-api-contract.test.mjs, EXPLORE_CONTEXT.md, docs/ai-context/clear.md, this receipt. The integration fixture's voice reference changed4to5seconds while its output duration remains4seconds, proving these settings are separate.

50policy/picker/workflow/client-to-real-API tests PASS. Bounds1.996916/4/4.999reject;5/10/30accept;30.1reject. Valid MP3 bytes remain exact; prior selection preserved on rejection. Real server handler rejects owned4.999second audio before starting a batch and accepts5seconds. Types and scopedlint PASS. Desktop/mobile hover/name/removal fixture rerun; final result recorded in ledger. Source request/job dispatch is tested with mocked storage/provider infrastructure, not hosted paid acceptance. No deployment.
