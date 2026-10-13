# Explore workflow theme and spacing update — 12 October 2026

The requested change is continuity: entering a workflow from Explore should retain the application's existing charcoal theme, use the screen width effectively, and keep Create, Edit and Schedule in the left side of the header.

## Changes

- Removed the separate dark palette overrides in `workflow-creation.module.css` and `workflow-section-layout.module.css`. Workflows now inherit AppShell's background, card, border, foreground and muted-text variables. Portaled menus already inherit the app theme and now match the workflow content.
- Removed the desktop Create and Schedule frame width limits that created excessive outer gutters. Create uses a 45/55 controls/preview split for video workflows and 40/60 for Slideshow. Compact settings and media cards retain their sizing. The reference grid remains responsive; no fixed four-card requirement was added.
- Desktop Create control cards reach the bottom action area alongside the preview/gallery. A user who deliberately hides the Talking Head preview gets a bounded, left-aligned form.
- Talking Head Create starts with the preview visible. Hide preview works with both empty and selected media, and Show preview restores it. Toggling visibility preserves instructions and media. Edit and Schedule keep their previews visible.
- Main actions already use the shared `Button` component. Removed workflow-specific corner and focus overrides so those actions retain the application's button treatment. Removed a Schedule CSS background override that obscured the selected platform tint. Kept the orange selected-state border and existing disabled actions.
- Reduced the empty Talking Head Library section's padding and removed its separate narrow alignment limit. The Library remains an honest empty state with its existing focus/scroll link.

## Verification

- 143 focused checks passed across Hook preview, workflow sections, source workspace, navigation, slideshow editor, common clip editor and demo/audio state.
- Added a real parent-component regression for default preview visibility, Hide/Show with a selected clip, and retained clip identity. Updated the existing focus check to require the shared button's focus ring instead of the removed local override.
- `tsc --noEmit` passed; scoped ESLint passed.
- At a 1900 px browser viewport, Hook panels start at x=24 and end at x=1876. Both are 908 px high in the 1000 px viewport. There is no horizontal document overflow. Talking Head uses 20 px outer gutters.
- Computed background variables are `#1f1f1f` for both AppShell and the workflows. Control-card backgrounds use the app's `#292929`. Recreate actions use the shared button component, an 8 px corner radius and the app card colour.
- Selected Instagram in Schedule uses the orange border and tinted background; unselected platforms use the app's muted card surface.
- Actual Hide/Show interactions retained a typed instruction. A fresh Talking Head visit showed Hide preview immediately, confirming the visible default.
- At 390 px phone width, Talking Head Hide preview worked and Slideshow Create/Edit remained accessible without horizontal overflow (document width 386 px).
- A stale Turbopack cache initially blocked local browser compilation. The current package JSON was valid. The cache was preserved in a workspace `.tmp` backup and the task's local server restarted; subsequent requests returned HTTP 200. No package or deployment configuration was changed for this recovery.

These are local presentation and preview-visibility checks. Authenticated production generation, rendering and publishing were not exercised. No deployment, paid generation or scheduling submission was performed.

## Screenshots

Saved outside the repository under:

`C:/Users/chund/.codex/visualizations/2026/10/10/01a12567-c95e-72a0-9429-0eefea6f626c/workflow-theme-20261012/`

- `01-talking-head-create.jpg`
- `02-wall-text-create.jpg`
- `03-hook-create.jpg`
- `04-slideshow-create.jpg`
- `05-talking-head-hidden.jpg`
- `06-schedule-buttons.jpg`
- `07-mobile-create.jpg`
- `08-mobile-slideshow-edit.jpg`

The independent palette review agent could not run because the account usage limit was reached. Implementation and verification were completed in the main task.

## Scheduling follow-up — 13 October 2026

The separate schedule action strip shown in `06-schedule-buttons.jpg` has since been removed. Actions and publishing confirmation now remain in the scheduling panel. That older screenshot is not proof of the current scheduling layout. See `docs/explore-inline-scheduling-update-2026-10-13.md` for the updated behavior, button coverage, tests and visual-verification limitations.
