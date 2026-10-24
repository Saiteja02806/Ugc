# Simple repeat scheduling — 19 October 2026

Implemented locally. This task did not deploy or create production posts.

## User flow

1. Choose accounts, caption, date and time; click **Schedule post**.
2. Show **Post scheduled** and **View in Scheduling** after a verified receipt.
3. Click **Schedule another post**, change the time and submit the same content
   as a separate post. Keep the form available and create a fresh request key.

Shared Explore background video, prepared Hook/Wall video, Talking Head/Phone
video and slideshow clients follow this policy. Preparation progress and real
publishing failures remain visible. The Trending scheduling drawer is unchanged.

## Interrupted requests

The saved-request check and confirmation controls are removed from scheduling.
After an uncertain POST response, the client reads the server state and checks
the exact request identity. A verified receipt shows success automatically.
Otherwise one **Try again** action retries the original durable request.

Hydration and preparation polling never POST. Preserve cross-tab locks,
double-click protection, receipt/source/target verification, time validation,
late-response guards, account isolation and the Scheduling cache handoff.

## Local verification

- TypeScript: `npx tsc --noEmit --incremental false` passed.
- Focused scheduling and related navigation/preparation/preview regression tests
  passed, including explicit hour-later repeats, interrupted requests, stale
  responses and no automatic POST on hydration.
- Scoped ESLint and `git diff --check` passed.
- `node scripts/simple-repeat-scheduling.browser.cjs` passed using real React
  scheduling components with local fixture authentication and HTTP. It covers
  desktop/mobile background video, prepared video and slideshow scheduling,
  repeat posts an hour later, double clicks, and a gateway error after the
  server saved the post. Screenshots are in `.tmp/simple-repeat-scheduling/`.

These are local checks; production authenticated acceptance remains pending
deployment. No paid generation or real social scheduling was used.
