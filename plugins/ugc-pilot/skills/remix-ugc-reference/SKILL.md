---
name: remix-ugc-reference
description: Browse UGC Pilot Hook, Wall-of-Text and slideshow references, read reviewed source text, create requested business-specific application text remixes, and recover saved remix results through MCP.
---

# Browse and remix application references

Discover `get_reference_capabilities` for catalogue/text access, remix readiness, provider/business prerequisites and limits. Catalogue and source reads use `assets:read`, saved remix history `jobs:read`; creation requires both `generation:write` and `brand:read`. Reads do not initialize credits or call a provider. A requested first-use remix may initialize the application's standard free allowance and consume provider/quota access; do not submit one for a connection check.

Use `list_references` with the requested format/query/category and returned opaque cursor. Catalogue IDs and slideshow `slide_id` are not owned media IDs. `paired_audio` is supplied soundtrack metadata, not a ready owned audio attachment; do not pass its URL or reference ID to `finish_video`. Attaching that catalogue soundtrack through MCP remains a separate gap. Use [audio media management](../manage-ugc-media/references/audio-workflow.md) for eligible owned recordings only when that matches the user's intended task.

For the selected reference, call `get_reference`; slideshow text needs a selected `slide_id`. Report `text_status` as returned. Missing/unreviewed extraction is not reviewed source text: do not transcribe, guess words or pretend remixing is available. When the user provides or reviews starting copy, the supported manual-text path can use that copy instead.

## Submit requested application text work

Read the live schema for exact casing. `remix_reference_text` uses camelCase `requestKey`, `referenceId`, `slideId`, `instructions` and optional `format`, `referenceBlocks`. Retrieval uses snake_case `request_key`.

- For a reviewed catalogue source, pass its selected `referenceId` and `slideId` (null for hook/wall text). Omit `referenceBlocks` to use its prepared text unchanged.
- For explicitly user-reviewed replacement starting text, pass the chosen `referenceBlocks`. For custom copy use `referenceId: null`, explicit `format`, and 1–20 blocks with at most 6,000 total characters. Hook/wall text use `slideId: null`; a custom slideshow may use its chosen slide identity or null.
- Preserve the chosen format and instructions (up to 2,000 characters). Use the account's saved business context when ready. Missing business context needs that prerequisite resolved; do not invent profile facts or bypass the service with an unrelated provider call.

Before submitting, persist a fresh random `requestKey` and exact normalized inputs. Check `remix_available`; a disabled gate or missing prerequisite stops new work. `remix_reference_text` runs directly. It does not deduct account credits; it uses the daily remix quota and may initialize the one-time free allowance. Save the returned source/output receipt. Do not change keys or inputs to bypass a conflict, quota or an uncertain outcome.

## Recover and use the result

Use `get_text_remix` with the saved `request_key`, or `list_text_remixes` to discover an owned saved request. These reads do not retry or call the provider. Pending/unconfirmed, failed and uncertain results are not ready copy. For uncertain provider acceptance, stop automatic resubmission. After an interrupted call, recover before replaying the same saved request; never allocate a fresh key merely to force another provider attempt.

A completed remix contains text, not a saved video edit or rendered slideshow. Hook/wall-text output uses ordered `blocks`; slideshow output uses `heading` and `body`. Preserve the returned source timing as source context and map exact chosen words to valid clip-local timing only for an authorized edit. Use [video finishing](../finish-ugc-video/SKILL.md) or [Edit drafts](../edit-ugc-draft/SKILL.md) for a requested follow-on edit/render. For a copy-only request, return copy without editing media. Ordinary host-written creative copy remains available through the other creative skills but must not be described as a saved application remix.
