# Slideshow failure-banner dismissal — October 16, 2026

The reported banner was derived from the saved failed job on every render.
It had neither a close button nor a presentation-only dismissal lifetime.

Explore slideshow image results now opt into a dismissible error badge through
`AiStudioResults`. It has an accessible × button and disappears after three
seconds. The notice identity includes account, submission, tracked job IDs,
failed job ID and displayed message. Unchanged polling does not reset its timer
or revive the dismissed error. A different failure receives its own timer.
Replacement, dismissal and unmount cancel the previous timer.

This is a banner-only change. It does not cancel, retry, delete or alter a job,
change credit settlement, clear references, hide generated slides or modify
History. Progress and other workflows retain their existing behavior. Dismissal
is local to this mounted visit; reopening the workflow can show a saved failure
again. The provider-credit repair is documented separately in
`slideshow-provider-credit-failure-2026-10-16.md`.

Validation:

- 98 existing generation-UI/recovery tests passed, including a new stable
  slideshow-failure identity regression and preserved Studio behavior.
- `node scripts/slideshow-error-notice.browser.cjs` renders the real shared
  results component with fixture status updates, without API calls. It verifies
  exactly three seconds, polling stability, keyboard and mouse dismissal,
  distinct failures, replacement/unmount cleanup, preserved result/history
  presentation, persistent progress and unchanged opt-out behavior.
- Browser screenshots at `.tmp/slideshow-error-notice-browser/desktop.png` and
  `mobile.png` were visually inspected; the mobile close button remains visible
  and the message wraps without horizontal overflow at 390px.
- Full application TypeScript, scoped ESLint and whitespace checks passed.
  No paid generation, hosted data mutation or deployment ran.

The fix is local and requires a web deployment. Authenticated acceptance on
`https://www.getugcpilot.com` remains pending; the fixture is not production
acceptance evidence.
