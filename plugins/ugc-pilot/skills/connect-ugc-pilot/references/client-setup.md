# Client setup

Endpoint: `https://mcp.getugcpilot.com/mcp`. Transport: Streamable HTTP. Authentication: per-user OAuth with PKCE. Do not put bearer tokens or secrets into configuration examples.

## Codex desktop / CLI

In Settings → MCP servers, add `ugc-pilot` with Streamable HTTP and the endpoint above. Save, restart the connection, then select Authenticate. Exact labels can differ by client version.

Alternatively, with the user's authorization to add this server, run:

```sh
codex mcp add ugc-pilot --url https://mcp.getugcpilot.com/mcp
codex mcp login ugc-pilot --scopes account:read,brand:read,assets:read,assets:write,generation:write,jobs:read
```

The add command may already offer OAuth; use login only if sign-in is still needed. Reuse a correct existing entry. If it points elsewhere, explain the mismatch before replacing it. Start a new session after installation if tools are not discovered. A local MCP config does not automatically connect ChatGPT web.

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

Install the private UGC Pilot plugin from its actual provided plugin link and connect when prompted. A public-directory listing is a separate reviewed release; do not claim one exists.

For developers with developer mode enabled, the current documented path is Settings → Security and login → Developer mode, then Plugins → plus → add the MCP URL. Create the personal connection, authenticate, and install it. Availability may depend on account and workspace policy. Follow the current UI rather than promising every account has developer mode.

Uploading this Markdown guide or a ZIP to an ordinary web conversation does not install a connector. If the host lacks a supported installation path, explain that limitation and offer the manual connector steps.

## First prompt

“Use UGC Pilot to check my connection, plan, credits, and available generation options. Do not generate anything yet.”

## Sources

- https://learn.chatgpt.com/docs/extend/mcp
- https://developers.openai.com/plugins/quickstart
- https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- https://code.claude.com/docs/en/mcp
