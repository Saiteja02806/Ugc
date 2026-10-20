# Explore workflow release — 9 October 2026

This release ships the complete intentional pending diff in the Explore release checkout. Hook and Wall of text use Create, Demo and Schedule, with independent clip editing opened from each preview. Accepted uploads appear automatically; failed replacements preserve the accepted video. Demo source actions and the background-audio switch are simplified. Demo edits retain their own text, timing, framing and sound. Scheduling drafts are scoped to owner, format and output, and pending sources cannot be scheduled.

The local laptop layout fixes reserve separate editor headers and Save / Apply action rows, retain a 160px instruction area, use compact reference tiles, offer a focused editor with source-control reveal, and use subdued scrollbars in workflows, dialogs and navigation. Drafts and editors remain mounted through navigation. The fixture stays development-only.

Validation: 164 offline regressions passed, including synthetic local FFmpeg editing and Demo composition. Scoped ESLint and the Next.js 16.3.8 production build passed; the build includes TypeScript checking and 151 prerender steps. Existing local browser evidence covers compact, scaled and expanded-control layouts. Paid generation, hosted merging and customer scheduling were not dispatched; the user deferred that test.

This release does not claim all perceived compact-window density is resolved. The separately proposed Controls / Preview switch, workspace-width-based composition and further portrait-preview balancing have not been implemented and are not represented as released features.

Generation prompt defaults and slideshow business-context worker changes remain explicitly deferred. No generation provider, backend API, migration, infrastructure or worker source path is modified by this pending release. The existing UGC website project is `ugcpilot/ugc`; production is `www.getugcpilot.com`. The MCP and GCP worker deployment targets do not require a release for this frontend change.

## Excluded local paths

These are the ignored paths in the release checkout before staging. No intentional pending source, test or documentation file is excluded.

| Path | Reason |
| --- | --- |
| `.env.development.local` | Local environment configuration; private values remain local. |
| `.env.production.local` | Local production build configuration; private values remain local. |
| `.tmp/` | Temporary audit screenshots, logs, receipts and local CLI authentication; not runtime source. |
| `.next/` | Generated Next.js build output. |
| `node_modules/` | Installed dependencies, rebuilt from the lockfile. |
| `worker/node_modules/` | Installed worker dependencies. |
| `worker/dist/` | Generated worker build output; no worker deployment is needed. |
| `next-env.d.ts` | Generated Next.js type declarations. |
| `tsconfig.tsbuildinfo` | TypeScript incremental cache. |
| `.broader-validation.log` | Local validation output. |
| `.build-validation.log` | Local validation output. |
| `.cloud-build-release.log` | Local build output. |
| `.explore-validation.log` | Local validation output. |
| `.image-validation.log` | Local validation output. |
| `.lint-validation.log` | Local validation output. |
| `.mcp-validation.log` | Local validation output. |
| `.plugin-validation.log` | Local validation output. |
| `.source-validation.log` | Local validation output. |
| `.tmp-types.log` | Local validation output. |
| `.worker-validation.log` | Local validation output. |

The separate original workspace's historical dirty changes remain preserved. They are not silently substituted for this release checkout, whose baseline was reconciled in earlier releases. The pending Explore diff is integrated with current remote main before release.

Deployment status at document creation: validation complete; commit, push and production deployment pending. Exact source provenance, domain assignment and HTTP / browser acceptance are recorded after deployment in the local release receipt. Authenticated paid flow acceptance is reserved for the user's later test.
