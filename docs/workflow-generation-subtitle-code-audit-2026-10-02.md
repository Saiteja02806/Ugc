# Explore workflow generation and subtitle wiring: code-only audit

Reviewed October 2, 2026. Scope: Workflow 1 (Create a Hook), Workflow 3 (Creator Shows App on Phone), and their shared Edit video panel. The existing standalone video API/worker and subtitle engine were inspected to identify integration boundaries. No generation request, transcription, render, upload, browser exercise, test suite, database query, or deployment was performed for this audit.

## Verdict

Workflows 1 and 3 are not end-to-end generation workflows yet. Their local layout and attachment controls exist, but generation, composition and subtitles are deliberately disconnected. This is missing integration, not evidence that the UI redesign broke a previously connected workflow. Their development-only route guards and disabled actions remain in place.

| Area | Code evidence | Status |
| --- | --- | --- |
| Entry points | `app/explore/create-hook/page.tsx` and `app/explore/creator-phone/page.tsx` require development mode and `preview=1`; otherwise they call `notFound()`. | Not exposed as functional production workflows. |
| Generate / Apply edits | `components/explore/workflow-creation-panel.tsx` renders disabled actions with no submit/render callback. | No generation or composition request can start here. |
| Creation settings | `components/explore/workflow-creation-form.tsx` keeps model, duration, output count, quality and ratio in component-local state. Its props expose instruction changes, not a generation-settings payload callback. | Settings are not forwarded to a job. |
| References | `components/explore/use-local-workflow-media.ts` creates browser `blob:` URLs, or uses a static creator-library path. It does not upload media. | Preview assets are not backend inputs. |
| Generated result | The Hook/Phone preview owners have no generated-video/job state. `workflow-edit-workspace.tsx` always shows an empty main-video segment and only plays the user-selected demo independently. | No generated result, concatenation, or mixed soundtrack is bound to this workspace. |
| Subtitle controls | `workflow-composition-panel.tsx` defaults the local style preference to `clean`; Auto subtitles remains disabled. The preference is not passed to a parent, API or renderer. | Visual preference only; it cannot produce captions. |
| Subtitle renderer | `worker/src/subtitles/generate.ts` contains the standalone transcription/render pipeline. Application entry points and production worker dispatch do not call it; the local lab/pilot scripts do. | Engine exists separately, but is not integrated into these workflows. |

## Existing video pipeline versus the new workflow inputs

The standalone video studio submits to `/api/ai-studio/videos/generate`. Its route calls `handleAIStudioVideoGeneration`, which authenticates the request, parses settings, reserves credits and dispatches `generate_hook_video`. The production worker dispatcher handles that job and the video worker persists provider output. These source connections exist independently of the new Hook/Phone preview screens; this audit does not prove runtime configuration, provider output quality, billing correctness or hosted acceptance.

Simply enabling the preview's Generate button would not be safe:

- The API requires trusted HTTPS storage references. Preview `blob:` URLs and relative creator-library paths are not accepted; owned uploads and server-resolved references must be implemented first.
- The current API allows either an image or a video reference, not both. Seedance 2.5 is text-only in this API; a reference requires Google Omni. Reference-video validation caps input at three seconds. The preview currently permits independent image/video selection and does not enforce that duration limit.
- The current request/job contract has no field for selectable quality, hook/creator audio, exact-recording intent, phone-screen placement, appended demo, demo audio, or subtitle settings. Those controls would otherwise be silently omitted.
- The worker persists the generated MP4; it does not use the preview's demo or audio state to assemble a final sequence. The demo player and audio player in the current UI are separate previews, not proof of concatenation or audio mixing.

These are integration requirements. No API, worker, billing logic, storage contract or provider behavior was changed during the UI pass.

## Subtitle scope and what is still missing

One style across spoken audio in the main video and optional demo remains the intended product behavior. Captions must be generated from the final composed soundtrack after audio changes, so speech and timestamps refer to the actual exported sequence. Music-only spans should not be assigned invented dialogue. Changing the composition later must invalidate or regenerate captions.

The standalone subtitle code includes transcription validation, layout generation and derivative-video rendering; Clean, Bold box, Active word and Editorial are its declared styles. Editorial currently has an English-language restriction. Code inspection does not establish transcription accuracy or synchronization on an arbitrary user's recording.

Missing connections include an authenticated, owner-scoped subtitle entry point; durable job/status/cancellation and paid-transcription checkpoints; a packaged hosted runtime; persisted derivatives/exports; and a result binding that returns actual captioned media to the workflow. The UI style samples below are not a substitute for those connections. Earlier integration planning remains in `subtitle-integration-readiness-2026-10-01.md`; its past test results are historical, not fresh verification for this change.

## Edit video changes made in this pass

- Replaced side-by-side demo/audio cards with a full-width demo area and a 44px horizontal Demo audio selector underneath it.
- On desktop, spare Edit-panel height goes to the demo area. Both frames still share their grid row; extra attached media or validation messages may extend normal page flow instead of being clipped by a rigid height or hidden scrollbar.
- Replaced the name-only subtitle dropdown with four selectable, illustrated style cards. Clean is selected initially. A single pressed state and check mark identify the chosen style.
- Samples use generic text, not a real transcript or a pretend generated video. Classic samples show white outlined text, a bold dark box and a yellow active word; Editorial illustrates large italic keyword treatment. They are CSS illustrations, not pixel-identical ASS-rendered output or timing previews. Editorial uses a browser serif fallback rather than importing worker-only font assets.
- Removed visible subtitle-scope and repeated unavailable-rendering paragraphs from the sidebar. Their scope and limitations remain screen-reader accessible, disabled actions retain their descriptions, and the footer still labels the screen as an unconnected local preview. Upload errors and overlong-audio warnings remain visible.
- Demo replacement/removal ownership, local file validation, original-sound policy, mounted tabs, user instructions and Create settings were not rewritten. Recreate was not changed.

## Verification limits

This is a code-only audit as requested. Source contracts were updated to reflect the new layout and visual choices, but were not executed. Full TypeScript checking (`npx tsc --noEmit --incremental false`) and scoped ESLint for the edited component and regression-contract file passed. No test suite, browser exercise or media generation test was run. These static checks establish source consistency only—not visual acceptance, caption timing or functional production integration. No deployment was made.

A SHA-256 comparison against the start-of-pass source snapshot identified only the shared composition panel, workflow stylesheet, regression-contract source and layout documentation as modified within the audited paths. The audit document itself was added separately. Recreate, preview owners, creation form, local media hooks and subtitle-engine source remained unchanged in that snapshot comparison; unrelated pre-existing worktree changes were preserved.

Before claiming this workflow works for users, implementation must connect owned media → supported generation settings → durable video job → composition/audio → subtitles on final media → persisted preview/export. That future integration needs separately authorized runtime verification; the current audit cannot replace it.
