# Trending slideshow planner fixes - 17 October 2026

Implemented locally after the production investigation recorded in
`trending-slideshow-generation-audit-2026-10-17.md` and the user's approval of
two corrections: concise body copy with two-line headings, and backend-owned
five-item batch positions.

## Copy admission

Helpful Tips previously required at least 18 body words; Product Stories required
at least 14. Those minimums could cause short, useful copy to be rewritten into
longer text that was harder to fit. Follow-up bodies now require nonempty useful
copy, with at most 30 words. Initial generation, schemas, complete repairs,
targeted repairs and shared presentation guidance use the same policy.

Counted Helpful Tips bodies support one complete paragraph and an optional second
paragraph, enforcing the combined 30-word / 300-character maximum. Persisted
bodies remain strings. Optional content headings allow at most 10 words and two
measured lines. Both renderers already supported this wrap, so no renderer or
font-size change was needed. The Helpful Tips heading minimum is now one word;
headings are still optional and must add a distinct idea.

Cover hooks retain 5-14 words and their existing one-statement contract. Measured
overflow, three-line body blocks, maximum text lengths, configured list counts,
business grounding, unsupported claims, product placement, perspective and CTA
rules remain enforced. This fix does not guarantee that every future model
response will satisfy those independent checks.

## Position ownership

Helpful Tips now requests an object containing `items.first`, `items.second`,
`items.third`, `items.fourth` and `items.fifth`. Each property has its own
assigned format/hook schema. The backend maps these fixed keys to its existing
reserved brief and slot; the model does not return numeric position identifiers.
Product Stories already used owned output keys and retain that mechanism.

The parser handles missing or malformed assigned items through the existing
bounded individual repair path while retaining valid siblings. It rejects old
indexed arrays, foreign keys and ambiguous envelopes. Slot input validation
requires integer positions 0-4 exactly once. Neither reservation identifiers nor
persisted plan shapes, delivery order, partial settlement or recovery budgets
change. Planner provenance advances to Helpful Tips v58 and Product Story v26.

## Verification

- `npm run build --prefix worker`: passed.
- 144 compiled worker tests: passed. These cover initial and repaired planning,
  short body acceptance, maximum copy limits, real-font two-line headings in
  1:1 and 4:5, overflow rejection, permuted response keys, absent-item repair,
  unchanged siblings, scoped repairs, image assignments, persistence and editing.
- `node --experimental-test-module-mocks --test
  worker/src/jobs/generate-carousel.partial.test.mjs`: one additional test passed;
  completed siblings remain consumed and only unused reservations are released.
- Scoped `git diff --check`: passed.
- Additional feed/database tests could not start because local
  `@electric-sql/pglite` is missing. Lint could not start because the local ESLint
  installation is missing `@eslint-community/eslint-utils`. These checks are not
  counted as passing. Shared dependency files were not changed for this fix.

This change is local and has not been deployed or verified in the production UI.
No paid model call, production data mutation or retry of failed user slots was
performed. Release acceptance requires deploying the Carousel worker and checking
a fresh Trending output on the production domain, with planner provenance and
individual slot outcomes inspected. Existing failed slots are not automatically
recovered by a source-code change.
