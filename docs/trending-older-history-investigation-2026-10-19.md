# Older Trending posts unavailable after a time gap — 19 October 2026

## Implementation follow-up (local; not deployed)

The correction below is now implemented locally. The original diagnosis is
retained as the production baseline, not a description of the new local code.

- Added authenticated `GET /api/trending/feed/history?feedId=…&before=…`.
  Ownership is checked before hydration. Pages contain at most 20 existing
  reviewed slots from that quota; original slot positions and IDs are retained.
  It reads decisions/creatives without preparing content, changing quota,
  reactivating assignments, marking shown, saving, or scheduling.
- Existing hydration supports completed assignments explicitly scoped to their
  owner, saved business profile/version and exact quota IDs. Carousel render
  readiness is retained. Normal active-feed queries remain active-only. Hook
  saved-edit history reads now admit skipped owned assignments without opening
  the corresponding write gate. Existing active-card reads restore saved edits.
- The gallery carries the persisted quota ID, keeps owner + quota cache keys,
  preloads earlier pages, deduplicates reviews, preserves local edits/likes and
  the active cursor, and removes recovered reviewed cards from stale unread
  feed responses. Failed requests show Retry, including an otherwise empty
  feed; unavailable previews are counted separately. Requests time out and
  abort when the account/quota changes. Browsing never replays the outbox.

Validation:

- History logic/route/service and edit-access regressions pass (22 tests).
- Existing interaction regression suite passes (88 tests).
- Full TypeScript and scoped ESLint pass on the latest source.
- The real Gallery/Deck in an isolated browser fixture passed recovery of
  server posts dated two hours earlier with empty browser storage, slow pages
  arriving while a historical card is selected, reload, navigation away/back,
  a different quota, empty unread feed, network retry, and denied storage.
  Decision/save/schedule write count remained zero.
- The final quota browser rerun passed on the isolated release checkout,
  including loading-state cleanup, stale-feed deduplication and timeouts.
- The new service ran read-only against the affected production quota:
  all eight reviewed Carousel slots recovered in positions 1–8 with six
  slides each and no unavailable previews. A different owner was denied;
  the quota was unchanged. This checks actual data and service behavior,
  not the deployed HTTP endpoint or signed-in production browser.

Run `npm run test:trending-history`, `npm run test:trending-interaction`, and
`node scripts/trending-history-recovery.browser.cjs --quota-only` to reproduce.
The final gate is deployment followed by authenticated recovery of those
existing quota posts on the real production domain. That gate remains open.

## Request and scope

The user reports that immediate up/down browsing now works, but a slideshow
viewed earlier (approximately two hours before) cannot be reached by swiping
back. This investigation reviewed the supplied 58.93-second Comet recording,
the current code, the authenticated production page, and owned production
assignment/decision records. Production reads only; no decisions, saves,
schedules, migrations or deployments were made.

## Evidence

- The recording opens on “3 things I wish I knew about managing content
  deadlines.” A second slideshow, “This is what I’d do if I wanted to improve
  content creation fast,” is visible at approximately 16–17 seconds, the first
  returns around 18 seconds, and the second appears again around 35 seconds.
  Repeated attempts do not reveal an older slideshow. Frames were reviewed
  across the full recording, with closer inspection of the attempts. The
  recording does not contain the preceding two hours or a request trace.
- Production database reads scoped to the owner of the visible slideshow
  confirm the first recording slideshow was skipped at 15:03:45 IST. The
  second is still `in_progress`, with no decision. Both first slides are ready.
- Earlier account records remain available: “stop doing this if you want
  better marketing results.” was skipped at 13:15:20 IST; “if you’re stuck on
  marketing effectiveness, read this.” was skipped at 11:51:23 IST. Both have
  ready slides and persisted rejected decisions. Skipping did not delete them.
- The connected production in-app browser is a different browser context from
  the Comet recording. It currently shows the historical post
  `carousel:63a50aad-0d8d-415f-a39b-7d04d2d72c76`, whose hook begins “the struggle
  to keep branding consistent”. Its assignment was skipped at 14:47:23 IST.
  Its feed has `aria-busy=false`, no `data-post-has-previous`, and no previous
  history item. Arrow Up leaves that same post active. Thus this account has
  older retained server posts which this browser cannot navigate to.

## Confirmed architecture gap at diagnosis (deployed baseline)

`use-post-review-history.ts` restores only account-scoped localStorage snapshots.
`previous()` reads only that local list. `trending-workspace.tsx` supplies
`previousItem` only from `postHistory.preceding`. There is no older-history
read request when that list ends. The normal daily feed excludes completed
assignments; it does not backfill the missing historical posts.

Consequently, a skipped post can still exist in the account database but be
unreachable when absent from this browser's snapshots. This includes older
visits never captured by the newer history feature, another browser, cleared
or unavailable storage, and entries pruned by storage limits. The specific
reason Comet lacks a particular snapshot cannot be inferred from the video;
its local storage was not inspected.

The cache is limited to 120 entries, seven days and one million serialized
characters. There is no two-hour expiry in this implementation. An isolated
probe using the actual serializer/parser preserved a valid post and selected
cursor at simulated +2 hours. This is not a real two-hour browser soak test.

The earlier deployed touch correction and short navigation/reload checks
covered only posts already present in browser history. They did not establish
recovery of older account decisions. Treating those checks as complete
acceptance of this user's history requirement was insufficient.

## Original correction plan

User clarification: recovery must cover previously viewed content from the same
quota/delivered feed. Scope retrieval to that owned feed and preserve its order;
do not combine unrelated quotas into one backward-browsing list. Revisiting
must not consume another quota slot. This scope clarification does not change
the diagnosis: server recovery was missing at that point. The local
implementation and remaining acceptance gates are recorded above.

1. Add an authenticated, owner-scoped, paginated read of existing reviewed
   assignments/decisions, hydrating their available creatives and latest edits.
   Keep completed decisions completed; browsing must not reactivate assignments,
   replay skips, save to the Library or schedule anything.
2. Merge local pending reviews with server history using stable assignment and
   format identity. Preserve the selected historical post while background
   reads finish. Load/preload older pages as the user approaches the beginning
   of the loaded history, including when local storage starts empty.
3. Distinguish loading/error from the actual end of history. Never silently
   treat a failed fetch as “no previous posts”. Reuse format-specific media
   renewal where required, rather than retaining expired preview links.
4. Validate with existing pre-release decisions absent from local storage,
   browser navigation/reload, a fresh browser, two-hour elapsed-time recovery,
   pagination, outbox reconciliation, exact post order and zero duplicate
   decisions. Use authenticated production acceptance after deployment.

No application implementation or deployment was made during the initial
diagnostic pass. The subsequent local implementation is recorded above;
deployment and authenticated production acceptance remain open.
