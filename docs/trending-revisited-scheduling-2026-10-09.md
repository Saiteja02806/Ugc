# Trending scheduling after returning to a previous post

The owner reported that double-tapping a previously viewed Wall of Text card
did nothing. Two failures were reproduced before changing the code:

- `requestCreativeDecision` rejected every liked history entry. An entry becomes
  liked when scheduling opens, even if the user cancels or saving fails. That
  restriction disabled both double-tap and the Schedule button on return.
- Wall schedule creation loaded a selected-only draft before confirming the
  browser's accepted decision. A pending outbox write left an owned, available
  post active and produced a 404. Production logs also contained a Wall schedule
  404, though the signed-out verification browser could not replay that request.

## Repair

Revisited liked posts can reopen their existing composer/scheduler without a
new review decision, history entry or remaining-count decrement. Skipped posts
keep their explicit persisted reconsideration before that hand-off.

The Wall schedule endpoint verifies the assignment under the authenticated
owner and derives the creative ID from storage. It confirms acceptance before
loading the selected draft. If an original skip arrived first, the existing
reconsideration RPC recovers that exact assignment. Foreign assignments,
creative mismatches and inactive assignments without a recorded decision fail
closed. Ordinary outbox conflicts are unchanged. Rendering remains a continuation
after schedule persistence, and an unsuccessful save does not start rendering.

## Validation

- Seven new route/history assertions failed on the original code and passed
  after the repair.
- `npm run test:trending-revisit-scheduling`: 37 passed, including the real
  decision helper against PostgreSQL via PGlite, delayed accepted/skip writes,
  ownership, exact creative scope, failure and retry behavior.
- `npm run test:trending-interaction`: 66 passed.
- `npm run test:trending-publishing`: 55 passed.
- Creative Assets/decision/library contracts: 17 passed.
- Scoped ESLint and `tsc --noEmit --incremental false`: passed.
- Browser: local Wall scheduler opened, was cancelled, and reopened by
  double-tapping the same history card at both 1366 × 680 and 1536 × 776. The
  reviewed count stayed at one, the Schedule button stayed enabled on return,
  and the reopened modal identified the original assignment's preview title.
  Evidence is in `.tmp/trending-revisited-wall-1536x776-20261009.jpg` and
  `.tmp/trending-revisited-wall-modal-1536x776-20261009.jpg`.

The browser was signed out, so local visual checks confirm the modal hand-off;
schedule saving and render dispatch were verified with isolated route/database
tests. No social post was created or published during verification.

## Production diagnosis and release status

Read-only Vercel inspection identified active production deployment
`dpl_8BnroSgS2Ct8FCG5et2TN8X9wa2F`, source
`bd352b7e52ce87f1e046dca8ad2ce6788280d545`. The revisit endpoint was deployed
and correctly rejected unsigned requests. Production already had the required
reconsideration RPC and service-role permission.

A rollback-only database diagnostic selected a recorded skipped Wall assignment,
asserted that its existing decision became accepted and its state selected,
replayed the delayed skip, and checked that it stayed accepted. The transaction
was rolled back; no user data changes persisted.

This repair is local and has not been deployed. It needs an application release
only; no database migration or worker release is required. Unrelated work in
the shared checkout was preserved and no Git push was attempted.
