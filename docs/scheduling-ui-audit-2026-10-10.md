# Scheduling UI and data audit — October 10, 2026

## Fixes and local verification

All five confirmed issues have now been fixed in the working tree. These fixes
have not been deployed. The browser used the actual workspace/editor with fake
API responses and blocked publishing mutations; no production record or job
was changed.

| Issue | Result after the fix |
| --- | --- |
| Future status refresh | A post loaded 75 seconds before publication automatically changed from Scheduled to Published. The first follow-up read began about 15 seconds after load, then continued every five seconds through completion. |
| Cancelled render metadata | The actual mapper now classifies all 28 saved production cancellation combinations as Cancelled; previously four were wrong. A cancelled Wall fixture also displayed Cancelled in List and was excluded from Calendar. |
| Undated drafts | Drafts 1 now displays the undated post with Edit and Cancel. Edit opened the correct saved-carousel editor; Cancel opened its confirmation and Keep schedule preserved the draft. |
| Calendar scope/counts | Calendar explicitly shows All post statuses and a View drafts shortcut. Status tabs appear in List. October shows 4 posts and empty November shows 0. |
| Failed data loads | Initial failure shows Retry without false zero counts/empty-calendar claims. Retry restores data. A failed refresh keeps the previously loaded four calendar posts with a stale-data notice; Retry clears the notice. |

Local verification passed 128 targeted scheduling/account-isolation tests,
TypeScript, and ESLint for the changed code. The new timing/status regressions
are included in the default test command and `npm run test:scheduling-ui`.
The production build (`npm run build`) also passed: compilation, TypeScript,
and generation of all 153 static pages completed successfully. The first
sandboxed build stalled during compilation; it was stopped, and the same build
completed with normal local permissions.

The 1366 × 680 and 1536 × 780 browser layouts were checked. The draft and its
actions were readable without horizontal overflow. The final normal fixture
browser console had no errors or warnings.

Saved local screenshots:

- [14-inch viewport draft](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/scheduling-ui-fixed-drafts-14inch.jpg)
- [15.6-inch viewport draft](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/scheduling-ui-fixed-drafts-15inch.jpg)
- [Automatically updated Published status](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/scheduling-ui-fixed-published.jpg)

Authenticated production acceptance remains pending deployment and an available
signed-in session. The additional pagination/timezone/navigation risks below
were outside the five confirmed fixes and remain follow-up work.

## Original audit result

The Scheduling screen correctly shows the saved local publish time, timezone,
account handle, and separate platform results in the examined cases. It is not
fully reliable as a live status screen. The audit confirmed stale status refresh,
cancelled-post status mapping, inaccessible undated drafts, misleading calendar
filters/counts, and weak recovery after a failed data load.

The prior [future scheduling audit](future-scheduling-audit-2026-10-10.md)
verified recent production publishing independently of the UI. A stale
Scheduled badge does not establish that the background publication failed.

The initial investigation changed no application source, database records,
publishing jobs, or deployment. The subsequent local fixes are recorded above.

## Evidence and scope

- Read the actual Scheduling workspace, editor, API, database serializer, account
  cache, action policies, timezone conversion, and social post link validation.
- Read production Supabase data. There are 197 parent schedule records:
  134 published, 17 failed, 8 partially failed, 28 cancelled, and 10 draft.
- Exercised the actual `SchedulingWorkspace` and lazily loaded `ScheduleEditor`
  in the browser using isolated, API-shaped fixture responses. Authentication
  and integration responses were stubbed; every publishing mutation was blocked.
- Reviewed laptop viewport sizes of 1366 × 680 and 1536 × 780. These are browser
  dimensions, not a guarantee of physical laptop screen size or display scaling.
  The fixture renders the workspace without the production navigation shell.
- Ran 110 existing tests for account selection, account timezone, draft form
  persistence, media availability, platform settings, published links, action
  policy, publish outcomes, and scheduling database/UI contracts. All passed.

There is no signed-in production browser session available. Production database
and worker evidence is real; interactive UI reproductions use the real component
with local fixtures. A fresh authenticated create/cancel/retry/publish cycle on
the live domain was not performed. The user previously asked to check locally
because signing in through the shared browser was not possible.

The production web deployment inspected in the preceding audit was
`dpl_JBWopVDJB6j4CXTHZUgwMjKdDipi`, commit
`4e3cbfa957d2aba2591c6e40f419fc429cc277ef`. Its Scheduling implementation matches
the audited checkout; the subsequent commit changes were Carousel workers and
documentation. Other intentional local changes remain outside this audit.

## Confirmed findings and safe fixes

### 1. The open screen does not wake up when a future post becomes due

Source: `components/scheduling/scheduling-workspace.tsx:539` and `:3555`.

Polling is enabled only when `hasActiveServerWork` is true. That value is memoized
only on `serverSchedules`. A scheduled target is considered active within a
60-second lookahead and a 120-second lookbehind. Loading the screen earlier does
not install a timer that reevaluates the condition as time passes.

Browser reproduction: the fixture returned one post scheduled 75 seconds ahead.
It switched its API response to Published at the due time. At 100.863 seconds,
the browser still showed Upcoming 1 / Published 0 / Scheduled and had performed
only its initial schedules read. A separate read confirmed that both the parent
and target API statuses were Published. No production write occurred.

Safe fix: schedule a bounded wake-up at the next target's lookahead boundary,
force a schedules refresh then, and continue polling while publication is active.
Also refresh on focus/visibility restoration. Clear timers on account change or
unmount. Verify future waiting, tab suspension, terminal states, and account
isolation without creating duplicate jobs.

### 2. Old render metadata overrides a cancelled parent status

Source: `components/scheduling/scheduling-workspace.tsx:3851`.

`getDraftStatusFromScheduledPost` checks queued/rendering/not_requested/failed
render metadata before it checks `schedule.status === "cancelled"`.

The real mapping function was executed against status/metadata combinations
aggregated from all 28 cancelled production records. Four are misclassified:

- Two cancelled Wall-of-Text posts retain queued render metadata and map to
  Rendering. Both were created September 13.
- One cancelled Wall-of-Text post retains not_requested metadata and maps to
  Rendering. It was created August 31.
- One cancelled combined-video post retains failed render metadata and maps to
  a render failure. It was created July 15, before the calendar rollout boundary.

The three Wall posts can incorrectly contribute to Upcoming and appear as
unfinished work. The records remain cancelled in the backend; this is a UI
classification defect. The other 24 cancelled records map correctly.

Safe fix: make a terminal parent cancellation authoritative before deriving
rendering status. Keep any useful historical render error as detail rather than
the primary status. Check Published and partial outcomes separately so the fix
preserves platform result information. No production metadata cleanup is needed
to correct the display.

### 3. Undated drafts are counted but cannot appear in the Drafts list

Source: `components/scheduling/scheduling-workspace.tsx:3447`, `:2900`, and `:1767`.

The Drafts tab identifies rows with no selected date/time. The List renderer
then requires `draft.scheduledDate === selectedDate`, excluding every undated
draft. Calendar intentionally excludes undated rows as well.

Browser reproduction: a valid undated draft produced Drafts 1, but selecting
Drafts and List displayed 0 drafts / No drafts posts. Choosing another day
cannot reveal an undated row. This contradicts the existing product requirement
in `CAROUSEL_CONTEXT.md:1283` that undated drafts remain visible in Drafts list.

Current production has ten draft parent rows, all with a planned time. This
reproduction establishes the defect for undated drafts, not that the ten current
production rows are missing for this exact reason.

Safe fix: use an undated draft list with recovery/edit actions for the Drafts
tab; apply the selected-day agenda only to dated history/upcoming tabs. Preserve
the rule that undated drafts are not timed calendar entries.

### 4. Calendar status tabs and the month badge imply filters they do not apply

Source: `components/scheduling/scheduling-workspace.tsx:561`, `:1661`, and `:2255`.

List correctly receives status-filtered rows. Calendar receives every eligible
dated row. Selecting Published 1 or Drafts 1 still showed the same four calendar
posts, including scheduled and failed posts. The panel's accessible label also
changes to the selected tab while its content remains unfiltered.

This use of all-status calendar data is explicitly required by an existing
contract test at `lib/scheduling/scheduling-database-contract.test.ts:1259`.
It is a confusing control/data relationship, not evidence of a publishing bug.

The badge next to the month title also counts every dated calendar row, not the
visible month's posts. Navigating from October to an empty November still
displayed 4 posts beside November 2026.

Safe fix: preserve the intended all-status calendar, hide or clearly distinguish
the history filters while Calendar is active, and count only the displayed
month (or explicitly label an all-month total). If status filtering is desired
for Calendar, update the product contract and its test together.

### 5. A failed schedules read leaves an empty calendar without a Retry action

Source: `components/scheduling/scheduling-workspace.tsx:489` and `:1254`.

An HTTP 503 fixture correctly displayed Could not load server schedules, but
also rendered zero tab counts, 0 posts, and No Instagram posts yet. There was
no schedules Retry control and no periodic retry without active server data.
The error notice is present, so this is not a completely silent failure, but
the empty state can be mistaken for an empty account.

Safe fix: distinguish failed/unavailable data from a successfully loaded empty
account; add a forced Retry action. Preserve the last successful data during a
refresh error and explain when it may be stale. Use platform-neutral empty copy
when the screen supports more than Instagram.

## Working behavior observed

- A saved October 11 at 16:30 UTC appears on October 11 at 22:00 in
  Asia/Calcutta, including the target's Will publish message.
- A saved October 10 at 02:30 UTC appears as 08:00 in the daily list.
- Calendar dates open Day view; Today and next-month navigation work. An arrow
  key changed the selected date from October 10 to October 11.
- Day view showed the three fixture posts from latest to earliest: 10:00,
  09:00, and 08:00, with visible account handles and platform-specific results.
- A partial failure showed Instagram Published and TikTok Failed with Retry
  publishing. An action-required target showed the reconnect explanation/link.
  These actions were inspected, not submitted to a production provider.
- Published TikTok media without a platform URL displayed Post link unavailable
  and the explanation that TikTok had not provided a direct link. It did not
  misrepresent the exported media URL as a published social post.
- Production contains no Published parent with a target in an incompatible
  state; its terminal targets are published, skipped, or cancelled.
- Production published target URL availability: Instagram 189/189, YouTube
  6/6, TikTok 0/11. The TikTok link limitation is represented honestly by the UI.
- Opening Schedule for this day loaded the actual editor with the selected
  day, account timezone, media/account/date checklist, and connected accounts.
  Missing media/account selection prevented submission.
- The isolated laptop layouts and daily list were readable. Calendar pills
  intentionally truncate long titles and show a +more indicator; Day view
  provides the full post details. No horizontal page overflow was observed
  after the viewport had settled.

## Additional risks, not current production failures

- `lib/scheduling/db.ts:258` caps the unfiltered schedule read at 200 and orders
  scheduled dates ascending. There is no workspace pagination. An account with
  more than 200 records could lose later/future and undated rows from the screen.
  Current production maximum is 111 records per account; none reaches the cap.
  Use date/status-scoped pagination and separate complete counts before this
  becomes a live missing-data problem.
- Today and the initial selected date use the browser's local calendar date,
  whereas posts retain their saved timezone. Behavior when the browser region
  differs from the account region near midnight needs a dedicated acceptance
  case; this audit did not reproduce an incorrect production date.
- List rows are summaries, with no direct detail/retry/cancel/post-link action.
  Day view exposes those details. Historic rows before the calendar rollout
  boundary may therefore be harder to inspect from history. This is a separate
  navigation improvement from the confirmed undated-draft defect.

## Release acceptance after fixes

Use isolated fixtures to verify these boundary cases, then verify the deployed
Scheduling screen on the real production domain with a signed-in session.
Compare displayed data to authoritative saved records and provider outcomes.
Do not publish, cancel, or retry existing user content solely for a UI audit.
