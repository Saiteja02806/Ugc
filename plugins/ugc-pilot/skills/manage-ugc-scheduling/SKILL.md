---
name: manage-ugc-scheduling
description: Inspect connected UGC Pilot social-account labels, connection health, and existing schedule delivery state through MCP. It cannot connect accounts, create or change schedules, or publish posts.
---

# Inspect social accounts and schedules

Start with `get_scheduling_capabilities`. It requires `account:read`, performs no data write, and reports whether this deployment is configured for scheduling reads. If it reports unavailable, say so without trying a website route, provider API, storage credential or another account.

## Read only after the user requests it

`list_social_connections`, `list_schedules`, and `get_schedule` require the separate `publishing:read` OAuth grant. Existing `assets:write`, `creative:write`, generation permission, or account-default permission does not imply it. When the grant is missing, use the normal client reauthorization flow only for the requested read; never ask for an OAuth token or a provider password in chat.

Use `list_social_connections` to show connected platform labels and their connection health. It deliberately excludes OAuth tokens, provider account IDs, grant scopes, scheduler identifiers and provider-only settings.

Use `list_schedules` to inspect the connected account's existing schedules. Prefer a narrow `from`/`to` ISO date range when the user asks about a period, and preserve the returned schedule and target identities. `get_schedule` reads a specifically selected `schedule_id`. A schedule ID, Library item ID, asset ID and social-connection ID are separate identities; do not substitute one for another.

The returned target status can explain whether a post is scheduled, published, retrying or failed. Present it as current delivery state. A failed status does not authorize an unreviewed retry or provider call.

## Current boundary

This workflow has no social-provider OAuth connection flow and no write operation. Do not claim that it can create, edit, cancel, retry, reschedule or publish a post. `publishing:write` is reserved for a later reviewed implementation and gives no current MCP tool.

If the user requests a change, show the selected existing state and explain that the agent must not change it yet. Do not bypass the boundary through application endpoints, direct provider APIs or hidden metadata. Report unavailable configuration, missing consent and `NOT_FOUND` ownership results truthfully.
