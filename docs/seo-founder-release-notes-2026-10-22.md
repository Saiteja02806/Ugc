# Founder SEO copy and evidence preparation — 22 October 2026

## Scope and location

Branch: `codex/seo-founder-evidence-20261022`.

Validation checkout: `C:/Users/chund/OneDrive/Desktop/UGC/.tmp/ugc-pilot-public-package-release`. The reviewed patch is also applied to the main working directory at `C:/Users/chund/OneDrive/Desktop/UGC`, after checking that none of its target files contain concurrent changes. File hashes are compared after application.

Base: local project commit `be7b9896` (the native decoder correction subsequently merged by PR #80). The main working directory contains active Explore/media/worker work. Those unrelated uncommitted changes were not copied into the validation checkout, staged or edited for this SEO task.

Only public content, guide media/presentation and existing pricing assertions change here. Plan IDs, prices, quotas, generation charges, permissions, publishing behavior, schema/migrations and workers are unchanged. Public routes and their canonical inventory are preserved.

## Changes

- Pricing now distinguishes daily slideshow concepts in Trending from Hook and Wall of Text work in Explore and separately metered custom generation. Source evidence: `lib/trending/format-policy.ts` has `TRENDING_SLIDESHOW_ONLY_ENABLED = true`; existing plan and billing values are retained.
- Pricing names Instagram, TikTok and YouTube, with verified-account/format conditions. Source evidence: platform visibility, TikTok access policy and general-availability tests. This corrects omission in marketing text; it does not grant or change account access.
- Removed unsupported 60-second readiness, two-minute setup and performance/viral claims from the landing copy and reusable format cards. Public brand wording uses UGC Pilot consistently in the changed surfaces.
- Product-demo guide now targets SaaS/app founders, includes an editable brief, format choices and a real 10-second excerpt. It corrects the obsolete implication that all AI-client finishing requires a separate editor. Connected-client capabilities still determine availability.
- Guide video is user-started with no autoplay and no preload, has a poster and written description, and links to its existing source. Its older interface and limited evidentiary meaning are explicit. `seo-product-demo-media-evidence-2026-10-22.json` records source/output SHA-256, dimensions, exact boundaries and a full MP4 decode.
- `reelfarm-vs-ugc-pilot-draft-2026-10-22.md` is an unpublished editorial draft. It contains direct official-source links, documented workflow differences, non-equivalent pricing units, balanced fit guidance and a matched-task test worksheet. No public comparison route or sitemap entry has been added. Reading websites is not labelled hands-on testing.

## Local validation

- Existing plan catalog tests: 10 passed. Prices, allowances and account limits unchanged.
- Existing pricing action/checkout/render regression suite: 19 passed.
- Scoped ESLint: passed for all changed TS/TSX/MJS code.
- TypeScript: passed after `next typegen`. The first attempt lacked generated `PageProps` in this isolated checkout; no application workaround was added.
- Rendered SEO suite against local Next dev: all 15 public pages passed. Single H1, canonical URLs, unique title/description, guide schema/visible headings, public navigation, home reachability and sitemap inventory matched.
- Local Edge browser: homepage, pricing and guide passed at 1280×800 and 390×844. No page errors or horizontal document overflow. Pricing explanation opens; guide brief can be edited and restored; the 10-second 1280×720 video plays with controls and has no autoplay. Screenshot/report artifacts are under `.tmp/seo-*` in this checkout.
- Guide media: complete FFmpeg decode passed; silent 10-second MP4 is 218,200 bytes; poster 29,320 bytes.
- Optimized Webpack build compiled, passed its TypeScript stage and generated all 170 static pages. The subsequent `check-hook-frame-bundles.mjs` gate failed: `hook-starting-frame: native ffmpeg-static index.js is missing from the function trace`. The trace includes `ffmpeg.exe` but omits the package loader/metadata. Decoder source, trace configuration and checker are unchanged by this patch. This checkout shares its parent `node_modules` through a junction and Next warns that it lies outside the repository; that is a possible cause, not a proven diagnosis. The complete `npm run build` command therefore did **not** pass. Do not bypass the gate or treat this as a deployable bundle.
- Started the resulting optimized app locally and reran the rendered SEO suite: all 15 pages, home reachability, sitemap and guide schemas passed. This validates the changed public surfaces, not the unrelated decoder route's deployed packaging.

Preview uses only the existing public Firebase web configuration in ignored `.env.local`; no server credentials were copied or printed. No media generation or social publishing was submitted.

## Production follow-up — hosting restored on 22 October

After the owner reported restoration, fresh anonymous requests to the apex and www domains returned HTTP 200; www resolves to the canonical apex domain. Pricing and the product-demo guide also returned 200. The updated slideshow pricing copy and guide media are present in the served pages.

The existing rendered SEO suite passed against `https://getugcpilot.com`: all 15 registered public pages, unique metadata, single H1, indexability directives, canonical URLs, internal reachability, guide schema, sitemap inventory and robots sitemap declaration passed. The live MP4 and poster returned 200 with the expected media types, byte lengths and exact SHA-256 values from the preparation receipt.

Live Edge browser checks also passed on the homepage, pricing and product-demo guide at desktop (1280×800) and mobile (390×844) sizes: no page errors or document overflow; pricing explanation opens; guide brief edits and restores; video plays and reports the expected 10-second 1280×720 media, controls and no autoplay. Reports are saved in `.tmp/seo-founder-live-render-2026-10-22.json` and `.tmp/seo-founder-live-browser-result.json`.

This verifies the public SEO surfaces now served in production. It does not verify authenticated media creation, export or publishing, or establish which deployment commit is serving. The earlier isolated checkout's FFmpeg bundle failure was not rerun or silently treated as passing.

## Earlier hosted availability blocker — resolved

Direct anonymous requests to both `https://getugcpilot.com/` and `https://www.getugcpilot.com/` returned HTTP 402 with `DEPLOYMENT_DISABLED` during the live capture attempt, confirmed again at 01:58 IST on 22 October. This is a fresh response; cached search retrieval of public content is not evidence that the site is live.

Vercel read-only inspection returned project `ugc`, ID `prj_mVOxt7AUko5egMAESaxjGyC60Kvu`, `live: false`. Its aliased production deployment `dpl_AfU6Cfw5Sbhg2ekVu2B6s1J66sHk` is marked READY at commit `3c5b0a214947b53e4cd571beccc91a10d3daf7c2`. Build readiness and serving availability are different facts. The exact reason for disabled serving has not been established. Billing, plan and hosting settings were not modified.

The owner subsequently restored service, as verified above. The historical disabled-serving responses do not describe current availability. The comparison still needs a fresh factual pass before publication; a hands-on quality/performance verdict additionally requires equivalent outputs and recorded effort/spend from both tools.

## Remaining work and release boundaries

- The changed public copy and guide assets are now verified live. The comparison remains a draft.
- The earlier isolated validation checkout did not pass its decoder bundle gate. This follow-up does not establish native decoder packaging or change it to force a passing result; validate it in the intended release checkout for any subsequent deployment.
- Fresh screen recording, generated/finished output comparisons and authenticated production acceptance remain unverified.
- No Search Console resubmission or paid backlink action occurred. There is no claim of changed indexing, rankings, signups or customer outcomes.
- Do not include ignored preview configuration, `.next`, `node_modules`, browser recordings from failed attempts or `.tmp` test output in a release. The two guide media assets and their evidence/preparation script are intentional release files.
