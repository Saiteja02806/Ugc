# Hook remix caption switch at the ending

The reported 3.167-second generated hook changes from “SaaS founders!! / This
app is a game changer” to “I used to think marketing my SaaS / would take so
much time.” Production Remix evidence contains both sentences as separate blocks.
The original reference has its main caption at 0–3067ms and a different caption
at 3067–3100ms, on a single final screen-view frame. Remix scales that second
caption to 3133–3167ms. Independent block styling makes a change to the first
caption's size leave the second smaller. Inspection of the generated video's
first and final decoded frames confirms that no text is embedded in the footage.

## Change

- Exclude the reviewed final screen-cut captions from Hook Remix for references
  `explore-paired-hook-4585ee949081c4e5cd835cd3` and
  `explore-paired-hook-7c53cba88343579e7e15c8b0`, gated by their exact original
  two-block timing signature. The main caption then spans the complete clip.
- Keep raw catalogue transcriptions unchanged. Do not globally discard short
  captions or flatten user-authored sequences, Wall text, or slideshow copy.
- Normalize reference display and new Remix inputs. Older completed Remix
  receipts are adapted for review/application without another model call or a
  mutation to the paid receipt/request identity.
- Derive repaired editing state for an older applied clip draft only when both
  blocks exactly match the inherited scaled timing. Preserve main copy, font,
  weight, size, color, position, trim, and audio. The existing Save action saves
  the corrected draft; final composition consumes the same normalized edits.
- Display full-duration text over the final paused frame even at the exact clip
  endpoint. Earlier intentional caption endpoints still hide their text.

## Local verification

- 53 focused tests passed across Hook-tail handling, Remix input/application,
  API auth/claim/recovery, sequence preview, clip controls and reference previews.
- TypeScript passed. Scoped ESLint passed for implementation and unit/API tests.
- `scripts/hook-remix-ending.browser.cjs` passed with the actual editor and Remix
  components, synthetic 76-frame/24fps footage and mocked authentication/storage.
  It checks a legacy draft, 3.1s/3.145s/final-frame seeks, natural playback ending,
  unchanged SVG typography, matching final sequence edits and old Remix review
  plus Apply. No generation/API writes occurred.
- A wider 121-test run had 107 passes and 14 slideshow fixture failures, all
  reporting `Unexpected import @/lib/explore/slideshow-composer-draft` in
  `scripts/explore-format-generation-ui.test.mjs`. That separate slideshow work
  is present in the shared worktree; this fix does not edit its implementation
  or test harness.
- The older general `scripts/remix-text.browser.cjs` check stops at its preset
  toggle assertion (switching Snapchat Classic back to Bold retains `preset`).
  This occurs before Remix generation/recovery and is outside this timing fix.
  The dedicated actual-component ending/recovery check above passes; the older
  general browser suite is not claimed as passing.

## Release status

Local implementation only. No deployment, production data mutation or paid
generation was performed. Existing exported videos are not rewritten; saving
and preparing a corrected draft is required to create a corrected export.
Production acceptance remains distinct from these isolated checks.
