---
name: ugc-ui-clarity
description: UGCPilot UI clarity and no-duplicate-interactions workflow. Use whenever editing Hook Video Create/Demo/Schedule, reference gallery, starting-frame preview, uploads, loaders, modals, or responsive UI. Preserve established layout, inspect explore context.md and clear.md, and add no new permanent control where an existing one suffices.
---

# UGCPilot UI Clarity

## Inputs

Actual requirement and screenshots; repo source; real `explore context.md`; `docs/ai-context/clear.md`; `docs/ai-context/nonnegotiables.md`; current component tree; approved baseline or known-good UI.

## Step 1 — Translate language into an interaction contract

Write short assertions answering:
- What does user see BEFORE action?
- What action is taken (click, hover, drag, shortcut)?
- What appears AFTER action, and where?
- What should remain hidden until action occurs?
- What data must persist after close/reload?
- What existing control already handles this task?

Example for starting frame:

```
Given a starting frame exists
Then show one image preview and one Change overlay
And do not show a separate persistent Choose Photos tile
When Change is clicked
Then open the existing image chooser, allowing replacement and permitted extra reference images
When chooser is cancelled
Then original frame and layout remain unchanged
When a replacement is selected
Then update the selected frame, persist it, and keep the preview dimensions stable
```

Do not confuse a capability (allow adding references) with permission to introduce an additional permanent UI surface.

## Step 2 — Inventory existing controls BEFORE changing UI

- Locate the component implementing the action, the state owner, data mapping and the existing selector/modal/drawer.
- Trace whether `Change`, `Upload`, and `Creative Assets` share an existing picker service.
- Inspect loaded, empty, restoring, uploading, selected, error and disabled states.
- Record current tab order, sticky footers, responsive breakpoints, borders, padding and typography. Do not invent new design tokens.
- Search app for similar components; reuse one instead of duplicating the UX.
- Mark every new control in a before/after UI elements inventory; justify it explicitly or do not add it.

## Step 3 — Stable loading and state transitions

- During `Restoring your starting frame`, reserve the established preview size using existing skeleton styles; loading is a state, not a different layout.
- On permanent failure, show a useful recovery action; avoid an indefinite waiting phrase.
- Prevent stale async results (frame A loading after user switches to B) from overwriting current state.
- Don't unmount the fixed action footer unexpectedly. If the panel scrolls, ensure the button stays usable.
- Preserve keyboard, touch, pointer and accessible names of existing actions.

## Step 4 — Implement smallest change

Prefer adjusting render conditions/state transitions in the established component. Avoid broad stylesheet rewrites, framework swaps, changing global typography or redesigning sibling tabs. If an unrelated change seems necessary, explicitly explain and scope it before doing so.

## Step 5 — Acceptance matrix

| Scenario | Expected |
|---|---|
| Frame present | Single card, Change; no extra Choose Photos tile |
| Click Change | Correct existing media chooser opens; supported add/replace flow |
| Cancel chooser | Preview unchanged and no ghost selection |
| Selected new frame | Same panel geometry; correct preview; no stale state |
| Reload | Frame restored; stable skeleton only while needed |
| Load failure | Retry/change available; meaningful error |
| Switch tabs | Reference and preview selection preserved as intended |
| Desktop/mobile | No overlap, page jump, clipped CTA, or unexpected scroll |

## Mandatory deliverable

Show screenshots BEFORE/AFTER for relevant states, changed-file list, behavior assertions, tests performed, and any unmatched design reference. Write new mistakes into `clear.md` and do not declare them resolved without evidence.

See `references/interaction-contract-template.md` for a reusable screen contract.
