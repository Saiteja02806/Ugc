# Explore return navigation — release follow-up

## Evidence

The reported delay occurs on the live site after about five minutes in a
workflow. Three read-only requests to `https://www.getugcpilot.com/explore`
returned HTTP 200 with `x-vercel-cache: MISS` and
`cache-control: private, no-cache, no-store, max-age=0, must-revalidate`.
Time to first byte was 1144, 306 and 577 ms. These requests confirm the
uncached route; they do not reproduce the complete authenticated 5–10 second
browser delay.

Explore contains shared cards and links, with no account-data fetch. Awaiting
the page's `searchParams` solely to support a development preview unnecessarily
made the production route dynamic. Next's installed docs describe a default
five-minute static/full-prefetch client cache and zero dynamic-page stale time.
After expiry, the old route requires another dynamic server response.

## Change

- Production Explore now renders synchronously without server query access,
  allowing Next to prerender and cache the shared menu.
- Development preview query handling lives in a client entry behind Suspense.
  Production `preview=1` cannot enable local-preview behavior.
- The three workflow return links and both sidebar presentations explicitly
  prefetch the complete Explore route.
- Authentication, business-profile gates, account query caches, generation
  APIs and workers retain their existing behavior. No account data is added
  to the shared menu cache. Cover videos and design are unchanged.

## Verification

- 28 offline navigation, launch, source-workspace and deployment-boundary checks
  passed; targeted ESLint passed.
- The complete Next production build passed compilation, TypeScript and all
  151 prerender steps. `/explore` is static in both its route table and
  `.next/prerender-manifest.json`, with `initialRevalidateSeconds: false`.
- Local production document and RSC-prefetch requests all returned HTTP 200,
  `x-nextjs-cache: HIT`, prerender headers and `s-maxage=31536000`. Their measured
  first-byte times were 6, 5 and 12 ms; these are local measurements, not a live
  site performance promise. The temporary verification server was stopped.
- Local preview workflow navigation and return to Explore still work.
- The production build used existing public browser configuration only from
  the main workspace; env files were not copied or modified. No paid generation
  ran during these checks. Authenticated production acceptance awaits release.

These changes are included in the complete Explore follow-up release, together
with the slideshow and reference-row changes. Production deployment is verified
separately against the exact merged commit; local timings are not production
acceptance measurements.
