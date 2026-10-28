---
name: edit-ugc-draft
description: Open or create UGC Pilot Edit-page drafts, save requested trims and exact text, reopen saved changes, or export a selected saved revision through MCP.
---

# Edit a saved UGC Pilot video

Use the discovered Edit tools for the same drafts used by the application's Edit page. These drafts support trim and up to three static text overlays. Explore hook/demo composition and slideshow drafts use different systems; use [video finishing](../finish-ugc-video/SKILL.md) for demo composition, volumes, framing or supported subtitles.

## Open and save

For an existing draft, use `list_edit_drafts` and `get_edit_draft`. For a user-selected ready raw video or influencer asset, resolve its owned ID through `list_assets`/`get_asset`, then call `open_edit_draft({asset_id})`. Opening runs directly and can create a draft; reopening the same source preserves saved content, revision and render history. It does not generate or render media. A read-only review should use listing/reading instead of creating a test draft.

Preserve the returned `draft.draft_id` as the editor identity. Read its current revision and content before saving. If `can_edit` is false or the source is unavailable, report that state. Null content represents the unedited source: trim start 0, trim end null, no text overlays.

Build the entire `content` from that current snapshot and the user's requested changes. Preserve unrelated trims and overlays. Use the discovered schema for limits and fields: `trimStartSeconds`, `trimEndSeconds`, and `textOverlays` with stable `id`, exact `text`, `position` (top/middle/bottom), and `style` (clean/minimal/bubble). End null means the source end. Keep trims within the measured duration. Do not silently truncate text, convert timed overlays to static ones, or promise ratio changes through these tools.

Before `update_edit_draft`, save a fresh UUID `request_id` and exact `{draft_id, expected_revision, content}` in a non-secret workspace record when local persistence is available, and preserve it in the conversation. The save runs directly. Saving changes the account's working draft but does not export or spend generation credits. After a lost response, reuse the same UUID and every input; never allocate another UUID to bypass an uncertain save. The replay response is the accepted snapshot, so reread before later edits. On a revision conflict, reread and reconcile the user's edit with current changes; ask only when that decision is ambiguous. Do not blindly overwrite website edits or silently change `expected_revision` and retry.

Use `get_edit_draft` to verify the saved content when needed. Report the draft ID and what was saved. Distinguish source playback from a rendered result: `get_asset` on `source_asset_id` returns the original source.

## Export a saved revision

Only export when the user requests a finished file or render. Check `get_edit_export_capabilities` before new work, then read/save the intended draft. Missing tools, disabled rollout or missing consent are capability states; do not invent an export call or substitute a different editing system.

Save a new export UUID and exact `{draft_id, expected_revision, request_id}` before calling `export_edit_draft`. The call runs directly. It does not spend generation credits. It submits real processing using the website's renderer. It snapshots the selected saved revision; later working edits do not change that export. Save the receipt and job ID. After interruption, check `get_edit_export` with the saved UUID. If submission recovery is necessary, reuse the identical export inputs and UUID. A changed revision or changed desired export needs a separately authorized new request; an uncertain response alone is not a reason to create another job.

Poll `get_edit_export` with increasing waits and a bounded period. This read does not submit or requeue a render. `unconfirmed` is not proof the original submission failed. For `pending`, report progress and the saved UUID. For `failed`, `cancelled`, or `output_unavailable`, report the actual result; do not regenerate automatically. When discovered, `get_operation` can recover `edit_export_request_id` for an owned saved export after a lost receipt. Read that dedicated UUID through `get_edit_export`; generic job completion is not itself proof of a downloadable export. Keep the local/conversation receipt.

For `completed`, retrieve the returned `output_asset_ids` through `get_asset`. Preview the actual output when supported. To save a local file, use the [transfer helper](../manage-ugc-media/references/local-transfer.md) with a current delivery URL and a new destination. Claim a downloaded file only after the helper reports verified saved bytes and an absolute path. A render receipt or URL is not proof of a local download.

Reads need `assets:read`, export capabilities `account:read`, opening/saving/export `creative:write`, and export status `jobs:read`. Use normal OAuth for missing consent; no account tokens belong in workspace records. Saving/opening tools use existing scopes and do not require renewed consent merely because tool discovery changed.
