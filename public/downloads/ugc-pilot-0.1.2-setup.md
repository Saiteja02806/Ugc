# UGC Pilot private beta — 0.1.2 candidate

Draft UGC copy and video prompts in ordinary language, then use your connected UGC Pilot account when you ask to generate media. This package includes eight skills: the existing connection, generation and media-library workflows plus five creative workflows.

The package points to the existing hosted MCP at **https://mcp.getugcpilot.com/mcp**. It includes no server executable, credentials, or automatic installation script. Generation uses your UGC Pilot plan and credits, separately from your AI subscription.

## Install and sign in

- **Codex:** use Settings → MCP servers → Add server, choose Streamable HTTP, and paste the endpoint. Select Authenticate, sign into your UGC Pilot account, approve access, and restart the connection. To install the workflow skills as well, use the private plugin link supplied with this beta or your trusted plugin source.
- **Claude web / Desktop:** use Customize → Connectors → Add custom connector, paste the endpoint, finish OAuth, and enable it in the conversation. Organization policies may require administrator setup.
- **Claude Code:** extract this folder and evaluate with `claude --plugin-dir /absolute/path/to/ugc-pilot`. Complete OAuth through `/mcp`. Marketplace installation is a separate distribution step.
- **ChatGPT:** install the actual private plugin link supplied with the beta and connect when prompted. Developer mode offers a manual MCP connection for eligible accounts. A public directory listing has not been released.

For exact CLI commands and troubleshooting, read [client setup](#client-setup). Reading or uploading this ZIP in a web chat alone does not install an MCP connection.

The host must load this skill package for the five creative workflows to be discoverable. Adding the MCP URL alone connects the tools; it does not install these local Markdown skills. A web-client connector and a plugin directory listing are separate distribution paths. This local candidate has not been uploaded or approved for a public directory, and existing installed/cached versions need an explicit update before they gain the new skills.

## Creative requests

| Say this | Skill and result |
| --- | --- |
| “Give me hook text based on my business.” | Hook Intelligence: short overlay words |
| “Give me a prompt for hook video generation.” | Emotion Hook Director: a timed footage prompt |
| “Give me the wall of text for my video.” | Wall Text Generation: a business-specific paragraph/list |
| “Give me a video prompt for this wall of text.” | Wall Text Video Generation: clean footage direction with unchanged overlay words |
| “Write a four-slide slideshow.” | UGC Native Slideshow: copy, sequence and visual intentions |
| “Generate the actual video.” | Create UGC Media: current capabilities, cost checks, submission and retrieval |

The AI selects skills by deliverable and context, not fixed command keywords. Copy plus prompt requests can run both steps; selected copy remains unchanged. It reuses your brief or, when relevant and connected, reads your business profile. Drafting alone does not submit a paid generation. Slideshow JSON is a semantic content plan, not the existing application Carousel worker contract. Exact text composition and slide rendering need separate tools.

## Try it

1. “Use UGC Pilot to check my account, credits, and available generation options. Do not generate anything.”
2. “Use UGC Pilot to generate one vertical product image of my skincare bottle on a bathroom shelf.”
3. “Animate that image into one five-second vertical video with a slow camera push-in. Return the finished video link.”
4. “Check the progress of the UGC Pilot job we already started. Do not create a new generation.”

The current MCP supports account/brand reads, image/video library access, uploads/deletion, image generation, short-video generation, and job polling. Counts are 1, 2, or 4; clips are 3–10 seconds and prompts are limited to 1,000 characters. Ask the AI to check live capabilities before spending credits. Exact overlays, slideshow rendering, audio generation, scheduling and publishing are not included in the MCP.

## Verification status

Package/schema validation and offline behavior checks are independent from installed-host activation. Fresh-account OAuth, installed skill behavior, paid generation through each target host and media previews must pass before customer rollout. See the bundled evaluation-cases.json for pending acceptance scenarios; expected routes are criteria, not recorded passes. A demo recording and platform approval remain separate requirements.


---

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

If a private UGC Pilot plugin link has been supplied, install it and connect when prompted. This bundle does not include an install link. A public-directory listing is a separate reviewed release; do not claim one exists.

For developers with developer mode enabled, the current documented path is Settings → Security and login → Developer mode, then Plugins → plus → add the MCP URL. Create the personal connection, authenticate, and install it. Availability may depend on account and workspace policy. Follow the current UI rather than promising every account has developer mode.

Uploading this Markdown guide or a ZIP to an ordinary web conversation does not install a connector. If the host lacks a supported installation path, explain that limitation and offer the manual connector steps.

## Public distribution

The same hosted MCP serves each user's own account through OAuth. OpenAI's plugin submission portal accepts the bundle and MCP endpoint for review; an approved, published directory listing provides the customer install link. Claude requires a separate developer submission for its connector or GitHub-hosted plugin bundle. The ZIP download is useful for supported local plugin installation and review preparation; it does not create either public listing.

Public review is still pending. Publisher/domain verification, installed-client acceptance, a reviewer-accessible walkthrough, and secure reviewer access must be completed before announcing public availability. Never put reviewer passwords, OAuth tokens, or publisher credentials in the bundle.

## First prompt

“Use UGC Pilot to check my connection, plan, credits, and available generation options. Do not generate anything yet.”

## Sources

- https://learn.chatgpt.com/docs/extend/mcp
- https://developers.openai.com/plugins/quickstart
- https://developers.openai.com/plugins/deploy/submission
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://claude.com/resources/articles/build-plugins-for-claude
- https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- https://code.claude.com/docs/en/mcp
