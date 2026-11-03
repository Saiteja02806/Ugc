# Character catalog backend migration — 3 November 2026

Status: backend upload and worktree wiring verified. Website cutover is not deployed. **No build was started**, respecting the user's explicit no-build rule.

132 original catalog paths (168,920,982 bytes / 161.10 MiB) now resolve to 122 distinct immutable objects in `gs://ugcsaas-media/catalog/character-studio/v1/`. Identical originals share cloud objects. Every path was downloaded through its actual public HTTPS URL and verified against its SHA-256 and original byte length before local removal. No storage policy, IAM, dependency, schema or billing changes were needed.

## Behavior and scope

- The registry retains its existing logical image paths, trait IDs, hidden historical options and selection order. A small allowlisted resolver maps these paths to cloud objects using the existing content manifest. No arbitrary remote URL is accepted.
- The dock's only render change is its image `src`. Existing labels, colors, cards, controls, CSS and responsive geometry are preserved. Uploaded personal photos keep their existing browser URL and authenticated upload lifecycle.
- Generation preparation now fetches its source from the same immutable backend catalog, instead of the website deployment. Original hashes and owner reference identities are unchanged; previously prepared references remain reusable.
- The 132 originals were removed from `public/explore/influencer-studio/` after cloud verification and an exact backup in ignored `.tmp/character-catalog/source/`. No Git history was rewritten; these are pending working-tree deletions.
- A catch-all route preserves old catalog URLs through allowlisted 308 redirects. Unknown paths return 404. This code still requires an authorized build/deployment before hosted cutover.
- Tests hydrate originals into an ignored cache from verified backend objects when needed. No binary catalog originals are required in the active website source tree.
- **Intentionally retained:** 37 existing Remotion promo authoring assets, including 36 byte-identical catalog copies. These belong to the separate video authoring workflow and do not supply website catalog thumbnails or generation preparation. Removing them would require adapting that workflow; it was preserved under the user's instruction not to change other working features. This migration does not claim every historical or authoring copy has disappeared from Git.

## Verification

| Check | Result |
| --- | --- |
| Actual cloud downloads | VERIFIED: all 132 source-path hashes and lengths; 122 unique objects |
| Character/catalog/preparation/current builder/session/studio tests | 189/189 PASS |
| Existing promo source and render-contract tests | 14/14 PASS; source comparisons use ignored cache, existing authoring assets unchanged |
| TypeScript | `npx tsc --noEmit --incremental false`: PASS |
| Scoped ESLint | Zero errors; five existing dock warnings. New helper/maintenance files lint clean after removing one newly unused import |
| Compatibility paths | All 132 old paths resolve to the exact immutable cloud URL, 308; unknown paths 404 |
| New source fetch | Actual `fetchStudioImage` fetched Extreme from GCS, exact SHA-256 verified, encoded to 1254×1254 JPEG, 206927 bytes |
| Cache identity | Extreme retains `decd49aa-bb8b-5da1-a6af-54f510f780c2`, matching the earlier real READY asset |
| Custom photo behavior / reference roles | Existing tests PASS; custom URLs bypass catalog mapping, ID/order/role logic unchanged |
| Visual comparison | Fresh integrated browser comparison NOT TESTED: fixture scripts bundle JavaScript and were not run under the no-build rule. Original image bytes match exactly and CSS/markup geometry is unchanged by source diff |
| Hosted integration / compiled route | NOT VERIFIED for this migration: no build, dev server, push or deployment started |
| Paid generation | Not run for this migration; no new generation charge |

Commands: `node scripts/migrate-character-catalog.mjs` (explicit real backend upload/verification), the existing Node TypeScript test loader with character suites, `node ... --test scripts/verify-ai-character-promo.test.mjs`, TypeScript no-emit, scoped ESLint and `git diff --check`. Test logs and exact object receipts are under ignored `.tmp/character-catalog/`.

## Changed files

- `lib/characters/studio-catalog.ts` and `studio-catalog.test.mjs`: immutable backend mapping, custom-photo behavior, legacy redirects and removal regressions.
- `components/characters/influencer-customizer-dock.tsx`: catalog image URL only.
- `lib/characters/studio-preparation.ts`: allowlisted backend source fetch only; no owner identity/cache or paid-admission change.
- `lib/characters/studio-references.ts`: resolve registered reference URLs to backend storage.
- `app/explore/influencer-studio/[...asset]/route.ts`: compatibility redirects.
- `lib/characters/studio-preparation.test.mjs`, `studio-references.test.mjs`: use verified ignored fixture cache; assert backend fetch URLs.
- `scripts/migrate-character-catalog.mjs`: repeatable create-only upload, exact public-byte verification and local receipt; credentials stay in memory.
- `scripts/character-catalog-test-cache.mjs`: verified fixture hydration, no build step.
- `scripts/character-catalog-fingerprints.mjs`: require an explicit external source directory for future manifest maintenance.
- `scripts/character-workflow.browser.mjs`, `scripts/character-studio-layout.browser.mjs`, `scripts/verify-ai-character-promo.test.mjs`: use the ignored test cache instead of removed website binaries. Existing concurrent test edits preserved. Browser scripts were updated but not executed because they build fixture bundles.
- 132 deletions under `public/explore/influencer-studio/`: every exact logical path is enumerated in the existing `lib/characters/studio-image-fingerprints.json` manifest, unchanged by this migration.
- `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`: append-only migration contract, evidence and limits; this receipt.

Preflight: inspected dirty worktree, actual callers, registry, preparation, tests and storage adapter; read the applicable Next route/Promise params guidance, nonnegotiables and relevant current Explore/ledger entries. Mandatory context-memory, immutable-contracts, UI-clarity and regression-gate skills were read; generation skill guidance was consulted. Earlier full-history reads were truncated; no fresh complete read of the large historical ledgers is claimed. Preflight script confirms required paths are readable. Incident: `UGC-ASSET-20261103-CHARACTER-CATALOG`.

## Maintenance and rollback

To hydrate offline test bytes, use `ensureCharacterCatalogCache` from the test-cache helper. Fresh caches require backend network access and validate every digest. To publish future originals, prepare a complete external source directory, refresh the manifest explicitly with `node scripts/character-catalog-fingerprints.mjs <directory-containing-category-folders>`, and use `node scripts/migrate-character-catalog.mjs <source-root-containing-explore/influencer-studio>` before changing serving code. Neither command builds or deploys. The upload command defaults to the ignored cache for verification/recovery. New manifest entries must be uploaded and verified before release.

Rollback can restore the removed source bytes from the ignored cache or Git and revert only this migration's URL wiring and redirect route. Cloud objects are immutable and can remain for historical links. Preserve unrelated dirty work. No cloud deletion is required.
