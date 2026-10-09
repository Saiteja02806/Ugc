---
name: create-ugc-media
description: Generate images or short videos through the connected UGC Pilot account, including animating an owned image and retrieving completed results.
---

# Create UGC Pilot media

Use the connected UGC Pilot tools. If absent, explain the connection step; do not substitute another provider and call its output UGC Pilot media. Use tool discovery and `get_capabilities` as the current contract.

## Prepare the requested generation

- Call `get_entitlements` and `get_capabilities` before a new generation to check access, supported settings, and cost. Report the estimated cost using `image_credit_cost × count` or `video_credits_per_second × duration_seconds × count`. Compare it with `credits_remaining`; reserved credits are not additional spendable credits. Preserve the user's existing authorization for the requested generation, including any budget. Ask only when the content, cost, or scope remains materially unclear.
- Retrieve `get_saas_brand` when the user wants brand-specific content. Ground product claims in that profile or user-supplied facts. If the profile is absent, ask for the relevant facts or proceed with an explicitly generic creative brief.
- Resolve the intended aspect ratio, count, and video duration. V1 supports counts of 1, 2, or 4; video duration is a whole number from 3 through 10 seconds. Do not silently turn three requested outputs into four or a long video into a short clip. Ask how the user wants to proceed. The server's currently discovered settings take precedence over these V1 defaults.
- References must be ready, owned image assets. Use `list_assets` and `get_asset` to identify and validate the intended image. Only one image reference is supported. Raw external URLs, video references, creator IDs, and model selection are not accepted generation inputs. If the user supplied a new file, upload it through the supported upload tools only when the host can PUT its bytes and confirm it; otherwise ask them to upload it to the UGC Pilot library and select it there.

## Submit once

Use `generate_image` with `prompt`, `aspect_ratio`, `count`, optional `reference_asset_id`, and `client_request_id`. The image prompt limit is 2,000 characters.

Use `generate_video` with the same fields and explicit `duration_seconds`. Its prompt limit is 1,000 characters. The reference is an optional owned image to animate. This generates a short clip; it does not provide a creator marketplace, voiceover editor, complete long-form video workflow, carousel, or social publishing.

Create a fresh random `client_request_id` for each intentional generation. Keep that ID and the exact input with the returned job IDs in the conversation. Never use the same request ID for a changed prompt, reference, duration, or count. After a transport failure with an uncertain outcome, retry the exact same input and request ID so the server can return existing jobs. Do not change the ID to bypass a conflict or charge twice. For `partial: true`, track all accepted jobs; if completing the original batch is still authorized, retry only the same original request and ID.

## Retrieve the result

Poll each returned ID using `get_job`, with increasing waits around 5, 10, then 20 seconds where the host supports waiting. Avoid tight polling. Check completion within a bounded time, approximately two minutes per turn; for unfinished work, return job IDs and progress so the user can resume. Do not claim an autonomous future notification unless the host actually supports it and the user requested it.

For `completed`, call `get_asset` for each `output_asset_ids` entry and return the actual URL with useful format/duration details. An accepted or queued receipt is not a finished result. Show media with the host's supported preview when available; otherwise link the usable URL. Do not claim it was downloaded locally unless it was.

If a job failed, stalled, or was cancelled, report the returned error and current status. Resume/poll existing work before considering a new paid generation. Do not automatically create a new charge after a terminal failure. Handle authentication/scope errors through reauthorization; insufficient credits require the user to change their budget or account plan. Do not alter billing or queue infrastructure.

For image → video requests, finish and retrieve the image first, then pass its asset ID to `generate_video`. Estimate the combined cost before beginning when both generations are requested.
