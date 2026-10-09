# UGC Pilot 0.1.1 review preparation

This document supplies review explanations, not a claim of approval. The portable manifest includes the supported five positive and three negative cases and the connection onboarding skill. Reviewer credentials must be entered in the secure platform dashboard, never in this document or the ZIP. The walkthrough URL is deliberately absent until an actual reviewer-accessible recording exists.

## Tool annotation justifications

These are supporting explanations for a scan finding or appeal; use them if the active portal asks. Current Plugin guidelines say justification fields are no longer required, while the remote-MCP review page still discusses them. The annotation values must agree with the scan. These explanations are not an invented MCP wire extension. The [later application check](plugin-directory-applications-2026-10-08.md) also adds Claude eligibility/licensing gates and clarifies its two submission types.

| Tool | Read-only | Destructive | Open world | Justification |
| --- | --- | --- | --- | --- |
| `get_profile` | true | false | false | Identifies the authenticated account; no account or billing mutation. |
| `get_entitlements` | true | false | false | Reads existing plan and credit state without refreshing paid credits or initializing a free allowance. |
| `get_capabilities` | true | false | false | Computes supported generation options from existing account entitlements. Does not submit a job or allocate credits. |
| `get_saas_brand` | true | false | false | Retrieves the connected account's existing completed business context. Does not crawl a requested public URL or update the profile. |
| `list_assets` | true | false | false | Lists ready, undeleted media belonging to the connected account with scoped pagination. No public search or mutation. |
| `get_asset` | true | false | false | Retrieves a ready, undeleted owned asset and its delivery link. Does not fetch arbitrary public URLs. |
| `get_job` | true | false | false | Reads the connected account's existing supported generation job and available output IDs. Does not enqueue or restart work. |
| `create_upload` | false | false | false | Creates a temporary owned media record and scoped upload URL. Does not replace existing media or publish to a public social account. |
| `confirm_upload` | false | false | false | Verifies the selected owned temporary upload's stored bytes and updates it to ready. Does not overwrite another asset. |
| `delete_asset` | false | true | false | Soft-deletes a selected ready asset; an unconfirmed upload can have its storage object removed. Ownership and explicit asset selection restrict the effect, but there is no advertised customer restore operation. |
| `generate_image` | false | true | false | Reserves credits and starts owned generation work. Completed generation spends credits and cannot be undone by deleting its output. Reusing the exact request ID and arguments returns the existing work; conflicting input is rejected. It cannot publish externally or accept arbitrary URL references. |
| `generate_video` | false | true | false | Reserves duration-based credits and starts owned video generation. Completed work spends credits. Stable request IDs and ownership checks protect retries and references. The tool cannot schedule or publish externally. |

`openWorldHint: false` describes the bounded UGC Pilot account, even though the backend uses externally hosted storage and generation providers. Returned media URLs can be shared; this is disclosed in the privacy page. Request tracing adds HTTP headers and operational logs rather than extra diagnostic fields to user tool results. [OpenAI review requirements](https://developers.openai.com/plugins/deploy/app-review)

## Walkthrough to record after installed acceptance

1. Install through the actual supported host flow; show the package/connector identity and version.
2. Sign into a dedicated reviewer account and show the consent scopes, image/video wording and credits notice. Keep passwords, tokens and private account information out of the recording.
3. Run the connection prompt. Show accurate plan/credit/capability reads and unchanged balances.
4. Generate one image and one short image-to-video example after showing the cost. Show real completion and accessible output links.
5. Resume the existing job; demonstrate that it does not create another job or charge.
6. Show safe handling of unsupported publishing/counts and unauthorized references.

Verify the recording link from a separate eligible session. Enter it through the secure review dashboard or `extensions.com.openai.review.demo_recording_url`, then rebuild the versioned archive and run `node scripts/validate-ugc-pilot-plugin.mjs --submission`. That command validates package materials; it does not verify publisher identity, portal scans, reviewer login, installed behavior, or platform approval.

## Final owner/platform requirements

OpenAI needs publisher identity verification, its exact domain challenge token, a current tool scan, annotation justifications, secure reviewer access, walkthrough and policy attestations. Review approval and publishing happen in its portal. Claude has a separate developer review for a remote connector or GitHub-hosted bundle. No approved public listing or install link is asserted by this source release. [OpenAI submission](https://developers.openai.com/plugins/deploy/submission), [Claude distribution](https://claude.com/resources/articles/build-plugins-for-claude)
