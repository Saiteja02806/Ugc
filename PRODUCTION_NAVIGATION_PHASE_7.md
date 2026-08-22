# Phase 7 Production Navigation Measurements

Measured: 2026-08-22 from India against `https://getugcpilot.com`.

This is a read-only production baseline. The current local navigation,
authentication-cache, shared-query, loading-boundary, and bundle-splitting
changes have not been deployed, so these numbers describe the production
version visible on the measurement date rather than the current worktree.

## Region evidence

- Production requests entered Vercel through `bom1` (Mumbai) and authenticated
  Node functions executed in `iad1` (Washington, D.C./Northern Virginia), as
  shown by repeated `x-vercel-id` values shaped like `bom1::iad1::<request>`.
  Vercel's [current region reference](https://vercel.com/docs/regions) confirms
  those region codes.
- The production Supabase database hostname resolved to
  `2600:1f16:1ce4:1c02:dba2:2278:f945:4a5b`. The current authoritative AWS IP
  ranges place its containing `2600:1f16::/34` network in `us-east-2` (Ohio).
  The repeatable probe reads AWS's
  [official IP range document](https://ip-ranges.amazonaws.com/ip-ranges.json)
  at run time instead of keeping a hard-coded region map.
- Supabase logs independently observed the deployed Node runtime reaching the
  Supabase gateway through the IAD Cloudflare colo from Virginia. Vercel and
  Supabase are therefore in neighboring US East regions, not the same region.

The path is:

`India user -> Mumbai Vercel edge -> iad1 Vercel function -> us-east-2 Supabase`

The largest unavoidable network leg is India to `iad1`. The Virginia-to-Ohio
database hop is measurable but is not the dominant cause of three-second
screen transitions.

## Function and cold-start probe

The public `/status` page and an unauthenticated GET to
`/api/business-profile` were measured from the same process. The API request
returns `401` before user data is read, but still reaches the deployed Node
function.

| Probe | Samples | Minimum | Median | p95 | Maximum |
| --- | ---: | ---: | ---: | ---: | ---: |
| Mumbai edge `/status` | 12 | 47.1 ms | 53.0 ms | 347.1 ms | 347.1 ms |
| `iad1` Node function auth gate | 20 | 240.1 ms | 261.3 ms | 352.1 ms | 425.6 ms |

An additional six-function comparison produced warmed medians of 251-276 ms.
One request reached 556 ms, but slow samples were intermittent rather than a
repeatable first-request penalty. This is not evidence that cold starts are the
main navigation problem. A guaranteed cold-start classification still requires
Vercel invocation logs; the repository probe deliberately labels its first
sample "first observed" instead of claiming it was cold.

## Database timing

Supabase gateway origin timings over the preceding 24 hours for the production
Node client (`supabase-js 2.108.2`, Node 24.18.x) were:

| Requests | Average | Median | p95 | Maximum |
| ---: | ---: | ---: | ---: | ---: |
| 7,671 | 52 ms | 26 ms | 127.5 ms | 894 ms |

The repeatedly requested `business_profiles` table had a 25 ms median,
387 ms p95, and 599 ms maximum across 284 requests. Most database work is tens
of milliseconds; tail latency exists, but it does not explain a stable
three-second delay on almost every protected screen change.

## Authenticated screen-to-screen timings

The existing signed-in production session was used. Each time is from clicking
the persistent sidebar link until the destination URL committed and its level-1
heading was visible. Two warmed passes produced:

| Destination | Pass 1 | Pass 2 |
| --- | ---: | ---: |
| Creative Assets | 474 ms | 427 ms |
| Analytics | 3,215 ms | 3,196 ms |
| Content | 3,245 ms | 3,130 ms |
| Scheduled | 3,140 ms | 3,148 ms |
| Trending | 3,153 ms | 3,250 ms |

First observed protected-route timings were also consistent: Trending
3,180 ms, Analytics 3,186 ms, Content 3,161 ms, and Settings 3,229 ms. Creative
Assets took 1,508 ms on its first visit and about 450 ms once warmed.

Creative Assets is the control route: its route configuration does not require
the business-profile gate. The other measured routes do. The observed
production behavior matches the previous route-specific `AuthGuard` design in
repository `HEAD`: changing protected routes remounts that guard and repeats
Firebase token retrieval, the authenticated `/api/business-profile` request,
Firebase server lookup, and Supabase profile lookup before showing the screen.
This matches the repeated three-second production pattern.

The current worktree already moves this guard and app shell to one persistent
workspace boundary and caches the account-scoped profile gate. Phase 7 does not
add another runtime fix on top of that unverified local work.

## Repeatable probe

Run:

```powershell
npm run performance:production:measure
```

The command performs only non-mutating GET requests, reports observed Vercel
edge/function regions, measures static and function latency, resolves the
Supabase database IPv6 address, and maps it through AWS's current official IP
range document. It never reads or prints API keys, access tokens, cookies, or
user data.

After the current worktree is deployed, repeat the authenticated navigation
matrix. Acceptance should compare the protected routes with Creative Assets;
the expected outcome is that warm protected transitions no longer cluster near
three seconds.
