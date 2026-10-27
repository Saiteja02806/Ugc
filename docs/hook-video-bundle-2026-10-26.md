# Public Hook Video Bundle — 26 October 2026

Status: implemented and locally verified; NOT production accepted or deployed.

## Scope

Owner explicitly requests no sign-in, one ZIP of all ordinary public Hook references, and a global 100-download cap. The frozen manifest has104clips. Private creator imports, customer-generated/uploaded media, removed references and separate music files are excluded. `/hook-video-bundle` serves everyone; signed-out `/explore/hook-video` shows the same offer after auth initialization. Signed-in users retain the existing guarded Hook workspace.

The native same-origin POST streams the ZIP straight to browser downloads. A GCS generation-conditional counter write admits at most100starts across instances; duplicate request IDs cannot open another stream. GET/page visits/prefetch do not count. At100 the endpoint returns410 and UI displays100downloads reached. Invalid requests, missing metadata and failed first-file reads consume no slot. Malformed counters or manifest drift fail closed rather than resetting. No sign-in, IP/email collection, dependency, schema, IAM, generation, scheduling, billing or private-download changes.

The rule counts download STARTS, not unique humans or confirmed saved files. Transfers interrupted after admission still count. New visits can create another counted request. Existing public catalogue preview URLs already exist; this cap applies to this ZIP endpoint, not original previews or recipient redistribution. Preserve `resources/hook-video-bundle/v1/downloads.json` through errors and rollback; do not delete/reset it as recovery. Changing bundle contents needs an explicit version/release decision.

## Preflight and protected boundaries

Sources inspected: AGENTS.md; applicable EXPLORE_CONTEXT.md entries covering public/private catalogue, workflow preservation and production evidence; mistake ledger and nonnegotiables; ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity and ugc-regression-gate skill files; actual route/AuthGuard/AppShell, Hook release manifests, owned media-download code, storage adapter and installed GCS SDK. Ran tools/preflight.py. Read installed Next16.4.2 route-handler/linking guides.

Relevant safeguards: UGC-UI-003/004 (adjacent UI), UGC-UI-005 (accepted state), UGC-OPS-003 (local versus production). This is a requested feature; no new user-reported defect is marked fixed or added. Existing incidents remain open.

Scope files:

- app/api/resources/hook-video-bundle/route.ts
- app/hook-video-bundle/page.tsx
- components/layout/workspace-route-boundary.tsx
- components/marketing/hook-video-bundle.tsx
- lib/resources/hook-video-bundle-manifest.json
- lib/resources/hook-video-bundle.ts
- lib/resources/hook-video-bundle-api.ts
- lib/resources/hook-video-bundle-service.ts
- lib/resources/hook-video-bundle-zip.ts
- lib/resources/hook-video-bundle.test.ts
- lib/resources/hook-video-bundle-store.test.mjs
- scripts/hook-video-bundle-access.test.mjs
- EXPLORE_CONTEXT.md and this receipt.

Rollback removes only these additions and the exact-route anonymous boundary branch. Preserve all unrelated work and the durable counter. Original Hook page, APIs, prompts, paid/private downloads and generation/edit/scheduling implementations were not modified.

## Tests and evidence

VERIFIED locally:

- Final focused command: `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-strip-types --test lib/resources/hook-video-bundle.test.ts lib/resources/hook-video-bundle-store.test.mjs scripts/hook-video-bundle-access.test.mjs scripts/explore-navigation-ui.test.mjs lib/navigation/release-routing.test.mjs` —36/36PASS. Includes110concurrent claims/100admitted,100th/101st boundary, repeated IDs, lost acknowledgements, counter corruption, private-path rejection, missing media, archive integrity, source cancellation and adjacent route access.
- GCS adapter tests use an isolated SDK contract, not hosted storage. Exact generation strings beyond JS integer precision, conditional writes, restart reads,403and malformed objects covered. Counter data/generation come from one GET to avoid metadata-read races.
- Three relevant existing account-isolation/shell assertions PASS. Signed-in Hook retains AuthGuard/AppShell/children; sibling routes retain access policy. Generation/finishing/scheduling live execution remains NOT TESTED.
- Application `tsc --noEmit --incremental false` and scoped ESLint PASS. Isolated Next16.4.2production preview build PASS (compile, types, prerender). This is not a full application build.
- Real ZIP:266503936bytes,104MP4entries. Every source SHA256 verified while streaming. Python zipfile independently verifies all names, CRCs and104hashes. No production counter increment.
- Headless Chrome actual UI/theme/font/API/ZIP with isolated storage/tiny media fixtures: native download, keyboardEnter,100th/exhausted/reload, unavailable status/retry, missing-media recovery,36px+heading,48pxbutton,nooverflow,noJSerrors PASS at1366/390/320widths. Styled desktop/mobile screenshots manually inspected. The isolated preview required explicit Tailwind external-source scanning; application CSS was not changed.

Artifacts: `D:/UGCPilot-hook-bundle-validation-20261026-3b754e/` contains the real ZIP, real-bundle-checks.json, browser-checks.json, available-{1366,390,320}.png, exhausted-320.png, failure-320.png and reusable verification scripts. Task preview sources are under the task visualizations directory; generated caches moved to D: after C:filled. No unrelated files deleted. The incomplete first archive and earlier Hook resource cache were moved to D:and preserved.

One broader existing test FAILS: account-isolation-contract's landing-auth assertion expects `await cookies()`, while untouched HEAD and current app/page.tsx use synchronous Home and initialHasSession=false. The bundle does not edit that page or assertion. Full worktree suite is not claimed green.

## NOT VERIFIED / release gate

The real counter read using this device's ADC returned403(serviceusage.services.use). No counter write, IAM/credential change or production download claim occurred. The deployed runtime must be checked with a separate test-prefix counter, including concurrent requests and restart readback. Full authenticated cross-tab production acceptance and full application build are not claimed.

No push/deploy performed. After normal release, verify signed-out requested URL, direct public URL, existing signed-in Hook flow, deployed storage identity, one explicitly counted full ZIP download and extracted104hashes. Verify hosted streaming limits and slow-client behavior; route declares300seconds and stream bounds290seconds. Keep unavailable on failed storage checks; do not replace the durable gate with a cosmetic/memory counter. No generated-output/publishing/provider evidence is relevant to this download-only feature.
