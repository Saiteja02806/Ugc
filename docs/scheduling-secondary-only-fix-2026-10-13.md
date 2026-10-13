# Secondary-only scheduling fix — October 13, 2026

The general Scheduling editor supports a secondary video on its own. The
confirmed bug was that an editor opened against an empty media catalog kept
Secondary on Skip after refresh auto-selected a newly available video. The
result was a disabled submit button asking for a clip that already existed.
An included but empty Hook also caused the button to incorrectly ask for a
date and time when a valid secondary video and publish time were present.

## Changes

- Default clip selection now includes available clips when the media catalog
  arrives or refreshes. Explicit Skip choices, saved clip selection, fixed
  Explore outputs, and an explicit secondary-only handoff remain authoritative.
- Refresh retains the selected asset ID. A removed selection requires the user
  to choose another asset; it never silently substitutes a different video.
- Secondary has its own refresh control, available even while it is skipped.
  Refresh failures are visible without enabling Hook.
- The submit button and its explanation show the missing-clip validation error
  before falling back to date/time guidance.
- `npm run test:scheduling-ui` includes the editor behavior regressions and
  secondary clip media policy tests.

The API contract remains `single_video` with `clipSelection: secondary_only`,
the exact selected secondary asset, and no hook ID. No scheduler, provider,
rendering, schema, or Carousel architecture changes were necessary.

## Verification

- All 97 tests in `npm run test:scheduling-ui` passed.
- TypeScript (`tsc --noEmit --incremental false`) and scoped ESLint passed.
- The actual updated component was bundled into an isolated local browser
  fixture with a ready video and an Instagram account. The fixture can capture
  a submission but cannot create a production schedule or publish content.
- Opening with no media, then using Refresh secondary clips, selected and
  included the exact secondary video, left Hook skipped, and enabled Schedule
  post. The explicit submission displayed `secondary_only` and `Hook: none`.
- Including an empty Hook showed `Select a hook clip or turn it off.` and
  disabled submission. Skipping it restored secondary-only submission.
- The browser reported no error or warning logs.

Browser evidence:
[Secondary-only confirmation](../.tmp/secondary-schedule-browser/secondary-only-confirmed.jpg).

This is a local fix. No push, deployment, production schedule, or social
publication was performed. Authenticated production acceptance is pending
deployment and a signed-in session on `https://www.getugcpilot.com`.
