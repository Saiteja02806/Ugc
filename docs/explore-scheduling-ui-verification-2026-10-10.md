# Explore scheduling UI verification — 2026-10-10

## Result and scope

The remaining scheduling UI changes are implemented locally. Explore's video review presents exactly one finished, playable video and uses that same owned asset in the schedule request. It no longer presents Hook/Secondary clip selection for an already composed Explore video. Other entry points retain their existing composition flow; slideshow scheduling retains the ordered saved images.

Hook and Wall of text accept either optional clip independently. An unchanged ready MP4 is reused without submitting a new rendering job. A standalone demo retains trim, timed text, audio and crop/pan; preparation preserves the existing serial edit/audio pipeline, then applies framing to that single source. A selected, unprepared opening blocks preparation rather than being dropped. With neither clip, the UI asks the user to add a video and offers no preparation action.

Optional publishing controls are collapsed. TikTok visibility and permitted interactions remain visible and require the user's selections. AI disclosure is collapsed per post, with an account default under Settings → Preferences. Loading the default has a bounded request timeout; explicit choices, existing saved schedule settings and account ownership remain authoritative. Instagram-only scheduling does not wait for this default.

## Local verification

- Actual React component browser checks verify one playable video, the exact submitted final asset, collapsed optional settings, TikTok privacy/interaction validation, delayed defaults preserving an explicit choice, durable preference saving/reloading, mobile layout at 390×844, failed preference loading, and the ordinary two-clip scheduler.
- The existing Hook/Demo browser simulation verifies sole-account auto-selection, two clips requiring exactly one join when unedited, serialized editing and joining for multiple timed texts, a default blank text box, no automatic scheduling, hook-only reuse, and demo-only reuse and explicit scheduling without a hook.
- API tests verify authentication, owner isolation, strict preference validation, non-cached responses and database failures. Local PostgreSQL-compatible tests execute the migration, save/reload distinct owners, verify row-level security and deny anonymous/authenticated direct table access.
- Actual FFmpeg tests verify standalone crop/pan pixels over time, duration and audio preservation, source immutability, long framing filter-file handling and rejection of a second clip in the single-source framing path. Contract/API tests verify feature gating, legacy fingerprint compatibility and idempotent recovery.
- The Explore regression run passed 658 of 659 checks. The one Windows sandbox temporary-file rename failure passed when its suite was rerun outside the sandbox (10/10). Final focused regression checks, TypeScript and lint passed. Worker build and a production Next.js build passed; the final build log is recorded under `.tmp/explore-review-audit/ui-build-final.log`.

Reproduce the scheduling/preference and browser checks with `npm run test:explore-schedule-review`. Browser fixtures use local fake identity and endpoints and never publish real posts. Screenshots are in `.tmp/explore-schedule-review-browser/final-video-desktop.png` and `final-video-mobile.png`.

## Release requirements and acceptance limits

These new changes are not deployed. Apply `20261009204135_account_publishing_preferences.sql` and deploy the updated renderer worker before exposing the website's standalone source-framing requests. Old workers reject the new optional field; legacy requests intentionally keep their prior shape and fingerprint. The preference table is private to the service role; the API obtains the owner from verified Firebase identity.

The user requested local verification because production sign-in is unavailable. These checks do not establish authenticated production acceptance, provider posting success or improved Cloud Run queue/startup latency. The existing status-recovery and owned unchanged-video reuse remain in place; a required render can still wait for the worker. Paid video/image generation and real social publishing were not invoked.

Concurrent Trending/Carousel changes in the shared worktree are outside this UI verification record and were preserved.
