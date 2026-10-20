---
name: manage-ugc-library
description: Browse UGC Pilot saved Carousel/slideshow Library entries, save selected completed outputs, archive entries, and recover Library requests through MCP. Does not render slideshow text.
---

# Manage the application Library

Discover `get_library_capabilities`. Reads require `assets:read`, writes `assets:write` and the live Library gate; slideshow saving has an additional gate. Storage configuration or catalogue discovery alone does not prove schema rollout. This is the application's saved Carousel/slideshow Library, distinct from generic media, Demo records and [Creative Asset groups](../manage-ugc-groups/SKILL.md).

## Browse actual saved entries

Use `list_library_items` with the user's project/filter selection and opaque cursor, then `get_library_item` for the selected `item_id`. Preserve returned ordered slides. Library `item_id`, Carousel generation IDs, reference IDs and media `asset_id` are different identities; do not pass Library IDs or arbitrary rendered URLs to a media mutation. `include_removed` exposes archived metadata when requested, not restored content. Current state includes `revision`, `status` and `deleted_at`.

## Save a completed Carousel

Discover owned sources with `list_carousel_library_sources`. Select the requested `carousel_id`, then call `inspect_carousel_library_save`. A completed generation is insufficient: its latest edit must also be fully rendered and ready. Do not fall back to the original slides when a newer edit is pending, failed or incomplete.

For an intended save, persist a random `request_id`, the chosen `carousel_id`, returned `source_revision` AND `destination_revision`, and `allow_recreate_removed` before `save_carousel_to_library`. Saving refreshes an existing Library snapshot, so preserve the user's chosen source and inspect the existing destination. Keep `allow_recreate_removed: false` unless the user explicitly intends to recreate an archived save. A revision conflict requires recovery and current inspection, not changing revisions on replay to overwrite intervening edits.

## Save an already rendered slideshow

`save_slideshow_to_library` accepts `request_id`, optional catalogue `reference_id` (null for no reference), and 2–10 ordered `slides: [{position_id, asset_id}]`. Preserve exact slide order and distinct chosen position identities; verify each actual media ID through `get_asset` as an owned ready raster output. A catalogue reference guides the save; its images do not silently become selected outputs.

This tool saves existing rendered images. It cannot render headings, body text, layout or copy JSON onto raw images. If the user's deliverable needs visible text, do not save text-free images and call it complete. Report the missing backend slideshow-text renderer and preserve the intended content. [Slideshow copy](../ugc-native-slideshow/SKILL.md) is a content plan, not a rendered artifact.

## Archive and recover

For an explicitly requested archive, read the selected entry then save a random UUID and `{request_id, item_id, expected_revision}` before `remove_library_item`. Removal matches the application's metadata archive and preserves source media and slide files. It does not cancel scheduled posts; existing scheduling restrictions remain authoritative. Do not broaden an entry removal into deleting assets or cancelling publication.

After an interrupted save/removal, use `get_library_request`, or `list_library_requests` to recover a lost accepted identity. A receipt's `state` is historical; use `get_library_item` for current state. If no accepted receipt is confirmed, replay only the original UUID and exact inputs when writes permit. Do not allocate another slideshow save merely because a response was lost. Different/reconciled user intent uses a new operation after recovery.

Report the real saved entry and ordered outputs or actual disabled/conflicting state. A Library save does not generate media, schedule or publish anything.
