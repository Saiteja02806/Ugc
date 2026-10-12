# Workflow frontend implementation — 10 October 2026

This implements the existing-header direction and the subsequent reference-control refinements. It supersedes the earlier separate navigation rail and expandable reference groups. The changes are local; they have not been pushed or deployed.

## Final interaction and design

- Create, Edit and Schedule share the existing Explore/title row. Hook and Wall-of-text label their existing middle stage “Edit & demo”; its underlying value and behavior remain `demo`.
- Hook and Wall-of-text use a wider form alongside the example-video gallery. The gallery retains References, Your videos, filtering, playback and Recreate.
- Generation references appear above instructions. Hook/Wall-of-text image and video inputs use compact, subtly shaded tiles with a single outer border. The latest comparison favors the old compact footprint over stretching the two cards across the form: each tile is 96 pixels tall, with a combined maximum width of 290 pixels. The tiles retain their boundary in empty and selected states. Talking Head's reference grouping retains its separately approved presentation.
- An empty tile is one clickable target, with a plus above its Choose label. A selected tile has one reference heading, a small media card and a separate plus-only action that opens the existing picker. Purpose descriptions remain accessible and are explained in the picker instead of repeated visibly inside each tile. There is still one attachment per supported slot; this does not add multiple-reference generation.
- Selected cards have a visible offset back card, a zoom-in cursor and a subtle hover/focus lift. The group shows “Hover or tap to preview” only after a reference is attached.
- Image hover/focus previews preserve the image's natural shape within 160 × 160 CSS pixels, with no side padding, filename footer or surrounding panel. Video and voice use matching compact selected controls. Hover does not play media. Escape and focus departure dismiss previews, and click works as an alternative to hover.
- Laptop layouts reserve the action footer and let longer controls scroll. Narrow available widths use the existing Controls/Preview switch. Navigation wraps only when necessary; small screens retain labelled references and keyboard focus targets.
- Talking Head + Demo now opens the shared clip editor from each sequence preview: “Edit talking-head video” and “Edit demo video.” Both clips have independent custom text, timing, style, trim and sound controls. Saving the clip returns to the sequence; Apply edits retains the existing final subtitles, music and demo audio step.

## Behavior preserved

Existing source modes, uploads, saved-media selection, model settings, generation payloads, ownership checks, billing guards, editing, demo options, scheduling and mounted drafts retain their existing owners and handlers. The hidden phone workflow remains hidden. Slideshow layout and controllers were not changed.

Talking Head clip editing reuses `FormatVideoEditor` and the existing single-clip finishing contract. Its local drafts and finishing receipts use separate owner/source scopes for the opening and demo, avoiding collisions with Hook video's drafts. The demo is uploaded through the existing authenticated media uploader when editing is requested; its verified owned asset is reused in the final composition. No server contract, worker or database change is needed.

Unsaved, invalid or pending clip changes block final finishing and invalidate the prior final preview. Saved clip assets feed the existing composition pipeline, where automatic subtitles, default music, demo audio/playback and framing remain available. The demo's recorded framing is rebased to its trimmed timeline. Replacing/removing media cannot carry a previous clip's edits or framing into the new sequence. Scheduling still receives the final saved asset and requires explicit confirmation.

The final user clarification keeps voice reference out of Hook video. The current Hook/Wall-of-text generator retains its existing image/video inputs. Talking Head + Demo keeps image, video and voice guidance through its existing generation client; voice/video guidance requires Seedance 2.5. The audio picker now names that requirement at the point of selection.

Seedance was already implemented but disabled in this local checkout. `NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE=true` was added to the ignored `.env.development.local` file; the local browser confirms the enabled model option in Talking Head. Hook's supported model list and API contract are unchanged. This local flag is not a production configuration change, and the existing production worker/credential/release gates remain required before enabling it in a deployment. No provider credentials were changed or exposed.

## Verification

- TypeScript: `npx tsc --noEmit --incremental false` passed.
- Scoped ESLint and whitespace checks passed.
- 196 workflow regression tests passed, covering exact draft text, source reuse, pending/error handling, reference ownership and upload guards, video request settings, demo state, voice guidance and scheduling drafts. This includes the real client-to-API contract with external writes mocked, confirming Seedance audio/video guidance and ownership validation.
- Local Edge checked four retained workflow implementations at 1280×720, 1366×768, 1440×900, 1536×864, 1920×1080, 1024×640 and 390×844: 28 combinations passed.
- The latest compact Hook/Wall-of-text reference refinement was rechecked separately at those seven viewports: 14 combinations passed. Scoped ESLint and all 11 existing reference-upload regression tests also passed. The change uses scoped CSS and a presentation-state attribute; generation and upload handlers were not edited.
- Browser checks cover one stage navigation in the existing header, readable targets, preserved drafts/options/attachments through stage changes, gallery availability, laptop action visibility, compact previews, focus/click/Escape, and horizontal overflow. The selected Talking Head fixture exercises image, local video and a one-second WAV reference together. The `--seedance-enabled` check confirms Talking Head offers/selects Seedance 2.5, and that Hook/Wall-of-text retain their image/video reference slots.
- Browser results contained zero uncaught exceptions and zero API writes. The test blocks non-GET application API requests; it does not generate media, charge credits or publish posts.
- The shared Talking Head clip editors passed all seven viewport checks using the real local app. The checks verify separate opening/demo drafts, retention across stage changes, available finishing options, no horizontal overflow and visible Save edits on laptop screens.
- 95 relevant workflow regression tests passed after connecting the shared editor. TypeScript, scoped ESLint and whitespace checks passed.
- `node scripts/format-hook-schedule.browser.cjs --talking-head` checked the real clip editor, finishing controller, composition settings and scheduling boundary with mocked authentication, media, rendering and publishing HTTP services. It verified both clips' text/trim payloads, serialized clip/final renders, subtitles, music, demo audio, rebased framing, final-asset scheduling, source replacement/removal, draft reload and recovery of a failed completed-output lookup without another render. It reported zero uncaught exceptions or overlapping renders. These fixture writes reach only the isolated test server.
- The runner's existing four Hook/demo scheduling scenarios also passed after the shared-editor change.

Existing form tests were updated for the approved visible references, plus actions and separate media preview. A cross-page assertion about the unrelated Explore homepage's horizontal card row was removed from the workflow-control test; workflow-page overflow remains checked in the browser matrix.

Screen diagonals alone do not determine available space: viewport size and operating-system scaling do. The checked CSS viewports represent laptop/desktop sizing, with the real app sidebar present.

Authenticated generation and publishing acceptance still require the deployed production domain after a separately authorized deployment. These local checks do not establish production acceptance.

## Review artifacts

Local screenshots and the complete browser result are retained under `output/workflow-ui-review-2026-10-10/` (ignored generated review artifacts):

- `reference-controls-final.png`: selected image, video and voice controls.
- `reference-hover-final.png`: compact frameless image hover preview.
- `hook-reference-cards-final.png`: the latest compact image/video tiles, with a selected image and empty video input.
- `create-1366x768.png`, `edit-1366x768.png`, `schedule-1366x768.png`: laptop stage layouts.
- `create-1920x1080.png`: desktop gallery density.
- `responsive-results.json`: all 28 viewport results.
- `reference-cards-results.json`: the subsequent 14 Hook/Wall-of-text viewport checks.
- `talking-head-editor-1366x768.png`, `demo-editor-1366x768.png`: shared clip editors on a laptop viewport.
- `talking-head-editor-responsive-results.json`: the seven shared-editor viewport checks.

The fixture screenshots use local illustrative media and disabled generation/publishing. They are UI review artifacts, not generated production outputs.
