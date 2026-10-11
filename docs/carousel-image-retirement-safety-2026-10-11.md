# Carousel source-image retirement safety audit

Audit date: 11 October 2026. Production project: `kltxwijhluawgveykfbt`.

This report covers safe retirement of the user-rejected Productivity part-2 human-hook images and the specified `productivity-human/Pinterest_2026-08-16 (61)/pinterest_029.jpg`. The main audit matched source SHA-256 identities against production; folder names alone miss canonical duplicate identities. The full pre-change 40-row backup is `.tmp/productivity-image-retirement/backend-before.json`.

## Production impact before retirement

The complete 40 source identities have 422 stored Carousel slide references. Their assignment history reaches 417 completed and 24 failed generations. At the audit snapshot, no affected generation was processing.

Existing assignment states for the 417 rendered source generations were: 3 pending, 10 accepted, 213 in progress, 2 completed saved, 139 completed skipped, and 14 completed scheduled. There were 24 undeleted saved Library items and 6 creative edits (5 ready, 1 failed). These are historical aggregate counts, not a claim that every old assignment remains in the current daily feed.

Physical deletion is inappropriate for this cleanup. The production foreign keys retain source provenance: `carousel_slides` references the asset with no cascading deletion; `carousel_image_usage` uses `ON DELETE RESTRICT`. Saved Library slides already contain separate rendered URLs and do not join the current source eligibility state when read.

## Selection and replay gates

The live production `reserve_carousel_role_assets_v2` procedure checks all of the following on every fresh source selection: active, ready, approved, a non-null library ID, and a null runtime exclusion reason. New role selection, product selection, role-pool readiness, and related-static fallback therefore exclude inactive archived rows.

Two idempotent existing-reservation branches return the previously assigned image IDs without rechecking their present eligibility. Keeping old assigned usage protects history and fairness, but a failed generation retry could reuse a retired ID. Reallocation must operate on a complete unconsumed reservation; deleting just one assigned slide creates `carousel_image_reservation_is_partial`. A completed historical reservation must remain intact. Retirement must check affected live jobs immediately before the mutation, not rely only on an earlier snapshot.

The old broad object-image query paths also require ready and null exclusion reason. Some of those legacy queries do not require active explicitly; the proposed archived status plus explicit exclusion still fences them out.

## Historical-read fix implemented locally

Before this fix, `mapRuntimeSafeSlides` filtered out a saved slide whenever its source was archived. Both single-generation status and batch status used that filter; the editor then built its default content from the truncated status. Source files could remain present while the website still lost slide completeness.

The new exception is deliberately explicit:

```json
{
  "is_active": false,
  "status": "archived",
  "subject_review_status": "approved",
  "runtime_exclusion_reason": "user_requested_retirement",
  "source_metadata": {
    "retirement": { "preserveHistoricalRenders": true }
  }
}
```

Only a completed generation's existing slide with `status = ready` and a nonempty rendered URL may use that exception. Library identity and role must still be present. Pending, failed, and unrendered slides cannot gain eligibility through retirement metadata. Generic archives, wrong-bucket exclusions, rejected reviews, and malformed metadata remain blocked.

`getCarouselEditBackgrounds` also resolves the preserved source bytes for these exact tombstones. Its only application caller supplies IDs from the existing source slides after verifying the requesting owner and completed generation. Submitted edits are matched to those same source slide IDs. This preserves text edits and source-background restoration for an existing owned Carousel; it does not offer the source as a new image choice.

Changes are limited to `lib/carousel/db.ts`, `lib/carousel/historical-source-retirement.ts`, and its focused test file. Fresh image listing, role readiness, worker selection, and production reservation SQL are unchanged. The website patch must be deployed before adding the retirement markers. This report does not claim the patch has already been deployed or the assets already retired; those operations are handled by the main cleanup task.

## Import and reconciliation risks

The normal role importer (`scripts/import-carousel-role-library.mjs`) notices an existing identity and requires it to be active and ready. An archived match stops that import rather than silently reactivating it. The older local importer similarly skips an existing hash.

The reconciliation script needs separate protection:

- Refresh upserts use the prepared manifest's active, ready, approved metadata. An old manifest can reactivate an explicitly retired row.
- A missing local source under a reconciliation prefix becomes stale. The script intentionally nulls old slide source pointers, deletes usage and the asset row, then deletes physical source objects. Its current preflight checks active jobs but does not protect a historical-preservation tombstone.

A safe future importer/reconciler must retain these tombstones and reject their source hashes before refreshing or deleting them. Local source removal alone is insufficient because prepared manifests and duplicate source copies may persist. Do not run the current reconciliation deletion path over these identities.

## Validation

- 27 focused tests passed, covering the new historical exception, failed/unrendered denial, generic archive/rejection denial, malformed metadata denial, six-slide completeness, owner-scoped background resolution, product editing, and shared reservation contracts.
- `npx tsc --noEmit --incremental false` passed.
- `npx eslint lib/carousel/db.ts lib/carousel/historical-source-retirement.ts lib/carousel/historical-source-retirement.test.ts` passed.
- Production procedure, foreign keys, source references, assignment states, Library references, and edit states were inspected through read-only SQL. This audit agent performed no database or storage mutations and triggered no generation.

Test command:

```powershell
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test lib/carousel/historical-source-retirement.test.ts lib/carousel/product-asset-editor-contract.test.ts lib/carousel/related-static-reservation-contract.test.ts lib/carousel/structure-routing-schema-contract.test.ts
```
