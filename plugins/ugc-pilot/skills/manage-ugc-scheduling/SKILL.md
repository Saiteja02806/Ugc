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

## Create one future schedule only when live capability permits it

`create_schedule` is available only when `get_scheduling_capabilities` reports `write_tools_available: true`. It separately requires `publishing:write`; do not infer permission from `publishing:read`. When the gate is disabled, report it and do not try an application endpoint or provider API.

Before a requested creation, read the selected source and social connections. Require a selected owned `media_asset` or saved `library_item`, one or more selected connection IDs, an explicit future ISO time, an IANA timezone, and a fresh saved UUID `request_id`. Keep the exact inputs and UUID in the conversation or a non-secret workspace record. On a lost response, replay only that same UUID and exact inputs; do not allocate another schedule or change the time/targets to work around a conflict.

The MCP token carries only a boolean verified-email snapshot captured during OAuth consent. It contains no email or Firebase bearer credential. Existing token families can be unverified until fresh consent after the identity migration, which can make TikTok/YouTube targets ineligible. Report that policy outcome instead of bypassing it. Instagram and the selected source still pass the application's normal ownership, readiness, entitlement and scheduling checks.

## Current boundary

This workflow has no social-provider OAuth connection flow. Do not claim that it can edit, cancel, retry, reschedule or publish a post. Do not bypass those boundaries through application endpoints, direct provider APIs or hidden metadata. Report unavailable configuration, missing consent, disabled writes and `NOT_FOUND` ownership results truthfully.
