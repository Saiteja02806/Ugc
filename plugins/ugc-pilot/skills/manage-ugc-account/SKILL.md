---
name: manage-ugc-account
description: Read UGC Pilot account publishing defaults and persisted timezone, update requested defaults, initialize an unset timezone, and recover accepted settings changes through MCP. Does not publish or reschedule posts.
---

# Manage account defaults

Use discovered `get_account_settings_capabilities` and `get_account_settings`. Reads require `account:read` and never initialize settings. A package update does not activate the account-settings write gate or apply its schema. Account defaults use the same application records; Business Context, logos, screenshots, billing and social connections are separate workflows.

## Review and change requested defaults

`get_account_settings` returns the six `publishing_preferences` fields and separate opaque `publishing_revision` and `timezone_revision` values. Publishing defaults cover AI disclosure, TikTok privacy/comments and YouTube visibility, audience and subscriber notifications. They initialize future posts; they do not change saved schedules, override selected social-account restrictions, publish a post or grant new platform permissions.

When the user requests a change, check `write_enabled` and require the separate `account:write` OAuth grant. Existing `assets:write`, `creative:write` or generation permission does not cover account settings. Use normal OAuth reauthorization only after that scope is deployed and needed for the task; [connection setup](../connect-ugc-pilot/SKILL.md) explains the client boundary.

Call `update_publishing_preferences` with a fresh random `request_id`, the exact saved `publishing_revision` as `expected_revision`, and only the selected `preferences` fields. Preference names use the website's camelCase schema: `containsSyntheticMedia`, `tiktokPrivacyLevel`, `tiktokAllowComments`, `youtubePrivacyStatus`, `youtubeMadeForKids`, `youtubeNotifySubscribers`. Read the discovered schema for enum values. Omitted fields are preserved; do not reset other choices to defaults or change disclosure/audience to resolve an unrelated failure.

## Initialize a timezone only when intended

The application's account-timezone policy is initialize once. An unset timezone is null, not an implicit saved UTC value. For requested first initialization, use `initialize_account_timezone` with the user's selected valid IANA `timezone`, fresh `request_id`, and saved `timezone_revision` as `expected_revision`. Do not infer a requested write from the IDE/device timezone or from a connection check.

An already initialized timezone is preserved even if a different one is supplied. `initialized: false` with an existing timezone is not successful replacement. If the task requires changing that existing account timezone, report the unsupported operation rather than claiming success, modifying a business profile to bypass it, or rescheduling posts.

## Preserve and recover accepted changes

Persist each UUID and exact normalized inputs in the conversation and a non-secret workspace record before submitting. On lost response, use `get_account_settings_request`, or `list_account_settings_requests` to recover a lost accepted ID. Receipts are immutable historical state; use `get_account_settings` to see current website choices. Recovery reads remain available when writes are disabled.

If no accepted receipt is confirmed, replay only the saved UUID and identical inputs when new writes permit. A settings conflict needs recovery, a fresh current read and reconciliation of the user's intended change. Do not merely replace `expected_revision` or allocate another UUID to force old inputs over intervening website changes. A newly reconciled intent is a new operation.

Report the actual accepted/current values, including unavailable schema, missing consent, disabled gate, stale revision or retained timezone. These tools neither generate media nor publish it.
