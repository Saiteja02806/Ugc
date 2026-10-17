---
name: connect-ugc-pilot
description: Connect or troubleshoot the UGC Pilot MCP in a supported AI client, and check the connected account, plan, credits, and capabilities without generating media.
---

# Connect UGC Pilot

Use the hosted Streamable HTTP endpoint `https://mcp.getugcpilot.com/mcp`. The server already exists; do not deploy a replacement, change its hosting, or request infrastructure credentials.

Look for the installed UGC Pilot MCP tools. If unavailable, read [client setup](references/client-setup.md) and use the setup path for the user's actual client. Installing a package, uploading instructions to chat, and completing OAuth are different steps. Do not claim a connection works until a read-only call succeeds. Obtain permission before modifying local client configuration; use the user's existing approval when it clearly covers installation.

Let the user complete sign-in and OAuth approval in the provider's sign-in UI. Do not extract credentials, copy another account's tokens, or ask for passwords in chat. Full generation workflows need `account:read`, `assets:read`, `generation:write`, and `jobs:read`. Brand lookup also needs `brand:read`; upload and deletion need `assets:write`. Video finishing separately requires `creative:write`; existing tokens do not gain it automatically. Job history needs `jobs:read`; cancellation and supported retry separately require `jobs:write`. Existing tokens do not gain new permissions automatically. Request the permissions needed for the task.

Once tools are available:

1. Call `get_profile` to identify the connected account. It returns an account ID, not an email address. When the account needs confirmation, have the user check it in the consent UI.
2. Call `get_entitlements` and report plan/access, spendable credits, reserved credits, and generation costs returned by the server.
3. Call `get_capabilities` and report the actual available formats, durations, and counts.

For demo composition, check `get_video_finishing_capabilities` when discovered. For the dedicated Edit-page export, check `get_edit_export_capabilities`. Both are read-only. For audio check discovered `get_audio_capabilities` without generating a sample or verifying a voice; its generation/upload/download/import flags are separate. Audio reads/preferences/import reuse their discovered account/assets/jobs scopes; speech generation uses `generation:write`. Draft listing/reading uses `assets:read`; opening/saving/export uses the existing `creative:write`, and export status uses `jobs:read`. Tool catalogue refresh alone does not require new consent when those permissions were already approved.

For requested application reference/group/Library work, use discovered `get_reference_capabilities`, `get_asset_group_capabilities` or `get_library_capabilities`. These checks do not activate writes. Group/Library writes reuse `assets:write`; application remix creation needs both `generation:write` and `brand:read`. Library IDs, catalogue reference IDs and owned media IDs are distinct.

For account-default settings, check discovered `get_account_settings_capabilities` and follow [account defaults](../manage-ugc-account/SKILL.md). Writes need a distinct `account:write` grant; existing media/edit permissions do not cover them. Capability reads do not initialize timezone or activate writes.

For existing social-account and schedule state, check `get_scheduling_capabilities` and follow [scheduling reads](../manage-ugc-scheduling/SKILL.md). The three data reads need a distinct `publishing:read` grant. They do not connect social accounts or create, edit, cancel, retry, schedule or publish posts. `publishing:write` is reserved for a later reviewed adapter and grants no current tool.

A Codex, ChatGPT, or Claude subscription does not supply UGC Pilot generation credits. Check the UGC Pilot account's actual entitlements. This connection check is read-only; do not generate a sample unless the user requests generation.

For missing or expired authentication, reconnect through the client. For insufficient scope, reauthorize the affected permissions and refresh tool discovery. If `generate_video` is missing, refresh the connection rather than inventing a tool. Preserve account boundaries: inaccessible assets and jobs are not evidence that another account should be used.
