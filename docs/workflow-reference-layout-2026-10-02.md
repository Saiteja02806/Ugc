# Workflow 1 and Workflow 3: compact, separated workflow sections

Local frontend update, 2026-10-02. No deployment or generation integration.

This supersedes the earlier header-audio/right-demo-drawer and settings-strip layout described in `workflow-1-local-layout.md`. Recreate retains its existing workspace, media sourcing, previews and generation controls.

## Current layout

- A permanent left creation column and larger right workspace on desktop. Both frames stretch in the same grid row, so their top and bottom edges match even when attached media or long post captions expand the content. Controls remain in normal page flow; neither frame uses independent sticky positioning or a separate scrolling pane. Extra attachments, validation errors and expanded demo settings extend the page rather than clipping controls.
- Three equal square reference tiles fill the creation row: **Choose image**, **Choose video**, **Select audio**. Corners are 8px on controls and 12px on major surfaces, with quieter borders.
- The image tile uses an existing creator-gallery image as a soft, blurred availability preview. It does not select a creator or add any generation input. Selecting/uploading an image replaces it with a sharp preview and a selection check. Removing it restores the unselected availability preview.
- The video tile displays only a user-selected upload, sharply and without autoplay. No stock clip, generated cover or Library example is inserted. There is currently no separate available-video inventory for this input.
- Audio uses a waveform icon and opens its own dropdown. Only user-chosen local recordings are offered. Voice reference / exact recording intent remains independent from the user's instructions and demo background audio.
- Model and Duration share row one; Quality, Videos and Ratio share row two at every checked width. Text labels wrap on very narrow screens without clipping.
- Workflow 3 retains its independent app-screen image/recording input above optional references. App-screen input is not the appended demo.
- Both workflows now have three accessible tabs in the permanent left column: **Create**, **Edit video**, **Schedule**. The previous combined creation/finishing layout was not the requested section separation and has been replaced.
- Create contains references, instructions and generation settings only. On desktop, unused column space goes to the instructions textarea rather than leaving a gap below settings. The setting rows stay directly above the primary-action footer. Mobile keeps a compact 72px textarea; long text scrolls only within that input. Its workspace focuses on generation, with no demo, subtitle or scheduling controls or demo guidance. Workflow 3's app-screen input remains independent.
- Edit video contains the optional demo, directly visible **Demo audio**, background music and subtitles. Its workspace shows the hook/phone segment followed by the optional demo, with an audio summary. Only user-selected demo media can appear; no stock clip or fake generated result is inserted. Invalid demo replacement preserves the prior demo/audio pair; accepted replacement/removal clears only demo background audio.
- Subtitle styles can be selected through four illustrated sample cards: Clean (initially selected), Bold box, Active word, Editorial. These are local CSS style illustrations, not generated captions from the user's video. One style is intended to cover spoken audio across the main video and optional demo; music-only sections have no speech captions. Actual subtitle rendering and background music remain disabled/unconnected.
- Schedule contains three named platform icon tiles (Instagram, TikTok, YouTube), a separate social-post caption, date and time. Selection is single-platform, initially empty, keyboard-accessible and visibly checked. The Account field and repeated visible notes below date/time and in the Schedule footer have been removed. Time-zone help remains screen-reader-only; disabled-action descriptions and the post workspace still explain that publishing is not connected. These are browser-session draft fields, not saved schedules. The social caption does not overwrite the generation instructions or become video subtitles. Date/time follow the device's time zone.
- Each tab has its own primary action: Generate video, Apply edits, or Schedule post. All remain disabled until their backend integration exists. No provider, upload, account or publish requests are made by these local previews.
- The three Base UI tab panels remain mounted. Inactive panels are hidden/inert; creation settings, references, audio intent, subtitle style and schedule drafts survive switching. Switching sections pauses media without clearing attachments. Short section transitions respect reduced-motion preferences.
- Empty section controls and actions fit the tested laptop viewport without an internal scrollbar. Extra attachments or validation errors may extend normal page flow. The right workspace can also expand for a long post caption without overlapping Library.
- Library remains below the complete first-screen workspace and empty until approved videos are supplied. Its shortcut scrolls and focuses the Library heading without changing instructions. Ordinary page scrolling remains necessary to reach Library.
- Explore workflow cards now form a responsive 1/2/3-column grid instead of a horizontal scrolling strip. Quick-start content and navigation were preserved.

## Verification of the earlier reference-tile update

- Full TypeScript check and scoped ESLint passed.
- 68 workflow/media/catalogue/presentation regression tests and 7 typed Recreate/query tests passed (75 total).
- Browser layout checks covered 320×740, 390×844, 1024×768, 1366×768, 1440×900 and 1920×1080 CSS pixels. No page horizontal overflow or nested creation-pane scrollbar. All three generation settings in row two remained aligned; Library remained below the initial viewport.
- Found and repaired narrow-screen reference-label clipping. All tile labels fit at 320px after wrapping.
- Browser interactions verified image selection removes blur, video selection and inspection, exact-recording retention after closing/reopening, subtitle-style and generation-setting retention, and verbatim instructions including leading/trailing spaces.
- Demo audio longer than its demo produces an explicit error without automatic trimming. A valid shorter replacement clears it. Invalid demo replacement preserves audio; a valid replacement clears demo audio without changing hook audio or instructions.
- Workflow 3 app-screen attachment survived demo removal; creator audio intent, quality and subtitle style survived picker interactions and resizing.
- Keyboard Enter opens the image picker; Escape restores focus to its tile. Library shortcut focuses its heading and supports reduced-motion mode.
- Browser interaction audits observed no console/page errors or non-GET application requests. No uploads, provider jobs, charges or schedules were initiated.
- Recreate components, catalogue bytes, local media ownership hooks, shared standalone composer, global theme, middleware and dependency manifests matched their pre-change SHA-256 hashes.

These checks establish local layout/interaction behavior only. They do not establish provider capabilities, subtitle rendering, audio mixing, persistence or authenticated production acceptance.

## Verification of the section-separation correction

- Full TypeScript and scoped ESLint checks passed. A malformed generated `.next/dev/types/validator.ts` was resolved by regenerating framework types and restarting the local development server; no application configuration or source workaround was added.
- 73 workflow, section, media, catalogue and presentation tests plus 7 typed Recreate/query tests passed (80 total).
- 66 actual browser interaction assertions passed across workflows 1 and 3. Checked default Create tab, keyboard switching, stage-specific controls/actions, verbatim instructions/captions, all generation settings, creator/video/audio references, exact-recording intent, subtitle-style retention, schedule-draft retention and media pause/detach behavior.
- Demo removal cleared only demo audio. Main audio and Workflow 3's app-screen input remained attached. Scheduling stayed unavailable; account connection was not simulated.
- All three sections in both workflows passed 36 layout checks across 320×740, 390×844, 1024×768, 1366×768, 1440×900 and 1920×1080 CSS pixels. No page horizontal overflow, nested creation-pane scrollbar or out-of-bounds controls. Inactive panels were hidden/inert, Quality/Videos/Ratio stayed side by side, reduced-motion disabled the section animation, and Library remained below the initial viewport and empty.
- Checked long post captions in both workflows: the right workspace expands in normal page flow and Library follows below it. Standard section motion is 160ms; the Library shortcut still scrolls and focuses its heading.
- Browser interaction checks recorded no page errors or non-GET application requests. No uploads, jobs, charges, rendered edits or schedules were initiated.
- SHA-256 checks confirmed Recreate components, the standalone generator composer, media/app-screen ownership hooks, global styling and dependency manifests were unchanged from this correction's starting state.

The UI separation is implemented locally in the development-only preview routes. Generation, audio mixing, subtitle rendering, persistence, account connection and scheduling are still separate integration work; nothing was deployed.

## Verification of aligned frames, cleaner Schedule, and expanded instructions

- Corrected the mismatched desktop frame heights with CSS grid stretch, not independent sticky heights or JavaScript measurements. Both panels' top and bottom edges match across Create, Edit video and Schedule. The action footer sits at the bottom of the control frame.
- Replaced the platform dropdown with existing brand icons in three accessible button tiles. No platform is preselected; selecting another leaves exactly one active tile. Removed the Account field and repeated visible Schedule notes. Unavailable publishing remains disabled and described without implying a connection.
- Follow-up correction assigns spare desktop Create space to the instructions textarea. At 1366×768 CSS pixels its measured height is approximately 216px for Hook and 178px for Phone; the settings-to-footer spacing is 12px, not an empty gap. Mobile keeps its original 72px field. This is layout-only: instructions are never inserted, rewritten or trimmed.
- Full TypeScript and scoped ESLint checks passed. 76 workflow/section/media/catalogue tests and 7 typed Recreate/query tests passed (83 total).
- All 36 responsive states passed at 320×740, 390×844, 1024×768, 1366×768, 1440×900 and 1920×1080 CSS pixels. All 24 side-by-side desktop states had a measured 0px height/top difference. Library remained empty and below the initial viewport. No horizontal overflow or nested creation-panel scrollbar was introduced.
- 94 browser interaction assertions passed: platform mouse/Enter/Space selection, long verbatim instructions scrolling only within the input, draft and generation-setting retention, independent reference/app-screen/demo ownership, tab media pause, and matching frame heights with attached demo/audio and long post captions. No page errors or non-GET application requests occurred.
- Agent-browser's initial launch failed with a closed CDP channel; browser verification and visual inspection were completed through the available Playwright connector. The temporary agent-browser session was closed afterward. The existing dev server was reused, not stopped or replaced.
- SHA-256 comparison confirmed that Recreate components, the standalone generator composer, media/app-screen ownership hooks, shared platform icons, global theme and dependency manifests were unchanged. No backend, authentication, account lookup or deployment changes were made.

This confirms the local preview UI only, not generation, subtitle rendering or actual scheduling integration.

## Shared visual polish for workflows 1 and 3

- Refined the existing dark/orange treatment without replacing the layout or global theme. Shared visual roles are workspace, control surface and raised input surface; corners remain 8px on controls and 12px on the two major frames.
- Removed repeated visible Create / Edit video / Schedule headings below the tabs. Semantic headings remain screen-reader accessible. Tabs have a quiet baseline and the existing orange active indicator.
- Reference tiles keep equal square geometry in empty, available, selected, loading and error states. Selected media has an accent border/check; selected images stay sharp, while the unselected creator-gallery availability image remains blurred. Reading status and upload errors are available outside closed pickers. A rejected replacement does not clear the previous asset or change instructions.
- Edit video uses two aligned upload cards for Demo and Demo audio. Both maintain a 112px action surface before and after attachment. Demo audio remains disabled and described until a demo is attached. Selected files have visible names and independent remove actions. The native audio preview uses the full control-column width rather than being squeezed into one card.
- Essential audio scope and validation errors remain visible. Secondary original-sound and demo-replacement guidance is in a named, keyboard-accessible help popover. Enter opens it; Escape returns focus to its trigger. No audio mixing or trimming behavior was changed.
- Settings share a consistent 36px desktop height; narrow-screen settings, date/time and subtitle-style controls use 44px targets. Model/Duration and Quality/Videos/Ratio remain in their existing two rows. The desktop instructions field still receives spare space; mobile remains 72px.
- All disabled primary actions now use a neutral surface and legible muted text rather than looking like available orange actions. Their descriptions still state that this is an unconnected local preview. Removed the redundant visible rendering warning in the Edit footer while preserving the accessible limitation.
- Focus styling covers actual buttons, including Base UI popover triggers whose data-slot differs from plain buttons. A single explicit focus outline avoids stacked rings. Control transitions remain brief (140–160ms); reduced-motion removes them. No new effects, subscriptions, requests or persistence were added for visual state.

### Verification

- Full TypeScript check and scoped ESLint passed. 81 workflow, attachment, section, catalogue and presentation tests plus 7 typed Recreate/query tests passed (88 total). Added regression coverage for paired-card ownership/geometry, visible validation, reference states, neutral disabled actions, focus and reduced-motion styling.
- All 36 responsive states passed again across both workflows and all three sections at 320×740, 390×844, 1024×768, 1366×768, 1440×900 and 1920×1080 CSS pixels. Desktop frame height/top differences remain 0px. Library remains empty and below the first viewport; no horizontal overflow or nested control-pane scrollbar was introduced.
- The existing 94 browser assertions and 58 additional polish assertions passed (152 total). Checked verbatim drafts and generation settings, media/app-screen independence, section pause behavior, upload failures preserving prior media, selected/empty card heights, full-width audio controls, overlong-audio errors outside help, keyboard help/focus restoration and reduced-motion controls. No browser page errors or non-GET application requests occurred.
- React review confirmed visual states are derived from existing attachment props rather than synchronized through new state/effects. Existing local owner hooks and media detach/revoke behavior were preserved.
- SHA-256 checks confirmed all 10 protected files were unchanged: Recreate workspace/generation components, standalone generator composer, workflow/app-screen media hooks, shared media controls, shared platform icons, global theme and both dependency manifests.
- The existing local server was reused. Agent-browser again could not launch its CDP channel; verification was completed through the available Playwright connector and the temporary CLI session was closed. A browser navigation initially timed out waiting for the full load event despite a rendered, HTTP-200 page; subsequent checks used DOM readiness and waited for the actual controls. No server restart or application workaround was necessary.

Only the development-only preview UI was changed. Nothing was deployed; provider generation, rendering, account connection and scheduling remain separate integration work.

## Stacked Edit video controls and code-only wiring audit

This section supersedes the earlier paired 112px demo/audio cards and name-only subtitle dropdown. Their earlier verification results describe the previous UI, not this change.

- The optional Demo now has a full-width upload/preview area. Demo audio is a horizontal, 44px selector directly below it. The demo area receives spare desktop panel height; Create retains its instruction-area expansion. Normal page flow, shared frame alignment and independently owned attachments remain intact in the source.
- Four illustrated subtitle-style cards make the local style preference visible, with Clean selected by default and exactly one pressed/checked choice. White outlined text, a dark bold box, a yellow active word and an italic keyword illustrate the styles. They use generic sample words and do not render or alter uploaded media.
- Repeated visible paragraphs below Subtitles were removed. Subtitle scope and unavailable-rendering explanations remain accessible to screen readers and disabled actions. Essential upload/audio-duration errors remain visible, and the footer still states that the screen is an unconnected local preview.
- Workflow 1 and Workflow 3 share these changes. Recreate, the standalone generator, APIs, workers, media owner hooks, theme and dependencies were not changed.
- The code audit confirms that these development-only workflows have no video-generation or composition callback, no uploaded-reference adapter, no generated-result binding and no subtitle-render job. Existing standalone video generation and local subtitle engines are separate paths. Details and integration gaps are in `workflow-generation-subtitle-code-audit-2026-10-02.md`.
- Full TypeScript checking and scoped ESLint passed for this pass. At the user's request, no test suite, browser exercise, generation, transcription, render, database query or deployment was performed. Regression source contracts were updated but not executed. Static source checks cannot establish runtime or visual acceptance.
