# Trending slideshow repairs — 10 October 2026

Status: implemented locally. These repairs have not been pushed or deployed,
and the new screenshot migration has not been applied to production. Earlier
Trending releases remain live. The separate Explore task is actively changing
this checkout; its work has been preserved and is not reported as validated here.

The production timing and database evidence are recorded in
`trending-slideshow-production-root-causes-2026-10-10.md`.

## Changes

1. **Hook-edit queue contention:** edits have a dedicated queue and warm Cloud
   Run service. Generation stays serial. Terminal Carousel jobs dispatch feed
   admission independently through Cloud Tasks rather than awaiting its HTTP
   retries. Database outbox recovery remains the fallback.
2. **Missing app screenshots:** the migration expands only the metadata check's
   eligible product positions from 4/5 to 4/5/6. The existing renderer already
   fills the frame proportionally for landscape, square and portrait uploads;
   this repair addresses the failed database insert after rendering. Earlier
   saved slideshows retain their original images until explicitly edited.
3. **Returned cards stuck at Updating:** owned skipped Carousel assignments
   have read-only status access, cards select the latest live edit over captured
   history, and temporary refresh failures appear as Checking update with retry.
   Save/edit access does not expand to skipped assignments.
4. **Unnecessary repeat rendering:** previous edited slides are reused when
   server-owned fingerprints cover every rendering input and match exactly.
   Draft/pending/failed edits remain unavailable for scheduling despite retaining
   previous output internally for reuse.
5. **Copy-repair failures:** cover, body and final-slide requirements are explicit
   in the system prompts and per-field schema guidance. The conflicting general
   body-paragraph guidance is removed from targeted repair. Fixed fonts, word
   ranges, line-fit checks and bounded repair counts remain unchanged.
   Initial and repaired plans additionally pass actual renderer measurements,
   including optional heading and CTA groups, before image sourcing/rendering.
6. **Reservation replay conflicts:** a dispatched terminal batch with no
   permitted successor waits instead of preparing its previous deterministic
   reservation key again. Undispatched preparations retain exact-item recovery;
   bounded recovery exhaustion still marks missing slots failed.

## Validation

- Full worker suite and post-suite: 306 + 15 passing tests before the final two
  failure-path regressions. The focused processor suite then verifies both
  successful and failed Carousel jobs dispatch independently, and failed task
  creation preserves terminal state for durable recovery.
  That focused processor suite passes 23 tests. Measured-copy/planner tests
  reproduce an overflow missed by the estimated widths and verify isolated
  repair without changing the valid slides or older paragraph contracts.
  The final combined Structure 2, edit-render and processor run passes 84 tests.
- Existing creative-edit suite: 37 passing tests. Slide-image suite: 11 passing
  tests, including all six independently uploaded images, ownership/readiness,
  original restoration and preserved app screenshot eligibility.
- Reconciliation API: five behavior tests cover verified ownership, nonterminal
  rejection, busy outbox retries, acknowledged completion, temporary failures
  and compatible legacy signed callbacks.
- History/save behavior: four tests verify exact assignment/creative/owner access,
  strict skipped-card mutation rejection, server-only cache retention and save
  revision fencing. Status/refill/queue policy tests pass.
  Two dispatch-routing tests verify the dedicated edit service and prevent
  fallback to the shared generation worker when its URL is missing.
- The actual screenshot migration passes in PGlite: slide 6 becomes valid,
  legacy 4/5 stay valid, product slots 1/2/3/7 and forbidden eligibility fail,
  missing metadata still fails, and repeat application is idempotent. The complete
  migrated baseline passes its six Structure 2 database integration tests.
- Terraform validates for the Carousel worker and foundation. TypeScript,
  scoped ESLint and the Next.js production build pass.
- A final isolated live `gpt-4o-mini` request repaired synthetic copies reproducing
  the observed two-paragraph, sixteen-word hook and twelve-word takeaway. Only
  slides 1/6 changed and their publishing plus actual renderer checks passed
  at 1:1 and 4:5. The cover uses 84px in two lines; the two body blocks use
  48px in two lines each, fully inside the safe area.
  Provider request `req_ea0f1f9b7a3d4d2ebd8e019600809941`, 1,334 total tokens.
  No customer rows, paid image jobs or schedules were created. This establishes
  one successful repair, not a guarantee that every future model output passes.
  An earlier probe passed only the estimated/legacy contract and then failed
  the native body rendering check; that result prompted the new measured gate
  and is not counted as a successful complete rendering probe.
- Eighteen renderer/spec tests cover full-frame proportional crops for 16:9,
  4:5 and 9:16 backgrounds in both output formats, original 72px hook
  compatibility and six-slide screenshot placement/persistence ordering.

## Release prerequisites and acceptance

Apply the validated screenshot migration. Provision `ugc-carousel-edit`,
`ugc-trending-reconciliation`, and `ugc-carousel-edit-worker` with the existing
private runtime identities and scheduler invocation permissions. Set the web
environment's `GCP_CAROUSEL_EDIT_TASK_URL` to that service's base URL; dispatch
appends `/tasks/jobs`. Release the reconciliation API before updating the
generation worker. Keep support for edit jobs already queued on `ugc-carousel`.

The edit service adds one warm instance, capped at one, without increasing shared
generation concurrency. Both new queues have bounded concurrency and retries.

Production acceptance still needs a real slideshow hook change while generation
is active, ready status after revisiting a skipped card, and a new six-slide
generation whose final app screenshot persists. Compare database queue/start/end
times and Cloud Tasks dispatch logs. Authentication is unavailable in the shared
browser, so local and isolated tests do not claim authenticated production
acceptance. Do not mass-retry prior failed customer generations or rewrite saved
images just to perform the check.
