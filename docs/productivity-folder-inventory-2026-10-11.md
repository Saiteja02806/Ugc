# Productivity source-folder inventory

Audit date: 2026-10-11. This document records the local source inventory before cleanup and historical import mappings. The completed cleanup and live verification are recorded in `docs/productivity-image-cleanup-2026-10-11.md`.

Source root: `C:/Users/chund/OneDrive/Desktop/slideshows/power`.

## Folder roles

The current carousel role library uses three runtime roles: `hook`, `human`, and `static`. Folder names and categories are provenance; the backend selects canonical approved assets by category and role. `hook` here means a still image for the first slideshow slide. It does not by itself mean a Hook video workflow.

| Source folder | Current importer mapping | Local images before cleanup | Intended use |
|---|---|---:|---|
| `productivity_hook` | `productivity / hook` | 29 | First-slide background |
| `productivity_humanhookpart-2/human` | `productivity / hook` | 39 | Additional first-slide backgrounds; the nested `human` name does not map these to body-slide `human` |
| `productivity-human` | `productivity / human` | 358 | Body-slide backgrounds containing people |
| `not been/productivity_static` and numbered variants `(2)` through `(12)` | `productivity / static` | 143 | Body/takeaway backgrounds without people |
| `part-2/productivity_static_2` | `productivity / static` | 9 | Additional nonhuman backgrounds |
| `produtivity_hook_part3` | Excluded: unsupported role bucket | 48 | The spelling and suffix are not recognized by the current standard importer |
| `working pictures` | Excluded: unsupported role bucket | 18 across categories | No standard category/role assignment |

There is no runtime `other` role in this importer. Local folders called “not been” and “part-2” are source batches, not runtime categories or priorities. The numbered static folder suffixes are normalized to the same productivity/static bucket.

After this inventory, the user requested intake of `produtivity_hook_part3`.
That subsequent reviewed additive operation imported 38 new unique sources
as productivity/hook backgrounds and raised the active hook pool to 59.
The misspelled folder remains unsupported by the legacy full-tree classifier;
the scoped part-3 intake preserves existing duplicates in their original roles.
See `docs/productivity-hook-part3-import-2026-10-11.md` for the completed review,
omissions, import and production verification.

The power root contains 1,585 files, including 1,563 supported image files. These are source counts, not counts of selectable backend assets. Exact duplicates are collapsed when preparing the canonical library.

The 2026-08-24 prepared manifest contained 60 productivity hook assets, 240 human assets, and 132 static assets. Its source inventory had 71 hook files, 358 human files, and 152 static files; 11 hook, 118 human, and 20 static duplicate copies were removed. Current local files differ from that historical source snapshot, so production counts must be read from the backend.

## Requested wrong images

The request identifies these exact image targets:

- `productivity-human/Pinterest_2026-08-16 (61)/pinterest_029.jpg`.
- Every supported image under `productivity_humanhookpart-2/human/`.

There are **40 unique SHA-256 targets**: the one specific JPG and 39 part-2 images. All 40 map by exact hash to canonical assets in the historical 2026-08-24 import manifest: 39 hook assets and one human asset.

The specific JPG is `productivity_human_e63a9d907b633b4cbf7f`; its SHA-256 is `e63a9d907b633b4cbf7fce0d6bea43ed7387c16bd8a676863c53ffb63413cf2a`. Visual inspection confirmed that it contains baked-in text, “Nobody cares. Keep studying”, over a studying scene.

There are **11 byte-identical copies outside the requested source paths**: nine files under `productivity_hook/hook1 (2)` and two under `productivity-human`. Some of the wrong part-2 images were deduplicated to canonical records whose source path names that older hook folder. Historical paths can also refer to a copy no longer present locally. Therefore backend retirement must match target hashes and canonical asset identifiers, rather than only the part-2 prefix. Otherwise wrong images can remain eligible under an older source path.

The part-2 directory also contains two MP4 files:

- `Create_a_photorealistic_vertical_9_16_202607021519 (1).mp4`
- `Woman_covering_mouth_disbelief_202607081523 (1).mp4`

They are recorded separately from the 39 image targets. The carousel image importer does not accept MP4 files. This local audit does not determine whether a separate video catalogue imported either clip.

## Evidence and scope

The local import scripts now enforce `scripts/carousel-role-library-retirements.json`, containing all 40 rejected hashes, the exact JPG path, and the retired part-2 image-directory prefix. Preparation skips these sources before duplicate selection. Import and reconciliation refuse a stale manifest containing any rejected source before storage or database preflight. Hash rejection also covers the 11 retained duplicate copies outside the user's specified deletion paths. The path guard recognizes Windows separators and case while respecting folder boundaries.

Reconciliation also preserves retired backend tombstones and their historical references. It excludes a remote row from stale deletion when its preservation marker is set or its source is in the local denylist, refuses attempts to restore or replace it, and reports preserved retirements separately. Immediately before destructive SQL, it locks the actual source rows and rechecks preservation markers and all rejected hashes before modifying rotation pointers, slide references, or usage records. Storage deletion has a further in-memory preservation guard.

Validation: 17 tests passed across the existing role-library contracts and new retirement tests, plus 16 existing category/relevance/reservation tests. The new tests execute both import entry points against a stale manifest and confirm retirement rejection before a deliberately invalid database URL can reach client initialization. They also evaluate the actual pure reconciliation planner without running its CLI, covering tombstone preservation, ordinary stale handling, and restoration/collision refusal, and check the SQL guard precedes destructive writes. Syntax checks and `git diff --check` passed. The normal `carousel:role-library:test` command includes the retirement tests.

- Exact paths, lengths, timestamps, SHA-256 hashes and duplicate-copy locations: `.tmp/productivity-image-retirement/local-inventory.json`.
- Historical canonical asset IDs, source paths, and storage keys: `.tmp/productivity-image-retirement/import-manifest-map.json`.
- Historical manifest: `.tmp/carousel-role-library/2026-08-24T05-57-39-045Z/role-library-manifest.json`.
- Historical completed reconciliation: `.tmp/carousel-role-library-reconcile/reconcile-2026-08-24T06-06-06-986Z.json`.
- Classifier and duplicate policy: `scripts/carousel-role-library.mjs`.
- Import metadata shape: `scripts/prepare-carousel-role-library.mjs`.
- Source-of-truth sections: “2026-08-24 Carousel Human-Hook Library Reconciliation” and “2026-08-31 Carousel Fresh-First Source Rotation” in `CAROUSEL_CONTEXT.md`.

The main cleanup subsequently deleted the exact JPG and all 39 part-2 images
after verifying backups, and retired all 40 canonical backend identities.
The part-2 directory now retains its two MP4 files. Eleven duplicate copies
outside the named deletion paths remain locally but cannot pass the hash
denylist. Existing produced slides, saved customer content and historical
source bytes were preserved. No AI generation request was made.
