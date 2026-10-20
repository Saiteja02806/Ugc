# Public Trending AI hook collection

The user requested the retired Trending AI hook inventory as one public bundle,
explicitly excluding Explore hook references. Anyone with the link may access it.

Production database inventory on 16 October 2026: 128 ready, undeleted global
`avatar_assets`, 128 distinct SHA-256 hashes, 74 creator keys. All clips are silent;
total duration 375.871 seconds. Source batches contain 78 + 1 + 28 + 11 + 10 clips.
`lib/trending/hook-video-sources.ts` establishes this as Trending's source catalogue.
Explore's separate reference libraries and owner-specific generated outputs are
excluded. Creator keys are catalogue identities, not verified real people.

`lib/trending/ai-hook-bundle.json` freezes this inventory with public video/poster
URLs, titles, durations, reactions and content hashes. `/hookvideos` is a public,
noindex collection with search, reaction filtering and on-demand playback. Only
selected footage loads. It does not enable Hook generation in the Trending feed.

Latest URL decision: use `https://getugcpilot.com/hookvideos` for the collection.
The former `/aivideos` URL permanently redirects there to preserve shared links.

`python scripts/build-trending-ai-hook-bundle.py` verifies all MP4 bytes against
their catalogue hashes and builds a ZIP with all 128 videos, catalogue.json and
README.txt. Local output is ignored under `.tmp/trending-ai-hooks-2026-10-16/`.
ZIP: 202,873,103 bytes; SHA-256
`bb761814f0e54a39568764c56affc8133a3e302c56154ead06a4e2852d6e4254`.

Public archive object:
`bundles/trending-ai-hooks-2026-10-16/trending-ai-hooks-2026-10-16.zip`
in `ugcsaas-media`, with attachment download headers. The upload is create-only
and does not replace source media. Future catalogue changes require an explicit
new snapshot and archive; they do not silently alter this bundle.

User correction: hide the bulk Download all button until explicitly requested
again. Remove the download invitation from the introduction. Cards, accessible
button labels, search and preview titles use reaction types only, with no Creator
001/002 labels or numbered name suffixes. Keep the prepared archive independently;
do not advertise or link it from this page. The collection count remains 128.

Third user correction: remove the preview's Open original video link because it
opens the Google storage URL. Playback remains in the preview dialog. The failure
message only suggests reopening the preview and must not refer to a removed link.
Deployed as `dpl_8vYv5HEkcEbyxJqyexR7fY1xPjqm` (READY); both public domains
serve it. Production browser verification found one video and zero links in the
preview dialog, including zero Open original video links. Scoped lint and the
full hosted production build passed.

Second user correction: jumble the creator-grouped catalogue order. The gallery
uses a deterministic mixed order: shuffle each creator's clips, then show one clip
per creator per shuffled round, avoiding the same creator at round boundaries
when another creator remains. The first 74 cards cover all 74 creator keys before
repeating one. Keep this order through filtering and rerenders; preserve all 128
clips. Spread any final clips from a prolific creator into earlier gaps so this
inventory has no adjacent repeats of a creator key. Preserve the frozen source
manifest. Do not infer real-person identity beyond
the catalogue keys. This does not change Trending feed allocation or Explore.

Local verification: TypeScript and scoped ESLint passed. Real Edge browser checks
passed for anonymous access, all 128 cards and unique hashes, Trending-only source
paths, no bulk-download link, no numbered creator labels in cards or dialogs,
search, reaction filter, empty state, actual video decoding, keyboard opening and
dismissal, mobile fit and absence of page errors. Desktop/mobile screenshots are
under `.tmp/trending-ai-hooks-qa/`. All 128 archive MP4 hashes and ZIP integrity
passed; its public HEAD returned 200 with the expected byte count and attachment
headers. Browser checks are rerun on the production domain after promotion.

Production domain aliases serve baseline `d73ef153` (both bare and www); the
project's production target also listed unpromoted `24a6faa4`, which must not be
mistaken for the live source. The final isolated deployment uses the live baseline
plus the seven bundle source/doc/script files. Other workspace changes, workers,
schema, deployment settings, feed generation and Explore are outside this release.

Production acceptance completed on 16 October 2026:

- Deployment `dpl_CY4usfE4EPFQee7UJoeiZcZg1sEn` is READY; both
  `getugcpilot.com` and `www.getugcpilot.com` resolve to it.
- Anonymous browser acceptance passed at `https://getugcpilot.com/aivideos`:
  all 128 cards in the expected mixed creator order, no bulk-download link,
  reaction-only labels, search/filter/empty state, real playback, keyboard and
  mobile preview fit, with no page errors. Full production build passed.
- All 128 clips remain present; first 12 creators are distinct and no two
  adjacent clips share a creator key across the full unfiltered collection.
- Sources are retained in this workspace as seven new files. This isolated
  deployment does not push or merge Git changes or ship other local edits.
