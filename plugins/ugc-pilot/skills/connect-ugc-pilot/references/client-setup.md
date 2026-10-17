# Client setup

Endpoint: `https://mcp.getugcpilot.com/mcp`. Transport: Streamable HTTP. Authentication: per-user OAuth with PKCE. Do not put bearer tokens or secrets into configuration examples.

## Codex desktop / CLI

In Settings → MCP servers, add `ugc-pilot` with Streamable HTTP and the endpoint above. Save, restart the connection, then select Authenticate. Exact labels can differ by client version.

Alternatively, with the user's authorization to add this server, run:

```sh
codex mcp add ugc-pilot --url https://mcp.getugcpilot.com/mcp
codex mcp login ugc-pilot --scopes account:read,brand:read,assets:read,assets:write,generation:write,jobs:read,creative:write,jobs:write
```

The add command may already offer OAuth; use login only if sign-in is still needed. Reuse a correct existing entry. If it points elsewhere, explain the mismatch before replacing it. Start a new session after installation if tools are not discovered. A local MCP config does not automatically connect ChatGPT web.

### Load the bundled skills locally

This repository includes `.agents/plugins/marketplace.json` with `authentication: "ON_INSTALL"` for the local UGC Pilot package. Add the checkout root as a marketplace, then install it:

```sh
codex plugin marketplace add /absolute/path/to/UGC
codex plugin add ugc-pilot@ugc-pilot-local
```

A noninteractive install reports the policy but cannot complete a browser sign-in. Start a new interactive Codex chat to complete normal OAuth before using protected tools. For a different supported repository marketplace, copy the extracted `ugc-pilot` folder into your workspace's `plugins/` directory and add an entry to `.agents/plugins/marketplace.json` at that workspace root (merge with an existing catalogue rather than replacing it):

```json
{
  "name": "ugc-pilot-local",
  "plugins": [
    {
      "name": "ugc-pilot",
      "source": { "source": "local", "path": "./plugins/ugc-pilot" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "interface": { "displayName": "UGC Pilot" }
    }
  ]
}
```

The source path resolves from the workspace root. Restart the desktop app through its normal UI, then choose this local source in the Plugins Directory and install/update UGC Pilot. Host support and organization policy can differ; do not claim installation from a file copy alone. Verify that the Edit skill and transfer helper load and a read-only tool succeeds. If the plugin already supplies a working MCP connection, reuse it instead of adding another copy.

## Claude Code

Install the supplied Claude-compatible plugin through a trusted local source or marketplace. For local evaluation, use `claude --plugin-dir /absolute/path/to/ugc-pilot`; run `/mcp` to complete OAuth. Do not also add the same MCP separately unless the plugin connection is unavailable, to avoid duplicate tools.

The direct alternative is:

```sh
claude mcp add --transport http ugc-pilot https://mcp.getugcpilot.com/mcp
```

Authenticate using `/mcp`. Local configuration and web connectors are separate installation mechanisms.

## Claude web / Desktop

Use Customize → Connectors → Add custom connector. Enter UGC Pilot and the endpoint. Follow the OAuth sign-in flow, then enable the connector in the conversation. A Team or Enterprise administrator may need to add the connector first. Use the platform's detected OAuth settings; do not use a shared API key. If the published-client strategy fails, inspect the error before trying the supported automatic-registration alternative.

## ChatGPT web

After public-directory approval, install UGC Pilot from the ChatGPT/Codex directory and connect when prompted. This bundle does not include a public install link because directory review is still pending. Until approval, use only a permitted private or workspace installation path.

Where custom connections are available, go to ChatGPT Plugins → plus → Add custom MCP server, enter the endpoint and finish the normal OAuth flow. Availability depends on account and workspace policy. Follow the current client UI; do not promise every account has the same setup options.

Uploading this Markdown guide or a ZIP to an ordinary web conversation does not install a connector. If the host lacks a supported installation path, explain that limitation and offer the manual connector steps.

## Package updates and tool refresh

Extract a new version into a fresh folder so the older bundle remains available. In Claude Code, restart with `claude --plugin-dir /absolute/path/to/ugc-pilot` pointing to the new folder and use `/mcp` to check the connection. In Codex, update the same `ugc-pilot` plugin through its supported local source or Plugins Directory flow; a repository/personal marketplace can point at the extracted folder. Do not edit installed cache files or create duplicate server entries to force an update. Follow the host's supported refresh/restart flow, then verify discovered tools in a new session when necessary.

Adding the MCP endpoint connects server tools; loading the package adds its skills and local helper. Neither step proves both are active. The reviewed 0.2.3 candidate catalog contains 83 tools; the deployed server and older active conversations can retain an earlier catalog until promotion or refresh. Discovery and live capabilities decide availability. The existing Edit surface includes `open_edit_draft`, `update_edit_draft`, `get_edit_export_capabilities`, `export_edit_draft` and `get_edit_export`. If discovery is stale, refresh the connection through the client. Reauthenticate only for expired sign-in or a missing requested scope. An existing `creative:write` grant covers the Edit tools. Account-default updates separately need `account:write`; schedule and connected-social-account reads separately need `publishing:read`. Those scheduling reads cannot publish, schedule, edit, cancel, retry or connect a provider. An older media-only consent does not expand automatically. Do not generate media or change a draft just to check discovery.

The local transfer helper needs Node.js 22+, ffprobe and a host process API that can pass ephemeral JSON on stdin. A browser-only connector cannot read an IDE file path. Use the bundled local transfer reference after the package is loaded.

## Public distribution

The same hosted MCP serves each user's own account through OAuth. OpenAI's plugin submission portal accepts the bundle and MCP endpoint for review; an approved, published directory listing provides the customer install link. Claude requires a separate developer submission for its connector or GitHub-hosted plugin bundle. The ZIP download is useful for supported local plugin installation and review preparation; it does not create either public listing.

Public review is still pending. Publisher/domain verification, installed-client acceptance, a reviewer-accessible walkthrough, and secure reviewer access must be completed before announcing public availability. The ChatGPT/Codex public directory and the Claude connector or Marketplace each have separate platform approvals. Never put reviewer passwords, OAuth tokens, or publisher credentials in the bundle.

## First prompt

“Use UGC Pilot to check my connection, plan, credits, and available generation options. Do not generate anything yet.”

## Sources

- https://learn.chatgpt.com/docs/extend/mcp
- https://developers.openai.com/plugins/quickstart
- https://developers.openai.com/plugins/build/plugins
- https://code.claude.com/docs/en/plugins
- https://developers.openai.com/plugins/deploy/submission
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://claude.com/resources/articles/build-plugins-for-claude
- https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- https://code.claude.com/docs/en/mcp
