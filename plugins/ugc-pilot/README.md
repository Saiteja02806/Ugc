# UGC Pilot — 0.2.9 public-submission candidate

Draft UGC hooks, wall-of-text copy, video prompts, and slideshow plans in ordinary language, then use your connected UGC Pilot account when you ask to generate supported media. This package includes eighteen skills covering connection, media generation, five creative workflows, media transfer, video finishing, shared Edit drafts/export, speech/private audio transfer, application references, Creative Asset groups, saved Library outputs, shared Business Context, saved business onboarding, saved social analytics, and read-only connected-social-account and schedule discovery where enabled.

The package points to the existing hosted MCP at **https://mcp.getugcpilot.com/mcp**. Its portable `mcp.json` contains only the supported HTTP transport and URL. Codex discovers OAuth from the server's protected-resource metadata and selects the registration method automatically. The server challenges initial account reads with the minimal `account:read` scope; other tools require their own consent when needed. Keeping authentication extensions out of this transport file avoids a parser failure in Codex 0.164.0-alpha.11.1. It includes no server executable or credentials. Generation uses your UGC Pilot plan and credits, separately from your AI subscription.

Terminal-capable IDEs can use the bundled [local transfer helper](skills/manage-ugc-media/references/local-transfer.md) to measure and upload actual hook/demo files, recover reservation from a saved intent and confirmation from a saved transfer receipt, and download completed media without overwriting existing files. It requires Node.js 22+ and ffprobe. Hosts without process/file access need their own transfer mechanism. The helper never handles account OAuth or submits generation.

## Install and sign in

- **Codex:** this repository includes a local marketplace entry with `authentication: "ON_INSTALL"`. Add the checkout root as a marketplace with `codex plugin marketplace add /absolute/path/to/UGC`, then run `codex plugin add ugc-pilot@ugc-pilot-local` or select it in the Plugins UI. A noninteractive install verifies the package and records the policy; start a new interactive Codex chat to complete the normal OAuth sign-in and consent. To add only the MCP server, use Settings → MCP servers → Add server instead.
- **Claude web / Desktop:** use Customize → Connectors → Add custom connector, paste the endpoint, finish OAuth, and enable it in the conversation. Organization policies may require administrator setup.
- **Claude Code:** extract this folder and evaluate with `claude --plugin-dir /absolute/path/to/ugc-pilot`. Complete OAuth through `/mcp`. Marketplace installation is a separate distribution step.
- **ChatGPT:** after platform approval, install UGC Pilot from the public ChatGPT/Codex directory and connect when prompted. Until approval, use only a permitted private or workspace installation path. Where custom MCP connections are available, use the current client flow to enter the endpoint and finish OAuth.

For exact CLI commands and troubleshooting, read [client setup](skills/connect-ugc-pilot/references/client-setup.md). Reading or uploading this ZIP in a web chat alone does not install an MCP connection.

The host must load this skill package for the five creative workflows to be discoverable. Adding the MCP URL alone connects the tools; it does not install these local Markdown skills. A web-client connector and a plugin directory listing are separate distribution paths. This package is ready for submission preparation but has not been approved for a public directory, and existing installed/cached versions need an explicit update before they gain the new skills.

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
| “Show my saved Instagram, TikTok, or YouTube analytics.” | Manage UGC Analytics: owner-scoped stored reports only, with no provider refresh or social-account change |
| “Show my connected social accounts and scheduled posts.” | Manage UGC Scheduling: account and schedule-state reads only |

The AI selects skills by deliverable and context, not fixed command keywords. Copy plus prompt requests can run both steps; selected copy remains unchanged. It reuses your brief or, when relevant and connected, reads your business profile. Drafting alone does not submit a paid generation. Slideshow JSON is a semantic content plan, not the existing application Carousel worker contract. Exact video text and demo composition use the separately gated finishing tools. Slide rendering still needs separate tools.

## Application references, groups and Library

- “Browse hook references and show their reviewed text.” Use the [reference workflow](skills/remix-ugc-reference/SKILL.md); creating an application remix is a separate requested action with provider/quota access.
- “Show my image groups and organize these selected Creative Assets.” Use the [group workflow](skills/manage-ugc-groups/SKILL.md) with current revisions and eligible owned media.
- “Save this completed Carousel, or these already rendered slides, to my Library.” Use the [Library workflow](skills/manage-ugc-library/SKILL.md). Saving slides does not render missing text.

Each workflow checks live capabilities. Reference remix, group and Library writes are disabled in the current production release; reads and existing receipt recovery are separate. Do not enable rollout flags or silently substitute another workflow. A published package, discovered tool, and successful installed-host execution are different evidence.

## Account defaults where deployed

Use the [account workflow](skills/manage-ugc-account/SKILL.md) for publishing defaults, unset timezone initialization and settings receipts. These tools require the additive account-settings migration; writes also require the separate `account:write` consent and write gate. Reads never initialize preferences. Existing scheduled posts and initialized timezones are preserved. Use the [Business Context workflow](skills/manage-ugc-business/SKILL.md) to read and edit the shared Settings draft or apply reviewed context for future content. Writes separately require deployed schema, an enabled gate and fresh `brand:write` consent. Use the [business onboarding workflow](skills/onboard-ugc-business/SKILL.md) to resume saved legacy/background setup, choose a website/manual/mobile source, save identity/goals and submit intended setup where its separate write gate is enabled. Read capabilities first; completion can activate access/trial and prepare Trending content. Use the [business-logo workflow](skills/manage-ugc-media/references/business-logo-workflow.md) for a supplied local logo with recoverable reservations and verified bytes. Screenshots, website reanalysis and social-account operations remain separate work.

## Scheduling reads where deployed

Use the [scheduling workflow](skills/manage-ugc-scheduling/SKILL.md) to inspect connected social-account labels, connection health and existing schedule/target delivery state. It requires a separate `publishing:read` grant after a user requests this information. When live capabilities explicitly report schedule writes enabled, the plugin can create one requested future schedule with separate `publishing:write` consent, a selected owned source, selected owned connections, a time and a stable request ID. It cannot connect a social account, edit, cancel or retry a schedule, or publish a post.

## Saved analytics where deployed

Use the [analytics workflow](skills/manage-ugc-analytics/SKILL.md) for the account's saved Instagram, TikTok and YouTube reports. It first checks `get_analytics_capabilities`, then requires fresh `analytics:read` consent and a verified UGC Pilot account identity. These tools return stored owner-scoped reports only. `refresh_recommended` is a state to report, not permission to call a provider or queue a refresh. The plugin cannot refresh analytics, connect a social account or expose provider credentials.

## Try it

1. “Use UGC Pilot to check my account, credits, and available generation options. Do not generate anything.”
2. “Use UGC Pilot to generate one vertical product image of my skincare bottle on a bathroom shelf.”
3. “Animate that image into one five-second vertical video with a slow camera push-in. Return the finished video link.”
4. “Check the progress of the UGC Pilot job we already started. Do not create a new generation.”

The reviewed production server contract contains **79 tools**. This 0.2.10 candidate registers **106** tools, including shared Business Context, saved onboarding, verified logo upload, saved social analytics, and schedule discovery, after its server/schema release; hosted acceptance remains pending. Paid generation, permanent deletes, schedule creation, and live brand-profile writes preview first and run only with a single-use confirm token. Draft edits, library saves, uploads and verification, audio uploads and voice settings, group membership edits, timezone, logo verification, demo registration, business-context drafts, publishing defaults, remix text, edit export, and cancellation run directly. Existing conversations can retain an older cached catalogue. Tool discovery and live capability checks are authoritative; installing this package does not enable server features or refresh a cached catalogue.

- Account/brand reads, owned visual media, image generation and short-video generation. Counts are 1, 2 or 4; clips are 3–10 seconds and prompts have a 1,000-character limit. Check live costs and options before generation.
- Owned Demo registration/list/get/delete, upload reservation lookup/list/renewal, and server probing before readiness. The helper preserves reservation intent and transfer confirmation separately.
- Video finishing: exact text, supported trims/volumes/framing, demo composition and optional supported subtitles. These use the deployed finishing capability gates and `creative:write`; subtitles can incur a separate cost.
- Owner-scoped operation history and supported cancellation/retry. Writes require `jobs:write`, the exact operation revision and a stable request UUID. Retry can reserve credits under the original plan; replay recovers the accepted action.
- Shared Edit-page opening, listing, reading and revision-safe saving, plus dedicated export capabilities/submission/status. Save/open do not render. Export snapshots a saved revision using the website's renderer. See [Edit workflow](skills/edit-ugc-draft/SKILL.md). Preserve the dedicated export UUID; `get_operation` can recover `edit_export_request_id` when discovered.
- Connected-social-account and schedule-state discovery. These calls omit provider credentials, OAuth scopes, target settings, scheduler identifiers and internal metadata. Gated `create_schedule` uses an explicit selected source/connection/time/request UUID and carries only the verified-email decision made during OAuth consent. Editing, cancellation, retry, publishing and social OAuth are not agent actions in this release.
- Saved social analytics for Instagram, TikTok and YouTube. These read existing owner-scoped snapshots only, omit provider tokens and private publishing records, and return a truthful stale/partial indicator. Provider refresh is not an agent action in this release.

Full application parity remains unfinished. Explore/slideshow working drafts, slideshow rendering, voice sample/clone/verification/removal and default music, advanced generation/character choices, business settings, further Trending/Carousel actions, schedule editing/cancellation/retry, social publishing and analytics refresh require additional implementation. Private-media upload support is a separately gated server rollout. It requires a verified separate private bucket and its signing/read/cleanup configuration; the helper validates the server's explicit bucket descriptor and never bypasses unavailable storage.

## Verification status

Package/schema validation and offline creative-output checks pass for this source. A production read-only MCP preflight on 15 October 2026 confirmed health, OAuth metadata, authenticated account reads, live capabilities, finishing capabilities, and edit-export capabilities. Fresh-account OAuth, installed skill behavior, paid generation through each target host, and media previews still need real customer-client acceptance. See the bundled evaluation-cases.json for the pending installed-host scenarios. A reviewer-accessible demo recording and platform approval remain separate requirements.

## Speech and audio where enabled

The bundle includes the dependency-free audio helper and [audio workflow](skills/manage-ugc-media/references/audio-workflow.md). Discover `get_audio_capabilities` before requested speech, voice preferences or private audio transfer. Saved recordings use a separate private library. Import an eligible recording to a distinct editing attachment before passing it to the finisher; free tests and voice references cannot be used in videos. The current default editing copy is public while the original stays private. Check the separate import/storage gates. No audio generation is needed for a connection check.
