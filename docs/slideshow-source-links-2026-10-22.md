# Approved slideshow references and source links

22 October 2026. Local implementation, not deployed. The user confirmed the
supplied mappings are good to go, including repeated post links and creator
profiles. Do not ask them to reconfirm those mappings or infer category moves.

## Implemented

- All **38 approved mappings** are in `slideshow-reference-sources.json`.
  Twenty-eight lead to posts and ten to creator profiles. Query/tracking
  parameters are removed without deriving different posts from profile queries.
  Shared destinations remain shared; Marketing's parent-folder link is mapped
  to its sole slideshow. Existing categories remain as supplied.
- Source links appear on slideshow cards in both Explore gallery variants and
  in the full slideshow preview. Text labels distinguish **Original post** and
  **Creator profile**. They open a separate tab and do not trigger Preview or
  Recreate. The existing verified Starter/Growth source-access policy is reused;
  free accounts see Upgrade to Pro. Hook source rules remain post-only and Wall
  still has no source-link action.
- **13 additional sets / 60 original images** are frozen in a separate staged
  manifest. This retains the previous 59 references and 332 image positions
  byte-for-byte, including the three references absent from the supplied folder.
  Local development can preview 72 sets / 392 image positions. The authenticated
  catalogue stays at 59 until the new media is uploaded and verified.
- The additive preparer matches ordered content hashes, preserving existing
  identities even after folder/category renames (including Focus's historic
  `nota` ID). New titles continue saved category numbering, rather than replacing
  old Calory Tracking 06 with the new folder `(6)`. The 13 additions have stable
  IDs and ordered slide dimensions/hashes. Source files on D: are untouched.
- Development media reads admit only manifest-listed hash filenames and still
  reject production access. New media is staged under `.tmp/explore-catalog/media`
  for previews, with a dedicated upload bundle under
  `.tmp/slideshow-reference-release-20261022/media`.

## Action map

| Action | Result |
| --- | --- |
| Click reference cover | Existing in-app preview |
| Click Recreate | Existing selection/generation setup |
| Click Original post / Creator profile | Approved external destination in a new tab, subject to the existing source entitlement |
| Open slideshow preview | Full source image, navigation/thumbnails and the same source link |
| Browse a reference without a supplied URL | No fabricated source link |
| Browse production while additions are staged | Existing references remain available; unverified media never enters generation lookup |

## Verification

- **86 focused checks passed**, covering source URL parsing, profile/post labels,
  approved mapping identities, immutable historical references, staging isolation,
  additive preparation, gallery behavior, Hook/Wall regressions, navigation,
  existing MCP catalogue retrieval and reviewed Remix-text preservation.
- The real-component browser fixture clicked all **38** approved destinations,
  checked labels, separate Recreate/Preview actions, preview navigation, Pro/free
  behavior, legacy gallery links, keyboard activation and viewports 1366×768,
  1280×720 and 390×844. TikTok navigation was intercepted locally; this is not
  evidence of current TikTok availability or remote post/image correspondence.
- Desktop/mobile screenshots were visually inspected. New-set previews use
  the staged image bytes; the fixture can use placeholders for unavailable
  older media. It is an isolated component fixture, not a deployed app capture.
- Application TypeScript and scoped ESLint passed. A final preparer staging
  guard adjustment passed the four release-preparation checks again.
- Windows sandbox prevented initial Edge launch and temporary-file renames;
  isolated reruns passed outside that sandbox. A stale test harness was updated
  to use the already-changed shared cover-playback hook, preserving that earlier
  performance implementation.
- Production `https://www.getugcpilot.com/explore/slideshows` returned HTTP 402
  **Deployment Paused**. Signed-in hosted acceptance remains pending. No website
  deployment, paid generation, database mutation or successful cloud-media
  upload was performed.

Logs: `outputs/slideshow-source-links-tests-2026-10-22.log`.
Screenshots: `.tmp/slideshow-source-links-browser/{desktop,viewport-1280,viewport-390}.png`.
The complete approved folder map and original raw URLs remain in the prior local
review artifacts. The 60 new slides do not yet have reviewed Remix transcripts;
their generation/preview inputs are prepared, but new-source Remix acceptance
must remain separate from link and media-import acceptance.

## Upload approval and remaining release steps

The upload dry run froze **60 JPEG files totaling 11,811,439 bytes**. Proposed
destination is the existing UGC Pilot public reference-media bucket:

`gs://ugcsaas-media/explore/recreate/v1/<image-SHA256>.jpg`

The initial sandboxed attempt could not resolve Google OAuth and stopped before
upload. The requested network escalation was then rejected by automatic approval
review: authorization to add references/links did not explicitly authorize this
payload and external destination. Do not bypass that rejection or transfer these
files through another tool. The local work is complete; explicit user approval
for this public-media transfer is required before continuing it.

After approval, use the existing verified importer against
`lib/explore/slideshow-reference-additions.json`, with assets from
`.tmp/slideshow-reference-release-20261022/media`. It skips compatible existing
objects and marks only that additions manifest published after all objects pass
its metadata checks. Read back every public object and compare its SHA-256 to
the frozen filename; check the exact release/IDs and merged catalogue. Do not
copy the whole staged candidate over the historical imported catalogue.

Prepare/review new-source Remix transcripts before claiming full Remix parity.
The separate website-deployment pause remains in effect; public object upload
and local manifest readiness are not a website release. Future deployment and
production UI acceptance must be recorded separately.
