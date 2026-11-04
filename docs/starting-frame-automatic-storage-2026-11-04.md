# Automatic source opening preparation — 4 November 2026

Local implementation and regression verification complete. No builds, bundling, deployment, external inference or new hosted storage/database writes were run in this task. This is not a claim of successful real AI generation or measured production loading speed.

## Requested change and scope

New public Hook, Text on screen/Wall of Text and Talking Head videos must have their original opening PNG stored and verified before their existing import/publication path exposes them. Recreate remains a stored-image read, without MP4 extraction. Keep the existing UI, source t=0, identity selections, prompts, historical jobs, billing, scheduling, private creator boundaries and unrelated working features unchanged.

Incident: `UGC-UI-20261104-AUTO-SOURCE-FRAME-INGEST`, linked to `UGC-UI-20261104-STARTING-FRAME-WAIT`. Before this patch, current frame coverage existed but several activation paths lacked automatic preparation. That was a code-confirmed future-ingestion gap. The upstream no-image incident `UGC-GEN-20261104-STARTING-FRAME-EMPTY-RESPONSE` remains open: local tests cannot reconstruct an unrecorded provider response or establish its root cause.

Preflight consulted: current `AGENTS.md`, `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`, `docs/ai-context/nonnegotiables.md`; context-memory, immutable-contracts, starting-frame, video-prompt, UI-clarity and regression-gate skills; previous loading/no-image receipts; actual importer callers, source resolver, storage implementation and tests. Large historical context outputs were partly truncated; no fresh exhaustive reread of their full history is claimed. Read-only `python tools/preflight.py --repo . --task "Automatically store original opening frames before activation of new Hook Wall Talking Head videos; local tests only, unchanged UI, no builds or external inference"` passed prerequisite discoverability. Existing unrelated worktree edits were preserved.

## Implementation

`preparePublishedSourceFrames` is an import-only helper, not a runtime request handler or build hook. It checks public identity/source hashes, reuses the existing immutable PNG/index store and validates frame-zero metadata/dimensions. For a newly imported local file, it checks file bounds and SHA before real FFmpeg first-frame decoding. For Hook release publication, it retains canonical remote source resolution. The existing store publishes the PNG first, confirms readback and publishes the source-addressed index last using create-only writes. Corrupt data fails instead of being silently replaced. Repeated imports read the stored opening and skip decoding; another source hash gets its own immutable index.

Automatic preparation now precedes activation in:

- Hook release publishers through the existing `preparePublishedHookFrames` helper.
- Paired Hook/Wall reference imports.
- Imported Recreate Hook/Wall videos; slideshow images are excluded.
- Silent Hook video imports and Wall video-asset imports, including resumed/already-active items.
- Wall Instagram template imports and the additive money-reference release.
- The existing October Explore batch publisher.
- Talking Head reference preparation and the explicit frame preparation script's `--write` path.

Talking Head's importer invokes a bounded Node preparation helper before changing any catalogue/source/frame manifest. It retains local opening PNGs for historical readers while also preparing the backend objects. It merges selected entries instead of deleting unrelated catalogue items, preserves existing source metadata, refuses changed video bytes under an existing ID before overwriting historical local media, and refuses activation if the manifests changed during backend preparation. Source/frame manifests are replaced first and the catalogue last. No new schema, dependency, scheduled service, UI control or application endpoint was introduced.

Existing explicit importer execution/confirmation flags are retained. Dry runs do not prepare frames or write storage. Running an importer in execute mode now necessarily includes frame storage; it fails if storage cannot be confirmed. These are authored ingestion gates, not a watcher that detects arbitrary hand-edited JSON. New import entry points must use the shared gate. Private creator sources remain on their existing private path and are rejected by the public helper.

A local importer test exposed another concrete defect: `import-explore-recreate-assets.mjs` recognized only the legacy `NoSuchKey` missing-object error. GCP's numeric 404 prevented new-object imports from reaching upload/preparation. It now accepts numeric404 as missing; incompatible existing objects and other errors continue to fail.

## Local verification

| Check | Result |
| --- | --- |
| Real local MP4 with red opening and later blue scene | VERIFIED: stored image is the red original frame zero |
| Hook/Wall/Talking cold readers with MP4/decoder forbidden | VERIFIED: read stored PNGs |
| Repeated preparation and fresh disk-backed store instances | VERIFIED: no new decoding; persisted opening reused |
| New source hash | VERIFIED: separate index/image; original remains readable |
| Storage failure/corrupt readback | VERIFIED: no activation; retry converges without replacing valid objects |
| Private IDs, changed bytes, wrong dimensions and conflicting IDs | VERIFIED: fail closed |
| Actual paired and Recreate importer execution with isolated cloud/filesystem boundaries | VERIFIED: prepare precedes activation; failed preparation leaves staged state; dry runs make no writes |
| Actual Hook/Wall activation-loop execution | VERIFIED: frame failure blocks ready/active update, resumed/active imports prepare missing frames; disabled Hook remains disabled |
| Talking Head Python importer | VERIFIED: storage failure leaves all activation manifests unchanged, successful import preserves unrelated entries, changed historical bytes rejected before overwrite |
| UI layout/controls, provider payload/prompts, identity stages and scheduling | Not edited in this task; shared local regression tests pass |
| Fresh hosted import/readback, live browser timing, new generated output/face fidelity | NOT TESTED under local-only/no-build/no-external-generation instructions |

Commands and results:

```text
node --import ./scripts/next-server-only-test-loader.mjs --import ./scripts/worker-source-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test scripts/prepare-published-source-frames.test.mjs scripts/starting-frame-import-gates.test.mjs lib/explore/hook-source-frame-store.test.ts lib/explore/starting-frame-reference-source.test.ts lib/explore/public-starting-frame-sources.test.ts scripts/wall-text-video-import-contract.test.mjs scripts/wall-instagram-reel-template-import-contract.test.mjs scripts/talking-head-full-sources.test.mjs
39 PASS, 0 failures/skips.

python scripts/prepare-talking-head-references.test.py
3 PASS.

Shared source/cache/client/admission/result/draft/variation/UI/navigation tests (same source-loader command/file list as docs/starting-frame-loading-fix-2026-11-04.md)
184 PASS, 0 failures/skips, including current Talking Head preparation tabs.

Worker OpenRouter/provider/durable-stages/generate-image/character/harmonizer suite (same source-loader command/file list as prior receipt)
84 PASS, 0 failures/skips.

node node_modules/typescript/bin/tsc --noEmit --incremental false
PASS, exit 0.
Scoped ESLint on 13 changed JavaScript helper/import/test files
PASS, exit 0.
Node/Python syntax checks and scoped git diff --check
PASS.
```

Some test groups overlap; do not sum them into a unique-test total. NoEmit is a type check, not a build. Test logs are under ignored `.tmp/starting-frame-auto-20261104/`: `import-tests.log`, `python-tests.log`, `loading-tests.log`, `worker-tests.log`, `lint.log`, `types.log` and `preflight.log`.

The first new test fixture omitted a canonical storage key, and a VM fixture needed normal CommonJS import interop; both fixture defects were corrected. Python's initial temporary directory was inaccessible in the sandbox, so fixtures now use the workspace `.tmp` directory and pass. Those failures were not evidence of production application bugs. The numeric404 importer failure was a source defect and is fixed/tested.

## Exact changed files

- `scripts/prepare-published-source-frames.mjs` (new)
- `scripts/prepare-published-hook-frames.mjs` (keeps existing release caller interface)
- `scripts/import-explore-paired-references.mjs`
- `scripts/import-explore-recreate-assets.mjs`
- `scripts/import-silent-hook-video-assets.mjs`
- `scripts/import-wall-text-video-assets.mjs`
- `scripts/import-wall-instagram-reel-templates.mjs`
- `scripts/import-wall-money-references.mjs`
- `scripts/publish-explore-reference-batch-20261023.mjs`
- `scripts/prepare-talking-head-frames.mjs`
- `scripts/prepare-talking-head-published-frames.mjs` (new)
- `scripts/prepare-talking-head-references.py`
- `scripts/prepare-published-source-frames.test.mjs` (new)
- `scripts/starting-frame-import-gates.test.mjs` (new)
- `scripts/prepare-talking-head-references.test.py` (new)
- This receipt; appended verification/product decisions in `EXPLORE_CONTEXT.md` and `docs/ai-context/clear.md`.

No current catalogue/video/source/frame JSON, user image or application component was edited by this task. Previous task changes remain in the dirty worktree; this list does not attribute other work to this patch.

## Remaining limits and rollback

The storage/import behavior is locally verified. The previous live audit's 232 existing backend PNGs remains historical evidence; this task did not perform a fresh hosted audit or import new hosted media. Deploying the stored-read/preload application changes and measuring signed-in speed remains separate and was not attempted. Current UI, prompts and existing stage1/stage2 inputs remain as they were.

The real provider stage1 no-image cause is still UNKNOWN. Existing local diagnostic/polling corrections pass regression checks, but no external generation was authorized or submitted; this report does not claim that the upstream failure is repaired or show fixture pixels as generated results.

Rollback only these importer/helper/test edits and appended documentation, preserving unrelated work. No hosted mutation occurred in this task. A future failed import can leave verified immutable objects or staged local media behind; it does not activate an unprepared catalogue entry, and a rerun reuses valid objects. Backend storage credentials and write access are prerequisites for execute mode. Arbitrary manual catalogue edits bypass authored ingestion and are not automatically watched.
