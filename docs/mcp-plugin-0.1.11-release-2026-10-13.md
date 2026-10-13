# Plugin 0.1.11 release checkpoint

Source: `fb7728fc8ac4f1e66ad55fb45b6830d267ad1b38`, [PR #49](https://github.com/Saiteja02806/Ugc/pull/49), stacked on the approved released backend `e3de4a4eb66cb7c7c6e6de6bda9bc9062aafbc63`. Both exact-commit MCP workflows passed: [38370445849](https://github.com/Saiteja02806/Ugc/actions/runs/38370445849) and [38370522979](https://github.com/Saiteja02806/Ugc/actions/runs/38370522979). The primary website preview is READY. The separate Trending preview failed and is excluded, so not every PR check is green.

## READY staged production builds

| Target | Deployment | URL |
| --- | --- | --- |
| Website | `dpl_Hb73txJSLLsrL6AEdvyvriVKJ4sX` | `https://ugc-k3eh8k08y-ugcpilot.vercel.app` |
| MCP | `dpl_5BKnHWecdmetkcuqt8WkDTEvyA72` | `https://ugc-442zidzbc-ugcpilot.vercel.app` |

Both authoritative deployment reads confirm READY, the full source SHA and matching Git/GitHub metadata. They were uploaded from the clean isolated checkout with `--prod --skip-domain`, explicit website/MCP isolation flags and all five new-write gates set false at build and runtime. Persisted production settings on both projects also confirm plain false for groups, Library, text remix, audio import and private uploads. API deployment `env` data only exposes descriptors/names rather than the actual runtime values, so that field is not a separate proof of resolved flag values.

All intentional source, package, setup-page and validation changes are included. All 17 earlier downloads and both transfer helpers are unchanged. Local environment files, caches, dependencies, build output, logs and temporary helpers are excluded by `.vercelignore`; unrelated dirty primary-workspace changes are outside this isolated package release. No new migration, worker, bucket/IAM or customer-media operation is included.

## Protected-stage verification pending

CLI 59.13.1 `vercel curl` incorrectly forwards `--global-config` to curl, which rejects it. Normal stage URLs return a Vercel login page after redirect, not the application; HTTP 200 alone was not accepted as success. The available in-app browser is also signed out. No browser credentials were requested or extracted, and the temporary browser tab was closed.

The documented deployment-specific access endpoint can create short-lived shareable links with a TTL and revoke each after local testing. The proposed verifier uses two five-minute grants only in memory, checks setup/noindex, exact ZIP/guide/checksum, health and host isolation, and immediately revokes each grant. It neither prints/persists links nor changes project-wide deployment protection. See [Vercel endpoint documentation](https://vercel.com/docs/rest-api/aliases/update-the-protection-bypass-for-a-url).

Automatic approval review rejected execution because temporary protection-bypass links are an access change not specifically authorized by the user. The script did not run; no grant was created. The user has been asked to approve these exact checks, sign into Vercel instead, or leave the builds staged. This is the current release checkpoint, not a successful stage-verification or promotion claim.

## Current public release

Pre-promotion reads confirmed the website custom domain still targets `dpl_H2K9hU7bq11m6fgNjyK59bTPmQkJ`, MCP `dpl_DGU8S51aUof1u1ZvdojXWCAuLsWE`, both at `e3de4a4...`. The setup page serves plugin 0.1.9 and MCP health is ready. Final alias/source/public artifact checks remain required after promotion. No custom domain promotion has been issued in this checkpoint.

Full application parity remains unfinished. Package publication does not activate disabled writes, refresh an active client catalogue, install new skills, or prove Claude Code/local upload acceptance.

## Ordinary Vercel sign-in completed

The user chose ordinary Vercel sign-in instead of temporary access grants and completed it. The protected staged website now renders the actual `/connect-ai` application page. All three 0.1.11 links and `noindex, nofollow` were observed. Browser downloads of the ZIP, standalone guide and checksum succeeded; the ZIP SHA-256 is the expected `e9e73d12ffb8ba6767d3fb43fb7c42ca8502f144574d4851f6280f016e79b7f5`.

The browser reported `net::ERR_BLOCKED_BY_CLIENT` for navigation to the separate staged MCP `/mcp/health` endpoint. That check remains incomplete; no alternate access grant or credential extraction was attempted. Promotion remains pending. The sign-in tab is retained for the user. This updates the earlier signed-out checkpoint without treating sign-in as authorization for bypass links.

## Follow-on source audit while release authorization is pending

The primary worktree still exports slideshow text through `document.createElement("canvas")`, browser text measurement and `canvas.toBlob` in `lib/explore/slideshow-text-client.ts`. Its `slideTextSvg` layout already lives in a pure shared module, with explicit font/alignment/position/background inputs. A backend renderer must reuse that design/layout contract with real server font measurement and rasterization; merely saving raw images cannot satisfy requested text rendering.

The primary worktree also contains unreleased Explore clip-draft contracts/store/API and migration `20261012212314`. These save revisioned JSON separately from rendering, but the routes authenticate Firebase requests and the current MCP draft tools still cover the dedicated Edit surface. Future Explore draft access should adapt the existing owner-scoped store after reconciling that candidate, rather than duplicate its tables or forward MCP tokens to a Firebase route. This inspection is not evidence of production rollout or MCP draft acceptance.
