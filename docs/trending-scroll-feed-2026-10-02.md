# Trending and Try UGCPilot interaction update

Implemented locally on October 2, 2026. Release verification on the production
domain remains separate; no publishing request was sent by this verification.

## Behavior

- Double-tap the active post media to like it and show a heart. Trending opens
  scheduling; Hook content first opens its required composition screen.
- Scroll vertically to the next post to skip one assignment. Review remains
  bounded by the existing daily pack, including the final ready assignment.
- Down-arrow Skip and heart Schedule/Like replace the old X and tick review
  controls. Keyboard and accessible button equivalents remain available.
  The shared decision component defaults to its original swipe appearance;
  Trending opts into post controls. The former Create Content screen used the
  default controls until its removal on October 3.
- The guide consumes its first acknowledgement without accepting/skipping the
  post. Single taps, long presses, horizontal drags, post controls, and automatic
  scrolling do not count as likes or skips.
- `/try-ugcpilot` demonstrates the gestures with its existing local counters,
  generation/refill, audio controls, and browser session. Its legacy
  `postedCount` property remains compatible with saved sessions and is displayed
  as Liked. It does not create a real social schedule.

## Preserved contracts

Carousel acceptance still saves the owner-scoped Library item before dismissal.
The returned item supplies the scheduler context directly. Save errors release
the interaction lock and leave the card in Trending. Render readiness checks,
the durable decision outbox, exact accepted assignment, scheduling account/time
and publishing settings, server idempotency, and worker dispatch are preserved.

Text and Reaction acceptance enter the existing shared scheduler directly.
Actual scheduling requires its normal explicit submission. The scheduler stays
mounted after the last ready card is dismissed. Editor ticks, close controls,
and Carousel slide navigation retain their original behavior.

Both screens share `PostInteractionFeed` and the gesture policy. It uses native
vertical scrolling and scroll snapping, waits for scrolling to settle, scopes
double-taps to one active post, cancels tap recognition on movement, excludes
controls, and cleans up timers. Future posts are inert and only the active post
plays. During acceptance the post remains visible for heart feedback; reduced
motion shows the heart without animation. Reset/new analysis cancels the demo's
pending decision so a replacement deck cannot lose its first post.

## Verification

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --experimental-strip-types --test lib/trending/post-interaction.test.ts lib/try-ugcpilot/browser-session.test.ts lib/trending/creative-card-actions-ui.test.ts
node --test lib/trending/trending-post-interaction-flow.test.mjs lib/trending/creative-card-actions-render.test.mjs
npm run test:trending-publishing
```

The browser script uses Playwright and the existing development server. Install
nothing when Playwright and a compatible browser are already available. Set
`UGCPILOT_PLAYWRIGHT_PATH` to the bundled module path if it is outside this
project. `UGCPILOT_VERIFY_ORIGIN` defaults to `http://127.0.0.1:3000`; the
development-only `/e2e/trending-feed-preview` route mounts the actual Trending
deck with disposable local fixtures and is unavailable in production.

```powershell
node scripts/verify-post-feed-interactions.mjs
node scripts/verify-post-like-motion.mjs
node scripts/verify-post-feed-mouse-drag.mjs
node scripts/verify-post-scroll-motion.mjs
node scripts/verify-landing-post-feed.mjs
```

Browser coverage: desktop guide acknowledgement, single/double tap, heart
visibility, repeated-tap lock, audio controls, programmatic versus real scroll,
browser-session refresh, reset during feedback, mobile touch double-tap and
real vertical touch scrolling, compact Trending layout, one scheduling dialog,
cancellation, final-post acceptance/skip, keyboard control, reduced-motion
feedback, mobile and short-viewport Trending layout, and 404 responses for the
retired Create Content page, preview, and APIs. Screenshots go into the ignored
`.tmp/post-feed-verification` directory.

Local checks establish the UI and preserved source contracts. After deployment,
verify authenticated Trending on `https://www.getugcpilot.com` and the public
demo on `https://www.getugcpilot.com/try-ugcpilot`, including real saved content
and connected accounts. These source changes do not need a worker deployment
or database migration.

## Follow-up regression audit

The audit found and corrected two local side effects:

- The shared decision buttons had also changed Create Content's icons and
  shortcut labels. The default now preserves the swipe appearance; Trending
  explicitly requests post controls. Rendering tests and the real Create
  Content preview verify its button and left-arrow skips.
- The bottom of vertical Trending media was clipped in 320×568 and 1024×600
  windows. The minimum media width now reserves space for the format label
  within the feed. Both complete-card bounds and decision visibility pass.

The 52 gesture, hand-off, session, and control tests plus 54 existing scheduling
tests pass. TypeScript and scoped ESLint pass, as do the desktop/mobile browser
checks, including the two additional regression checks above.

The broader Create Content suite had an unrelated proxy-matcher mismatch at
the time of that audit. On October 3 the owner retired Create Content; its page,
APIs, preview, exclusive helpers, and tests were removed. The browser script now
checks that those routes return 404. Existing media, schedules, schema history,
and the worker support for previously queued renders remain intact. Authenticated
production verification remains pending deployment.

## Like feedback refinement (October 3, 2026)

The shared heart is now solid white, with a soft shadow and responsive size.
It pops into view promptly, overshoots gently, settles, holds briefly, and
fades away over 720ms. CSS gets its duration from the same constant as the
decision timer. Trending offsets the feedback to the center of its actual
media below the format-label space; the demo keeps its media-centered heart.
Reduced motion displays a still heart for the feedback period.

`scripts/verify-post-like-motion.mjs` checks the real animation on both screens:
prompt visibility, restrained overshoot, a steady hold, fading, centering, and
one decision after the feedback. It records pop/hold screenshots in the same
ignored directory. The existing desktop/mobile gesture suite also checks
duplicate taps, reset, skipping, scheduler hand-off, and reduced motion after
the duration change. No publishing API or gesture-recognition policy changed.

## Mouse drag browsing (October 3, 2026)

Both screens now show an open hand over active post media and a grabbing hand
while the primary mouse button is held. A vertical mouse drag follows the
cursor directly, including movement back down. Snap is suspended during the
drag. Releasing after moving at least 35% of the feed height smoothly snaps
to one next post, which uses the existing settled-scroll skip. Short or
reversed drags return without deciding a post; reduced motion snaps instantly.
Dragging never counts as a double-tap, and a held drag never commits a skip.

Buttons, audio controls, links, slide controls, and form fields are excluded
from dragging. Native mouse image/text drag behavior is prevented over post
media. Pointer capture supports a release outside the card. Escape, window
blur, lost capture, cancellation, busy state, new active posts, and unmount
clean up the grip and pointer state. Touch and wheel scrolling remain native.

`scripts/verify-post-feed-mouse-drag.mjs` checks the actual demo and Trending
deck: open/closed hand cursors, short and reversed drags, horizontal movement,
release outside, Escape/blur/capture cancellation, native draggable images,
audio clicks, no decisions while held, exactly one skip on release, and a later double-tap opening one
scheduler. The existing motion and gesture browser suites still cover native
touch, wheel, duplicate taps, reset, reduced motion, and scheduling. No
publishing API, Library save, worker, or server contract was changed.

The focused gesture, hand-off, session, and control suite now has 54 passing
tests, including the two mouse-drag boundary tests. All 54 existing scheduling
tests also pass. TypeScript and scoped ESLint pass.

## Scroll motion refinement (October 3, 2026)

Touch and wheel browsing retain native momentum and snapping. The shared feed
uses `scrollend` for completion, avoiding the old 160ms post-scroll pause, with
the previous debounce as a compatibility fallback. Touches still held on the
screen cannot decide a post. During retirement the arrived post remains visible
until its item becomes active; the busy transition no longer resets to the old
post. Scroll anchoring is disabled because the feed deliberately resets its
window when the active item changes.

Mouse release now recognizes quick upward flicks with at least 10% travel and
recent speed of 0.65px/ms, alongside the existing 35% distance threshold. A
100ms pause expires that speed. Mouse release and keyboard navigation use a
180–320ms decelerating scroll, with no bounce or extra reveal animation. Short
or paused drags glide back. Escape, blur, interruption, new items, busy state,
and unmount cancel the animation; reduced motion moves instantly. Animation
updates the scroll position through animation frames without React renders
per frame. The double-tap heart and its shared 720ms timer are retained.

`scripts/verify-post-scroll-motion.mjs` records actual scroll frames and reset
calls on both screens. It checks gradual monotonic return/advance, a paused
flick, cancelling during settlement, one quick-flick skip, continuity while the
next post becomes active, later double-tap feedback/scheduling, native touch
held until release, and reduced motion. The focused unit/hand-off suite now
has 55 checks. The existing gesture, mouse and heart browser scripts remain
the regression checks for controls, sessions, reset, layout, and scheduling.

Browser completion semantics are described in the
[MDN scrollend reference](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event).
This refinement changes no server, Library, scheduling, or publishing API.

Local verification passed: all 55 focused checks, TypeScript, scoped ESLint,
the six scroll-motion scenarios, and all existing gesture, mouse-drag, and
heart-motion browser checks. The real-frame checks also caught and corrected
a transient native snap between dragging and release animation; native snap
now stays paused continuously until that animation finishes. Authenticated
production verification remains pending deployment.

## Landing daily feed preview (October 3, 2026)

The homepage `#interactive-feed` section now uses the same shared feed. Its
heading says “Double-tap to approve your daily content.” The supporting copy
teaches double-tap to like and scroll to skip, and explains that liking starts
scheduling in Trending. Heart/down-arrow controls replace tick/X, and the
stacked horizontal swipe exit and Posted/Rejected stamps are removed.

The existing three media samples loop as before. Only active video plays;
upcoming videos preload metadata and remain paused. Slideshow arrows stay
interactive within the current post, slide position resets on advancement,
and reduced motion removes slide/heart animation. A synchronous like lock and
an unmount-cleaned timer hold the shared heart for 720ms before advancing once.
The preview makes no API save, schedule, or publish request.

`scripts/verify-landing-post-feed.mjs` checks the actual homepage on desktop,
mobile touch, and reduced motion: copy/icons, single/double tap, duplicate
likes, like/skip controls, slideshow arrows, wheel/mouse/keyboard browsing,
looping, inactive playback, responsive width, and absence of API writes.

Desktop, real mobile touch, and reduced-motion checks pass, as do TypeScript
and scoped ESLint. The visual review caught and corrected intrinsic video
sizing stretching the feed; an absolutely positioned inner frame now preserves
9:16, with a browser dimension assertion and desktop/mobile screenshots.
Production release and verification remain pending.
