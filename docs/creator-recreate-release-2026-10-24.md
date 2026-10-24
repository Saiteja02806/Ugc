# Creator Recreate and public resource production release — 24 October 2026

The user requests review and deployment of all intentional changes and a check
that PR 85 is merged into main. The release contains the v3 Gemini image receipt
fix, faster independent Creator Account gallery loading, private video loading
on sustained hover/focus, immediate dismissible Recreate loading, the rounded
three-column preparation dialog with actions under the result, the Reaction
Hook Library and the intentional homepage/guide/resource changes.

## Git and PR verification

- Intentional local release: `0f9f2ebaf89c47462bb8ea18dab8d96765a59a5a`.
- Integrated remote PR 84 while preserving both new sitemap entries:
  `e8cf26631e2cb3a739709614a0b8158adfef0830`.
- PR 85 is MERGED into main at
  `e9f441e60ebeebbc8ae132a38cd94e2ea4840a3d`; GitHub reports merger at
  16:52:18 UTC / 22:22:18 IST on 24 October. It changes four public metadata/copy
  files and preserves the complete Recreate release. Its worker tree is equal
  to the previously built worker tree: `10b4089ba025f7739e0bad4025071fc7ccf3a14a`.

## Ordered rollout

Automatic Vercel build settings were temporarily held while source was pushed.
Cloud Build `ed2d3915-4b8e-4eea-a913-087506cb369b` succeeded. The generation
worker was staged at zero traffic with its immutable image, initialized through
a zero-traffic verification tag, and checked before receiving production work.
Baked/runtime SHA agreement and the health probe passed. Complete revision
specification comparison confirms that only the image and release-identity
variables changed. The worker was promoted before the web builds.

| Target | Verified active deployment |
| --- | --- |
| Generation worker, 100% traffic | `ugc-ai-generation-worker-r-e8cf2663` |
| Worker baked/runtime source | `e8cf26631e2cb3a739709614a0b8158adfef0830` |
| Immutable worker image | `us-central1-docker.pkg.dev/ugcsaas/ugc-worker/ugc-worker@sha256:064dcabf4cfaa3caea59e0ef4d87c0dd88d75012aaa7fa043cedc691620ac258` |
| Website, apex and www | `dpl_F8NBi11GSzP3MdVwJyPUmaxA4G39` |
| MCP | `dpl_68dGPSrZVBAVgGU28k32RV5jMLSy` |
| Both web sources | `e9f441e60ebeebbc8ae132a38cd94e2ea4840a3d` |

Both hosted production builds reached READY. Protected staged HTTP checks
verified the PR 85 titles, public MCP reference, full library and MCP health.
The verified builds were then promoted, and alias checks confirmed
getugcpilot.com, www.getugcpilot.com and mcp.getugcpilot.com. Recorded original
automatic-build settings were restored. Other Cloud Run targets were not
changed: this worker diff affects image generation in the generation service.

## Validation and production acceptance boundary

- 135 worker image tests and worker TypeScript build passed; all 59 combined
  preparation, variation, private loading and hover/playback tests passed.
- All twelve Hook/Wall/Talking Head responsive layout cases passed, including
  delayed loading dismissal, four variations, selection/approval, enlargement
  and no horizontal overflow. Additional Creator gallery fixtures were recorded
  in the implementation report. These use simulated auth and provider boundaries.
- The merged application production build, TypeScript, route generation and
  native decoder postbuild verification passed. Both final hosted builds pass.
- Thirteen real production route, authorization, metadata and PDF checks pass.
  The Hook workflow HTML identifies the intended website deployment. Both PR 85
  page-title changes and the hidden unreleased publishing-preferences tool are
  verified on the live domains. The PDF hash matches the reviewed local bytes.
- All 30 public SEO checks pass across 23 pages. An initial check applied the
  legacy FAQ/breadcrumb requirement to the new five-step guide. Its valid
  Article/HowTo/VideoObject layout is now checked with all five visible step
  anchors; the existing assertions for other guides remain.
- All twelve private selected frame images return exact approved SHA-256
  digests through read-only, short-lived provider capabilities. Anonymous
  metadata/media requests remain denied. No provider-generation call is made.
- Vercel runtime-error queries for the two new deployments returned no logs in
  the checked postdeployment window. This is bounded observability evidence,
  not a claim that all authenticated flows have been exercised.

No paid generation or automatic retry was submitted. Existing failed requests
remain failed. A signed-in Create Account/Recreate run, actual loading latency,
facial fidelity and the new output's visual quality require a live user test.

## Exclusions and rollback

The only visible untracked paths excluded are superseded, unreferenced draft
cover previews, retained locally rather than deleted:

- `public/resources/reaction-hook-library-cover-v2.webp`
- `public/resources/reaction-hook-library-cover-v3.webp`
- `public/resources/ugc-pilot-hooks-cover.webp`

The approved v4 cover, preview and PDF are included. Existing ignored private
plaintext/credentials/environment files, `.tmp/`, `outputs/`, `.next/`, `.vercel/`,
`.tools/`, `node_modules/` and `worker/dist/` remain local. Private assets deploy
through their existing encrypted packages. No intentional runtime change is
deferred. Exact local deployment and check receipts are under
`.tmp/recreate-fix-release-20261024/`.

Rollback can promote the preceding website/MCP deployments
`dpl_5Xtc7PQxMo36uVmaqfgzkQ6hz7uL` and `dpl_5Qy8yPnDBTiT8o1UTSniYXgoQvSC`,
and route generation traffic back to `ugc-ai-generation-worker-r-5f7b7747`.
No migration or data rewrite is part of this rollout.
