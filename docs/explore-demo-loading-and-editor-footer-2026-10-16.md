# Demo loading and editor footer follow-up

Implemented locally on 16 October 2026. These changes are not included in the
previously deployed commit `cdf8c936`. Authenticated production acceptance is
still outstanding.

The Hook Demo component used one busy flag for pending opening footage, demo
upload, audio operations, draft saving and final preparation. That same flag
disabled Edit demo video, Change, source replacement and the focused editing
fieldset. A local clip could already play while upload confirmation was pending,
making those disabled actions look broken. The upload helper also performed a
second metadata read without a timeout.

## Retained actions and their location

| Action | Before | After |
| --- | --- | --- |
| Edit demo video | Matching preview card; disabled by the broad busy flag | Same card and focused-editor destination; navigation stays available and validated local footage can be edited during upload |
| Change | Matching preview card; disabled by the broad busy flag | Same card; reveals/focuses Demo source controls, as before |
| Replace demo / Creative Assets / Remove | Demo source group; blocked during video upload | Same source group; a new selection or removal supersedes the pending upload |
| Trim / manual text / style | Focused demo editor; blocked by upload and unrelated media work | Same tools; local edits survive the owned upload acknowledgement |
| Save edits / Schedule | Requires media readiness and validation | Still requires confirmed owned media; opening an editor never renders or schedules |
| Save / return footer | Repeated instruction row, divider and extra spacing | Compact actions without that routine row or divider; real loading, errors and retry controls remain |

Pending upload edits do not overwrite the last accepted recoverable draft. Failure
restores the accepted clip, trim, text, framing and source mode. Successful upload
binds local edits to its confirmed media ID. Request revisions prevent an older
completion from replacing a newer upload, Creative Assets choice or removal.
This does not delete an already accepted server upload when its UI selection is
superseded. The additional demo metadata read now times out after 15 seconds;
network transfer itself is not assigned that deadline.

The routine footer change applies to shared Hook/Talking Head/Wall clip editors
and Hook's separate demo editor. It preserves workflow-specific audio placement,
the Demo tab, trim/text controls, error feedback and navigation. Talking Head's
separate upload/edit coordinator was not rewritten to offer pre-upload editing.
Slideshows do not use this demo component and were not changed.

## Verification

- 161 targeted tests passed, covering real component event/state callbacks,
  deferred upload boundaries, metadata timeout, superseded completions, failure
  rollback, ownership gates, existing clip editing and audio behavior.
- TypeScript and targeted ESLint passed. Test log:
  `outputs/explore-demo-loading-tests.log`.
- `scripts/explore-demo-loading.browser.cjs` renders the real demo component,
  upload hook, browser metadata reader, trim/text controls and application CSS.
  HTTP/auth/storage, Remix generation and draft persistence use isolated
  fixtures; no production data writes or paid media requests are made.
- At **1280×720** and **1536×864**, the browser deliberately holds the upload PUT
  response. It clicks Change and Edit, changes trim/text, checks that Save stays
  disabled, releases confirmation and verifies that the edits remain and Save
  becomes available. The ordinary demo footer is **44px**, has no divider, stays
  within the viewport and causes no horizontal overflow.
- Shared Talking Head and advanced Wall editors were also rendered at
  **1280×720**, including scrolling the tool region. Both keep their footer
  visible with no divider or routine instruction row. The Talking Head fixture
  footer is 64px including panel padding. The empty Wall fixture retains its
  required-text validation, making that footer 98px; real error feedback is
  intentionally retained.
- Screenshots and measured results are under
  `.tmp/explore-demo-loading-browser/`; browser log:
  `outputs/explore-demo-loading-browser.log`. These are component fixtures,
  not screenshots of a signed-in production session.
- Production navigation was attempted at
  `https://www.getugcpilot.com/explore/hook-video`, but the shared browser profile
  was already in use. It was not closed or reset. This pass does not establish
  production upload/edit/save acceptance. Narrow/mobile, zoom and other laptop
  viewport scenarios were not rechecked in this follow-up.

The Explore mistake log records these regressions as EX-44 and EX-45. Other
chats' ongoing scheduling/reference edits were preserved and are outside this
follow-up's implementation scope.
