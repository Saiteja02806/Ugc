# Trending finger swipe-back — 19 October 2026

The user clarified the remaining failure as a finger gesture within one visit:
swipe a Reel upward, then swipe downward to see the previous Reel. The previously
deployed history recovery addressed unmount/reload, a different boundary.

The controlled browser fixture uses the actual Trending Gallery, Deck, Reaction
Reel and PostInteractionFeed, with only auth/API responses isolated. Native
Chromium `Input.dispatchTouchEvent` creates touch input rather than directly
calling handlers or changing scrollTop. Before this change, a long upward swipe
advanced post 1 → post 2. A 120px downward gesture left post 2 selected, with
`scrollTop=510`, `clientHeight=510`, `data-post-has-previous=true`, and
`aria-busy=false`. A much longer downward pull succeeded. Thus the history existed
and the interaction lock was clear; release/snap selection was the broken boundary.

Previously the touch path let the browser choose the mandatory snap target and
only changed history if the final offset reached 80% of a whole card height.
The browser snapped the shorter return to the current post. The existing mobile
verification advanced by keyboard and pulled back by 85% of the viewport, so it
did not reproduce this gesture. Mouse dragging already had custom targeting.

The correction tracks single-finger start/move/release separately from pointer
events, since native pan cancels pointer delivery. The feed keeps native panning
and suspends native snap after identifying a vertical drag. Release chooses a
single adjacent post using a bounded 48–100px travel threshold or a directional
flick with at least 24–48px travel. The established animation/settlement/decision
locks perform the transition. Mouse and wheel behavior are unchanged.

Validation includes real native touch up/down sequences at 390px and 768px,
120px and long drags, reduced motion, multiple previous posts, forward history
without a repeated skip, and desktop mouse reversal. Earlier reload/navigation,
account-isolation, exhausted-feed and blocked-storage browser checks remain.
Regression tests execute actual touch handlers for short jitter, horizontal
movement, reversal, paused flicks, multitouch, buttons, disabled/tutorial states,
missing history and double-tap preservation. Existing gesture/history/decision
tests, application TypeScript and scoped ESLint are run separately.

The fixture records skip decisions and API mutations. Existing Reaction
presentation telemetry is explicitly handled; no schedule, Library save, paid
generation or publication is created. Media is a local fixture Reel.

Results: all 86 interaction checks pass with serial execution. Application TypeScript and scoped ESLint pass. The complete actual-gallery browser run passes navigation/reload recovery, backward and forward history without duplicate decisions, final-post recovery, account isolation, corrupt/blocked storage, native touch up/down at 390px and 768px, reduced motion, and desktop mouse reversal.

The prior desktop assertion was a fixture coordinate error: the portrait media extended below the clipped 699px feed and the drag started outside the visible post. The fixture now intersects the media and feed rectangles and verifies the hit target before dragging. No product mouse behavior was changed for that correction. The full combined run now passes.

This is automated Chromium acceptance, not physical iOS/Safari/Android acceptance. Production deployment and signed-in acceptance are recorded separately after rollout.

Deployment acceptance — 19 October 2026: source 426b37fd is live on getugcpilot.com/dashboard as dpl_H6LcLwBrPVFyaB1igR1bVsSZvGsn, READY. PR #73 is merged as d2f698a7; the main file tree exactly matches the tested source. Contract CI passed. In the real signed-in production browser, a mouse drag advanced to the next post, the reverse drag returned to the exact original post, and reload restored that historical selection. One initial skip was recorded; no save, scheduling, publication or paid generation was performed. Native touch remains automated local Chromium acceptance, distinct from physical-phone verification. Evidence: outputs/trending-touch-release-verification-2026-10-19.json.
