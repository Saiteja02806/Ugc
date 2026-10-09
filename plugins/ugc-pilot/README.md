# UGC Pilot private beta — 0.1.2 candidate

Draft UGC copy and video prompts in ordinary language, then use your connected UGC Pilot account when you ask to generate media. This package includes eight skills: the existing connection, generation and media-library workflows plus five creative workflows.

The package points to the existing hosted MCP at **https://mcp.getugcpilot.com/mcp**. It includes no server executable, credentials, or automatic installation script. Generation uses your UGC Pilot plan and credits, separately from your AI subscription.

## Install and sign in

- **Codex:** use Settings → MCP servers → Add server, choose Streamable HTTP, and paste the endpoint. Select Authenticate, sign into your UGC Pilot account, approve access, and restart the connection. To install the workflow skills as well, use the private plugin link supplied with this beta or your trusted plugin source.
- **Claude web / Desktop:** use Customize → Connectors → Add custom connector, paste the endpoint, finish OAuth, and enable it in the conversation. Organization policies may require administrator setup.
- **Claude Code:** extract this folder and evaluate with `claude --plugin-dir /absolute/path/to/ugc-pilot`. Complete OAuth through `/mcp`. Marketplace installation is a separate distribution step.
- **ChatGPT:** install the actual private plugin link supplied with the beta and connect when prompted. Developer mode offers a manual MCP connection for eligible accounts. A public directory listing has not been released.

For exact CLI commands and troubleshooting, read [client setup](skills/connect-ugc-pilot/references/client-setup.md). Reading or uploading this ZIP in a web chat alone does not install an MCP connection.

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
