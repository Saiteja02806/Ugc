# Trending history recovery — 19 October 2026

The reported failure occurs after leaving Trending or refreshing. The previous
implementation stored review snapshots only in React state. The new-post API
correctly removes reviewed assignments, so a fresh mount had neither those posts
nor a route back to them. Earlier scroll/gesture checks stayed within one visit
and therefore missed the failure. A separate empty-feed return could prevent
the history-owning component from mounting at all.

Authenticated Trending now recovers account-scoped snapshots from this browser.
The gallery initializes history above loading/empty branches and passes it into
the feed and deck. History writes happen in the action before unmount, and the
selected historical post uses a stable ID. Recovery itself does not write to a
decision, Library or scheduling endpoint. Existing explicit actions continue
through the normal owned APIs. Landing/Try history remains visit-local.

The cache retains up to 120 posts, expires snapshots after seven days, and is
bounded to 1,000,000 serialized characters per account. Size pressure removes
older snapshots. Invalid schemas/positions/expired entries are rejected safely.
Account changes cannot display the previous owner's history. Other-tab entries
merge on a later history action; liked decisions cannot be downgraded by a stale
tab. Storage denial/quota errors preserve current-visit navigation and display
a concise message about the recovery limitation.

Validation:

- `lib/trending/post-review-history.test.ts`: round-trip order/position/decisions,
  account mismatch, corrupt versions/entries, expiry/future dates, size/count
  limits, stale-tab merging and format recovery guards.
- Existing post-interaction, scroll-settlement and real decision-handler tests:
  restored-history navigation must not retire posts or duplicate durable work.
- `node scripts/trending-history-recovery.browser.cjs`: actual Gallery/Deck and
  history hook under React StrictMode with controlled auth/API boundaries. Three
  posts are reviewed through actual controls, the document navigates away/back,
  native wheel-back revisits a post, reload retains that selection, forward
  browsing does not repeat a decision, an empty server feed exposes previous
  posts, account switching isolates history, and corrupt/blocked storage degrades
  safely. API mutations are counted; no restoring/browsing request may mutate.
- Application TypeScript and scoped ESLint checks.

Limits: this is same-browser recovery for reviews recorded by the new code. It
does not backfill visits already lost, provide cross-device history, or override
media deletion/access expiry. Clearing site data removes the cache. Cached edit
snapshots still refresh through the existing authenticated API on revisit.

No deployment or production data mutation was performed. Final acceptance needs
the deployed production domain and a signed-in account. Local fixtures are not
production verification.
