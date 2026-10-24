# Creator Recreate loading and dialog fixes — 24 October 2026

The private creator gallery waited for twelve complete MP4 downloads and their
posters before publishing either account. Restored Recreate references also
depended on that media hydration. This made an unrelated clip's transfer delay
the selected account and its preparation screen.

The gallery now publishes each account's stills independently, in bounded
parallel batches. Canonical, authorized metadata resolves restored preparations
without waiting for those stills. Private MP4s load only after sustained card
hover/focus or an explicitly opened preview. Transfers retain bearer auth and
owner-scoped local URLs, with cancellation and revocation on source/owner change,
logout and unmount. Ready previews are reused during repeat hover. One account's
failure does not hide the other. First playback still needs one complete MP4
download; this change does not introduce authenticated byte-range streaming.

Recreate now shows a dismissible dialog while its lazy UI module downloads.
Source frame and price reads begin once saved draft/checkpoint metadata is
validated, alongside saved face-photo validation. The stricter restored state
still gates editing, persistence, approval and paid submission. Failed photo
restoration preserves the original browser preparation.

The approved source/person/result columns remain. The outer dialog has softer
26px corners (20px on mobile), lighter edges and rounded previews/actions.
Generate, credit cost and subsequent explicit approval stay under the result;
there is no separate bottom action bar. Complete images, four-variation review,
enlargement, recovery and motion checks remain available.

The separately confirmed worker receipt-version bug is documented in
`creator-starting-frame-generation-fix-2026-10-24.md`. That bug prevented two
production requests from reaching Google; both app credit reservations were
released. The model/prompt did not cause those particular failures.

Validation passed:

- 59 preparation, variation, private loading and playback checks.
- 135 worker image checks and the worker build; 89 focused adapter/job checks
  also passed, with overlap with the image suite.
- Seven creator Hook viewport cases, three slideshow cases, and twelve Recreate
  layout cases across Hook, Wall and Talking Head. The layout fixture delays the
  lazy UI module and checks Escape/reopening, then four variations, selection,
  explicit approval, enlargement and horizontal overflow. The real photo-picker
  UI uses fixture owned photos; source/provider/auth boundaries are simulated.
- Scoped ESLint, whole-app TypeScript, webpack production compilation and native
  decoder bundle verification. Independent review found no concrete blockers.

Local evidence: `outputs/starting-frame-loading-combined-tests.log`,
`outputs/creator-loading-tests.log`, `outputs/creator-loading-browser.log`,
`outputs/starting-frame-rounded-layout-browser.log`,
`outputs/starting-frame-loading-build.log`,
`.tmp/creator-accounts-browser/receipt.json`, and
`.tmp/hook-recreate-layout/receipt.json`. A layout-only preview is
`outputs/starting-frame-dialog-rounded.png`.

No paid generation, production mutation or deployment was performed. Existing
failed jobs are unchanged and never automatically retried. Production loading
times and a newly generated output's visual quality remain unverified until
the fixes are deployed and explicitly exercised.

Production follow-up: the website and MCP now serve `e9f441e6`, including these
changes and PR 85. The matching generation-worker fix is active. Hosted builds,
live route/deployment identities and selected private source-frame delivery
pass. Signed-in performance and a fresh paid output remain unmeasured. Complete
release evidence and exclusions: `creator-recreate-release-2026-10-24.md`.
