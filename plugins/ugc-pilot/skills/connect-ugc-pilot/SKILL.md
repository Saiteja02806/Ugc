---
name: connect-ugc-pilot
description: Connect or troubleshoot the UGC Pilot MCP in a supported AI client, and check the connected account, plan, credits, and capabilities without generating media.
---

# Connect UGC Pilot

Use the hosted Streamable HTTP endpoint `https://mcp.getugcpilot.com/mcp`. The server already exists; do not deploy a replacement, change its hosting, or request infrastructure credentials.

Look for the installed UGC Pilot MCP tools. If unavailable, read [client setup](references/client-setup.md) and use the setup path for the user's actual client. Installing a package, uploading instructions to chat, and completing OAuth are different steps. Do not claim a connection works until a read-only call succeeds. Obtain permission before modifying local client configuration; use the user's existing approval when it clearly covers installation.

Let the user complete sign-in and OAuth approval in the provider's sign-in UI. Do not extract credentials, copy another account's tokens, or ask for passwords in chat. Full generation workflows need `account:read`, `assets:read`, `generation:write`, and `jobs:read`. Brand lookup also needs `brand:read`; upload and deletion need `assets:write`. The advertised full permission set includes all six.

Once tools are available:

1. Call `get_profile` to identify the connected account. It returns an account ID, not an email address. When the account needs confirmation, have the user check it in the consent UI.
2. Call `get_entitlements` and report plan/access, spendable credits, reserved credits, and generation costs returned by the server.
3. Call `get_capabilities` and report the actual available formats, durations, and counts.

A Codex, ChatGPT, or Claude subscription does not supply UGC Pilot generation credits. Check the UGC Pilot account's actual entitlements. This connection check is read-only; do not generate a sample unless the user requests generation.

For missing or expired authentication, reconnect through the client. For insufficient scope, reauthorize the affected permissions and refresh tool discovery. If `generate_video` is missing, refresh the connection rather than inventing a tool. Preserve account boundaries: inaccessible assets and jobs are not evidence that another account should be used.
