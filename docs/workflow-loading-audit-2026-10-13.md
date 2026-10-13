# Production workflow loading audit — 13 October 2026

The requested flow is Explore → click a workflow → interactive workflow screen, including immediately switching to another workflow. This audit is read-only for production; it does not deploy changes or generate media.

## Confirmed live state

Vercel reports the production domain on deployment `dpl_DtdBHu576DFWeK8FM5ftsWJTFxn7`, source commit `a2b3dd79ebf20c6a6ae96f493523cc695d6feccb`. The local static-route and full-prefetch fixes are not part of that live commit at the time of this audit.

Three unauthenticated GET samples per route from the available execution host returned HTTP 200. The observed edge region was `bom1`; dynamic workflow responses also included function region `iad1`.

| Route | First-byte samples (ms) | Cache |
| --- | --- | --- |
| Explore | 290, 72, 64 | HIT |
| Talking Head + Demo | 308, 293, 293 | MISS |
| Hook video | 316, 315, 298 | MISS |
| Wall of text | 301, 293, 285 | MISS |
| Slideshows | 302, 301, 343 | MISS |
| Build AI influencer | 325, 272, 305 | MISS |

First-byte time includes network latency. The first Explore sample includes connection startup. These numbers describe route HTTP responses, not signed-in click-to-ready time. The observed server wait alone does not establish a multi-second delay.

## Findings

1. **Live workflows still dynamically render on each entry.** Workflow responses use `private, no-cache, no-store` and miss CDN cache. Production source awaits server query parameters, even where they only configure development fixtures. This adds a server round trip compared with cached Explore. The local production build already confirms static Hook, Wall, Slideshows and Build AI influencer routes; they require release before users receive that improvement.
2. **Live workflow cards lack full-route prefetch.** The live `ExploreWorkflowCard` uses default Link prefetch for dynamic destinations, which does not fetch the complete workflow in this configuration. The local cards now specify full prefetch. Talking Head remains dynamic because its production preview query guard is still meaningful; its local full-prefetch change helps but does not make its server rendering static.
3. **First workflow entry has a substantial JavaScript load.** Hook, Wall and Slideshows initial HTML references about 1.67 MB of decoded JavaScript in total (about 494 KB with estimated gzip compression), versus Explore's 857 KB (266 KB estimated gzip). About 824 KB decoded / 231 KB estimated gzip is additional to Explore. This can contribute to slower first entry on slower networks/devices. Hook → Wall → Slideshows use the same initial script URLs, so these sizes should not be treated as a fresh full download on each switch. Talking Head adds approximately 221 KB decoded / 68 KB estimated gzip after Hook.
4. **Animated covers can compete for bandwidth.** The five local Explore cover MP4 assets total approximately 8.34 MB. The current playback hook attaches each visible cover automatically. The potential bandwidth impact is an inference from the source and asset sizes; no authenticated production video/download contention trace was captured.

## Checks and limits

- All measured workflow HTML routes and fetched initial JavaScript assets returned 200; no route/chunk HTTP failure was observed in these samples.
- Profile access, billing and reference catalogue queries are cached in the account query client. Source inspection does not show an unconditional whole-page database wait on every workflow switch; a fresh authenticated entry still needs its profile gate/catalogue data.
- The existing production browser had no signed-in session during the earlier check, and the current shared browser endpoint was already in use. CUA initialization was unavailable. Therefore no authenticated rapid-switch trace, API duration, long-task timing or exact click-to-ready measurement is claimed.
- The local fixes passed the previously recorded production build, 145 targeted checks and character/browser verification. This audit did not rerun unrelated validation.
- Detailed route/chunk measurements are in `.tmp/workflow-production-latency-audit.json`; the read-only measurement script is `.tmp/audit-workflow-latency.mjs`.

The next acceptance check is authenticated rapid workflow switching on the real domain after the routing/prefetch changes reach production. If a multi-second delay remains, capture the clicked route's network and main-thread trace to distinguish catalogue/profile API waits, chunk loading and browser rendering from the measured server round trip.
