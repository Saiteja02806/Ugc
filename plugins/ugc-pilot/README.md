# UGC Pilot private beta — 0.1.10 candidate

Draft UGC copy and video prompts in ordinary language, then use your connected UGC Pilot account when you ask to generate media. This package includes ten skills covering connection, generation, media transfer, five creative workflows, video finishing, shared Edit drafts/export, and speech/private audio transfer where enabled.

The package points to the existing hosted MCP at **https://mcp.getugcpilot.com/mcp**. It includes no server executable, credentials, or automatic installation script. Generation uses your UGC Pilot plan and credits, separately from your AI subscription.

Terminal-capable IDEs can use the bundled [local transfer helper](skills/manage-ugc-media/references/local-transfer.md) to measure and upload actual hook/demo files, recover reservation from a saved intent and confirmation from a saved transfer receipt, and download completed media without overwriting existing files. It requires Node.js 22+ and ffprobe. Hosts without process/file access need their own transfer mechanism. The helper never handles account OAuth or submits generation.

## Install and sign in

- **Codex:** use Settings → MCP servers → Add server, choose Streamable HTTP, and paste the endpoint. Select Authenticate, sign into your UGC Pilot account, approve access, and restart the connection. To load the workflow skills and helper, follow the repository marketplace example in the client setup guide, or update the plugin through your trusted installed source.
- **Claude web / Desktop:** use Customize → Connectors → Add custom connector, paste the endpoint, finish OAuth, and enable it in the conversation. Organization policies may require administrator setup.
- **Claude Code:** extract this folder and evaluate with `claude --plugin-dir /absolute/path/to/ugc-pilot`. Complete OAuth through `/mcp`. Marketplace installation is a separate distribution step.
- **ChatGPT:** install the actual private plugin link supplied with the beta and connect when prompted. Developer mode offers a manual MCP connection for eligible accounts. A public directory listing has not been released.

For exact CLI commands and troubleshooting, read [client setup](skills/connect-ugc-pilot/references/client-setup.md). Reading or uploading this ZIP in a web chat alone does not install an MCP connection.

The host must load this skill package for the five creative workflows to be discoverable. Adding the MCP URL alone connects the tools; it does not install these local Markdown skills. A web-client connector and a plugin directory listing are separate distribution paths. This package has not been approved for a public directory, and existing installed/cached versions need an explicit update before they gain the new skills.

For application model, quality, duration and multiple-reference choices, use the [advanced generation workflow](skills/create-ugc-media/references/advanced-generation.md) when its discovered capabilities are enabled. Installing this package does not enable server creation gates. Character/avatar adapters and finished slideshow text rendering remain separate missing capabilities.

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

## Try it

1. “Use UGC Pilot to check my account, credits, and available generation options. Do not generate anything.”
2. “Use UGC Pilot to generate one vertical product image of my skincare bottle on a bathroom shelf.”
3. “Animate that image into one five-second vertical video with a slow camera push-in. Return the finished video link.”
4. “Check the progress of the UGC Pilot job we already started. Do not create a new generation.”

The coordinated audio candidate contract contains **46 tools**. Production may still expose the previous 33-tool catalogue until its server release. Tool discovery and live capability checks are authoritative; installing this package does not enable server features or refresh a cached catalogue.

- Account/brand reads, owned visual media, image generation and short-video generation. Counts are 1, 2 or 4; clips are 3–10 seconds and prompts have a 1,000-character limit. Check live costs and options before generation.
- Owned Demo registration/list/get/delete, upload reservation lookup/list/renewal, and server probing before readiness. The helper preserves reservation intent and transfer confirmation separately.
- Video finishing: exact text, supported trims/volumes/framing, demo composition and optional supported subtitles. These use the deployed finishing capability gates and `creative:write`; subtitles can incur a separate cost.
- Owner-scoped operation history and supported cancellation/retry. Writes require `jobs:write`, the exact operation revision and a stable request UUID. Retry can reserve credits under the original plan; replay recovers the accepted action.
- Shared Edit-page opening, listing, reading and revision-safe saving, plus dedicated export capabilities/submission/status. Save/open do not render. Export snapshots a saved revision using the website's renderer. See [Edit workflow](skills/edit-ugc-draft/SKILL.md). Preserve the dedicated export UUID; `get_operation` can recover `edit_export_request_id` when discovered.

Full application parity remains unfinished. Explore/slideshow working drafts, slideshow rendering, voice sample/clone/verification/removal and default music, advanced generation/character choices, full Library/business settings, Carousel actions, social publishing and analytics require additional implementation. Private-media upload support is a separately gated server rollout. It requires a verified separate private bucket and its signing/read/cleanup configuration; the helper validates the server's explicit bucket descriptor and never bypasses unavailable storage.

## Verification status

Package/schema validation and offline behavior checks are independent from installed-host activation. Fresh-account OAuth, installed skill behavior, paid generation through each target host and media previews must pass before customer rollout. See the bundled evaluation-cases.json for pending acceptance scenarios; expected routes are criteria, not recorded passes. A demo recording and platform approval remain separate requirements.

## Speech and audio where enabled

The bundle includes the dependency-free audio helper and [audio workflow](skills/manage-ugc-media/references/audio-workflow.md). Discover `get_audio_capabilities` before requested speech, voice preferences or private audio transfer. Saved recordings use a separate private library. Import an eligible recording to a distinct editing attachment before passing it to the finisher; free tests and voice references cannot be used in videos. The current default editing copy is public while the original stays private. Check the separate import/storage gates. No audio generation is needed for a connection check.
