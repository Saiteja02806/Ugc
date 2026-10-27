# Hover-only landing gallery — 27 October 2026

Supersedes continuous-on-arrival and demo-centered opening decisions in the prior gallery receipts. User's latest reference is codex-clipboard-21a2a895-f2d4-49a3-863f-2391830e059a.png.

## Scope

Restore initial position3: glasses Hook, Wall, fitness slideshow, primary Hook, fitness slideshow, Wall, outer Hook. No gallery travel until the mouse enters the gallery. While hovered, the existing3second-per-position movement runs; leaving stops at the current position, re-entry continues. Keyboard focus, touch contact, explicit pause, hidden/offscreen/offline state and reduced-motion/save-data guards still stop travel. Touch/swipe/arrow controls remain manual. Video playback behavior is unchanged; this change gates carousel travel. The creator-first Talking Head + Demo media stays in the rotation.

Changed files: components/marketing/landing-hero-gallery.tsx; lib/marketing/landing-gallery-motion.ts; scripts/landing-gallery-motion.test.mjs; scripts/landing-gallery.browser-checks.mjs; scripts/landing-performance.browser.cjs; docs/ai-context/clear.md; this receipt. No media, layout/copy/font/theme, Explore catalogue/API/provider/scheduling/authentication or dependency changes. Other dirty worktree changes preserved. Rollback only this interaction/initial-position change and its assertions, retaining incident history.

## Preflight and protected contracts

Mandatory skills already read in this ongoing task: ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity and ugc-regression-gate. Existing AGENTS.md, Explore context, clear.md and nonnegotiables.md reads retained; latest ledger and actual component/state/test sources reviewed, complete git status inspected, actual-task tools/preflight.py PASS. Relevant safeguards UGC-UI-003/004, UGC-OPS-003. UGC-UI-022 records this explicit user interaction change before editing.

Protected: same card size profile, same11sources/creator-first combined clip, visible slideshow chevrons and their keyboard isolation, normal video speed, center-only video admission, manual controls/preferences/recovery. No unrelated shared workflow edits.

## Checks and visual evidence

-5/5motion/provenance tests PASS: primary-Hook initial position/order,3second interval, card dimensions/gaps, loop wrap, exact original media/trim/hash preservation.
-Scoped ESLint and whitespace checks PASS.
-Actual-component browser fixture PASS: stationary arrival; measured hover pace; stationary leave; resume on re-entry; explicit pause; no unattended travel after touch or keyboard use; all11sources reach center; visible slideshow controls and isolated click/key action; reduced-motion/save-data, failed-media/offline/reload recovery. Fixture uses actual gallery/application CSS with native image adapter/static surrounding shell; not hosted acceptance.
-Manually inspected .tmp/landing-loop-browser/gallery-desktop-still.png: original Hook-centered composition restored. Motion video .tmp/landing-loop-browser/landing-gallery-motion.webm shows idle, hover travel, then idle on leave. Cropped gallery-motion-preview.webm is a viewing copy. Other mobile/slideshow images and fixture receipt in the same folder.
-Final build and real-page results are appended below after completion. No assertion that the prior-revision build proves this revision.

NOT TESTED: hosted release/live-domain behavior, real signed-in Explore generation/scheduling/provider actions. No deployment, commit/push or backend writes. Earlier UGC-OPS-010 unscoped font-preload budget mismatch remains independent and explicitly excluded by the scoped performance command.

## Final result

LOCALLY VERIFIED. Final npm run build -- --webpack PASS including TypeScript,230static pages and native traced-route checks. Real production-build sweep40/40PASS across four public routes/five widths/both themes; hover-only idle/leave/re-entry, manual controls, slideshow isolation, preferences and recovery PASS; clipboard/setup links PASS; zero page errors/image warnings.15scoped production media/performance checks PASS. Server-rendered primary Hook center verified. Final actual-page desktop screenshot manually compared to supplied arrangement; matches card hierarchy/positions with existing chevrons. Receipts .tmp/marketing-layout-browser-production/receipt.json and .tmp/landing-performance-browser/receipt.json. UGC-UI-022 locally verified; hosted acceptance remains NOT TESTED.
