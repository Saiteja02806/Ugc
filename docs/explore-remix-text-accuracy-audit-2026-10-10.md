# Remix Text accuracy audit — 2026-10-10, completed 2026-10-11

All 453 current source units have been reviewed: **441 eligible text entries,
12 entries without eligible Remix Text, and zero awaiting review**. All source
associations and original file fingerprints match. The ten priority cases have
been corrected. The 19 previously approved entries are unchanged.

This is a local catalogue and extraction-pipeline correction. The generation
rollout remains disabled; no migration, deployment or paid AI request was made.

## Inclusion policy

- Use the creator's added captions. Exclude app controls, text inside app/demo
  screenshots, watermarks and incidental scenery. An explicit creator overlay
  mentioning an app or brand is eligible.
- Exclude infographic/poster slides completely, including their title,
  instructions and added “Study tips” captions. The user's latest instruction
  supersedes the earlier choice to keep poster titles and instructions.
- Twelve slides have empty active blocks: five excluded posters, six app-screen
  slides without eligible creator captions, and one photograph without post text.
  These exact source/slide identities are protected from re-extraction and Remix.
- Historic OCR is retained as audit evidence. It is separate from the active
  catalogue and is never substituted as generation input for an excluded entry.

## Verification coverage

| Check | Result |
| --- | --- |
| Current references / source units | 185 / 453 |
| Slides / video units | 326 / 127 |
| Eligible reviewed slides / videos | 314 / 127 |
| Intentionally unavailable slides | 12 |
| Unreviewed entries | 0 |
| Missing entries / source mapping or structural errors | 0 / 0 |
| V2 re-extractions / retained sampled observations | 434 / 3,927 |
| Previous reviews preserved exactly | 19 |
| Known priority cases resolved | 10 |

All 326 slides were visually reviewed against their original images. All sampled
frames of the 125 previously unreviewed videos were inspected in sequence,
including their final frames. Static captions were consolidated only after this
inspection. Changing captions were separated into timed blocks; neighbouring
native frames were inspected around their transitions, including delayed caption
appearance and hooks that add another line. Original video stream durations bound
the curated text intervals. The two previously approved videos were preserved.

The audit validates schema, exact reference/slide IDs, format, original-byte
SHA-256, source coverage, video bounds, lossless transcript reconstruction and raw
OCR fingerprints. It also verifies all 434 retained v2 transcripts. The catalogue
includes the 16 references with paired audio omitted by the original inventory.

Review evidence is saved in:

- `docs/remix-text-reviewed-samples.json`: seven original reviews.
- `docs/remix-text-audit-reviewed.json`: eleven restored slides and one original
  no-text photograph.
- `docs/remix-text-priority-reviewed-v2.json`: ten priority corrections.
- `docs/remix-text-slides-reviewed-v2.json`: 308 additional slide decisions.
- `docs/remix-text-videos-reviewed-v2.json`: 116 additional video reviews.
- `docs/explore-remix-text-audit-findings.json`: resolved issues, coverage counts,
  caption policy and the exact five poster exclusions.

## Why the first pass needed correction

The first pass linked sources correctly but did not establish transcription
accuracy. English whole-frame OCR collected interface text, missed stylized words
and emojis, and created repeated paragraph variants from minor recognition
changes. A 20-block slice then discarded later observations. Matching hashes
prevented selective reprocessing, and nominal 2fps timestamps were too coarse for
caption transitions.

The v2 pipeline now:

1. Retains every sampled OCR observation in
   `lib/explore/reference-text-transcripts.json`, with original source identities,
   real frame timestamps, line boxes, full raw blocks and alternate crop readings.
   No transcript block limit discards observations.
2. Samples original video frames up to 4fps and includes the final source frame.
   Timings come from presentation timestamps, rather than nominal frame indexes.
3. Proposes consolidation using similarity while preserving every variant as
   evidence. Changes to numbers, currency, emojis and negation stay separate.
   Proposals never automatically become approved copy.
4. Supports selective unreviewed re-extraction, versioned checkpoints and resume.
   Reviewed `ready` and `no_text` entries remain protected, including with `--force`.
5. Leaves unsupported editor-length drafts empty and unreviewed instead of
   publishing a truncated transcript. Approved curated blocks meet editor bounds.
6. Uses an exclusive extraction lock, serialized atomic catalogue writes and
   bounded retry for transient Windows/OneDrive file locks. Failed replacement
   retains the previous file and staged evidence; it never deletes reviewed data.

Seven transient file-lock failures during extraction were recovered through
selective reprocessing. All 434 selected units now have complete saved results.

## Ten priority corrections

| Reference | Applied correction |
| --- | --- |
| Wall 59 | Restored nine game tutorial captions, emojis and later lines; removed game UI; checked native transitions. |
| Wall 28 | Restored twelve tutorial captions; removed app controls and screenshot excerpts; checked native transitions. |
| Wall 06 | Corrected startup hook and emojis; excluded demonstrated app interface. |
| Investing | Checked amounts and percentage; saved one complete static paragraph. |
| Eldest daughter | Restored lines and quotation; removed repeated OCR variants. |
| Green flags | Restored five bullets and parentheses; saved one static block. |
| Research list | Restored five bullets, including the missing first claim. |
| Choose two | Checked A–H choices and amounts; removed stray OCR characters. |
| Bare minimum | Restored headline emoji and bottom lines; removed spurious numeral. |
| Fitness slide 4 | Preserved creator overlays “3. Train consistently” and “JournAI”; excluded phone UI. |

Exact copy, hashes and review notes are in the priority correction file. Historic
findings remain available with `status: resolved` and their applied resolution.

## Practical limits

This review does not certify every native frame of every video or establish a
measured OCR accuracy percentage. Sampling can miss exceptionally brief text;
native transition checks reduce that risk for observed changing captions. The two
prior approved videos retain their earlier approximate timing. Text baked into
source pixels is not erased by Remix.

Some original captions contain typos or end with an incomplete sentence. Their
visible wording was retained without inventing an ending, including Wall 37 and
Wall 53. One slide starts with a visibly clipped heading; only visible words were
saved. Source claims about health, money or other subjects were transcribed, not
fact-checked. Business-specific generation must use supported business facts and
cannot promise equivalent reach.

No unresolved wording/brand/inclusion decision remains for the user in this batch.

## Final validation

- All 22 targeted pipeline, atomic-write, catalogue, API and editor/recovery tests
  passed. Excluded `no_text` input is rejected before a provider call or receipt.
- Scoped ESLint checks and the tracked-diff whitespace check passed.
- Forced selective extraction dry-run selected zero units and reported all 453
  reviews protected, with zero external requests.
- The read-only viewer passed desktop/mobile checks in headless Edge with HTTP
  blocked: all 453 reviewed units, 326 slide sources, 441 text entries, 12
  exclusions, no pending priority cases and correctly empty poster text.
- Raw duplicate/capacity flags still describe unapproved OCR evidence; they are
  not unresolved defects in the separately reviewed curated blocks.

## Recreate and inspect the local audit

```powershell
node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/audit-explore-reference-text.mjs
node scripts/create-explore-reference-text-review.mjs
```

Open the [local comparison viewer](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/remix-text-audit/review.html)
to inspect originals, curated copy, complete unapproved extraction and sampled
frames. It is read-only and makes no provider calls. Source/frame caches are
ignored local files; retain them to use the viewer. Audit output is
`.tmp/remix-text-audit/audit.json`; original extraction snapshots remain under
`.tmp/explore-reference-text-local/runs/`.

Future reviews must match the exact source ID/hash and run after extraction has
finished. The runtime resolves approved catalogue copy; it never uses full raw OCR
as a substitute. Production acceptance remains pending on the real domain after
an authorized rollout.
