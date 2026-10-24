---
name: manage-ugc-groups
description: Browse and organize UGC Pilot Creative Asset image/video groups, change membership or names, remove selected groups, and recover accepted group changes through MCP.
---

# Manage Creative Asset groups

Discover `get_asset_group_capabilities` before requested group work. Reads use `assets:read`; writes require `assets:write` and the live write gate. A package update cannot activate that gate. These groups organize Creative Assets; [application Library snapshots](../manage-ugc-library/SKILL.md) and the dedicated Demo library are separate surfaces.

## Browse and select

Use `list_asset_groups` with the requested `media_type` (`image` or `video`). Resolve the selected `group_id` with `get_asset_group`. Use its exact `revision` as `expected_revision` for `list_asset_group_items`; preserve the same filters, revision and opaque cursor while paging. If the group changes, reread and restart the page traversal. Mark unavailable members truthfully; their IDs can support membership removal but are not ready media for finishing.

For membership additions, resolve selected IDs through `get_asset`. Assets must be owned, ready, visible in Creative Assets and match the group's type. Catalog creator footage, combined/wall-text/reaction renders and hidden hook-only assets are excluded even when another workflow can retrieve them. Do not upload, duplicate or change an asset's collection to bypass this policy. For ordinary files and Demo registration, use [media management](../manage-ugc-media/SKILL.md).

## Apply the intended change

- `create_asset_group`: `request_id`, selected `name` (1–80 characters), `media_type`. Its request UUID is also the stable new group ID; creation does not create media.
- `rename_asset_group`: `request_id`, `group_id`, `expected_revision`, exact chosen `name`.
- `add_assets_to_group` / `remove_assets_from_group`: the same identity/revision fields and 1–100 distinct `asset_ids`. The full batch validates atomically; do not silently omit an invalid selection or claim partial success.
- `delete_asset_group`: the same identity/revision fields. Only perform an explicitly requested group deletion: it removes the group and membership, has no application undo, and preserves media files and other groups. Membership removal also preserves media.

Create, rename, add, and remove run directly. Only `delete_asset_group` returns a preview on the first call. Show the affected group and pass `confirm_token` only after an explicit yes. Membership removal preserves the media files.

Before each intentional mutation, save a fresh random UUID and the exact inputs in the conversation and a non-secret workspace record when possible. Sequential changes use the current revision after each preceding accepted change. On `GROUP_CONFLICT`, recover the saved request first and read current state; do not advance the revision or change the UUID merely to force an old intent over newer website edits. A newly reconciled change is a new intentional operation.

## Recover and report

Use `get_asset_group_request` with the saved `request_id`, or `list_asset_group_requests` to discover lost accepted IDs. These reads remain useful when new writes are disabled. Receipts are immutable historical results, not the current membership: use `get_asset_group` for current state when `group_exists` is true. A later deletion is not evidence that the original change failed. If no accepted receipt is confirmed after an interrupted submission, replay only the saved identical inputs and UUID when the gate permits; do not create a duplicate group with a fresh key.

Report the actual receipt and current state, including disabled writes, unavailable members and revision conflicts. Organizing a group does not render, schedule or publish media.
