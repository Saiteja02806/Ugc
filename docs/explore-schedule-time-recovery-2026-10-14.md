# Explore scheduling time recovery and publishing verification

The reported form showed 14 October 2026, 04:18 in Asia/Calcutta while rejecting
the five-minute lead. The shared timezone resolver correctly accepts that time
at 04:08, including seconds and both Asia/Calcutta and Asia/Kolkata aliases.

## Reproduced cause and fix

Talking Head + Demo keeps a durable browser request before sending it. Its
Review schedule action replayed that original request, and confirmation also
preferred the saved input over the current form. A rejected or expired earlier
time could therefore cause a server error although the visible time was valid.
Hook, Wall of Text and Slideshow shared that recovery problem. Background
preparation also retained definitively rejected requests as unconfirmed and
offered only replay of the old input.

The clients now preserve HTTP status and error code. Only an explicit 409
`schedule_time_too_soon` permits correction. Ordinary scheduling uses the same
idempotency key with the newly confirmed values; the server returns existing
accepted posts before applying the lead check. Background preparation checks
the old immutable request before allowing a new explicitly confirmed request.
All mutation/replay paths use the owner/output browser lock. Uncertain network
outcomes still preserve exact inputs and identity; reads and hydration never
create posts. Existing accepted schedules and publishing targets remain the
authority. No migration or worker change is required.

The older generic Scheduling and platform selectors use the same working
timezone/lead helpers. Their validation math does not reject the reported
04:08 → 04:18 example; the generic server recovery ordering is corrected too.

## Production evidence (read-only)

The connected account has one Explore-tagged server post, and it is published.
Its schedule ID is `4e2d839b-b2bb-4447-bc86-03cdbde34e87` and its metadata marks
`exploreWorkflow=format`.

| Evidence | Result |
| --- | --- |
| Selected publish time | 12 October 2026, 22:41:00 IST |
| Instagram target published | 12 October 2026, 22:41:45.822 IST |
| Schedule/target state | Both `published` |
| Publishing job | `2cb880e0-cca0-403e-a8c8-48c3762bd64b`, `completed` |
| Instagram media ID | `17936488524390469` |
| Provider permalink | https://www.instagram.com/reel/DeZvV21jzI6/ |
| Publishing error | None |
| Screenshot caption search | Zero matching server schedules |

The worker records publication after Instagram `media_publish` returns a media
ID and reads its permalink; a queued job alone does not produce this result.
Explore finished videos use `/api/schedules`, scheduling targets, Cloud Tasks,
the publish dispatch route and the same social publishing worker. Background
Explore requests reserve a schedule and finishing receipt, then completion and
periodic recovery attach the exact rendered file and create publishing targets.
Pending preparation is a saved intent until those targets are scheduled.

This verifies that the existing Explore path really published a post. It does
not establish live success for every format/platform combination, or prove
that the screenshot's interrupted browser request was accepted. That request
has no matching server schedule by its supplied caption. No new post was sent
or rescheduled during this investigation.

## Validation and release boundary

- Deterministic regressions cover the exact reported date/time, an old rejected
  request with a new visible time, both Talking Head controllers, Hook/Wall/
  Slideshow, background scheduling, recovery after reload, missing accounts,
  cross-tab identity and lost acknowledgements.
- 216 focused scheduling/client/API/database-contract tests and 82 compiled
  provider/worker tests pass (298 total). Final test logs are
  `outputs/schedule-time-recovery-tests.log` and
  `outputs/explore-publishing-verification-tests.log`.
- Web TypeScript and scoped ESLint pass.
- The production Explore browser URL redirects this automation session to
  sign-in, so authenticated browser acceptance of the patched form remains
  unverified. Production database evidence was read through the connected
  account and backend tooling.
- Changes are local, uncommitted and undeployed. Production acceptance of the
  fix requires release and an authenticated check on getugcpilot.com. Unrelated
  existing worktree changes were preserved.
