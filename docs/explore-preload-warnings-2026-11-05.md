# Explore preload warning audit — 5 November 2026

Read-only production reproduction, deployment `dpl_G5A9YWn6fUDSX61YzhESNqkZyEvm`. No application fix, build, deployment or production setting change.

## Verified causes

1. **Speculative route CSS.** Explore workflow cards explicitly use `prefetch={true}`. Other visible navigation links also prefetch. Next/React downloads destination stylesheet resources before the user opens the route. The signed-out public Explore test created11`as="style"`preloads after hydration; their sheets were not applied to the current page, producing11warnings. The eight user-listed files all return200and`text/css; charset=utf-8`; none is a missing stylesheet. Their contents identify Slideshow/final-video controls, overlay fonts, AI Character dock, workflow-draft entry, image library and analytics styles.
2. **Unused Instrument Serif root font preload.** `app/layout.tsx` configures `brandSerif` with no`preload:false`; Next's default preloads its TTF globally. The actual live HTML includes`a5a846b80042abc2-s.p.ttf`with correct`as="font"`,`type="font/ttf"`,crossorigin. Browser font status after12seconds: Geist and Vidmake DM Sans loaded, brandSerif unloaded. This is a different face from the previously corrected Geist italic warning.

No incorrect `as` attribute was found. `?dpl=` consistently identifies the same deployment in the examined resources; not evidence of cache corruption or mixed deployments.

## Causal isolation

- Normal isolated signed-out Chrome1440x1000, https://vidmake.io/explore:11unusedCSSwarnings+1unusedseriffontwarning;0pageerrors. Initial rawHTML has3appliedstylesheets and2fontpreloads; speculativeCSSappears later.
- Second fresh browser, same URL/viewport/wait, intercepts and aborts **only in that diagnostic browser** requests carrying`Next-Router-Prefetch:1` (or browser-prefetch purpose).17speculative requests observed across Explore, workflow routes, Studio, analytics/library/scheduling/pricing/sign-in/navigation.
- With speculative requests blocked: **0CSSpreloads,0CSSwarnings**; the same rootseriffontwarning persists. This confirms separate causes without editing the live application.
- This is not an approved implementation to block all prefetching. Doing so can make the next workflow navigation slower; preserve deliberate intent-based data/composer warming and compare actual navigation time if implementing a narrower policy.

## Measured payload / performance limits

The normal run's11speculativelypreloadedCSSfiles total40,211encodedbodybytes. The serif font body is37,425encodedbytes (37,725transferbytes including overhead); local original font70,012bytes. These are one cold diagnostic run's resource counts, not a controlled loading-speed benchmark or total page transfer. The eight named CSS files total80,478decodedbytes and are a subset of the11.

Warnings do not themselves block rendering or prove a crash. Extra downloads can compete for network/bandwidth, especially on slow mobile connections, but no LCP/INP/main-thread or authenticated long-delay attribution was established. Repeated console lines do not prove repeat network transfers. CSS bodies need not all be executed/applied on Explore simply because downloaded.

## Safe follow-up, not applied

- Make the unused brand serif font demand-loaded while preserving its face/variable and existing normal Geist preload; no typography/palette change.
- Reconsider unconditional full destination prefetch on the Explore card grid and nonessential navigation. Prefer bounded intent-based warming (hover/focus/touch) or framework default partial behavior where appropriate; retain profile/catalog/composer overlap on actual navigation.
- Validate both initial resource fanout and signed-in destination open time; do not trade away the user's previously requested fast workflow loading solely to silence console warnings.

Sources inspected: actual deployment HTML/headers/eightCSSbodies; installed Next render-css-resource and React style preload code; app/layout.tsx; ExploreWorkflowCard/AICharacterCard; useExploreWorkflowPreload/preloadExploreWorkflow; WorkspaceLink/WorkspaceRouteBoundary; current Explore context and incident/nonnegotiable rules; context-memory skill. Official Next Link/prefetch documentation corroborates viewport route warming: https://nextjs.org/docs/app/api-reference/components/link and https://nextjs.org/docs/app/guides/prefetching.

## Artifacts / commands / limits

- `.tmp/explore-preload-audit/live.html`, eight hashed`.css`files,`assets.json` — public GET HTML/CSS inspection, status/MIME/decodedsize.
- `node .tmp/explore-preload-audit/browser.cjs` — public isolated Chrome,12secondobservation; `browser.json` stores links,fontstates,performanceentries,warnings.
- `node .tmp/explore-preload-audit/prefetch-isolation.cjs` — public isolated browser-onlyrequestinterception; `prefetch-isolation.json` stores17blockedroutepaths andremainingfontwarning. No usercookies/tokenswereextracted/copied.
- Initial restricted fetch failedDNS; allowed public-network read succeeded. No build/devserver was started. No tests of altered app behavior because no app code changed.

Incident **UGC-PERF-20261105-EXPLORE-UNUSED-CSS-SERIF-PRELOAD** recorded in append-only clear.md. Diagnosis VERIFIED for the tested public route; remediation remains OPEN. Existing authenticated customer session, cold/warm mobile-performance comparisons and actual-navigation tradeoffs NOT TESTED. Palette/layout/handlers/configuration untouched.
