# Wall of Text UI review — 12 October 2026

Wall of Text already uses the current Hook workspace and shared clip editor. Its Create and Schedule screens are structurally consistent with Hook. The main remaining design gap is the Edit overview: optional Demo and Audio controls are prominent, while the workflow's primary text action is behind the video card's **Edit wall-of-text video** button.

## Scope and evidence

- Inspected Create, Edit overview, full text editor and Schedule at the local preview route `/e2e/explore-format-preview?format=wall_text&ratio=9:16`.
- Desktop viewport: 1280 × 720. Phone viewport: 390 × 844.
- Typed two lines of text, selected Snapchat Classic styling, inspected timing controls, chose a ready demo fixture, and changed platform, caption, date and time. The schedule summary reflected those fields.
- Schedule presented one combined sequence player with Wall of Text first and Demo second. This is an immediate browser preview; the publishing file prepares separately. This review did not measure production rendering time.
- Local saving, generation and scheduling are intentionally disabled. Authenticated saving, account selection, hosted rendering and publishing were not accepted or verified in production.

## Fixes applied

### Long text no longer widens the editor

`components/explore/format-video-editor.tsx:211` — the native fieldset had its default `min-width: min-content`. A moderately long text-block label expanded the controls and created an internal horizontal scrollbar, pushing part of the video preview out of view. Added `min-w-0` to this fieldset and the two shared Demo control fieldsets.

Desktop browser measurements for the clip editing region:

| Measurement | Before | After |
| --- | --- | --- |
| Visible width | 796 px | 796 px |
| Scrollable width | 1032 px | 796 px |
| Fieldset minimum width | min-content | 0 px |

At phone width, the editing region measured 313 px for both visible and scrollable width. The document did not overflow horizontally.

### Wall of Text copy

`components/explore/format-demo-section.tsx:326` — background audio help now refers to the whole video.

`components/explore/format-demo-section.tsx:390` — the Schedule action describes a wall-of-text video and demo when both are present. It previously called the opening clip a hook.

These changes affect sizing and help text. They do not change edit data, rendering, source validation or scheduling logic.

## Remaining design recommendations

1. **Make text the first Edit control.** Add a compact **Wall of text** section above Demo and Background Audio with an **Edit text** action that opens the existing full clip editor. Show a short text summary when present. This improves discoverability without duplicating the text editor or changing its behavior.
2. **Keep manual text visible and remix secondary.** The full editor already exposes manual text, timed blocks, styling, sound and trim. Remix is available there in a collapsed optional section. Keep these roles clear rather than giving remix more prominence than the primary text task.
3. **Finish the audio collection requirement.** `components/explore/workflow-saved-audio-picker.tsx:32` loads saved user audio from `/api/audio/history`. Its enabled Audio Library button opens successfully, but the built-in background music collection requested earlier is not implemented by this picker. The local preview explains that it cannot load account audio.
4. **Polish secondary labels.** `components/explore/format-video-editor.tsx:210` exposes raw duration precision such as `7.566667s`; display a concise duration. Some source-loading and asset-picker help still says “hook” in shared Wall of Text paths. The Create reference-duration hint wraps into several lines beside otherwise compact settings. These are cosmetic follow-ups, not confirmed generation or scheduling failures.

## Validation

- 139 focused tests passed across the common editor, Demo state, Demo finishing, format edit, source workspace and schedule draft suites.
- TypeScript `tsc --noEmit` passed.
- ESLint passed for the two modified components.
- Browser verification confirmed the text/style preview, corrected width, accessible text-edit action on mobile, paired clip cards, one Schedule preview player, schedule field updates and phone-width containment.
- Existing project changes were preserved. Nothing was deployed or published.

The review also used the [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) for long-content layout, form labels, keyboard access and responsive sizing.

## Screenshots

Evidence is saved outside the repository under:

`C:/Users/chund/.codex/visualizations/2026/10/10/01a12567-c95e-72a0-9429-0eefea6f626c/wall-text-ui-20261012/`

- `01-create.jpg` — Create screen.
- `02-edit-overview.jpg` — current Edit overview with a ready demo fixture.
- `03-text-editor.jpg` — overflow before the fix.
- `04-text-editor-after.jpg` — corrected desktop editor.
- `05-schedule.jpg` — single sequence preview, form and summary.
- `06-mobile-editor.jpg` — corrected text editor at phone width.
