# Remix Text functionality and UI review — 11 October 2026

This is the earlier audit. Its input, draft-recovery and demo-scope findings are addressed by the subsequent [editable Remix Text implementation](remix-text-editable-input-2026-10-11.md), which records the current behavior and local verification.

Remix Text is an optional tool for adapting a chosen reference's on-screen copy to the user's business. Its purpose is to help a user keep a useful hook or slide structure while changing the subject and examples to fit their product.

This review did not change product code, invoke a paid model or modify production data. The user previously requested local checks. Browser generation used the real RemixTextSection and applyVideoTextRemix helper with isolated mock authentication, business context and API responses.

## What the user does

1. Open the clip or slide editor. Manual text controls are available by default; Remix Text is a collapsed 44px row.
2. Expand Remix Text. It displays reviewed copy from the automatically linked catalogue reference, along with the source thumbnail/name and the account's saved business context. Additional instructions are optional.
3. Generate a remix. The server resolves the source and business facts, asks the model to retain the reference's structure and approximate length, and validates the response.
4. Review or edit the suggestion. The current video or slide remains unchanged.
5. Click **Use this text**. The suggestion enters the editor, the Remix panel collapses, and manual text tools return. The user then saves/applies the clip through the existing editing flow.

For videos, the result becomes text overlays. It does not change spoken dialogue, remove words already baked into the footage or change the scheduling caption. For slideshows, it updates the selected slide's heading/body. It is useful when recreating a reference with prepared copy; an uploaded clip with no linked source uses manual text.

Existing matching video blocks retain styling and timing; trim and sound settings are retained. Newly needed blocks inherit the existing/default style and scale reference timing to the trimmed clip. Applying builds the overlay list from the remix blocks, so existing additional blocks can be removed. Slide design and position remain intact.

## Current UI

The collapsed row reads **Remix Text · Adapt for your business**. Opening it hides the manual text controls and shows the source copy, business context, optional instructions and **Generate remix**. When a suggestion arrives, those source controls are replaced with editable result fields, **Use this text** and **Start a new remix**.

The actual local Hook editor was inspected at 1280×720. It had no horizontal overflow. The expanded feature requires scrolling within the editing area to reach Generate after the Trim controls. Generation is explicitly disabled in the actual local preview; its enabled interaction was checked in the isolated fixture.

## Findings

- `components/explore/remix-text-section.tsx:45` — **P2: Unapplied revisions are not recovered.** The editable suggestion exists only in React state. Storage retains request identity/instructions, but not revisions to the returned draft. Browser reproduction: generate → change the suggestion to “My unsaved revision should survive refresh.” → reload → Check remix result. The recovered field contains the original mock AI answer, “Our better way to plan time”. Text already applied to the clip remains intact. Persist the reviewed draft within the existing account/source/target scope and restore it safely.
- `components/explore/talking-head-clip-editing.tsx:95` — **P2: Talking Head inherits the row without a usable source binding.** Both shared editors omit remixReference/remixReferences. The shared editor resolves references against an empty list, so it cannot supply the catalogue source needed for AI remixing. Manual text editing works, but showing an unusable Remix tool is misleading. Decide whether to support an explicit source for this workflow or omit the tool when no source exists.
- `components/explore/remix-text-section.tsx:134` — **Review lacks source comparison.** Once a draft exists, the original quote, source identity and business context disappear. Keep an expandable original quote/name in the review state so users can judge the adaptation.
- `components/explore/remix-text-section.tsx:156` — **Application scope is unclear.** “Use this text” does not explain that it replaces this clip's text blocks and that saving/export is a separate step. Prefer “Apply to this clip” or “Apply to this slide”, with an explicit replacement explanation and undo where appropriate.
- `components/explore/remix-text-section.tsx:131` — **Purpose needs a plain-language explanation.** “Remix” can mean dialogue, captions or existing typed copy. Add a brief description such as “Adapt the reference's on-screen text for your business.”

Accessibility checks found semantic disclosure controls, labelled text fields, visible keyboard focus, loading/status announcements and inline error feedback. The review used the [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Functional and comprehension findings above take priority over minor form metadata refinements.

## Verification

74 targeted tests passed: Remix validation/application (5), API behavior (6), source association (4), source/privacy API (3), catalogue (1), in-memory database claims (1), demo state (31) and slideshow editing (23).

The browser verified that generation leaves authored copy unchanged; editing a suggestion before Use is supported; Use applies only the reviewed copy while preserving the tested trim, volume, placement, size, color and timing; and the original paid-request receipt can be recovered after refresh. The unapplied-revision loss above is outside the existing passing coverage and was reproduced separately.

Real provider output quality, hosted activation and authenticated production persistence remain unverified. The backend requires an eligible authenticated user, prepared source copy, saved business name/product description and an enabled rollout flag.

## Screenshots

- [Actual local editor: source view](../../output/remix-text-review-2026-10-11/remix-expanded-source.jpg)
- [Actual local editor: generation controls after scrolling](../../output/remix-text-review-2026-10-11/remix-expanded-actions.jpg)
- [Isolated mock fixture: recovered original suggestion](../../output/remix-text-review-2026-10-11/mock-recovered-draft.jpg)

The feature's purpose is sound. Before changing its visual design, clarify source availability, preserve user revisions and make the review/application steps explicit.
