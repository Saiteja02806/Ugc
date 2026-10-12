# Workflow proportions follow-up — 11 October 2026

## Accepted direction

The latest clarification accepts the Create gallery with room beside its three examples. Filling that space with a fourth example is not a requirement. The remaining problem is the Edit and Schedule workspace: it must use the available area while individual controls stay compact.

## Changes

- Create keeps compact source choices, bounded model/duration/ratio fields, small generation-reference cards, and the quiet scrollbar.
- Quality can be changed in the local preview despite its generation lock. Supported options still follow the selected model: Omni Flash supports 720p and 1080p; unavailable resolutions remain disabled. Live access restrictions and generation dispatch are unchanged.
- Edit uses the full stage width and height. Hook and Demo remain beside each other on laptop and desktop layouts. The existing individual editors retain trim, text timing/style, sound, and Demo framing.
- Hook text is directly available in the Edit overview. “Remix text · Available” labels the editable reference/idea field without an extra surrounding card. One compact Generate action sits below the inputs. Optional tone/language/avoidance guidance is behind Options; nonempty guidance shows a Set indicator and recovered guidance opens for review. The ready business-context row and Review link are removed from this overview, while saved account context still feeds the existing authenticated generation request. Missing context still offers an actionable Settings link. “Add text manually” is a quiet text-icon action beside the Hook text heading and opens the existing Hook clip editor. Edited source text survives that round trip. The reviewed remix applies to the selected Hook only and does not continue onto the Demo.
- Background audio exposes Upload audio and the existing authenticated saved Audio Library. A chosen background track uses the existing finishing contract across the complete sequence. Demo-only audio, trim, text and framing remain separate. The default-track toggle remains available.
- Schedule uses the full stage, with one final-video player on the left and a bounded form on the right. Hook and Demo appear in that same player after preparation completes. Before completion, Schedule shows preparation, error and retry states without presenting raw clips as the finished result. Caption, native date/time, platform choices, time zone, review and confirmation keep their existing behavior. A Hook without a Demo is final only if no background-audio pass is still required.
- Below 1024px, Controls and Preview switch as separate panels. This avoids a narrow empty second column.

## Local verification

Actual browser CSS viewports checked: 1280 × 720, 1366 × 768, 1536 × 864, 1920 × 1080, 900 × 800 and 390 × 844. Physical laptop diagonal alone does not determine usable CSS dimensions; resolution, browser zoom and OS scaling also matter.

At 1280 × 720, both Edit media previews are approximately 203 × 360px, both edit actions remain visible, and the initial reference field ends above the reserved action footer. Generate sits below the remix inputs and is reachable through the quiet controls scroll at shorter laptop heights. At 1920 × 1080, Edit portraits are bounded at 270 × 480px. The single Schedule player is bounded at 315 × 560px and the scheduling form remains at most 520px wide. The caption is initially 80px tall; Date and Time use 220px and 180px fields within a 412px row. At narrow widths they shrink to fit and retain 44px touch heights. No horizontal page or native-field overflow was observed at the checked sizes. Narrow panel switching was verified through the UI.

Omni Flash's quality picker was changed to 1080p through the browser. Native keyboard changes to scheduling date/time, caption and platform selection retained across stage/panel switches. An automated fill of native date/time inputs did not reliably emit a React change; native keyboard interaction confirmed the existing handlers work, so no behavioral scheduling workaround was retained.

Hook and Demo editors were opened separately. The local Hook overlay was removed, and the Demo text remained empty. An edited remix source stayed present after switching into a clip editor and back. Local media playback metadata and visible previews were checked after hot updates.

195 focused regression tests pass, covering source selection, supported quality, shared clip editing, Hook/Demo boundaries, background-track snapshots and recovery, remix source/API contracts, single-result Schedule preparation/invalidation, and exact scheduling targets and receipts. The overview Generate test verifies that mounting only reads source/business details, an explicit click sends the edited seed with its idempotency key, and applying the reviewed draft returns to the visible source box. TypeScript and scoped ESLint checks pass. These are local and mocked integration checks.

The latest remix-refinement pass checks closing/reopening Options without losing guidance, forwarding those instructions on the explicit generation request, and opening the existing Hook editor through Add text manually. 64 relevant remix/API, shared-editor and final-video preparation tests pass, with TypeScript and scoped ESLint checks. The earlier broader 195-test validation remains the baseline for the complete workspace.

Current proof screenshots are in `.tmp/workflow-proportions/`: `edit-remix-clean-1366.jpg`, `edit-remix-clean-1536.jpg`, and `schedule-compact-1536.jpg`. These supersede the previous nested remix card, header Generate and wider scheduling-form proofs. The earlier Create and quality proofs remain applicable; `schedule-final-demo-1536.jpg` still documents playback beyond the Hook boundary in the one prepared video.

The development fixture accepts `finished=1&ratio=9:16` to show an actual prepared sample. `node scripts/create-workflow-final-preview.mjs` joins two existing local clips into the ignored `.tmp/workflow-final-preview.mp4`. Its fixed media route is unavailable outside development. The browser verified one 10.404-second player and sought beyond the Hook boundary into the Demo, rather than simulating a combined result with separate players. This sample never becomes a publishable output.

## Acceptance limits

Per the user's instruction to use local checks, no production generation, authenticated audio-library selection/upload, render, save or publishing request was executed. Those actions remain disabled in the development fixture. Existing owner/authentication and finishing/scheduling contracts remain in place; hosted acceptance still requires an authenticated deployment check. No deployment was performed.
