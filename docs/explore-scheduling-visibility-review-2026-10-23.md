# Explore scheduling confirmation visibility — 23 October 2026

Status: local visual fix and scheduling cross-check. Deployment remains paused.

The user clarified that View in Scheduling is present after Schedule post but
blends into ordinary text. The supplied screenshot is an unfilled scheduling
form, not a captured post-confirmation state; it cannot prove receipt loss,
submission failure or incorrect publication. The available production browser
redirected `https://www.getugcpilot.com/explore/hook-video` to sign-in. No real
scheduling or publication was performed.

## Finding and change

Direct Hook/Wall/Slideshow, background preparation and Talking Head each render
their confirmation navigation separately. All used `text-sm text-primary underline`.
In an isolated browser with the real compiled global CSS, the pending confirmation
computed orange `rgb(255, 112, 69)` but `text-decoration-line: none`. The unlayered
global anchor reset overrides Tailwind's layered underline utility. This establishes
a lost link cue locally, not the exact hosted colour seen by the user.

The three renderers now share `.schedulingLink` from
`components/explore/workflow-schedule-review.module.css`: explicit primary orange,
semibold text, underline, arrow, hover and keyboard-focus styles, plus a larger
touch target for coarse pointers. It stays a navigation link to `/scheduling` and
only appears under the existing confirmation condition. No confirmation, repeat,
idempotency, preparation, API, worker or publishing settings changed.

## Scheduling cross-check

- 58 focused component/client/transport/preparation tests pass. They cover exact
  owned inputs, account/timezone/date validation, rejected time correction, missing
  accounts, stale async input, lost POST recovery, request preservation, repeat
  intents, cross-tab guards, owner-scoped calendar cache handoff and read-only
  hydration/polling.
- 20 direct/background service and route tests pass using isolated dependencies.
  They cover durable commit before acknowledgement, queue/provider outages, exact
  request replay, signed callbacks, verified output, cancellation/expiry, duplicate
  callbacks, disabled-new-admission recovery and status reads without publishing.
- Two pre-existing client tests failed before the UI change because their fixture
  assumed commercial disclosure defaulted on. The fixture now explicitly selects
  disclosure and own-brand promotion, making its canonical-settings and mutation
  checks meaningful with the current off default. Runtime defaults are unchanged.
- The existing repeat-scheduling browser runner previously expected the superseded
  Schedule another post label. Its assertions now use the current Schedule post
  label and confirmed link state. It loads real global CSS and no longer forces all
  anchors orange in fixture CSS, which had hidden styling regressions. It also
  checks reload restoration without POSTs and explicitly fills a fresh repeat form
  after successful direct scheduling clears its unsent form cache.

The final browser run passes eight scheduling cases (background, prepared Hook,
Wall and slideshow, each at 1440×1000 and 390×844) plus two Talking Head confirmation
presentation cases. It verifies the computed orange colour, underline, keyboard
focus, navigation destination, preserved confirmation after reload, repeat an hour
later, double-click protection and lost-acknowledgement recovery. TypeScript and
scoped lint pass. Screenshots are under `.tmp/simple-repeat-scheduling/`; these are
actual component fixtures with mocked accounts and HTTP, not production captures.
Other viewport sizes, physical touch and browser zoom were not tested in this run.

Production follow-up after an authorized release: sign in, inspect an existing
confirmed post and its orange link, navigate to Scheduling, compare caption,
destinations and displayed timezone/date, and check status/reload. A fresh real
schedule or provider publication requires an explicitly scoped test; no synthetic
post should be submitted just to verify link styling.
