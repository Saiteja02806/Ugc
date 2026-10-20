# Scheduling navigation freshness - 18 October 2026

Confirmed Hook Video and slideshow posts could be absent after following
View in Scheduling until the browser was refreshed. The shared schedule query
is fresh for 30 minutes. Scheduling's entry read reused that cache, while the
newer Explore confirmation paths did not update or invalidate it. An empty old
list also has no active work for the normal status poll to discover.

Scheduling now retains cached rows for immediate display but forces a fresh
schedule read on entry. Expensive media and social-connection catalogues keep
their existing caching. Existing focus, visibility and active-work refreshes
are preserved.

Format Hook/Wall/Slideshow confirmation, Talking Head finishing, and background
preparation now upsert the verified server schedule and invalidate the owner's
schedule query. Verified receipt recovery uses the same handoff. Unconfirmed
requests never invent rows or cause additional scheduling POSTs. API contracts,
timing, posting behavior, request idempotency and account isolation are unchanged.

Verification: 142 regression checks passed, including the real QueryClient
loader with a fresh empty cache and both workflow source kinds, confirmed versus
unconfirmed background requests, receipt recovery and duplicate protection.
Application TypeScript passed with incremental state disabled; the initial
incremental run encountered a removed unrelated temporary editor-preview route.
Scoped ESLint passed with zero errors and four existing unused-variable warnings
in the pending-schedule test fixture. Scoped whitespace checks passed.

The new entry regression is `scripts/explore-scheduling-navigation-freshness.test.mjs`,
included by the existing Explore test glob. Fixtures use isolated HTTP/auth and
browser storage; no real customer post, publishing attempt or paid generation was
created. This fix is local and has not been deployed or accepted through an
authenticated production scheduling flow.
