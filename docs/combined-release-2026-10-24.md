# Combined release — 24 October 2026

The user requests review and deployment of all current intentional changes.
This includes private video/slideshow creator collections and parity fixes;
Analytics return/freshness behavior; Hook Remix brand/role corrections and medium
draft reasoning; the optional quality-review system kept disabled by default;
Poppins/TikTok Sans fonts and caption outlines/defaults; reviewed Hook source
frames; optional animation face references and supported three-second output;
and generated-video prompt placement/history details. Existing intentional
source, scripts, tests, configuration, bundled fonts and documentation are part
of the release. No new migration is introduced by this diff.

## Private package boundary

The repository is public. The user explicitly confirms the creator package must
be deployed while remaining restricted to verified `vtu19403@veltech.edu.in`,
and approves encryption plus a new server-only production package key.

All 79 private source files (four metadata/text files and 75 media files) ship
as authenticated AES-256-GCM ciphertext. Each file has a random 96-bit nonce,
HKDF-SHA256 key derivation and authenticated path binding. The dedicated key is
configured as an encrypted production variable on website and MCP; it is absent
from Git, client code and the worker image. It is separate from provider-delivery
signing. Existing provider capabilities remain short-lived and hash-bound.

Production reads require decryption, even when a plaintext development copy is
present. Public clones without the key have an empty private collection. Server
Firebase/email checks still apply after decryption. Encryption does not replace
authorization. No existing production secret was downloaded.

## Validation before deployment

- Combined root suite: 1,135 passed, zero failed/skipped (101 files).
- Worker suite: 118 passed, zero failed/skipped; worker TypeScript build passed.
- Scoped ESLint and application TypeScript passed; webpack production build and
  isolated native decoder bundle checks passed.
- All 79 production-mode decryptions match their original SHA-256 digests;
  all 36 creator/model contract simulations pass using encrypted sources.
- Server traces contain the required encrypted slideshow and frame files and
  no plaintext creator manifests/media. Private source assets remain outside
  public; private manifest markers are absent from 430 client JavaScript bundles.
- Analytics browser fixture passes return-event/owner/error behavior and no
  idle refresh loop. Caption editor fixture passes all 18 bundled font faces,
  desktop/mobile placement and save/reopen/defaults. Video result fixture passes
  96 responsive pending/completed layouts. Earlier creator gallery/preparation
  browser simulations remain documented in the creator parity report.
- Public-clone simulation: 60 passed and eight actual-private-fixture checks
  explicitly skipped. Authorization/synthetic capability checks still run.

The broad audit found stale VM dependency stubs and prior-font/prior-duration
expectations; those fixtures are updated to the implemented contracts. One Git
fixture required execution outside the Windows sandbox to write its temporary
repository. No runtime failure is hidden as a skip in the full local suite.

No new paid generation is performed for release verification. The earlier paid
Remix experiments retain their recorded scope and limits. Generated likeness,
motion fidelity and viral performance are not qualified by mocked browser jobs.
Creator 2 clip 3 retains partial lower-face occlusion in its clearest sampled
source. Authenticated hosted acceptance is distinct from local validation.

## Excluded source material

Only private plaintext and local-only material are excluded. Their encrypted
equivalents are included; no creator feature or smaller intentional fix is
deferred. Exact private source paths are recorded in the local release inventory.

- `lib/explore/creator-accounts.json`
- `lib/explore/creator-account-reviews.json`
- `lib/explore/creator-slideshows.json`
- `lib/explore/creator-slide-text.json`
- Plain `.png`/`.mp4` files under `lib/explore/creator-account-media/` (36 files).
- Plain `.jpg`/`.webp`/`.png` files under
  `lib/explore/creator-slideshow-media/` (39 files).
- `docs/creator-profile-frame-review-2026-10-24.json`
- `docs/creator-profile-browser-simulation-2026-10-24.json`
- `docs/creator-profile-legacy-simulation-2026-10-24.json`

Existing ignored environment/credential files, `.tools/`, `.tmp/`, `.vercel/`,
`.next/`, dependency directories, `worker/dist/`, local logs, generated browser
screenshots and other build caches remain local. The new package key and
transient encrypted-variable request are inside ignored `.tmp/release-20261024/`.

## Rollout

Released on the production domains after worker verification:

| Target | Verified source / deployment |
| --- | --- |
| Website: apex and www | `4cb252d572a8a26de2172d99788f5a1e5f6067ec`; `dpl_5Xtc7PQxMo36uVmaqfgzkQ6hz7uL` |
| MCP | Same app source; `dpl_5Qy8yPnDBTiT8o1UTSniYXgoQvSC` |
| All eight Cloud Run targets | `5f7b77470c83644a3d1d5cd800a39191c7d1d7ef` |
| Immutable worker image | `us-central1-docker.pkg.dev/ugcsaas/ugc-worker/ugc-worker@sha256:eb73d206213b7c9f28d9fb26ec1223c7e9489163cbde16704b3fbdd13b5775e2` |
| Cloud Build | `56db6a13-27e3-4b65-be64-312a4ba7745a`; SUCCESS |

The app follow-up changes only the remaining starting-frame identity reader to
use encrypted metadata. Its worker Git tree is exactly equal to the baked worker
commit; no worker change is missing. The final evidence-only documentation
commit does not alter either deployed runtime tree.

All six service workers have a single verified new revision at 100% traffic;
both jobs identify the same pinned image/source. The generation worker's
`ugc-ai-generation-worker-r-5f7b7747` startup log verifies baked and runtime SHA.
All eight functional configuration fingerprints match the initial baseline.
Only gcloud's generated job-template nonce is excluded, after the original
fingerprint was reconstructed exactly from the original-image audit nonce.

The first hosted build caught one remaining local-plaintext manifest import.
It was fixed before promotion; superseded builds were never promoted. A rollout
guard also stopped at the first job: its runtime source identity was corrected
to the baked worker commit before any new execution, and the separate nonce
difference was proven before rollout resumed. The latest execution timestamp
remained unchanged throughout that correction.

Production read-only smoke checks pass on the real domains: homepage/sign-in
and MCP health return 200; anonymous metadata/video/poster/slide-preview reads
are denied; all 12 selected creator PNGs and all 39 original slideshow images
return their exact hashes through approved short-lived provider capabilities.
The remaining 29 slideshow checks additionally match original byte sizes and
actual MIME types. Unsigned creator-frame capabilities are denied. No generation,
paid provider call or user-content mutation was made for these checks.

The user elects to verify the signed-in gallery personally. Final browser
acceptance under verified `vtu19403@veltech.edu.in`, including positive original
video playback and live generation quality, is therefore not claimed here.
Check [Hook video](https://www.getugcpilot.com/explore/hook-video) and
[Slideshows](https://www.getugcpilot.com/explore/slideshows), switch each private
account, open Recreate and return to All references.

Exact local receipts: `.tmp/release-20261024/identity.json`,
`workers-verification.json`, `worker-guard-proof.json`,
`generation-worker-acceptance.json`, `vercel-verify.json` and
`production-smoke.json`. Automatic-build settings are restored to the recorded
original values after the evidence-only documentation push; restoration is
verified separately in the same receipt directory.
