# Saved captions and scheduling: local fixes

25 October 2026. User-provided screenshots inspected; current implementation
reviewed. No production write, post creation, paid generation or deployment.

## Caption layout

The prior shared field rendered its caption library below the textarea. The
library had a 320px scroll region, while each caption had its own 7rem scroll
region. These nested scroll areas sat above date/time and Schedule post, matching
the user's reported confusion and awkward scrolling. Saving itself did not set
the open state in code, but an already-open library grew when entries were saved.

The Saved captions control now stays at the right of the caption actions. It
opens a Base UI dialog drawer at the right edge, outside the form layout. On
small screens it uses the available width. The close/header area remains visible;
only the list scrolls and caption paragraphs do not create nested scroll areas.
Use caption applies exact text, closes the drawer and returns focus to the field.
Save caption shows its existing status without opening the library. Existing
default, intentional blank, owner isolation and revision checks remain in place.

The shared field is also used by Trending and other scheduling forms, so these
surfaces receive the same drawer. No caption storage/schema behavior changes.

## Scheduling timeout findings and recovery

The screenshot alone does not establish which network request timed out. Code
does establish that saved-caption reads/writes are not awaited by Schedule post.
Do not attribute network failure to the presence of the caption list.

Scheduling first loads limits, connected accounts and publishing defaults;
TikTok additionally loads creator publishing settings. A pending video can then
resolve background audio, including download/upload, before saving the scheduling
request. Upload requests use native deadlines, whose raw TimeoutError can escape
this pre-submit resolution. Approved background music also previously lacked a
client deadline across authentication, download and response-body reading.

Changes:

- Retry a timed-out scheduling GET once, with a fresh bounded attempt. Explicit
  caller cancellation and non-timeout failures are not retried. No automatic
  schedule POST retry; retain typed time rejection and existing receipt checks.
- Name which preflight check timed out. Before any submission, report that the
  post was not submitted and retain caption/account/date/time choices.
- Bound default-music authentication, download and body to 30 seconds. A late
  token cannot start a download after the caller times out.
- Show settings, media preparation, submission and receipt-check progress in
  background scheduling. Media timeout gives a relevant retry/edit instruction.
- For a lost scheduling response, distinguish uncertain submission from a known
  pre-submit failure. Keep the exact durable request; explicit Try again reuses
  the same identity and recovery path, preventing duplicate posts.

This repairs reproducible client failure/recovery behavior. It does not prove
which hosted dependency was slow in the supplied screenshot or that the user's
production schedule now completes. That needs an authenticated production trace.

## Verification

- 42 focused transport, caption API/client/hook, simple scheduling and background
  schedule panel tests passed. Includes stalled token/download/body, read retry
  limits, cancellation, late auth, media/settings timeout before submission,
  explicit successful retry and lost-response recovery without duplicate POST.
- Three caption-field handler tests passed: saving leaves the library closed,
  exact selection closes and returns focus, and cleared/default/manual entry rules.
- Another 31 existing format-draft, direct/repeat scheduling, Talking Head review
  and video preparation checks passed (76 total focused tests).
- Scoped ESLint and application TypeScript passed.
- Existing caption browser fixture updated for the drawer, Escape/return focus,
  right-edge geometry, saved selection and existing library recovery checks.
  Not executed because browser access was disabled earlier in Work settings.
  Handler tests do not establish visual geometry or actual keyboard trapping.
- A read-only production request-log query through Vercel CLI 65.2.0 was denied
  with HTTP 403 (`permission_denied`). No log records were returned and the denied
  query was not retried. Production timing/root-cause evidence remains unavailable.

## Production acceptance still required

On https://www.getugcpilot.com, test at 1366×768, 1280×720, narrow mobile and
125–150% zoom. Use long captions and twenty saved entries; check right placement,
one library scroll area, keyboard close/return focus, and reachable date/time and
Schedule after closing it. Repeat in an existing publishing modal for nesting.

Trace a real Hook Schedule click through settings, optional audio preparation and
schedule receipt. Record endpoint, duration and status without caption/token
logging; correlate server diagnostics when available. Verify an explicitly
confirmed test post in Scheduling and check interrupted/repeated confirmation
retains one post. An actual production submission requires a chosen account/time
and an authorized test post; none was submitted during this work.

Automatic on-video Hook Remix remains a separately recorded proposal in
`explore-click-friction-review-2026-10-24.md`; it is distinct from the post caption.
