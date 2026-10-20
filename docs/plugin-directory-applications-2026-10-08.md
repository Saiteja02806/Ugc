# UGC Pilot directory applications — checked 8 October 2026

**ChatGPT has a submission route; Claude needs an eligibility decision before applying with the current generation-focused product.** Neither approved public listing is verified. This check used current official documentation; earlier Claude distribution advice omitted an eligibility gate and treated connector/bundle submission as alternatives.

| Platform | Application portal | Material |
| --- | --- | --- |
| ChatGPT / Codex | https://platform.openai.com/plugins | Versioned plugin ZIP and live MCP connection |
| Claude | https://claude.ai/directory/manage | Remote connector submission; a separate GitHub plugin-bundle submission for the skills |

The deployed endpoint is `https://mcp.getugcpilot.com/mcp`. Each customer authorizes their own UGC Pilot account. A directory listing makes the integration discoverable; hosting a downloadable ZIP alone does not establish listing approval.

**OpenAI application**

1. Finish the installed-client tests and resolve unexplained connection failures. Prepare a dedicated reviewer account, run the five positive/three negative cases, and record an accessible walkthrough. Confirm the actual publishing identity, supported countries, and existing-account billing behavior before finalizing the listing.
2. Add the real recording URL and confirmed publication metadata to a new versioned ZIP, then run submission validation. The live [0.1.1 ZIP](https://getugcpilot.com/downloads/ugc-pilot-0.1.1.zip) is a prepared draft package; it does not yet contain a real walkthrough recording.
3. Sign into the owning organization/project; verify the publishing identity and submission permissions, then upload the finalized ZIP as a draft.
4. Connect the MCP, complete the exact domain challenge issued by the portal, authenticate, and resolve package/tool scan findings. Check the imported review/listing details and enter reviewer credentials securely in the portal, outside the public ZIP.
5. Complete owner attestations, submit, and publish after approval.

These steps are from [OpenAI submission documentation](https://developers.openai.com/plugins/deploy/submission). The challenge is portal-generated; no token or verified domain status has been established here.

Existing-account subscription features are permitted. Selling credits/subscriptions, upgrade promotion, and transactional purchase links within the plugin are restricted. The public version must be reliable and complete, and show a useful workflow beyond native capabilities. Use actual supported brand context, owned media, and image-to-video workflows as evidence. [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines)

Current blockers: unexplained connection failures; fresh ChatGPT installed acceptance; full upload consent/testing; reviewer account and recording; confirmed publishing identity and country availability; domain checks and portal scans. The four public URLs, supported cases, onboarding, annotations, and ZIP are prepared, not proof of review acceptance.

Annotation notes are supporting explanations. The current Plugin guidelines say justification fields are no longer required, while the remote-MCP review page still discusses them. Follow the active portal findings; do not treat prepared explanations as a verified mandatory form field. [Guidelines](https://developers.openai.com/plugins/plugin-guidelines), [remote-MCP review page](https://developers.openai.com/plugins/deploy/app-review)

**Claude eligibility comes first**

Anthropic excludes standalone AI image/video/audio generation from its directories without written permission. Its design-workflow exception excludes standalone image generation as a primary service. Our current media-generation positioning makes approval uncertain and requires clarification. A private custom connector is a separate technical setup, not evidence of directory eligibility. [Directory policy, section 4.B](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)

Request a written eligibility decision from Anthropic before attesting compliance. Possible alternatives need an actual product decision: an independently useful library/brand connector without generation tools, or a genuine qualifying design workflow. Merely renaming or concealing tools does not resolve eligibility. No feature removal or platform inquiry was performed in this check.

**Claude application after eligibility is resolved**

Paid Claude plans can submit; Team/Enterprise roles must satisfy the documented owner or delegated-access requirements. For our own backend, submit the MCP connector and then the plugin bundle from the same organization. [Publishing overview](https://claude.com/docs/directory/publish)

- Connector: select Submit new → MCP connector, connect our HTTPS endpoint, complete listing/authentication/data-handling fields, provide sample-account access and tested use cases, and address compliance checks. [Connector submission](https://claude.com/docs/connectors/building/submission)
- Bundle: connect GitHub, select Plugin bundle, enter repository/folder/ref, validate, complete listing/data/compliance information, submit, and follow publication status. The repository must be public before the listing goes live. [Plugin submission](https://claude.com/docs/plugins/submit)

Use a repository containing only distributable plugin materials if publication would otherwise expose application source. The current application remote is `Saiteja02806/Ugc`; do not change its visibility as a side effect of plugin distribution. A future plugin repository, permission, and license have not been selected.

The local bundle has no `LICENSE` and its Claude manifest has no `license` field. This is a directory validation blocker even though local CLI validation passed. Choose an owner-approved plugin license before preparing a new version; the license need not cover the proprietary hosted application. [Claude pre-submission checklist](https://claude.com/docs/plugins/pre-submission-checklist)

Published status and a different eligible customer's actual installation remain final acceptance evidence. Approval, passing local validation, and endpoint health do not independently establish that. For submission questions, Anthropic documents `directory@anthropic.com` for bundles and `mcp-review@anthropic.com` for connectors. No message was sent. [Submission status and contact](https://claude.com/docs/directory/submission-status)

**Recommended order**

Resolve the remaining hosted/client tests and prepare the OpenAI draft first. In parallel, obtain Claude eligibility clarification. Complete its license and separate connector/bundle materials only after the intended permitted scope is clear. On approval/publication, add the actual directory install links to the setup page and verify the full per-user OAuth path.

