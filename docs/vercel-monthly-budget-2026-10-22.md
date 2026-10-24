# Vercel monthly budget audit — 22 October 2026

Read-only account and repository audit. No billing settings, subscriptions, budgets, retention policies, deployment state or application code were changed by this audit. No paid media generation was run.

## Actual account usage

Authenticated Vercel CLI 60.1.3 was queried for team `ugcpilot` on 22 October 2026. These are **team-wide** totals, not a project-specific attribution. The reported billing cycle is **21 October 2026 07:00 UTC to 21 November 2026 08:00 UTC** (21 October 12:30 PM to 21 November 1:30 PM IST).

| Item | Reported amount |
| --- | ---: |
| Included infrastructure credit | $20.00 |
| Credit used so far | approximately $0.23 |
| Credit remaining | approximately $19.77 |
| Pro subscription | $20.00 |

The CLI's approximately **$20.23 total combines the $20 subscription with $0.23 of infrastructure usage**. It does not mean $20.23 of included credit was consumed or that an overage has occurred. Rounded figures are appropriate because usage continues and reporting can lag.

Largest reported usage charges:

| Meter | Usage charge so far |
| --- | ---: |
| Fluid active CPU | $0.0501 |
| Functions Storage | $0.0430 |
| Fast Data Transfer | $0.0373 |
| CDN Requests | $0.0329 |
| Deployment Storage | $0.0266 |
| Fluid provisioned memory | $0.0149 |
| Image transformations | $0.0088 |
| Function invocations | $0.0086 |
| All remaining usage meters | approximately $0.0066 |

The daily export contains only one day with recorded usage at inspection time. Future dates contain placeholder zero usage and allocated subscription amounts; they are not observed traffic-free days. It reports 176 Build CPU Minutes with **$0 charge**, so builds are not a measured current cost problem. A full-month traffic forecast would be premature, particularly while the existing production deployment has been unavailable.

Evidence was saved locally under ignored `outputs/vercel-budget-current-usage-2026-10-22.json` and `outputs/vercel-budget-daily-usage-2026-10-22.json`; these transient exports are not release inputs. Account/project response exports must not be published because they can contain private configuration.

## What the included $20 covers

Vercel Pro's $20 monthly platform fee includes one deploying seat and $20 of infrastructure credit. Managed infrastructure draws on that credit from the first unit; unused credit expires rather than accumulating. Extra seats and separately billed products can add to the bill. This credit is not a balance for Seedance, ReAPI, Gemini, Supabase, GCS or external rendering workers. Track those providers independently. [Vercel Pro plan](https://vercel.com/docs/plans/pro-plan)

Current public pricing also advertises a zero-price Flat Rate CDN tier with 1 million requests and 1 TB transfer. This account export lists `Flat Rate CDN 1M` at $0 **and** chargeable CDN/transfer rows. That coexistence does not establish which rows will be offset or how the team's configuration is reconciled. Confirm Billing and the settled invoice before forecasting CDN costs from the public allowance. Flat Rate CDN eligibility excludes services primarily delivering bulk downloads or large-scale media hosting. Do not enable or upgrade a paid tier on the assumption that all UGC video traffic qualifies. [Flat Rate CDN](https://vercel.com/docs/pricing/flat-rate-cdn)

## Practical plan for this cycle

1. **Aim for $15 infrastructure usage and retain $5 headroom.** Roughly $0.50/day is a useful operating target over a month, not a hard limit. Compare total usage with elapsed billing days, not the calendar month. At present $0.23 used leaves substantial room, but real production traffic must be measured after restoration.
2. **Inspect Usage daily for the first seven live days, then weekly if stable.** Record credit used, daily usage excluding subscription, top meter and top project. Investigate a sustained pace above $0.50/day or an abrupt change. Use the same team and date range each time. No recurring automation was created by this audit.
3. **Review spend controls deliberately.** In Team Settings → Billing → Spend Management, an On-Demand Budget applies to usage *beyond* included credit. A $20 on-demand budget permits another $20 of overage. A budget alone does not stop service; automatic pausing is a separate action that takes the team's production sites offline and can run after additional usage accrues. Storage and separately billed products can continue costing money. Choose a small acceptable overage only after deciding whether downtime is acceptable. No cap or pause action was changed. [Spend Management](https://vercel.com/docs/spend-management)
4. **Prioritize the measured CPU, retained output and transfer costs.** Their individual current amounts are small; preserve working functionality while improving reuse and measuring each change.

## Repository-specific priorities

| Priority | Evidence in this repository | Recommended next action |
| --- | --- | --- |
| 1 | `next.config.ts` traces native FFmpeg for Hook frame APIs; `lib/explore/hook-source-frame.ts` caches extracted frames only in each process for five minutes. Cold instances can fetch and decode a source again. | Profile extraction count and CPU, then consider reusing a durable, immutable canonical first-frame asset keyed to verified source hash. Preserve ownership checks and source provenance. This is a candidate optimization, not a measured attribution of all CPU spend. |
| 1 | Both retained Functions Storage and Deployment Storage are already charged. Native binaries, static media and repeated deployment outputs can enlarge stored releases. | Inspect deployment Resources sizes and project storage breakdown, audit the required rollback window, then propose retention or bundle changes. Keep required FFmpeg/fonts and a validated rollback release. Do not delete deployments indiscriminately. |
| 2 | `app/api/media/delivery/[assetId]/route.ts` securely streams private assets through Vercel with range support and `no-store`. Large video delivery can incur function and transfer usage. | Measure route bytes/requests. If substantial, evaluate short-lived signed private storage delivery with equivalent authorization. Never turn private media into publicly cached assets to save cost. |
| 2 | `lib/jobs/background-job-client.ts` polls active jobs every five seconds and the visible idle job list every thirty seconds. Current release also includes batching and visibility-aware polling work documented in `docs/ui-performance-2026-10-22.md`. | Verify deployed request counts before further changes. Retain completion recovery; deduplicate identical reads and avoid polling hidden/offline screens. Polling frequency is an implementation observation, not proof that all invocation cost is unnecessary. |
| 3 | `components/social/use-social-account-picture.ts` and the corresponding private picture route introduce an authenticated social avatar proxy with a five-minute client cache. | Measure proxy volume after release. Keep provider-host validation and the private cache policy; reuse valid client data rather than repeatedly renewing avatars. |
| 3 | `lib/media/image-picker.ts` already uses bounded 256px public thumbnails; image transformation/cache spend is currently under one cent. | Keep stable immutable public URLs and bounded sizes. Do not disable useful optimization or apply shared public caching to signed/private images. |
| 3 | Public marketing preview video can contribute CDN transfer; Explore previews already use conservative preload/lazy behavior. Direct reference uploads and signed owned downloads already avoid much binary proxying. | Inspect actual transfer paths before replacing the architecture. Preserve direct storage uploads, lazy previews and existing access rules. |

Vercel bills Fluid CPU while code executes; memory can remain billed during in-flight I/O. Thus a long request waiting for a provider is not necessarily free. Keep asynchronous generation on the existing external generation worker, with Vercel handling admission/status; the rendering worker handles `render_demo_video` separately. Do not move those jobs into long-lived web functions to simplify the UI. Region prices differ; no region or memory change is justified without the database/network layout and real profiling. [Functions usage and pricing](https://vercel.com/docs/functions/usage-and-pricing)

Retained deployment output is billed in GB-months, using each project's maximum stored amount per billing day. Deployment output and Function bundles are separate meters, each listed at $0.10/GB-month. Shorter retention reduces future stored history and rollback options; it does not refund already incurred storage. [Deployment Storage](https://vercel.com/docs/deployment-storage)

For output work, compare Resources before/after and test changed functions; broad tracing exclusions can pass a build yet break runtime. New Pro teams now default to 30-day retention, but this audit did not verify or change this team's effective policy. [Storage optimization](https://vercel.com/docs/deployment-storage/optimize), [retention announcement](https://vercel.com/changelog/new-pro-teams-now-default-to-30-day-deployment-retention)

Batch small UI changes into one validated release, reuse the build cache and investigate duplicate Git/manual deploy triggers. Current public build pricing depends on CPU minutes, machine size and account terms; this account currently reports zero build cost. Avoid promising savings from switching machines without measuring build duration and rate. [Managing Builds](https://vercel.com/docs/builds/managing-builds)

## Separate production availability observation

Release packaging preflight found an additional concrete issue: the CLI source
manifest included local worktrees, generated audits and prototypes—31,353 entries
and 2.33 GB before upload. Adding their existing local-only exclusions to
`.vercelignore` reduced the dry-run manifest to about 4,172 entries / 309 MB,
before the last screenshot/history exclusions. These were inspection-only dry
runs. This reduces unnecessary source transfer; it is not a measured percentage
reduction in billed deployment output, Function Storage or runtime usage. Required
application sources, native decoder assets and public product media remain.

Read-only API responses show this team as **Pro, active, not limited, with no `blocked`, `softBlock` or feature blocks**. The current production target was `READY` / `PROMOTED`. Project/deployment responses inspected did not expose an explicit paused flag or the reason for the previously observed HTTP 402.

An HTTP 402 `DEPLOYMENT_DISABLED` is distinct from the documented HTTP 503 `DEPLOYMENT_PAUSED`. Current credit usage does not establish a spend-cap cause. The existing disabled deployment may need a new deployment or platform support investigation; that is an inference, not a confirmed root cause. Deployment restoration belongs to the release owner, and this audit did not change billing restrictions. [Disabled deployment](https://vercel.com/docs/errors/deployment_disabled), [paused deployment](https://vercel.com/docs/errors/deployment_paused)
