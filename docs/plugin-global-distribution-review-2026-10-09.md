# UGC Pilot global distribution review

Reviewed the official publication documentation and local/saved package evidence on 2026-10-09. The result is **yes for pursuing a public OpenAI listing; conditional for the full Claude plugin**. Approval and worldwide availability have not been obtained. The saved 0.1.2 release is still private.

## Name, publisher and icon

The plugin display name is already **UGC Pilot**, with package identifier `ugc-pilot`. The saved private release currently identifies the developer/author as **Chundu Srisaiteja**. The local candidate uses UGC Pilot as developer metadata. These represent different publisher identities; use the verified identity selected in the publication portal rather than assuming a manifest changes verification.

OpenAI requires business verification to publish as a business, and individual verification for a personal publisher. That is the remaining identity decision for publishing under UGC Pilot. [OpenAI remote MCP review requirements](https://developers.openai.com/plugins/deploy/app-review).

The package already references `./assets/logo.png` for both `logo` and `composerIcon`. This file is **byte-identical** to the website's `public/brand/ugc-pilot-logo.png`: a transparent RGBA PNG, **500×500 pixels**, **26,932 bytes**, SHA-256 `44a9e46f81ff6618d620647510c31e1c625f426c10ce8b50c8dae248522f7d36`. I visually inspected the black Pilot mark and orange play symbol. Retain this original brand asset. Its dark mark should be previewed on both light and dark directory surfaces; a contrasting optional dark variant can be prepared if the actual host preview needs it. No replacement logo was generated.

## Public paths

| Platform | Route and current position |
| --- | --- |
| ChatGPT / Codex | Upload the complete plugin ZIP at [OpenAI Platform → Plugins](https://platform.openai.com/plugins), connect and scan the production MCP, resolve findings, submit for review, then publish the approved version. The directory supports packages combining skills and MCP. [Submission workflow](https://developers.openai.com/plugins/deploy/submission). |
| Claude | Paid-plan developers can use the submission portal linked in [Build plugins for Claude](https://claude.com/resources/articles/build-plugins-for-claude). A bundle of skills plus MCP is hosted on GitHub and submitted as a repository; a connector-only submission supplies the remote MCP URL. |

The full UGC Pilot package exposes standalone AI image/video generation. **This is a concrete Claude eligibility obstacle:** Anthropic's current directory policy excludes such capabilities unless expressly permitted in writing, with a narrower exception for design-focused visual aids. Request written permission for the full product, or design a genuinely separate copy/planning edition with generation capabilities excluded. Do not conceal generation or assume adding slideshow skills establishes the design exception. [Anthropic Software Directory Policy, section 4](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy).

No submission was made in this review and no public visibility was changed.

## Remaining work before submission

- **Installed-host acceptance:** reload version 0.1.2; test fresh-user OAuth, all creative activations, a real authorized generation/result and retry behavior in the target clients. The earlier offline tests and successful hosted account/capability reads are useful evidence, but do not establish those passes. Claude Code was logged out at the last check.
- **Review materials:** provide a dedicated sample-data test account and accessible demo recording. The package already has five positive and three negative MCP review cases, but the recording URL remains absent. Local package validation continues to pass while reporting that gap.
- **Portal checks:** complete publisher/domain verification, tool and skill scans, policy attestations and tool-annotation explanations. The server source declares read-only, destructive and open-world hints on all 12 tools; this inspection found no explicit justification text in the registration files. Confirm/fill the required explanations in the portal instead of treating local tests as portal approval. [Final submission requirements](https://developers.openai.com/plugins/deploy/submission-errors).
- **Public-package rights:** the hook resource includes external creator transcriptions. Confirm permission for redistributing that collection or omit it from a public edition and retain original pattern guidance. Ownership of UGC Pilot's logo does not establish rights to those third-party excerpts. OpenAI requires permission for included intellectual property and a complete, reliable product rather than a trial/demo. [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines).
- **Release presentation:** after acceptance, prepare a new immutable public release with consistent verified publisher metadata and accurate production copy. Keep the existing private beta/released archive intact; do not merely remove the beta label to imply readiness. Define intended supported-country availability in the portal; the present manifest omits country targeting, which does not prove global availability. [Country settings](https://developers.openai.com/plugins/deploy/submission).

Suggested order: verify the publishing identity; finish customer/host tests and recording; prepare the public edition and rights-safe resources; upload and clear automated findings; submit; publish only after approval. For Claude, resolve generation eligibility before investing in its full directory application.

## What users will do

After an approved listing is published, users can discover and add the plugin through the platform's directory, then authenticate **their own UGC Pilot account** through OAuth. Their account supplies access and generation credits; the shared hosted endpoint remains `https://mcp.getugcpilot.com/mcp`. Host subscriptions, supported regions, organization controls and platform rollout can affect availability. This does not make the software available to every account in every country automatically.

The complete package delivers the creative skills as well as the MCP connection. A bare connector URL supplies tools and does not itself install the local Markdown skills. A ZIP published on the website can support compatible local installations, but does not create an approved ChatGPT or Claude directory listing.

## Proposed public listing text (draft only)

- Display name: **UGC Pilot**
- Subtitle: **UGC copy, prompts and media** (27 characters)
- Publisher: the verified UGC Pilot business identity, or the verified individual if publishing personally
- Icon: the existing UGC Pilot logo for listing and composer
- Description: “Write business-specific hook text, wall-of-text overlays, video prompts and slideshow copy. Connect your UGC Pilot account to generate images and short video footage, use your owned references and retrieve results. Exact overlay composition and slideshow rendering require separate tools.”

Starter prompts can retain their existing text and order. This draft has not been applied to the private plugin or submitted; it is a concrete branding/publication proposal for the next release.

Local evidence: `plugins/ugc-pilot/plugin.json`, `.tmp/ugc-pilot-saved-source-after-update.json`, `.tmp/ugc-pilot-private-update-verification.json`, and the earlier implementation/client-readiness reports. Official policy/portal facts were checked live; current portal identity, domain-verification and review status still require authenticated publisher access.
