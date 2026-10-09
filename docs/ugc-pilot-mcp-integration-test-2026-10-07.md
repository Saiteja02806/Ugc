# UGC Pilot MCP integration test — 7 October 2026

**Result: the production MCP completed a real authenticated image and image-to-video workflow in Codex. Customer rollout is still incomplete.** The downloadable package was validated, but this test used Codex's direct MCP connection; it does not establish that an installed plugin loads its bundled skills or that other hosts work.

Later on 7 October, the missing-asset check returned a safe `NOT_FOUND`, and brand-profile retrieval passed. A candidate based on the exact current production commit now includes the credit correction, consent wording, request tracing, and onboarding additions. See the [readiness follow-up](ugc-pilot-mcp-readiness-followup-2026-10-07.md) for its validation and deployment scope. Earlier observations below remain the record of the initial canary.

## Production flow verified

Endpoint: `https://mcp.getugcpilot.com/mcp`. The user completed sign-in and consent in the provider's UI. Codex reported a successful OAuth login, and all twelve UGC Pilot tools became available in this chat. No password or bearer token was requested from the user or placed in the package.

The connected account has an active, paid **Starter** subscription. Its starting balance was 200 credits, with zero reserved. Generation was explicitly authorized by the user.

| Check | Observed result |
| --- | --- |
| Codex OAuth and discovery | Login succeeded; twelve tools available |
| Profile, entitlements, capabilities | Account identified; image/video access enabled; supported options returned |
| Image generation | One vertical image completed in approximately 21 seconds |
| Image output | Owned asset retrieved; PNG returned HTTP 200 and decoded in the browser at 720×1280 |
| Image-to-video generation | The generated image was used as the owned reference for one three-second vertical video; job completed in approximately 28 seconds |
| Video output | Owned asset retrieved; MP4 returned HTTP 200; browser played it to completion at 720×1280, duration 3.008 seconds, without a playback error |
| Image retry | Reusing the same request ID and input returned the original job |
| Video retry | Reusing the same request ID and input returned the original completed job |
| Billing | 200 → 199 after the image → 187 after the video and retries; 13 credits total, zero reserved |
| Asset listing | The new image appeared in the connected account's generated-image list |
| Missing job | Returned a safe, non-retryable `NOT_FOUND` tool error |
| Missing/invalid bearer token | Production returned HTTP 401 with the resource metadata challenge and `no-store` |
| Untrusted browser origin | Production returned HTTP 403 with `invalid_origin` |
| Health and OAuth metadata | Production returned HTTP 200; endpoint, issuer, scopes, and S256 PKCE metadata were consistent |

The billing matches the live advertised prices: one image costs 1 credit; three seconds of video at 4 credits per second cost 12 credits. No duplicate job or extra charge was observed on either replay. These completion times describe this canary run, not a latency guarantee.

Image job: `6a79a1a4-e8e8-4467-8454-36fc055488ca`; image asset: `7d0a67c5-d040-4f3b-89ce-f5d9c4b77a6b`.

Video job: `33b8e931-e1af-4e12-837e-adcd93272c04`; video asset: `ed6b876c-45ed-4e6b-9b1d-96bbf8c36d72`.

- [Generated image](https://storage.googleapis.com/ugcsaas-media/images/generated/voJZyQBmMGZowIWIKfmwSAYQrh32/ai-studio/19960017-fd1c-4421-9027-98556de0ac55.png)
- [Generated video](https://storage.googleapis.com/ugcsaas-media/videos/hooks/voJZyQBmMGZowIWIKfmwSAYQrh32/ai-studio/74724cf7-c714-4590-a51a-cc46628b264a.mp4)

The output remains in the user's account for inspection. It was not deleted.

## Corrected locally

The broader MCP tests exposed a billing regression in the current source: MCP entitlement reads could call `ensure_free_generation_credit_balance`, allocating a free allowance despite the tools being described as read-only. Generation preflight could also initialize the allowance before rejecting a free account.

`getUserSubscription` now accepts `initializeFreeCredits: false`. The two MCP callers set it alongside `strict: true` and `refreshCredits: false`. They inspect an existing, owner-filtered free-credit row instead of allocating one. A missing row returns zero free credits; an unavailable or invalid ledger fails closed. Website callers retain their existing default initialization behavior.

The read and generation test fixtures were also brought into agreement with the current billing queries, whose subscription results are arrays. New assertions cover existing/missing/invalid free balances, outages, denied free generation, and zero allowance-initialization writes. Date-sensitive fixtures use a future active cycle and a past expired cycle.

Files corrected in this test session:

- `lib/billing/subscription-db.ts`
- `lib/mcp/read-tools.ts`
- `lib/mcp/generation-tools.ts`
- `scripts/test-mcp-read-tools.mjs`
- `scripts/test-mcp-generation-tools.mjs`

**These corrections have not been pushed or deployed.** Production canary results establish the deployed happy path; they do not establish that production contains this new free-account correction. Existing worktree changes were preserved. No database migration or live ledger adjustment was applied for the fix.

## Validation of the correction and package

| Validation | Result | Scope |
| --- | --- | --- |
| `npm run test:mcp` | Passed | Eleven unit tests plus the read/upload/delete, generation/job, token-error, migration, and storage-signing suites |
| `npm run test:free-generation-credits` | Passed, eleven tests | Website default allocation, budget/reservation/refund behavior, paid/complimentary sources, concurrency, and database role restrictions in the test environment |
| ESLint on the five corrected files | Passed | Scoped source/test lint |
| `git diff --check` | Passed | Diff whitespace |
| Plugin validator | Passed | Twelve allowlisted files and twelve tool references |
| Archive integrity | Unchanged | SHA-256 `f7d363d5f297cc7a04f34bf5c0e2c8d428e3920773df0807183c6b5423df23b5` |
| Whole-repository TypeScript | Failed | Eight existing Explore errors listed in the [package build report](ugc-pilot-plugin-private-beta-2026-10-07.md#website-deployment-blocker-found); none reported in the correction |

The package-build snapshot covered 33 MCP/auth runtime files. Following the intentional correction, only `read-tools.ts` and `generation-tools.ts` differ within that snapshot; the other 31 remain unchanged. The billing file and test fixtures above are additional intentional corrections. The earlier build report's preservation result describes the earlier build stage.

## Remaining issues and release gates

1. **Intermittent transport errors remain unresolved.** Several Codex tool calls failed while sending or receiving requests. Retrying the same generation input and request ID recovered the original accepted image job; reads and video-result retrieval also recovered. A missing-asset probe repeatedly failed at the transport layer, so its live safe-error behavior remains unverified. The sampled Vercel logs show MCP HTTP 200/202 responses and job creation; an error/warning/fatal query found no matching entries in its time window. Independent health requests succeeded. This evidence does not identify whether the failures originate in the client, connection, platform, or server. Reproduce and trace the failed request boundary before declaring reliability resolved. Do not create a new generation request ID to recover an uncertain submission.

2. **Customer onboarding is not deployed.** `https://www.getugcpilot.com/connect-ai` and `https://www.getugcpilot.com/downloads/ugc-pilot-0.1.0.zip` redirect to the apex domain and return HTTP 404. The standalone guide has not received final production acceptance either. Reconcile the existing Explore type errors, validate the complete intended website release, deploy it, and verify the page and downloads on production.

3. **Installed-plugin and other-host acceptance are pending.** The saved private package is account-scoped. This test does not prove bundled skill loading, fresh-account onboarding, Claude/Claude Code or ChatGPT OAuth, or universal distribution. Do not present the private personal plugin link as a customer-wide installation link. The ten installed-host evaluation scenarios remain pending.

4. **The live consent text understates generation access.** It labels the generation permission “Generate images,” although that permission also enables video generation. Align the deployed consent description with the actual image/video permission before rollout. The local website consent component and the deployed MCP consent component currently differ; apply this to the actual deployment source rather than assuming the website component is authoritative.

5. **Broader production checks remain bounded.** Live multi-account isolation, upload/confirmation/deletion, insufficient scope, token revocation/refresh/reconnection, partial paid batches, queue failures, and brand-context retrieval were not exercised in this canary. Relevant automated tests passed where present; those tests do not replace cross-account or other-host production acceptance.

Vercel access is now available: reading the `ugc-mcp` project and its production runtime logs succeeded. The sampled current deployment was `dpl_34shbMncaicg7Ki2HeR3C2heYtvj`, branch `codex/media-safety-fixes-20261006`, Node.js 24, region `bom1`. The earlier account-access blocker is no longer the reason rollout is incomplete.

## How a user can use the verified Codex connection

1. Add the hosted MCP endpoint through Codex's supported MCP settings or CLI.
2. Complete UGC Pilot sign-in and consent in the provider's browser UI using the user's own account.
3. Ask the agent to check profile, entitlements, and capabilities. A paid UGC Pilot account with enough credits was required for the tested generation flow.
4. Request an image, or a video using an owned image. The agent estimates the credit cost, submits a stable request ID, checks the returned job, and retrieves the actual output asset when complete.

The bundle provides instructions and configuration; uploading a ZIP into a chat does not itself establish an MCP connection or approve OAuth access. Client-supported installation and the user's sign-in/consent remain necessary.

## Evidence retained locally

Evidence is under `.tmp/mcp-plugin-build/` and is excluded from the plugin ZIP:

- `paid-canary-final-2026-10-07.json`: inputs, jobs, owned assets, billing, retry receipts, and limitations.
- `live-boundaries-2026-10-07.json`: public HTTP and authentication-boundary checks.
- `generated-image-preview-2026-10-07.jpg` and `generated-video-preview-2026-10-07.jpg`: actual browser previews.
- `before-integration-fixes/`: copies of the five files before this correction, preserving the earlier worktree state.
- `integration-fixes.patch`: differences from those copies, isolating this session's corrections from unrelated existing changes.
