# Talking Head + Demo: visit recovery and complete preview frame

Scope: fix automatic recovery and the video element's sizing. Do not change shared stylesheets, button presentation, editor controls, or the other chat's UI work.

## Automatic recovery

The former draft and completed-generation display IDs were read from localStorage indefinitely. Reopening the workflow could fetch yesterday's media and automatically select its completed result, including through the automatically persisted `hookJob` URL parameter.

The four-hour proposal has been replaced by explicit draft identities and entry intent. A connected workflow gets a random `work` UUID. Its owner-scoped browser snapshot and generation result IDs are namespaced by that UUID, with no idle expiry. Entering `/explore/create-hook` from Explore creates a new task and clears obsolete automatic section/job hints from that new URL. Refreshing a matching active tab continues that exact task. Explicit `resume=1` opens a specific saved task; this one-time intent is consumed from the URL. Opening an older work URL without that intent, restoring a discarded page, or returning through the back/forward cache shows Resume previous work / Start new video before mounting media recovery. Switching browser tabs does not reset the editor.

The Saved drafts link lists owner-specific snapshots stored on this browser. It does not imply cross-device workflow sync. Each entry is validated independently. Missing or corrupt selected drafts show a recovery error and cannot fall back to a different task's video. Local uploaded generation references still use the existing choose-again warning; File objects are not serialized.

Clip draft scopes, final preparation, caption review, and scheduling receipts include the same work UUID. Separate tasks can use the same source asset without sharing trims/text/audio edits. Scheduling marks the current task as scheduled only after a verified scheduling response; preparing or generating a video never marks it complete. A draft editing lock prevents a second tab from overwriting the same task. Closing the page releases the browser lock without cancelling backend work.

Permanent media, job receipts, uncertain generation requests, preparation receipts, and schedules remain separate. They are not deleted or cancelled by starting fresh work. Unacknowledged generation requests retain their account-wide coordination and read-only recovery. Before submission, their original work UUID is saved beside the request identity. If another task resolves that request later, its result IDs are saved under the original task and never inserted into the new task. Unknown legacy request origins leave the result in durable history rather than guessing its current task. The phone workflow's policy is unchanged. Legacy untimestamped localStorage drafts are not imported automatically or deleted.

## Preview frame

The workflow preview's broad video rules impose a 300–360px maximum height. A sequence layer can be taller, so the nested video was capped independently of its frame and left a black region below it. The sequence video now explicitly fills its projected layer with no independent maximum dimensions. Projection still controls containment, aspect ratio, and intentional demo cropping. No shared stylesheet was edited.

## Verification

Implementation sequence: introduce and validate the draft storage/entry contract; wire the entry boundary and exact-media session; isolate generation/clip/preparation/scheduling recovery; connect verified completion callbacks; then run the existing regression suites and a browser navigation test. Existing buttons and shared stylesheets were preserved throughout this lifecycle patch. No schema or worker change is needed.

- Session tests cover reload, exact source/demo/audio selections, independent task IDs, legacy history isolation, account isolation, duplicate-tab locking, recovery deadlines, and preservation of durable receipts.
- Generation tests cover task-specific job polling, ignoring historical IDs/automatic URLs on a fresh task, and routing an older unresolved request back to its origin. Unconfirmed request recovery remains read-only.
- The real entry boundary and recovery hook run in an isolated browser fixture through refresh, new entry, explicit resume, duplicate-tab lock, confirmed scheduling, closing/reopening a tab, and ambiguous old URLs. Its media/auth responses are isolated fixtures; no paid generation or real schedule is submitted.
- The real sequence player is rendered with the real workflow CSS and a synthetic portrait calibration clip at 1440×900, 1024×768, and 390×844. Video and projected-layer bounds match, no horizontal overflow occurs, and the desktop frame exceeds the former 360px cap.
- The local fixture does not access production authentication, spend AI credits, or submit jobs.

Results: 195 regression tests passed across draft/session contracts, generation/recovery, finishing, simple/background scheduling, saved clip composition, media selection, and Explore navigation. Scoped ESLint and TypeScript checks passed. The browser lifecycle fixture also verifies same-document client navigation from a reloaded task into a new workflow, without loading the earlier task's media. The prior preview-fit fixture passed at desktop/laptop/mobile widths.

Code review checks: immutable work IDs are validated before storage access; owner-qualified keys prevent cross-account snapshot exposure; no fallback can replace a missing chosen draft; timers no longer decide recovery intent; request origin is saved before paid submission; uncertain requests remain account-coordinated; completion callbacks run only after verified schedule responses; same-draft tabs cannot overwrite one another; independent clip scopes stay within the existing 160-character contract; mount/refresh/resume never submit generation or scheduling mutations.

Browser limitations: reload and all possible browser crash/session-restore variants cannot be distinguished perfectly on every platform. The boundary uses navigation type, the active-tab marker, discarded-document information where supported, and back/forward-cache restoration signals, and asks when those indicate an older/ambiguous entry. Browser-only drafts do not sync across devices and are lost if browser site data is cleared; owned media and confirmed server schedules remain durable.

Changes are local. Deployment and authenticated production acceptance have not been performed for this patch.
