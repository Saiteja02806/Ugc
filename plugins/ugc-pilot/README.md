# UGC Pilot private beta

Connect your UGC Pilot account to a supported AI client and ask for images or short videos in ordinary language. Your AI handles tool inputs, generation progress, and retrieval.

The package points to the existing hosted MCP at **https://mcp.getugcpilot.com/mcp**. It includes no server executable, credentials, or automatic installation script. Generation uses your UGC Pilot plan and credits, separately from your AI subscription.

## Install and sign in

- **Codex:** use Settings → MCP servers → Add server, choose Streamable HTTP, and paste the endpoint. Select Authenticate, sign into your UGC Pilot account, approve access, and restart the connection. To install the workflow skills as well, use the private plugin link supplied with this beta or your trusted plugin source.
- **Claude web / Desktop:** use Customize → Connectors → Add custom connector, paste the endpoint, finish OAuth, and enable it in the conversation. Organization policies may require administrator setup.
- **Claude Code:** extract this folder and evaluate with `claude --plugin-dir /absolute/path/to/ugc-pilot`. Complete OAuth through `/mcp`. Marketplace installation is a separate distribution step.
- **ChatGPT:** install the actual private plugin link supplied with the beta and connect when prompted. Developer mode offers a manual MCP connection for eligible accounts. A public directory listing has not been released.

For exact CLI commands and troubleshooting, read [client setup](skills/connect-ugc-pilot/references/client-setup.md). Reading or uploading this ZIP in a web chat alone does not install an MCP connection.

## Try it

1. “Use UGC Pilot to check my account, credits, and available generation options. Do not generate anything.”
2. “Use UGC Pilot to generate one vertical product image of my skincare bottle on a bathroom shelf.”
3. “Animate that image into one five-second vertical video with a slow camera push-in. Return the finished video link.”
4. “Check the progress of the UGC Pilot job we already started. Do not create a new generation.”

The current MCP supports account/brand reads, image/video library access, uploads/deletion, image generation, short-video generation, and job polling. Counts are 1, 2, or 4; clips are 3–10 seconds. Ask the AI to check live capabilities before spending credits. Creators, carousels, audio generation, scheduling, and publishing are not included in this beta.

## Verification status

This is an initial private package. File validation and endpoint health are checked independently from installation. Fresh-account OAuth, installed skill behavior, paid generation through each target host, and media previews must pass before customer rollout. Do not treat package creation as proof that a host connection works.
