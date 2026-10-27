# Landing gallery opening and speed correction — 27 October 2026

Supersedes the initial position,6.5second travel and11–19second demo excerpt decisions in landing-gallery-motion-2026-10-27.md. History/media retained.

## Requested behavior and implementation

Initial card positions match the user's screenshot (codex-clipboard-f6509f40-a37b-419d-bdc2-1156e9f0a93b.png): outer Hook, Talking Head, keyboard Hook, centered Talking Head + Demo, Wall, glasses Hook, Wall. Latest clarification (codex-clipboard-8cde6bb4-bbbb-4400-b673-3ba712865444.png) changes the centered clip to the original creator-speaking opening. The combined preview now covers original source0–19seconds, with a creator poster, then the later demonstration. Full original remains intact.

Server render and client initialize at position9. Motion begins continuously once visible, without a long introductory wait. Travel now takes3seconds per position,2.17times the prior pace. Videos retain normal1×playback; no retiming. Existing max270×480desktop and252×448compact card dimensions remain.

Small previous/next slideshow chevrons are always visible on each visible slideshow, including non-focal cards. Clicking or using arrow keys on them changes only that slideshow. Focal slideshow auto-advance is2seconds so it can advance during the faster center pass. Pause/hover/focus/touch and motion/data preferences remain.

## Exact files changed for this correction

- components/marketing/landing-hero-gallery.tsx
- lib/marketing/landing-gallery-motion.ts
- lib/marketing/landing-preview-assets.json
- scripts/prepare-landing-loop-additions.mjs (optional --only; original-zero combined excerpt)
- scripts/landing-gallery-motion.test.mjs
- scripts/landing-gallery.browser-checks.mjs
- scripts/marketing-layout.browser.mjs (new source identity assertion)
- scripts/landing-performance.browser.cjs (initial focal media/title and exact slideshow locator)
- public/marketing/hero-gallery/demoExample.850bad2edb14a778.mp4
- docs/ai-context/clear.md (append-only UGC-UI-021 and clarification)
- This receipt.

Creator poster reuses existing talkingDemo-poster.3b0775f5767f1742.webp bytes; no new poster. Old demo-only media remains recoverable. No app/page.tsx, root styles, font settings, Explore catalogue, API, generation, schedule, auth, worker or dependency changes in this correction. Other dirty worktree changes preserved. Rollback boundary is the above scoped changes only.

## Preflight sources actually read

Current supplied AGENTS.md plus relevant on-disk rules; existing Explore context/history and latest entries; clear.md/nonnegotiables.md (prior full reads retained, latest ledger additions reviewed); UGCPilot context-memory, immutable-contracts, UI-clarity and regression-gate skills; bundled Next.js client guidance. Existing gallery, shared preview API, manifest and preparation scripts, caller defaults and browser tests inspected. tools/preflight.py passed for the actual requested correction. Relevant safeguards UGC-UI-003/004 and UGC-OPS-003. UGC-UI-021 records the user's slow-travel/opening/control correction before implementation.

## Verification evidence

- Motion/provenance tests5/5PASS: screenshot-order indices,3second interval, original slot dimensions/gaps/wrapping, source hashes/media sizes, explicit0–19second trim and byte-identical original creator poster.
- Scoped ESLint PASS.
- Final npm run build -- --webpack PASS: TypeScript,230static pages, native decoder/traced-route postbuild checks.
- Actual built HTML verified creator-first center ID talking-room-explainer-full:demo-0-19 before animation.
- Final actual-component fixture PASS: measured travel0.3–0.65positions in1.4seconds, initial phase9, all11pieces traverse center, opaque visible chevrons, slideshow click/keyboard isolation, hover/pause, keyboard/swipe, reduced motion/save data, failed-media browsing, offline release and reload. Native image adapter/static shell limitations remain disclosed.
- Final production-build page and performance receipts are recorded separately under .tmp/marketing-layout-browser-production/receipt.json and .tmp/landing-performance-browser/receipt.json. See final follow-up below for completed outcomes; do not treat intermediate previous-revision passes as final.
- Media preparation decoded the new19second clip fully; inspected actual first image showing creator speaking. Source SHA cac6f530242841fc7bc6b1ed805fb0a8edd2ead4fd9d0dbe271ee0014e504afe retains canonical public Talking Head provenance. New clip1,456,507bytes, silent, original-time playback. No prompt/model/provider changes or paid calls.
- Scoped diff whitespace checks PASS.

## Visual artifacts and protected contracts

Before: user screenshots named above and earlier gallery screenshots. After actual-component screenshots: .tmp/landing-loop-browser/gallery-desktop-still.png (creator centered), gallery-visible-slideshow-chevrons.png, gallery-mobile-moving.png. Updated recording .tmp/landing-loop-browser/landing-gallery-motion.webm; cropped viewing copy gallery-motion-preview.webm. Fixture shell is not the live website; production page screenshots are home-1440.png/home-390.png under .tmp/marketing-layout-browser-production.

VERIFIED locally: initial card arrangement, creator opening, unchanged card geometry, faster gallery travel, original video speed, visible slideshow chevrons, pause/preferences/manual navigation and recovery. Existing social badge/header/copy/CTA remain sourced from current app unchanged. Auth/generation/schedule implementations unchanged by scoped source review.

NOT TESTED: hosted deployment/live-domain acceptance, real authenticated generation/scheduling/provider output. This revision is not deployed. Existing UGC-OPS-010 root-font preload budget mismatch remains a separate unresolved unscoped performance failure; --gallery-only explicitly excludes that single budget assertion. No general full-suite-green claim.

## Final outcomes

Final creator-first production build completed exit0. The real production-build browser sweep passes40/40layouts and all motion/opening/visible-chevron/recovery checks, clipboard/setup navigation, zero page errors and zero image warnings. Scoped production performance suite passes15checks, including initial demo-only request admission,1×playback lifecycle, source release/resume, preference guards, immutable delivery/ranges and existing auth-component fixtures. Root font budget remains excluded as documented. Final desktop actual-page and exact-initial fixture images manually inspected: creator speaking visible in center, card hierarchy retained. No live deployment. UGC-UI-021 is LOCALLY VERIFIED.
