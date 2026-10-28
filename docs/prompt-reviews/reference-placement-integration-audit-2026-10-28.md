# Reference placement integration audit — 28 October 2026

Read-only application audit. No deployment, provider requests or video generation. This records current local code, not live activation.

## Confirmed gaps

- Hook automatic plans freeze layoutVersion but no source-specific geometry. automaticHookEdit initializes width .84, y .18, size48 and fitInitialHookText forces width .94. Manual new unstyled Hook Remix shares that generic fitter.
- Manual applyVideoTextRemix does not resolve Wall profiles. Its no-previous-style path uses width .84, y .18, size36 even for a reviewed Wall source. Existing remix-text test explicitly asserts that default.
- Automatic Wall plans freeze source/hash-bound profile and preserve full duration. Admission rejects source.blocks.length other than one, so static profiles cannot alone enable timed/multi-block sources.
- Wall heading/body title geometry is hardcoded .84/y .11/size65, while only body fields are profile-driven. Separate source-defined title geometry needs explicit fields/versioning.
- Wall profile assumes centered text; left-aligned paired source needs actual renderer/profile support.
- Profile fitter uses minSize max(36, baseline*.85). Wall measurement agent found source Wall50 needs about29px; parser supports24. Any lower bound adjustment must remain source-specific and preserve old receipts.

## Minimal manual integration

Existing editor and demo callbacks pass ReferenceText, remixed output and output dimensions to applyVideoTextRemix. For an untouched source no additional UI control is necessary. Only when no prior overlay exists, use a source/hash-bound reviewed layout initializer. Existing overlay branch must retain styles, timing, presets and explicit empty values.

Edited source prose complicates provenance: remixInputSource changes sourceSha256 to a synthetic copy hash. Therefore retain an immutable media-layout identity separately in server-prepared Remix receipts or resolve the original catalogue source through the authorized reference. Do not select a profile on referenceId alone or mistake the synthetic text hash for source-video hash. Preserve historical receipt behavior with a version field; do not refit recovered prior results.

## Persistence protections observed

clip-draft API returns initialContent only if no persisted draft exists. initialContent verifies owned ready asset, owned completed generation job, workflow format, bound output asset and request/source profile identifiers. Wall checks full duration and rejects Hook timeline contamination. Existing saved drafts take precedence. Manual explicit Use Remix intentionally changes words but preserves existing styles.

## Required regression assertions

1. Distinct reviewed sources initialize at distinct source positions with matching media hashes.
2. Automatic and manual new unstyled paths use the same reviewed layout.
3. Changed media hashes and unknown versions fail or require review.
4. Edited reference copy retains verified original media layout identity; custom copy without a reference cannot borrow a catalogue profile.
5. Prior overlays, blank user text, line breaks, fonts, coordinates, widths and trims retain precedence.
6. Source text changes do not reset full Wall duration; Hook trim behavior stays separate.
7. Old receipts recover exact stored geometry without recomputing using new settings.
8. Structured/multiblock/left-aligned sources are supported deliberately or explicitly queued for review.

## Commands actually run

`node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/explore/remix-text.test.ts lib/explore/clip-draft.test.mjs`: six clip-draft tests passed; Remix failed setup due extensionless TS import resolution.

`node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/explore/remix-text.test.ts`: all ten Remix tests passed.

These baseline tests demonstrate current behavior, including the generic-layout gap. No browser or production acceptance was performed in this audit.
