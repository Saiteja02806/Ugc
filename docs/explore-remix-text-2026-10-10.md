# Explore Remix Text — 2026-10-10

Local implementation; generation is disabled until rollout. No production
migration, deployment or paid generation was performed.

## Editor flow

Hook and Wall of Text: select or generate your background, open its **Edit**
control, then use **Remix Text** after Trim. Slideshow: open **Edit slides**,
select an owned output slide, then use **Remix Text**. Manual text tools are the
default. Open the compact Remix Text row to adapt saved reference copy; it is
also available in the Demo clip editor. See the 11 October UI/preset update in
`docs/explore-remix-text-ui-2026-10-11.md`.

Choose a catalogue reference (and its original slide for slideshow), inspect the
extracted text, optionally add instructions, then select **Generate remix**.
The backend combines the original copy with the signed-in account's saved
Business Context. Review or edit the generated draft, then **Use this text**
applies it and returns to manual tools. Users can still type,
adjust positions and change timing through the existing editor. Generation alone
never changes authored copy. Video copy keeps existing overlay styles and timing;
new blocks scale reference timing to the trimmed clip. Slide copy keeps its design.

## Extraction and provenance

- 185 catalogue references: 58 slideshows, 30 Hook videos, 97 Wall videos,
  including 16 references with paired audio found during the accuracy audit.
- 453 source units: 326 slides and 127 videos. Every unit is saved in
  `lib/explore/reference-text-catalog.json` under exact reference ID, slide ID
  (null for videos), format and SHA-256 of original source bytes.
- Windows English OCR processed images locally. V2 re-extracted 434 previously
  unreviewed units using real video timestamps, sampling up to 4fps plus the final
  source frame. Complete observations and unapproved similarity/crop proposals
  remain in `lib/explore/reference-text-transcripts.json`; none are silently
  truncated by editor limits. All new sampled frames were visually inspected,
  with native neighbouring frames checked around observed caption transitions.
- Seven initial entries were visually checked, corrected and marked ready: five slides
  in the first Fitness deck, `explore-hook-02`, and `explore-wall-text-05`.
  `docs/remix-text-reviewed-samples.json` records their exact corrections.
- The accuracy audit restored 11 completely missed slide texts and confirmed one
  slide without post text. Corrections are recorded in
  `docs/remix-text-audit-reviewed.json`. The completed audit has 441 `ready`,
  12 `no_text` and zero `needs_review`. All 19 prior reviews are unchanged; ten
  priority corrections and the additional slide/video reviews are saved under
  `docs/remix-text-*-reviewed-v2.json`. See
  `docs/explore-remix-text-accuracy-audit-2026-10-10.md` for coverage and limits.
- Unreviewed OCR can include incidental app UI,
  watermarks, missed text and unstable recognition between frames. These entries
  cannot generate. Empty detections also require review before being called
  `no_text`. The 20-block/6,000-character editor bound never certifies a truncated
  result; unsupported drafts remain empty/unreviewed while complete extraction
  is retained separately. Source claims were transcribed, not fact-checked.
- Creator-added captions only are eligible. Exclude app UI, screenshots,
  watermarks and scenery. Infographic/poster slides are entirely excluded,
  including their title, instructions and added Study tips text, under the user's
  latest instruction. Five posters, six app-screen-only slides and one photograph
  have no active blocks. Raw historic OCR is audit evidence only and cannot
  supply Remix input for those excluded entries.
- Local frames and raw OCR: `.tmp/explore-reference-text-local/<sha>/`.
  Source media: `.tmp/explore-catalog/media/` and
  `.tmp/explore-paired-references/media/`. These cache files are ignored.

Preview selective extraction safely (dry-run is the default):

```powershell
node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/extract-explore-reference-text-local.mjs --reextract-unreviewed
```

Add `--execute` to perform local OCR. Optional `--reference-ids`, `--review-set`,
`--limit` and versioned checkpoints support selective work. `ready` and `no_text`
entries remain protected even with `--force`; all 453 current units are protected.
Writes are serialized, atomic and retried briefly for transient Windows locks.

Review original media, then supply a JSON file shaped like
`docs/remix-text-reviewed-samples.json`. Every review must identify the same
source fingerprint, provide corrected blocks and explain what was checked.
Run after extraction has finished, since both write the catalogue:

```powershell
node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/review-explore-reference-text.mjs path/to/reviewed-text.json
```

Automatic approval review rejected the optional OpenAI vision extraction pilot
because reference media uploads and paid processing to that destination lacked
specific approval. No such upload occurred. The separate approved public CDN
download fetched source bytes for local OCR and made no AI requests. Optional
`extract-explore-reference-text.mjs` requires `--allow-openai-upload` as well as
`--execute`; do not use that path without approval for its destination and cost.

## Backend and recovery

GET `/api/explore/reference-text` requires existing generation access and resolves
only current catalogue identities. Unknown slides, changed fingerprints and
client-provided source URLs cannot supply original copy.

POST `/api/explore/remix-text` validates strict source IDs, instructions and an
Idempotency-Key UUID. The account is derived from verified authentication. The
server retrieves business facts and source copy; the client cannot replace either.
Source must be reviewed before a new generation. The prompt preserves structure
and approximate length, prioritizes supported business facts, treats source data
as untrusted instructions and never promises equal reach.

Private `explore_text_remixes` receipts store original text, business profile
version/context, model and prompt version before any paid request. Atomic claims
serialize each account and allow 20 attempts per rolling 24 hours. Pending,
failed and completed receipts remain idempotent. Failed attempts need an explicit
new request; uncertain replies check the same key. SDK retries are disabled.
Completed replies return their frozen original source and validated output.
Results are only shown after a durable save is confirmed.

Browser recovery stores the UUID and immutable source/instructions, scoped by
account, workflow format and output target. It is written before the API request.
Browser storage failure prevents starting a paid request. The saved Business
Context itself is never stored in this browser recovery record. Account/target
changes ignore late replies. A reference selection remains attached to the output
slide's stable identity when slides are reordered.

## Rollout and practical limits

1. The current catalogue review is complete. Future new or changed references
   must be visually reviewed before generation is enabled for their copy.
2. Apply `20261012135237_explore_reference_text_remix.sql` through the established
   Supabase migration process. Browser roles have no direct access to receipts.
3. Set `EXPLORE_TEXT_REMIX_ENABLED=true` and an existing `OPENAI_API_KEY` on the
   web runtime. Optional `OPENAI_TEXT_REMIX_MODEL` is independent of the business
   analysis model; default is `gpt-5.6-luna`.
4. Deploy and verify a real authenticated flow on `https://www.getugcpilot.com`,
   including business context, generated text, Use, saved output and recovery.
   This acceptance remains pending. Local previews are not production acceptance.

Uploaded catalogue alternatives currently show no automatic extraction. Remix
adds editable copy to the existing video/image overlay renderer; text baked into
source pixels is not erased by this feature. Choose a clean background before
applying replacement copy. Existing fit checks and export limits remain active.
Preserving text structure and style cannot guarantee the reference's reach.

## Local verification

- TypeScript `npx tsc --noEmit --incremental false`: passed.
- Scoped ESLint for the new Remix implementation and scripts: passed.
- All 73 targeted backend, schema, edit, catalogue, migration and existing
  generation/render regression tests passed. They cover
  owner-only context, exact source/slide association, fingerprints, private table
  privileges, quota, payload conflicts, concurrent claims, invalid output,
  durable-save failure and request recovery without another provider call.
- Existing video generation/edit and slideshow save/render regressions passed,
  including actual FFmpeg overlay exports and slide PNG rendering.
- `node scripts/remix-text.browser.cjs`: passed with real Remix component and
  mocked APIs. Covers all three formats, Use preserving style, reload reusing
  UUID, failed-request recovery, target selection and stale account responses.
- Updated Wall and Slideshow workflow fixtures checked at desktop and 390px mobile. Source lookup,
  uploads, paid generation and saving stay disabled in these development fixtures.

Useful commands:

```powershell
node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/explore/remix-text.test.ts lib/explore/remix-text-api.test.mjs scripts/remix-text-db.test.mjs scripts/remix-text-catalog.test.mjs
node scripts/remix-text.browser.cjs
```
