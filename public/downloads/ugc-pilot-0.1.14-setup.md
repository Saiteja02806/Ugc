# UGC Pilot private beta — 0.1.13 candidate

Draft UGC copy and video prompts in ordinary language, then use your connected UGC Pilot account when you ask to generate media. This package includes fifteen skills covering connection, generation, media transfer, five creative workflows, video finishing, shared Edit drafts/export, speech/private audio transfer, application references, Creative Asset groups, and saved Library outputs where enabled.

The package points to the existing hosted MCP at **https://mcp.getugcpilot.com/mcp**. It includes no server executable, credentials, or automatic installation script. Generation uses your UGC Pilot plan and credits, separately from your AI subscription.

Terminal-capable IDEs can use the bundled local transfer helper (`skills/manage-ugc-media/references/local-transfer.md` in the extracted bundle) to measure and upload actual hook/demo files, recover reservation from a saved intent and confirmation from a saved transfer receipt, and download completed media without overwriting existing files. It requires Node.js 22+ and ffprobe. Hosts without process/file access need their own transfer mechanism. The helper never handles account OAuth or submits generation.

## Install and sign in

- **Codex:** use Settings → MCP servers → Add server, choose Streamable HTTP, and paste the endpoint. Select Authenticate, sign into your UGC Pilot account, approve access, and restart the connection. To load the workflow skills and helper, follow the repository marketplace example in the client setup guide, or update the plugin through your trusted installed source.
- **Claude web / Desktop:** use Customize → Connectors → Add custom connector, paste the endpoint, finish OAuth, and enable it in the conversation. Organization policies may require administrator setup.
- **Claude Code:** extract this folder and evaluate with `claude --plugin-dir /absolute/path/to/ugc-pilot`. Complete OAuth through `/mcp`. Marketplace installation is a separate distribution step.
- **ChatGPT:** install the actual private plugin link supplied with the beta and connect when prompted. Developer mode offers a manual MCP connection for eligible accounts. A public directory listing has not been released.

For exact CLI commands and troubleshooting, read [client setup](#client-setup). Reading or uploading this ZIP in a web chat alone does not install an MCP connection.

The host must load this skill package for the five creative workflows to be discoverable. Adding the MCP URL alone connects the tools; it does not install these local Markdown skills. A web-client connector and a plugin directory listing are separate distribution paths. This package has not been approved for a public directory, and existing installed/cached versions need an explicit update before they gain the new skills.

## Creative requests

| Say this | Skill and result |
| --- | --- |
| “Give me hook text based on my business.” | Hook Intelligence: short overlay words |
| “Give me a prompt for hook video generation.” | Emotion Hook Director: a timed footage prompt |
| “Give me the wall of text for my video.” | Wall Text Generation: a business-specific paragraph/list |
| “Give me a video prompt for this wall of text.” | Wall Text Video Generation: clean footage direction with unchanged overlay words |
| “Write a four-slide slideshow.” | UGC Native Slideshow: copy, sequence and visual intentions |
| “Generate the actual video.” | Create UGC Media: current capabilities, cost checks, submission and retrieval |
| “Upload my hook and demo, attach them, and finish the video.” | Finish UGC Video: local transfer, owned clip preparation, composition and output retrieval where enabled |
| “Open this video in Edit, trim it, save my text, and export it.” | Edit UGC Draft: the same saved draft as the application, revision-safe changes and dedicated export where enabled |

The AI selects skills by deliverable and context, not fixed command keywords. Copy plus prompt requests can run both steps; selected copy remains unchanged. It reuses your brief or, when relevant and connected, reads your business profile. Drafting alone does not submit a paid generation. Slideshow JSON is a semantic content plan, not the existing application Carousel worker contract. Exact video text and demo composition use the separately gated finishing tools. Slide rendering still needs separate tools.

## Application references, groups and Library

- “Browse hook references and show their reviewed text.” Use the reference workflow (`skills/remix-ugc-reference/SKILL.md` in the extracted bundle); creating an application remix is a separate requested action with provider/quota access.
- “Show my image groups and organize these selected Creative Assets.” Use the group workflow (`skills/manage-ugc-groups/SKILL.md` in the extracted bundle) with current revisions and eligible owned media.
- “Save this completed Carousel, or these already rendered slides, to my Library.” Use the Library workflow (`skills/manage-ugc-library/SKILL.md` in the extracted bundle). Saving slides does not render missing text.

Each workflow checks live capabilities. Reference remix, group and Library writes are disabled in the current production release; reads and existing receipt recovery are separate. Do not enable rollout flags or silently substitute another workflow. A published package, discovered tool, and successful installed-host execution are different evidence.

## Account defaults where deployed

Use the account workflow (`skills/manage-ugc-account/SKILL.md` in the extracted bundle) for publishing defaults, unset timezone initialization and settings receipts. These tools require the additive account-settings migration; writes also require the separate `account:write` consent and write gate. Reads never initialize preferences. Existing scheduled posts and initialized timezones are preserved. Use the Business Context workflow (`skills/manage-ugc-business/SKILL.md` in the extracted bundle) to read and edit the shared Settings draft or apply reviewed context for future content. Writes separately require deployed schema, an enabled gate and fresh `brand:write` consent. Use the business onboarding workflow (`skills/onboard-ugc-business/SKILL.md` in the extracted bundle) to resume saved legacy/background setup, choose a website/manual/mobile source, save identity/goals and submit intended setup where its separate write gate is enabled. Read capabilities first; completion can activate access/trial and prepare Trending content. Dedicated logo upload, screenshots, website reanalysis and social-account operations remain separate work.

## Try it

1. “Use UGC Pilot to check my account, credits, and available generation options. Do not generate anything.”
2. “Use UGC Pilot to generate one vertical product image of my skincare bottle on a bathroom shelf.”
3. “Animate that image into one five-second vertical video with a slow camera push-in. Return the finished video link.”
4. “Check the progress of the UGC Pilot job we already started. Do not create a new generation.”

The released server contract contains **79 tools**. Business Context PR #51 is a separate **85**-tool candidate. This onboarding candidate registers **90** after its server/schema release; hosted acceptance remains pending. Existing conversations can retain an older cached catalogue. Tool discovery and live capability checks are authoritative; installing this package does not enable server features or refresh a cached catalogue.

- Account/brand reads, owned visual media, image generation and short-video generation. Counts are 1, 2 or 4; clips are 3–10 seconds and prompts have a 1,000-character limit. Check live costs and options before generation.
- Owned Demo registration/list/get/delete, upload reservation lookup/list/renewal, and server probing before readiness. The helper preserves reservation intent and transfer confirmation separately.
- Video finishing: exact text, supported trims/volumes/framing, demo composition and optional supported subtitles. These use the deployed finishing capability gates and `creative:write`; subtitles can incur a separate cost.
- Owner-scoped operation history and supported cancellation/retry. Writes require `jobs:write`, the exact operation revision and a stable request UUID. Retry can reserve credits under the original plan; replay recovers the accepted action.
- Shared Edit-page opening, listing, reading and revision-safe saving, plus dedicated export capabilities/submission/status. Save/open do not render. Export snapshots a saved revision using the website's renderer. See Edit workflow (`skills/edit-ugc-draft/SKILL.md` in the extracted bundle). Preserve the dedicated export UUID; `get_operation` can recover `edit_export_request_id` when discovered.

Full application parity remains unfinished. Explore/slideshow working drafts, slideshow rendering, voice sample/clone/verification/removal and default music, advanced generation/character choices, business settings, further Trending/Carousel actions, social publishing and analytics require additional implementation. Private-media upload support is a separately gated server rollout. It requires a verified separate private bucket and its signing/read/cleanup configuration; the helper validates the server's explicit bucket descriptor and never bypasses unavailable storage.

## Verification status

The existing-media trim → demo composition → actual local download passed in Codex on 13 October 2026 using the released 0.1.9 helper. This is not new-hook generation, local upload, Claude Code, or complete application acceptance. Package/schema validation and offline behavior checks are independent from installed-host activation. Fresh-account OAuth, installed skill behavior, paid generation through each target host and media previews must pass before customer rollout. See the bundled evaluation-cases.json for pending acceptance scenarios; expected routes are criteria, not recorded passes. A demo recording and platform approval remain separate requirements.

## Speech and audio where enabled

The bundle includes the dependency-free audio helper and audio workflow (`skills/manage-ugc-media/references/audio-workflow.md` in the extracted bundle). Discover `get_audio_capabilities` before requested speech, voice preferences or private audio transfer. Saved recordings use a separate private library. Import an eligible recording to a distinct editing attachment before passing it to the finisher; free tests and voice references cannot be used in videos. The current default editing copy is public while the original stays private. Check the separate import/storage gates. No audio generation is needed for a connection check.


---

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

For a supported repository marketplace, copy the extracted `ugc-pilot` folder into your workspace's `plugins/` directory. Add an entry to `.agents/plugins/marketplace.json` at that workspace root (merge with an existing catalogue rather than replacing it):

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

If a private UGC Pilot plugin link has been supplied, install it and connect when prompted. This bundle does not include an install link. A public-directory listing is a separate reviewed release; do not claim one exists.

Where custom connections are available, go to ChatGPT Plugins → plus → Add custom MCP server, enter the endpoint and finish the normal OAuth flow. Availability depends on account and workspace policy. Follow the current client UI; do not promise every account has the same setup options.

Uploading this Markdown guide or a ZIP to an ordinary web conversation does not install a connector. If the host lacks a supported installation path, explain that limitation and offer the manual connector steps.

## Package updates and tool refresh

Extract a new version into a fresh folder so the older bundle remains available. In Claude Code, restart with `claude --plugin-dir /absolute/path/to/ugc-pilot` pointing to the new folder and use `/mcp` to check the connection. In Codex, update the same `ugc-pilot` plugin through its supported local source or Plugins Directory flow; a repository/personal marketplace can point at the extracted folder. Do not edit installed cache files or create duplicate server entries to force an update. Follow the host's supported refresh/restart flow, then verify discovered tools in a new session when necessary.

Adding the MCP endpoint connects server tools; loading the package adds its skills and local helper. Neither step proves both are active. The released server contains 79 tools; older active conversations can retain a cached catalogue. Discovery and live capabilities decide availability. The existing Edit surface includes `open_edit_draft`, `update_edit_draft`, `get_edit_export_capabilities`, `export_edit_draft` and `get_edit_export`. If discovery is stale, refresh the connection through the client. Reauthenticate only for expired sign-in or missing scopes, not merely because new tools appeared. An existing `creative:write` grant covers the Edit tools. Account-default updates separately need `account:write`, only after the account-settings server/schema rollout; request that scope when the user intends those changes. Business Context writes separately require `brand:write` after its schema/server rollout; reads and receipt recovery use `brand:read`. These scopes are granted only through normal OAuth consent for an intended task. An older media-only consent does not expand automatically. Do not generate media or change a draft just to check discovery.

The local transfer helper needs Node.js 22+, ffprobe and a host process API that can pass ephemeral JSON on stdin. A browser-only connector cannot read an IDE file path. Use the bundled local transfer reference after the package is loaded.

## Public distribution

The same hosted MCP serves each user's own account through OAuth. OpenAI's plugin submission portal accepts the bundle and MCP endpoint for review; an approved, published directory listing provides the customer install link. Claude requires a separate developer submission for its connector or GitHub-hosted plugin bundle. The ZIP download is useful for supported local plugin installation and review preparation; it does not create either public listing.

Public review is still pending. Publisher/domain verification, installed-client acceptance, a reviewer-accessible walkthrough, and secure reviewer access must be completed before announcing public availability. Never put reviewer passwords, OAuth tokens, or publisher credentials in the bundle.

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
