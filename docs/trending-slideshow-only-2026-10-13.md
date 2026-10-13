# Trending slideshows only

Implemented locally on 13 October 2026. Not pushed or deployed.

Trending uses 100% Slideshows and 0% Hooks, Wall of Text and Reaction Reels.
This applies to new packs for every plan, including users with older saved
video preferences. Existing daily limits remain authoritative. Adjust shows
only Slideshows at a fixed 100%, and the Trending introduction, first-visit
walkthrough and cached feed results no longer present the hidden formats.

Saved preferences, daily slots, assignments, creatives and schedules are
preserved. Existing mixed packs keep their original slideshow allocation until
the next daily pack. Their hidden video slots are excluded from public progress
and do not trigger preparation. Existing all-video packs show caught-up rather
than polling hidden work, including after trial access ends.

Generation entry points reject hidden formats before reserving work. The worker
skips queued Trending Hook-copy, Wall planning/copy and Reaction-generation jobs
before invoking their handlers. Existing rendering/publishing and Explore
generation retain their handlers. Already executing production work was not
remotely cancelled. No database migration or deletion is needed.

The website policy is `lib/trending/format-policy.ts`; the separately deployed
worker policy is `worker/src/lib/trending-format-policy.ts`. Ship them together.
Authenticated production acceptance remains pending a deployment to
`https://www.getugcpilot.com`.

Validation:

- 82 focused application/worker tests pass, covering saved mixes, full daily
  allocation, old slot preservation, pending counts, expired access, stale
  client saves, authentication and skipped queued generation.
- Application TypeScript, worker build and scoped lint pass.
- The real Adjust component passes isolated browser checks at 1366×768 and
  390×844: one slideshow row, fixed 100%, correct daily count, no video rows or
  Save action, no writes and no browser errors, even with stale API preferences.
- The broader creative-card UI suite has one existing assertion failure:
  `Carousel editing keeps content headings and shared Slide 1 typography`.
  It expects a literal `0.370cqw` stroke while the unchanged editor calculates
  that value from the typography constant. The other 37 assertions pass.

Browser artifacts are ignored local files under
`.tmp/trending-slideshow-only-browser/`; no paid generation, customer data
mutation, scheduling submission, push or deployment was performed.
