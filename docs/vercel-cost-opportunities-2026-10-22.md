# Vercel cost opportunities for UGC Pilot — 22 October 2026

This is an assessment, not an implementation or deployment. Application code,
database state, billing settings, deployment retention and provider configuration
were not changed. Existing uncommitted product work was inspected in place.
The only new project document from this review is this report. Source was
inspected at HEAD `b81f02e7` with the existing uncommitted work present; this is
not a claim that the complete worktree is deployed.

## Assessment

The article's approach is useful, especially measuring costs first, avoiding
unnecessary server rendering, reducing repeated work and checking bundles.
UGC Pilot already implements several of these patterns. Its most useful next
steps are build/deployment discipline and targeted public-homepage changes,
followed by reducing unnecessary Proxy work and profiling MCP CPU. Another
frontend caching library is unnecessary.

The cited 35% reduction is another application's outcome, not an estimate for
UGC Pilot. Costs are currently small and within included credit. Optimizations
can preserve capacity and reduce future overages without lowering the fixed
Pro subscription today.

## Fresh account evidence

Authenticated Vercel CLI 60.1.3 queried team `ugcpilot`, grouped by project, at
approximately **6:55 PM IST on 22 October 2026**. The billing cycle runs from
21 October 12:30 PM IST to 21 November 1:30 PM IST.

| Item | Current reported amount |
| --- | ---: |
| Included monthly usage credit | $20.00 |
| Credit consumed | approximately $0.57 |
| Credit remaining | approximately $19.43 |
| Pro platform subscription | $20.00 |

The export's approximately $20.57 total combines the subscription with resource
usage. It does not establish a $0.57 overage: infrastructure usage remains
within the included credit. Usage reporting can lag and rounded credit figures
need not exactly reconcile with the service rows at every instant.

| Usage meter | Charge reported so far | Share of approximately $0.569 usage |
| --- | ---: | ---: |
| Build CPU Minutes | $0.1960 | 34.4% |
| Functions Storage + Deployment Storage | $0.1231 | 21.6% |
| Fluid Active CPU + Provisioned Memory | $0.1057 | 18.6% |
| Charged Observability Events | $0.0385 | 6.8% |
| Fast Data Transfer | $0.0373 | 6.5% |
| CDN Requests | $0.0329 | 5.8% |
| Function Invocations | $0.0155 | 2.7% |
| Other usage | approximately $0.0201 | 3.5% |

The export reports 232 Build CPU Minutes. The earlier same-day
`vercel-monthly-budget-2026-10-22.md` snapshot reported 176 minutes with no build
charge. Its zero-build-cost observation is historical; **the fresh snapshot
does record build costs**. Neither snapshot establishes a full-month run rate.

| Project | Reported infrastructure usage |
| --- | ---: |
| `ugc` | approximately $0.3251 |
| `ugc-mcp` | approximately $0.1764 |
| `trending-release-web-3f35202` | approximately $0.0676, entirely build CPU |

The project breakdown contains fractional invocation attribution; treat it as
billing attribution, not an exact HTTP request counter. Approximately 72% of
team Active CPU charges are attributed to `ugc-mcp`. That identifies a profiling
target, not a proven defect or an attribution to a particular tool operation.

Raw usage evidence is retained in ignored local file
`outputs/vercel-cost-code-review-project-usage-2026-10-22.json` and should not be
published as release source.

Current Pro includes $20 usage credit with the $20 platform fee.
[Vercel Pro pricing](https://vercel.com/docs/plans/pro-plan).
Fluid separates Active CPU, memory during in-flight requests and invocation
charges. Reducing invocation counts alone does not remove all runtime costs.
[Fluid pricing](https://vercel.com/docs/functions/usage-and-pricing).

## Prioritized opportunities

### 1. Reduce avoidable builds and retained deployment output

**Measured relevance:** builds and stored output together currently account for
about 56% of reported infrastructure usage, although these small early-cycle
amounts do not predict the eventual monthly mix.

Build usage is attributed to the website, MCP project and a release project.
This alone does not prove duplicate or unnecessary builds. Check deployment
history for repeated builds of the same revision, simultaneous Git/manual
deploys, and release previews that are no longer needed. Batch related UI edits
into validated releases, preserve build-cache reuse and avoid rebuilding an
unaffected project when release dependencies permit it.

Inspect each project's deployed Resources before choosing retention or package
changes. Both deployment output and function bundles carry storage charges.
Retain an adequate rollback window and required native binaries/fonts; do not
delete releases or apply broad tracing exclusions just because a build passes.
The existing `.vercelignore` already excludes local worktrees, audits, outputs,
caches and local Try UGC Pilot originals. That packaging improvement should be
retained, but source-upload size is not billed function/output size.

The same repository serves the website and MCP, while `MCP_ONLY_DEPLOYMENT`
restricts routes in Proxy. Runtime route blocking does not itself demonstrate a
smaller MCP build. Compare actual output before considering a smaller MCP build
boundary. That is a larger change and must preserve OAuth pages and tool
dependencies.

**Acceptance:** compare build CPU, build counts and deployed resource/storage
sizes over equivalent release activity; verify native media routes and rollback.
Do not equate a 40% faster build with a 40% lower total hosting bill.
[Build pricing](https://vercel.com/docs/builds/managing-builds),
[Deployment Storage pricing](https://vercel.com/docs/deployment-storage).

### 2. Make the public homepage static where personalization permits

**Confirmed source:** `app/page.tsx:111` reads `cookies()` only to supply the
initial session hint used by landing sign-in/Start Posting actions.
`components/marketing/landing-auth-actions.tsx` already reconciles authentication
in the browser. The inspected existing local build's prerender manifest includes
pricing, guides, legal pages and many application shells, but not `/`.

**Confirmed production:** a public request through
`https://www.getugcpilot.com` redirected to `https://getugcpilot.com/` and returned
the actual homepage with HTTP 200, `x-vercel-cache: MISS` and
`Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`.
This is a current observation; older audit notes about unavailability are not a
description of this request.

**Recommendation:** prerender the shared marketing page and let the small auth
CTA resolve its label/destination in the browser with an intentional initial
state. Preserve hydration behavior, email verification routing and correct
signed-in navigation. Do not merely attach public cache headers to the current
personalized response.

Most application screens already have prerendered shells and load private data
through APIs. Broadly replacing dashboards with ISR would miss the main issue.
Private credits, media, schedules and job state must retain their account and
freshness rules. Installed Next.js is 16.3.8, with Cache Components not enabled;
the matching bundled caching guide was inspected. Enabling that feature is a
separate migration, not a one-line prerequisite for this optimization.

**Acceptance:** build shows `/` prerendered; production shared HTML can be served
from cache; signed-out, signed-in and unverified CTA flows remain correct.
[Next.js caching model](https://nextjs.org/docs/app/guides/caching-without-cache-components).

### 3. Stop preloading editor fonts on public pages

**Confirmed source and production:** `app/layout.tsx` declares browser editor
fonts in the root layout. Production homepage HTTP `Link` headers preload eight
font files, including Arial regular, Arial bold and Avenir Next demi bold.
`components/marketing` does not reference the editor font variables.

The three matching local source/output font files total **2,299,972 bytes before
HTTP compression**. Production serves the TTFs with Brotli encoding, so this is
not a claim of 2.3 MB actual wire transfer per visitor. Cached repeat visits may
reuse these immutable files. The concrete issue is unnecessary preload demand
on first visits to pages that do not need editor typography.

**Recommendation:** keep marketing fonts global; scope overlay font loading to
the workspace/editor routes that require it, or selectively disable preload
where the font is not needed immediately. Preserve the exact browser/worker
font match that keeps saved overlay layouts consistent. Review global Geist
Mono and italic preload use as a secondary step.

**Acceptance:** public homepage preload headers no longer include editor-only
fonts; cold-visit resource measurements improve; all editing previews retain
their existing metrics and exported text layout.
[Next.js font preload behavior](https://nextjs.org/docs/app/api-reference/components/font#preloading).

### 4. Reduce landing-video transfer without losing useful previews

**Confirmed source and production:**
`components/marketing/landing-hero-showcase.tsx` starts the center preview after
750 ms and enables the side preview on desktop. Both videos autoplay. Production
HEAD responses confirm these current resources:

| Hero video | File size |
| --- | ---: |
| `left_side-v3.mp4` | 6,212,902 bytes |
| `middle.mp4` | 2,466,545 bytes |
| Combined desktop resource size | **8,679,447 bytes, about 8.68 MB** |

This is the complete resource size, not a browser-waterfall measurement proving
every visitor downloads both files in full. `preload="metadata"` does not cap
bytes once autoplay starts. Both responses currently use
`public, max-age=0, must-revalidate`.

**Recommendation:** encode appropriately sized short previews, retain posters,
and control playback/loading by visibility, reduced motion and data-saving
preferences. Use immutable versioned or content-hashed URLs with a suitable
cache policy if the files will never change at those URLs. Moving public video
to the existing media delivery infrastructure can reduce Vercel transfer, but
compare the resulting storage/CDN egress costs; that shifts costs between
providers rather than making delivery free.

**Illustration only:** saving 5 MB on 10,000 fully affected cold visits saves
about 50 GB of transfer. Dollar savings depend on actual playback, CDN terms,
request regions and which allowances offset the usage.

**Acceptance:** production browser waterfall and playback/quality checks on
desktop/mobile; compare transferred video bytes per landing visit.

### 5. Narrow unnecessary Proxy execution and profile MCP CPU

**Confirmed source:** `proxy.ts:40` matches `/:path*`, including static chunks,
fonts, images and API routes. The proxy enforces website/MCP separation and
sets selected headers. The installed framework uses Node.js Proxy.

**Supporting hosted evidence:** a bounded MCP log query requested up to 200
entries from the last 24 hours and returned 50 entries. Of those, 32 were
`serverless-middleware` records, alongside MCP, token and discovery route
records. This sample is not the full day's traffic and does not provide CPU
attribution per route.

**Recommendation:** start by excluding only paths already intentionally allowed
on both deployments, such as framework static assets, after verifying header
requirements. Preserve the MCP deployment boundary and private-page indexing
rules. A blanket exclusion for all APIs or all file extensions can bypass the
existing isolation policy.

Profile `/mcp` work separately. `lib/mcp/server.ts` creates a server and registers
all tool families through the SDK factory; the installed SDK invokes the factory
per exchange. Schema construction/serialization is a candidate to measure,
along with tool execution and cold starts. The SDK enforces per-request server
lifecycle, so reusing one connected server globally is not a safe shortcut.
Likewise, do not weaken token revocation checks to reduce database reads.
Stable public discovery metadata is a separate possible caching target after
confirming its deployment-specific issuer and resource identity.

**Acceptance:** observe Proxy requests before/after, test both deployment hosts,
OAuth discovery/login/token exchange and required headers; profile MCP CPU
before choosing a handler change.
[Node.js Proxy billing](https://vercel.com/docs/functions/runtimes/node-js).

### 6. Consolidate remaining polling; retain the existing query cache

`components/providers/job-query-provider.tsx` already uses TanStack React Query
with account-specific client lifetimes, 30-minute default freshness, one retry
and a one-hour cache lifetime. Image/library queries override freshness where
needed, and mutations invalidate relevant data. Adding SWR would duplicate this.

`lib/jobs/background-job-client.ts` polls active-job discovery every five seconds
while jobs exist and every 30 seconds while empty. Individual unfinished job
queries also poll every five seconds, then stop at terminal status. An empty
visible list is nominally 120 reads/hour; each individual active job is nominally
720 reads/hour, before request duration, retries or tab lifecycle effects.
Simultaneous list/detail observers can overlap in purpose.

React Query's normal interval behavior already pauses background-tab polling,
and `lib/http/foreground-polling.ts` provides a shared hidden/offline guard.
Recent local performance work also addresses resume/cancellation. Those changes
must not be counted as new work or assumed deployed from this audit.
One remaining handwritten loop in `components/trending/reaction-text-editor.tsx`
polls preparation every 2.5 seconds and retries errors every five seconds without
an explicit visibility/offline guard in that component.

**Recommendation:** reuse list responses to populate matching detail caches
where contracts permit, batch status reads, back off empty/error polling and
use the shared foreground lifecycle in remaining handwritten loops. Preserve
cross-device recovery, progress updates and the final completion read. Do not
increase the global cache TTL for credits, schedules or changing job state.

Invocation charges are currently only about 2.7% of reported infrastructure
usage. This work can also reduce CPU/database work, but present it primarily as
scale and responsiveness work until route metrics establish dollar impact.

### 7. Reuse immutable Hook source frames when this workflow has volume

`lib/explore/hook-source-frame.ts` downloads a verified canonical video and uses
FFmpeg to decode frame zero. It already coalesces concurrent work within a
process and keeps an eight-entry, 24 MiB cache with a five-minute TTL. It does
not reuse that result across cold instances. The starting-frame API and
keyframe-generation preparation call this service; the paid image generation
itself uses the existing background worker.

**Recommendation:** consider preparing the exact canonical first frame once and
storing it under an immutable source-hash/decoder-version key. Preserve verified
dimensions, frame-zero identity, entitlement checks and provenance. Do not use
a decorative poster as a substitute. Profile extraction volume first: most
current Active CPU attribution is to MCP, so the account export does not prove
that Hook extraction is the present CPU cost driver.

Native decoder tracing in `next.config.ts` and the postbuild decoder checks are
intentional. Do not remove the binary to shrink a bundle while the route still
depends on it. Compare worker/storage costs before moving extraction elsewhere.

### 8. Treat private streaming as conditional future work

`app/api/media/delivery/[assetId]/route.ts` streams private storage objects through
Vercel, including byte ranges. Such traffic can consume transfer and runtime
resources. However, `lib/media/private-media-storage.ts` deliberately disables
new private-media writes during the unfinished rollout, and this review did not
establish material live traffic to this path. It is not a confirmed current drain.

Short-lived storage-signed delivery could reduce proxy transfer if this path
becomes significant. The current application URL rechecks ready/deleted state
on every read, so deletion revokes existing links. A storage-signed URL may stay
usable until expiry. Any replacement must explicitly preserve the required
revocation/access behavior. Never share-cache private response bytes to save cost.

## Recommendations from the article already present

- Prerendered marketing guides, pricing/legal pages and private application shells.
- Account-scoped React Query caching and query invalidation; no need to add SWR.
- Dynamic imports for Explore image/video panels and editors and the Scheduling
  editor. There is no evidence here of an entire icon library reaching clients.
- Background generation/rendering rather than holding web requests open for the
  entire job, with durable status/recovery reads.
- Public image-picker thumbnails bounded to 256 pixels, selective public-image
  optimization and conservative library preview loading.
- Direct signed storage uploads for existing media flows, rather than carrying
  every upload through Vercel.
- Local packaging exclusions and recent visibility/resume improvements. Existing
  source improvements still require their own release/acceptance evidence.

Root layout also places Firebase/auth and the query provider on marketing pages.
That is a secondary bundle-analysis target. Any provider split must keep the
landing CTA and redirect handler working. The existing local build predates some
current edits; manifest chunk totals are not fresh Lighthouse/production transfer
measurements and are not used as promised savings.

## Proposed order and validation boundary

1. Measure deployment/build duplication and resource retention; establish a small
   repeatable dashboard by project and meter.
2. Scope public-page fonts and prerender the shared homepage while retaining auth
   CTA behavior; optimize the hero video resources and delivery policy.
3. Narrow safe Proxy matches and profile MCP CPU. Preserve host isolation.
4. Consolidate remaining status reads and consider durable Hook frames only when
   request/extraction volume justifies it.

Measure a comparable period after release: build CPU per release, retained output,
home cache behavior, cold-visit font/video bytes, Proxy invocations, MCP Active
CPU and status requests per completed generation. Include GCS, external workers,
Supabase and model-provider spend when a change moves work between services.

No application tests/build were rerun because application code was not changed.
This review inspected source, bundled framework/SDK documentation, existing local
build artifacts, fresh authenticated billing attribution, bounded hosted request
metadata and public production HTTP responses. It did not exercise authenticated
production generation, editor or publishing flows, run paid generation, or prove
before/after savings. No upgrade to Enterprise is justified by the current usage
or this article alone.

References: [supplied case study](https://pagepro.co/case-studies/vercel-cost-optimization-for-saas-scalability),
[Pagepro optimization article](https://pagepro.co/blog/optimizing-vercel-hosting-costs/).
