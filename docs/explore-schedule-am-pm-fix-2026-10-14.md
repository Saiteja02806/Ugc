# Talking Head + Demo schedule time investigation

The supplied screenshot shows 14 October 2026, `02:49` in `Asia/Calcutta`,
while the Windows clock shows `14:40`. The screenshot's warning is produced
by the shared ScheduleEditor before any scheduling request is submitted.

## Reproduction and cause

The old picker uses 24-hour values but its closed button has no AM/PM marker.
`02:49` is 2:49 AM, not 2:49 PM. The selected instant is
`2026-10-13T21:19:00.000Z`, already past at 14:40 IST on 14 October.
The intended afternoon time is `14:49`, or `2026-10-14T09:19:00.000Z`.
The exact screenshot inputs reproduce the rejection; selecting PM clears it.
Both India timezone aliases resolve correctly.

A second source of confusion is the full elapsed five-minute lead. At
14:40:30, 14:45 is only four minutes and thirty seconds away. The earliest
whole-minute slot is 14:46. The embedded video in the screenshot is not
evidence of the browser's current clock.

## Changes

- The shared time picker displays AM/PM and has explicit 12-hour, minute,
  and AM/PM controls. Drafts, hidden form values and API inputs remain in
  24-hour format. Midnight/noon convert to 00:xx/12:xx respectively.
- The form shows the current date/time and earliest valid slot in the
  selected timezone. Past selections have a specific past-time message.
- Use next available time updates only date/time, preserving caption,
  timezone, media and destinations. It chooses a whole-minute slot with an
  extra minute beyond the required lead for confirmation and transport.
  It never schedules automatically or repairs an accepted durable receipt.
- The clock checks minute boundaries every second without rerendering the
  editor on every tick. Submission independently validates Date.now(),
  covering sleeping tabs and a slot expiring between render and click.

The previously prepared rejected-request recovery changes remain intact.
Explicit server rejection permits correction; uncertain requests retain
their exact input and identity. Accepted schedules recover rather than
creating another post. See `explore-schedule-time-recovery-2026-10-14.md`.

## Validation and release boundary

- 35 time/editor tests pass, including the supplied AM/PM reproduction,
  noon/midnight conversion, timezone-aware date rollover, preservation of
  destinations, and clock expiry before confirmation.
- 81 existing workflow/recovery/API tests pass, covering Talking Head,
  Demo composition, background preparation, corrected rejected requests,
  lost acknowledgements and duplicate prevention.
- Seven browser scenarios pass against the real editor with isolated
  accounts and HTTP fixtures, including AM-to-PM correction, exact UTC
  submission, date rollover, publishing preferences and mobile layout.
- TypeScript and scoped ESLint pass. The initial sandboxed browser launch
  failed because Edge could not create its temporary profile; the same
  fixture test passed outside the sandbox.
- These changes are local and uncommitted. No push, deployment, real
  generation or social publication was performed. The production browser
  session became unavailable, so authenticated final acceptance against
  getugcpilot.com remains a deployment check.

Browser evidence: `.tmp/explore-schedule-review-browser/schedule-afternoon-corrected.png`.
