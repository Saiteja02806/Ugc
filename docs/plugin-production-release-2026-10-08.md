# UGC Pilot hosted plugin release — 8 October 2026

**Hosted release complete; broad public production readiness remains unproven.** The MCP service and website serve the reviewed 0.1.1 candidate. Real image generation, owned retrieval, exact replay, concurrent reads, downloads, OAuth discovery, and public SEO regression passed. Intermittent unexplained client send failures remain unresolved. Fresh installed-client acceptance, full upload permissions, and platform review remain pending; the user explicitly chose to finish the hosted release before signing in.

**Deployed result**

| Project | Production URL | Deployment | Status | Provider build-to-ready interval |
| --- | --- | --- | --- | --- |
| `ugc-mcp` | https://mcp.getugcpilot.com/mcp | `dpl_B9qu1Rkx1xRXYN4XWe8xuErWL9Gb` | READY | 114.8 seconds |
| `ugc` | https://getugcpilot.com/connect-ai | `dpl_qngKMz26xQpQZkXLiJT673Jd56Qi` | READY | 133.5 seconds |

Both use Next.js 16.3.8 and Node.js 24.x. Immutable deployment URLs are [MCP](https://ugc-i84p421qd-ugcpilot.vercel.app) and [website](https://ugc-9pqx7e3cs-ugcpilot.vercel.app); their deployment protection remains enabled. Production domain inspection confirmed the deployment IDs above after promotion. The website's www domain redirects to the canonical apex.

Source provenance is **base commit `9390357231e31cfb72cdb67df6098d5b3c87aa4d` plus a reviewed, uncommitted snapshot**, not a newly pushed Git commit. [Provider metadata and timing](plugin-release-deployment-evidence-2026-10-08.json) record `releaseScope=plugin-readiness-0.1.1`, that `releaseBase`, `sourceState=reviewed-uncommitted-snapshot`, and `gitDirty=1`. The [42-path source inventory](plugin-release-source-inventory-2026-10-08.json) has SHA-256 `c1c87af5d2ea7d4a968be117da4cb6beb032ccbadc1dbbc70927c6587b8ffbd3`; all entries still matched the isolated release checkout after deployment.

The isolated checkout is `C:/Users/chund/.codex/worktrees/plugin-readiness/UGC`. It preserves the production baseline and reviewed changes independently of the main workspace's unrelated work. The upload plan included all 42 reviewed paths and checked exclusions for credentials, local environment files, caches, build output, and Git internals. These exclusions are also necessary for the locally generated, ignored Vercel environment file. Unrelated main-workspace features were outside this explicitly scoped release and remain intact.

**Problems addressed**

| Earlier problem | Released correction |
| --- | --- |
| Setup and bundle unavailable on production | `/connect-ai`, the client guide, versioned ZIPs, and checksums are live. |
| Incomplete public-review package | Four verified HTTPS metadata links, supported five positive/three negative cases, onboarding skill, aligned compatibility manifests, and stricter validation. |
| Unclear installation expectations | Per-client setup, own-account OAuth, separate UGC Pilot credit use, private-beta status, and actual advertised tool limits. |
| Read-only tools could initialize/refresh billing state | Reads and generation preflight now inspect existing entitlements without those writes; regression fixtures cover the behavior. |
| Inaccurate tool safety metadata | Explicit read-only, destructive, and open-world annotations; paid generation is marked destructive because completed work spends credits. Dashboard justifications are prepared separately. |
| Consent did not clearly describe both media types | Image/video generation, library access, selected uploads/deletions, permissions, and credit wording are clearer; responsive consent components are deployed. |
| Insufficient AI-connection privacy disclosure | Public privacy page describes OAuth, returned account/media/job information, provider processing, sharing, disconnect/revocation, and safe diagnostics. |
| Vulnerable runtime dependency paths | Compatible patch updates and pinned transitive overrides; the release's production dependency audit has zero findings. |
| Hard-to-correlate MCP failures | No-store responses, safe request IDs, and structured tracing are deployed without logging bearer tokens, prompts, or emails. This improves diagnosis; it does not establish that reliability is fixed. |

The endpoint, twelve tool names, schemas, OAuth scope names, ownership rules, and request-ID replay contract remain compatible. No production database migration, worker image release, Git push, or public directory publication was performed.

**Package and customer connection**

The live [setup page](https://getugcpilot.com/connect-ai) explains each client. A customer connects to `https://mcp.getugcpilot.com/mcp`, signs into their own UGC Pilot account, and approves the requested OAuth permissions. The backend remains hosted; the bundle supplies configuration and workflow skills. An ordinary chat attachment does not install or authenticate it.

The public [0.1.1 bundle](https://getugcpilot.com/downloads/ugc-pilot-0.1.1.zip) is 40,258 bytes with 12 allowlisted files and SHA-256 `037c35c4d1866fd17e267a9cffa4ed20cd12c4c4c766825af39923a1dfa2b830`. The [checksum](https://getugcpilot.com/downloads/ugc-pilot-0.1.1.zip.sha256) and [setup guide](https://getugcpilot.com/downloads/ugc-pilot-setup.md) match reviewed source. Version 0.1.0 remains available for traceability.

There is no verified public install listing yet. Eligible ChatGPT accounts can use the documented private/custom MCP flow; Claude can connect through its custom connector flow; Claude Code can load the extracted bundle with `--plugin-dir`. Public discovery requires separate OpenAI and Claude platform reviews and approval, followed by acceptance with another eligible account. The release does not create those listings automatically. [OpenAI distribution](https://developers.openai.com/plugins/deploy/submission), [Claude distribution](https://claude.com/resources/articles/build-plugins-for-claude)

**Regression evidence**

| Check | Result and limits |
| --- | --- |
| Full candidate MCP suite | Passed: bearer validation, discovery, read tools, concurrent account contexts, upload/confirm/delete fixtures, scope/ownership boundaries, generation pricing, exact replay/conflict, partial batches, queue recovery, safe token failures, SQL role isolation, and SDK signing. Injected outage messages in test logs are expected fixtures. |
| Free-credit regression | 11 passed, zero failed; includes budget concurrency, replay, refunds, and role restrictions. These are fixture/migration tests, not live fresh-account acceptance. |
| Package metadata regression | Six passed; portable/compatibility manifests, supported fields, archive equality, and Claude CLI manifest validation passed. |
| Compilation and scoped lint | Full type-checked candidate build passed with 147 prerendered routes; worker candidate build and scoped ESLint passed. Both provider builds completed successfully. |
| Dependency audits | Zero findings in both candidate production audits. The worker's hosted image was not redeployed, so this does not certify that image's current dependencies. |
| Public release HTTP checks | 18 passed on production; exact ZIP/guide bytes, legal/support pages, OAuth/PKCE discovery, readiness, safe bearer/origin/token rejection, request tracing, and domain isolation. |
| Production browser setup | All four client choices showed the intended instructions and 0.1.1 links. Desktop layout and a 390px mobile viewport were inspected; mobile document width did not exceed the viewport. No new OAuth approval was submitted. |
| Post-release SEO | 20 passed, including all 13 sitemap pages, canonical redirects, robots/sitemap, unique title/description, one H1, parseable guide Article/BreadcrumbList/FAQ data, private-beta noindex, and an actual 404 for a missing page. |

Saved evidence: [public HTTP checks](plugin-release-http-evidence-2026-10-08.json), [SEO checks](seo-release-regression-2026-10-08.json), [real authenticated tests](plugin-release-live-test-evidence-2026-10-08.json), [actual media retrieval](plugin-release-media-evidence-2026-10-08.json), [bounded log summary](plugin-release-log-summary-2026-10-08.json), [root production audit](plugin-release-root-audit-2026-10-08.json), and [worker candidate audit](plugin-release-worker-candidate-audit-2026-10-08.json). Local build/test logs remain in the ignored `.tmp/plugin-release-*` files.

Repeat the bounded public checks from the workspace:

```powershell
node scripts/check-ugc-pilot-release.mjs --output .tmp/plugin-production-check.json
node scripts/check-public-seo.mjs --output .tmp/seo-production-check.json
node scripts/validate-ugc-pilot-plugin.mjs
node --test scripts/validate-ugc-pilot-plugin.test.mjs
```

Run full MCP, build, and audit commands in the isolated candidate with its installed lockfile; main-workspace dependencies and unrelated source differ from that deployed snapshot.

**Real authenticated production result**

The existing Codex OAuth connection remained usable. Earlier paid image and video jobs/assets remained retrievable. Eight concurrent account reads and three rounds of mixed account/job/asset reads passed before promotion; eight concurrent completed-job reads passed after both releases.

A new one-image release canary used request ID `ugc-plugin-release-20261008-mug-v2`. Job `403f911e-51d9-4f49-96c1-f51d29e26f85` completed in approximately 19.1 seconds and returned asset `c33e9898-5fb3-4ea3-972a-2b75a5bebf09`. Exact replay returned the same completed job. Credits moved from 186 to 185, with zero reserved afterward: **one credit spent, no extra replay charge**. The generated 720×1280 PNG was fetched successfully: HTTP 200, PNG MIME/signature, 1,824,608 bytes. The canary is retained in the account.

No new video was generated during this release test. Previous completed video retrieval passed; a new image-to-video path remains in the signed-in acceptance matrix. A single canary establishes neither general latency nor broad billing certification.

**Open findings**

1. **Unexplained client send failures.** An old-generation replay and an entitlement read intermittently failed with an error sending to the MCP URL; later identical/relevant calls succeeded. Initial collected handler logs did not account for those failed calls. The bounded logs are not sufficient to prove a client-versus-edge root cause. Do not treat successful retries or eight concurrent successes as proof of a permanent fix. Capture precise timestamps/request boundaries from fresh host sessions, compare native HTTP/SDK and installed hosts, and exercise idle/reconnect/refresh. Any uncertain generation must reuse its exact request ID and arguments.

2. **Upload acceptance needs renewed permission.** All three attempted `create_upload` calls ended with **Insufficient scope**. Those errors were initially grouped too broadly with transport failures; their complete messages and the latest server trace explain the rejection. Production inspection showed the existing token has `account:read, brand:read, assets:read, generation:write, jobs:read`, but not `assets:write`. The latest request reached the handler and returned 403, request ID `e79451de-6162-402b-8451-271726bc0d32`. A read-only production query verified zero matching disposable upload records. No upload bytes were sent. Complete upload/confirm/delete after the user renews consent for `assets:write`; do not bypass the permission check.

3. **Installed-host, fresh-account, and OAuth lifecycle tests.** ChatGPT, Claude, and Claude Code signed-in sessions remain deferred by the user. Existing Codex tools passing does not verify bundled-skill activation, a fresh installation, fresh free-account behavior, real two-account isolation, token refresh/revocation/reconnect, or reviewer accessibility in each host.

4. **Directory submission is unfinished.** Prepared [review materials](plugin-review-materials-2026-10-08.md) contain justifications and a recording storyboard. An actual accessible recording, publisher/domain verification, secure reviewer access, tool scans, owner attestations, submission, approval, and independently installable listings remain required. `--submission` intentionally requires the real recording URL; no placeholder recording or approval claim was added. [OpenAI review requirements](https://developers.openai.com/plugins/deploy/app-review)

5. **Operational and worker acceptance is limited.** Request tracing is live. Drains, durable error alerting, and a long-running customer monitoring period were not verified or configured. The worker candidate was patched/tested but its production image was not replaced. Do not broaden the readiness claim to unrelated application flows.

**Post-deploy observability**

The final bounded collection covered 50 MCP log records from 06:05:17–06:15:37 UTC and 20 website records from 06:10:29–06:15:46 UTC. It contained no error-level entries or structured application error events and 33 MCP request traces. Expected negative HTTP tests appear as 4xx responses. A later collection captures the upload's permission rejection described above.

Two website `/api/internal/carousels/replenish` requests returned 401. A [bounded comparison of the previous website deployment](plugin-release-baseline-log-comparison-2026-10-08.json) also recorded three 401s on that path, so the symptom predates this release. It is a separate existing integration observation; this plugin release did not change Carousel behavior or establish that background flow's health. No 5xx appeared in these collected samples; sampling and log availability limit this conclusion. **Monitoring gaps remain**, and absence of server exceptions does not dismiss the observed client failures.

**Rollback record**

| Project | Previous deployment | Previous URL |
| --- | --- | --- |
| `ugc-mcp` | `dpl_34shbMncaicg7Ki2HeR3C2heYtvj` | https://ugc-6sdy1utix-ugcpilot.vercel.app |
| `ugc` | `dpl_94qjVSXUHuVFaU4ytcZjHNzShhMD` | https://ugc-hu0ygucgt-ugcpilot.vercel.app |

If a demonstrated new regression requires rollback, select the affected Vercel project, restore that recorded deployment, inspect its production alias, and rerun the domain checks. The old deployment also restores older dependencies and omits this release's fixes, so halt expansion while repairing the candidate. No rollback was needed for the passed hosted acceptance.

**Remaining sequence**

The subsequent [directory application check](plugin-directory-applications-2026-10-08.md) adds an eligibility decision and a license requirement for Claude, and corrects its connector/bundle submission sequence. These are additional public-distribution gates; hosted-release evidence above is unchanged.

Keep the declared private beta. On user sign-in, reconnect the test account with the needed explicit permissions; run installed acceptance and OAuth lifecycle/two-account tests; resolve unexplained transport failures; verify and release the patched worker candidate if included in the intended production scope; record the actual reviewer flow; submit independently to OpenAI and Claude; verify an approved listing from another eligible account; then observe a limited customer cohort.

The independent SEO assessment and [SEO improvement plan](seo-improvement-plan-2026-10-08.md) remain valid: crawl readiness works, while Search Console indexing, acquisition measurement, unnecessary public font preloads, and complete product examples are the next priorities. This hosted plugin release added regression evidence; it did not claim rankings or implement that separate growth plan.
