# Plugin account release and host readiness — 12 October 2026

## Saved private account release

The existing [UGC Pilot plugin](https://chatgpt.com/plugins/plugins_6ac5dfae127081919c929c4fdfe29b1c) was updated through the supported account plugin update tool, guarded by its previous release ID. No duplicate plugin was created.

- Plugin: `plugins_6ac5dfae127081919c929c4fdfe29b1c`.
- Previous version/release: `0.1.2` / `pluginrel_6ac8fd3c061481919b2f985b6508282a`.
- Saved version/current release: `0.1.8` / `pluginrel_6accc0e282348191b1b13d8523229cd9`.
- Scope/audience: USER / PRIVATE, unchanged.
- Fourteen text files overlaid; four added; 35 resulting files, ten skill entrypoints.
- Account update overlay SHA-256: `1d8d0064ca8b110c6df4c440219db9b7348f14a006f28c9fef25ce7d691fd3e1`.

The complete saved inventory and all 34 UTF-8 files were read back from the same new release. Overlay bytes and unchanged text were compared. Existing publisher/author, starter prompt value/type/order, MCP connection configurations, original review cases and creative instructions were preserved. Account publisher metadata remains distinct from the public package's publisher. The logo was omitted from the overlay and retained at the same inventory path/size; a fresh binary hash was not read. The overlay is for this existing account release, not a standalone Claude installation archive.

The public 0.1.8 package is unchanged: 104,319 bytes, SHA-256 `f22ceea7f435d9baa73b24b70aa977629d29a6408058530e6d62d7e59188322c`. Production package/release checks are recorded in [private-upload release evidence](mcp-private-upload-2026-10-12.md).

## Codex native acceptance

The current desktop cache now contains the ten 0.1.8 skills and this chat exposes all 33 tools. Native `get_profile`, `get_entitlements`, `get_capabilities` and `get_edit_export_capabilities` succeeded through the existing OAuth connection. Image/video generation and dedicated Edit export reported available. These are read-only account/capability calls, not render acceptance. No account identifiers, credentials or balances need to be committed to demonstrate the check.

## Claude Code installation

Claude Code 2.1.76 installed the reviewed public 0.1.8 package through supported local marketplace/plugin commands with user scope:

- ID: `ugc-pilot@ugc-pilot-private-beta`, enabled, version 0.1.8.
- Normal install path: `C:\Users\chund\.claude\plugins\cache\ugc-pilot-private-beta\ugc-pilot\0.1.8`.
- Remote HTTP endpoint: `https://mcp.getugcpilot.com/mcp`.
- All 35 installed file hashes match the reviewed public archive; ten skills present; installed transfer helper passes `node --check`.
- Node 24.13.1 and ffprobe 8.1 were found on the host.

At installation readback, Claude Code was signed out and `claude mcp list` reported Failed to connect for the plugin server. That initial generic status alone did not diagnose its cause. A subsequent normal CLI readback confirmed the plugin remains installed/enabled at 0.1.8, Claude Code is still signed out, and MCP now reports Needs authentication. Claude Code account login, normal UGC OAuth and real tool execution remain pending; connecting Claude.ai does not authenticate the CLI.

## Claude.ai discovery

The user completed normal Claude.ai connector OAuth. The connector page was inspected in the user's existing browser tab: Disconnect is available, the endpoint is correct, and the catalogue contains 19 read-only plus 14 write/delete tools. New saved Edit/export tools are listed. Approval requirements were left unchanged.

Claude.ai catalogue discovery is confirmed. Successful tool execution in Claude.ai is still pending; the user was given a read-only profile/capability/export-capability prompt. No Claude prompt was submitted by this agent and no account data was copied between clients. Browser Claude.ai cannot itself run the local Node/ffprobe transfer helper; the IDE/local-file goal requires a host with supported local file/process access, such as Claude Code.

## Acceptance boundary

No customer upload, generation, draft creation/edit, export, subtitle job, cancellation/retry, publishing or deletion was submitted for these checks. Private upload creation remains disabled. The complete hook → demo → finished local download journey in both IDE hosts and the remaining application adapters are still unfinished. See [remaining-work audit](mcp-remaining-work-audit-2026-10-11.md).
