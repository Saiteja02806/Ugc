# Explore compact-window follow-up — 9 October 2026

This follow-up includes the complete intentional pending diff in the reconciled release checkout, building on production commit `0afa37597090237143dfd53b7f33ddce53f2f692`. All pending source, tests and documentation are included. The original historical dirty checkout is preserved; its source reconciliation is recorded in `complete-release-inventory-2026-10-08.json`.

## Behavior

- Below 1024 CSS pixels, Controls / Preview switches between the still-mounted panels instead of placing the preview below the entire form. At 900×560 the preview begins around 126px, compared with the previously audited 973px.
- Compact video editors use the available workflow width. Workflow controls opens a temporary controls view; Back to editor preserves drafts and restores focus. Save / Apply rows remain separated from the scrolling tools.
- Slideshows names Reference images, Creating slide and Versions for this slide separately. Reference selection and output quantity contracts remain unchanged.
- Explore overview uses the existing shared muted scrollbar. Crop controls are named Adjust crop & pan.
- Generated videos from the current foreground submission are selected automatically as the opening. Explicit uploads and Creative Assets selections take precedence. Edit / Change actions remain compact; Change returns to the existing source controls without duplicating them in the preview.
- Development fixtures restore known Demo clips and can populate a sample slideshow editor. They remain unavailable in production and cannot generate or save owned outputs.

No provider, worker, API, migration, infrastructure or MCP source is changed. Default background music still applies once across the final combined video through the existing finishing contract. No backend deployment is required.

## Validation and acceptance limits

155 relevant offline checks passed, including local synthetic video editing and Demo composition; scoped ESLint passed. The Next.js 16.3.8 production build passed compilation, TypeScript and all 151 prerender steps. Browser evidence covers 900×560, 1024×640, 1280×640, 1366×680 and 1536×780, including populated slideshow editing, controls-return draft retention and quiet scrollbars. These are CSS window sizes rather than a physical laptop diagonal.

The user deferred paid generation, hosted merging, final background-audio rendering and customer scheduling. These operations are not submitted during release verification. Production checks verify deployment provenance, live route and asset delivery, development-fixture exclusion and signed-out routing; authenticated functional acceptance is not claimed from offline tests.

The existing website deployment target is `ugcpilot/ugc`, serving `getugcpilot.com` and `www.getugcpilot.com`. Deployment uses the exact merged main commit. The existing project Ignored Build Step can be overridden for this one Git-source deployment without modifying shared project settings.

## Excluded local paths

No intentional source, configuration, test, script or documentation path is excluded. The complete ignored-path inventory before staging is:

| Paths | Reason |
| --- | --- |
| `.env.development.local`, `.env.production.local` | Private local environment configuration. |
| `.tmp/` | Screenshots, local verification reports, build archives, receipts, logs and CLI authentication; not runtime source. |
| `.next/`, `worker/dist/` | Generated build output. |
| `node_modules/`, `worker/node_modules/` | Installed dependencies, reproduced from the lockfiles. |
| `next-env.d.ts`, `tsconfig.tsbuildinfo` | Generated types and incremental cache. |
| `.broader-validation.log`, `.build-validation.log`, `.cloud-build-release.log`, `.explore-validation.log`, `.image-validation.log`, `.lint-validation.log`, `.mcp-validation.log`, `.plugin-validation.log`, `.source-validation.log`, `.tmp-types.log`, `.worker-validation.log` | Local validation logs. |

At documentation creation, deployment is pending. Exact source commit, deployment identifier, domain assignment, build result and live verification are recorded in the local release receipt after completion.
