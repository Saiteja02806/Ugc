# Choose Image loading and multiple uploads — 19 October 2026

Status: implemented locally; not committed or deployed. Production observations below describe the old implementation. They are not acceptance of this correction.

## Latest production recheck

The current production domain still resolves to READY deployment
`dpl_Dfbks1DRK3L4AMnmWQRJFU9ohNSM`, source commit
`4c22c19e30eeeab6c24be8c40658a1deae05d98e`. Inspection of that exact commit
confirms `staleTime: 0`, original image URLs in the tiles, and no public-GCS
thumbnail optimizer configuration. The thumbnail helper is absent from the
deployed commit. **The loading correction has not reached production.**

A fresh read-only measurement of two previously observed saved images succeeded:

| Sample | Original | 256px WebP preview | Byte reduction |
| --- | ---: | ---: | ---: |
| Saved image 1, 720 × 1280 | 2,056,818 bytes | 10,574 bytes | 99.49% |
| Saved image 2, 720 × 1280 | 2,178,932 bytes | 12,644 bytes | 99.42% |

The originals took about 1.0s and 2.3s respectively in sequential server-side
fetches. These are individual download measurements, not the customer's browser
opening time. The thumbnail experiment used the bundled Sharp runtime and wrote
no original/production media. Receipt:
`outputs/image-picker-performance-2026-10-19/thumbnail-payload-experiment.json`.

A nine-file patch was prepared against the exact current production source and
passes `git apply --check` in an isolated baseline. It includes the shared
thumbnail/pagination/cache correction and the requested generation multi-file
upload; unrelated worktree edits are excluded. Review inventory:
`outputs/image-picker-performance-2026-10-19/release-review.json`.

The project dependencies were absent at the first recheck, so a temporary
validation runtime was installed separately with the same locked package
versions. Fresh validation now passes: **132 tests** and **seven actual-component
browser scenarios**. The browser checks cover Hook/Talking Head at three sizes
and a 114-image Hook library: 24 initial optimized tiles, 48 after Load more,
zero hidden catalogue requests, zero extra list reads on warm reopen, and a
three-file upload. Auth, inventory, upload and thumbnail responses are fixtures;
these checks do not establish hosted CDN latency or production acceptance.
Receipts: `recheck-tests.txt` and `browser-recheck.txt` in the output directory.
Earlier full project TypeScript and scoped lint remain historical checks.

## Finding

The signed-in Hook workflow at `https://getugcpilot.com/explore/hook-video` downloads full originals for approximately 68px tiles whenever uploaded assets have no thumbnail. Browser lazy loading still starts many images near the scroll area. Both image-source panels were mounted; the catalogue could also begin downloading while the owned-image list was pending.

Read-only production inventory, using the picker’s actual filtering rules:

- 114 reusable images; none has a stored thumbnail.
- Original bytes total 104.84 MiB. The newest 64 total 62.00 MiB; the newest 12 total 13.22 MiB.
- At an observation about 20.9 seconds after opening, 64 owned-image requests had started, 35 were decoded; 17 hidden catalogue images also had a source assigned. Some originals decoded at 2297 × 4097 pixels.
- At a later observation about 38.4 seconds after opening, all 64 started owned images were decoded. These are intermittent snapshots, not measured first-visible-image timings or proof of an exact one-minute delay.
- The indexed database list query executed in about 81ms (planning about 88ms). This rules out an equally long database scan in that sample; API/auth/network latency was not measured end to end.
- The sample inventory contains no private-proxy image URLs. Signed/private delivery must retain its authorization boundary regardless.

The upload button’s other issue is independent: the main generation picker’s HTML file input lacked `multiple` and used only `files[0]`. The shared Talking Head form and slideshow instruction attachment input already supported multiple files.

## Local correction

- Public images in the existing `storage.googleapis.com/ugcsaas-media` bucket and known built-in creator paths use the installed Next image optimizer at width 256, quality 75. Original URLs remain the generation/upload references. This needs no stored-thumbnail backfill.
- Private application delivery, signed GCS URLs, blobs and other hosts retain their existing delivery path. The optimizer allowlist rejects signed query strings. No additional permission or public exposure is introduced.
- Shared saved-image pickers initially render 24 entries and provide Load more. Hidden tabs have no thumbnail source or mounted catalogue content. The initial owned-image loading state no longer briefly starts the catalogue for signed-in users.
- The owner-scoped metadata query stays fresh for one minute; explicit refresh and mutation reconciliation remain available. This is inside the five-minute private delivery URL lifetime.
- Add images accepts several PNG/JPEG/WebP files in one file-dialog selection when the workflow supports multiple references. The complete selection is checked against remaining capacity and the model’s per-file size before uploading. Single-image callers keep their contract.
- Uploads run at most two at a time, show completion progress, append successful files in selection order, preserve earlier selections and report individual failures. Users can dismiss the error or retry a failed file. Account/unmount cancellation prevents late results or queued files from attaching to another session.

Scope: Hook/Wall generation references, shared saved-image library, instruction-image picker, and the reusable image-library browser’s public tile previews/cache. Existing full previews and selected generation assets retain their original content.

## Validation and limits

Targeted tests cover the actual generation component with controlled auth/upload boundaries, partial failure, ordered appending, limits before upload, bounded concurrency, pagination and cancelled-owner isolation. A test uses the installed Next optimizer’s parameter validator against the actual configuration and optimizes a real local PNG into a decodable small WebP without remote requests. Shared creation, reference inventory/ownership and workflow-generation regressions are also checked.

Final sequential run: **132 tests passed**, no failures. Full project `tsc --noEmit --incremental false`, scoped ESLint, and tracked-file whitespace checks passed. Test output: `outputs/image-picker-performance-2026-10-19/tests.txt`.

Validation command:

```powershell
node --test --test-concurrency=1 scripts/image-picker-performance.test.mjs scripts/explore-format-reference-upload.test.mjs scripts/explore-reference-images.test.mjs scripts/workflow-image-collection.test.mjs scripts/workflow-creation-form.test.mjs scripts/explore-format-generation-ui.test.mjs
```

The local sample shrank from 222,408 bytes to 10,716 bytes (95.18%) at width 256. This is a local sample, not a measured production-wide saving or a latency guarantee. Receipt: `outputs/image-picker-performance-2026-10-19/local-thumbnail-experiment.json`.

An initial combined validation run exhausted host memory in the large generation UI suite. That suite subsequently passed alone (72 checks). Keep validation sequential on this host rather than treating resource exhaustion as a code assertion failure.

Initially sandboxed Edge launch was denied and the in-app browser could not
reach the sandbox loopback server. The later approved browser run outside that
sandbox passed using the separate locked runtime. Its optimizer response is an
explicit small-image test stub, not a real hosted CDN test. Production opening
time remains unverified until rollout.

An earlier read-only remote image-download benchmark was not executed because
automatic approval review hit its usage limit. A later explicitly approved run
succeeded; its results are recorded in Latest production recheck above.

Before production acceptance, deploy the reviewed scope, open the real signed-in Hook workflow on desktop and mobile, check the first 24 preview requests and hidden-tab behavior, measure cold/warm opening time, choose several files in one dialog, exercise the model limit and retry, and confirm generation still receives original owned assets. No paid generation was performed during this investigation.
