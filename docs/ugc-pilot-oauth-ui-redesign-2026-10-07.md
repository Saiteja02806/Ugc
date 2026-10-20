# UGC Pilot OAuth consent redesign — 7 October 2026

The consent page shown in the supplied screenshot has been redesigned in source. **It has not been deployed.** Screenshots below are an isolated local presentation preview with a fictional account; they are not evidence of a new production OAuth grant.

## Result

- A compact account and permission layout replaces the oversized modal, grid backdrop, repeated headings, and inner scrollbar.
- The desktop layout shows all five requested permissions and the approval/cancellation controls together at the supplied screenshot size.
- Short permission descriptions preserve account/plan, brand, asset, generation, and job access. Image and video generation explicitly use plan credits. Requested scopes are rendered individually; the layout never silently drops a scope.
- Mobile uses normal page scrolling. Long account addresses and client names wrap without hiding their contents. Light and dark themes use scoped colors, so other application pages are unaffected.
- The account switch, Cancel, and Allow access remain native buttons. All are disabled while connecting or switching accounts. Loading, signed-out, unverified-email, and failed-request states remain distinct.
- Return information is available below the actions, with expandable callback details. The existing warning, privacy policy, and terms links remain available.
- Keyboard focus is visible, touch targets are at least 44 pixels for the main actions and mobile links/details, reduced motion is respected, and safe-area padding supports narrow devices.
- Text contrast was calculated for both themes: muted descriptions are at least 6.00:1, account-switch text at least 5.23:1, and the approval button 6.58:1.

## Original logo correction

The first redesign reused a simplified SVG from the prior consent implementation. Its proportions and white play symbol did not match the brand asset. Both consent logos now use the original `public/brand/ugc-pilot-logo.png`, unchanged, with `object-fit: contain`, square dimensions, and a white tile that keeps the dark mark and orange play symbol visible. Header and connection marks are 32 and 40 pixels respectively. No crop, zoom, or replacement illustration is applied.

The image is statically imported so Next.js serves it under `/_next/static/media/`, which the MCP-only deployment already allows. The deployment route boundary and allowed permissions have not been expanded to accommodate the logo.

The refreshed desktop and mobile previews check that both images load with natural dimensions 500 × 500 and preserve their complete proportions. The original asset hashes match in the main checkout and release candidate.

The candidate build and scoped lint passed after the correction. With its built server running locally in MCP-only mode, the bundled logo returned HTTP 200 and matched the original PNG byte for byte; an unrelated `/api/jobs` route still returned 404. This verifies the asset boundary in the built candidate, not a production deployment. Evidence is `.tmp/mcp-plugin-build/oauth-consent-logo-build-check-2026-10-07.json`.

## Source and safety

The shared presentation is `app/oauth/authorize/oauth-consent-view.tsx` with scoped `oauth-consent.module.css`. The existing controller continues to own authentication and the approval request.

The release candidate is based on production commit `9390357231e31cfb72cdb67df6098d5b3c87aa4d` at `.tmp/mcp-readiness-candidate-20261007`. Its client decision handler, sign-out handler, token retrieval, request body, redirect classification, and redirect behavior were retained. The server authorization page, decision endpoint, PKCE validation, allowed scopes, and OAuth database lifecycle were not changed by this UI work. The older main-checkout controller uses the same new view while retaining its own existing behavior; it was not substituted for the production controller.

The preview under `.tmp/oauth-consent-preview` imports the actual presentation component but uses fictional fixture data and callbacks. It contains no credentials, Firebase sign-in integration, or production decision endpoint, and is excluded from the release.

## Verification

- Scoped ESLint passed for the consent controller, presentation, and brand mark in both the main checkout and production-source candidate.
- The complete production-source candidate build passed with TypeScript checks enabled and 147 static pages generated. A final build also covers the mobile touch-target and safe-area refinements.
- The MCP regression command passed: 24 unit checks plus read/auth, asset upload/delete, image/video jobs, token-error, OAuth/migration isolation, and storage signing suites. These are regression tests, not newly submitted paid jobs.
- Browser fixtures checked signed-in, signed-out, loading, unverified email, connecting, switching account, and error states. Signed-out and unverified accounts do not receive approval buttons. Busy/switching states disable the controls.
- Keyboard Tab/Enter invoked the cancellation fixture, and clicking Allow access invoked only the approval fixture. The callback disclosure opens and shows the return information. No real grant was created.
- Desktop checked at approximately 1074 × 877; mobile at 390 × 844; narrow light-mode stress case at 320 × 568 with a long client name, long account address, seven scope rows, and fallback wording for an unknown fixture scope. The checked content has no horizontal overflow or nested scrolling region.

## Preview evidence

![Desktop consent preview](../.tmp/mcp-plugin-build/oauth-consent-desktop-2026-10-07.jpg)

![Mobile consent preview](../.tmp/mcp-plugin-build/oauth-consent-mobile-2026-10-07.jpg)

Fixture state evidence: `.tmp/mcp-plugin-build/oauth-consent-state-checks-2026-10-07.json`. Logo loading checks and source integrity evidence are in the same directory. The earlier light-mode stress screenshot records layout testing before the original-logo correction.

## Release status

This UI is included in the reviewed MCP release candidate. Production acceptance still requires deploying the candidate to `ugc-mcp` (and `ugc` if the combined setup-page release proceeds), then checking the real consent page on `https://mcp.getugcpilot.com`. The existing production connection and previously completed image/video jobs were not modified by this work. Deployment approval remains pending.
