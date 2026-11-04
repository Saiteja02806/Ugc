# Audio reference picker — 5 November 2026

Status: local layout/feedback VERIFIED; real sample attachment remains OPEN.

The supplied screenshot and current CSS show a shrinkable gender pill inheriting `overflow-wrap:anywhere` inside the crowded name row. The name/waveform now use their own line and gender/accent share the metadata line. Colors, outer popover geometry and existing actions stay unchanged. Missing account data or preview-only eligibility now show an explanation and an explicit retry using the existing catalogue/bookmark/selection refresh functions. No backend entitlement was weakened.

## Exact scope / rollback

- `components/explore/workflow-saved-audio-choices.tsx`: metadata placement and unavailable-service feedback/retry only.
- `components/explore/workflow-saved-audio.module.css`: scoped title/metadata sizing, no-wrap pill and feedback styles only.
- `scripts/workflow-bookmarked-audio.test.mjs`: missing-account, preview-only, eligible and busy/retry assertions.
- `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`, this receipt: append-only evidence/context. Other worktree changes belong to other tasks and were preserved.

Rollback only these task hunks; do not revert shared documents wholesale.

## Preflight

Read AGENTS.md, EXPLORE_CONTEXT.md, clear.md, nonnegotiables.md; ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity and ugc-regression-gate skills; installed Next CSS guide; audio sample/API/provider/account conversion and existing tests. Ran `python tools/preflight.py --repo . --task "Fix vertical gender label and crowded saved voice rows in audio reference picker; preserve palette and handlers"` (prerequisites PASS). Historical UGC-VID-034-AUDIO minimum-duration and previous-reference preservation remain relevant. Used connect-ugc-pilot skill for read-only hosted readiness.

## Why Use sample is disabled

Both the UI and `lib/audio/voice-sample.ts` require the connected ElevenLabs account's paid eligibility. This is separate from the application's user plan. `getAudioBootstrapForOwner` falls back to a public preview catalogue when no account catalogue can load; account then remains null and attachment is unavailable, while previews can still play. Existing product documentation `docs/audio-ugc-native-plan.md` explicitly protects this restriction.

Fresh local development environment lookup found no ElevenLabs key and no enabled audio-generation flag. That is a new-process environment observation, not inspection of a pre-existing server process.

Actual hosted read-only MCP evidence for the connected account:

```json
{
  "generation_access": "allowed",
  "generation_available": false,
  "catalogue_source": "public-preview",
  "models": [],
  "upload_available": false,
  "download_available": false,
  "message": "Audio generation has not been connected yet."
}
```

This establishes hosted service readiness is missing despite permitted application access. It does not distinguish missing key from disabled rollout or prove the precise production website deployment configuration. No secret was printed, settings changed, paid speech generated or attachment bypassed. Reconnecting/enabling the provider and confirming its eligible account are still required before a real sample can be accepted.

## Verification

- `node --test scripts/workflow-bookmarked-audio.test.mjs`: 14 PASS. Includes eligible attachment exact bytes, minimum/maximum duration rejection, previous attachment preservation, owner isolation, pending/cancel/stale transfer protection and new reason/retry states.
- `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/audio/voice-sample.test.mjs`: 8 PASS. Authentication, catalogue membership, trusted URL, redirect, MIME/MP3 validation, size and provider eligibility guards preserved.
- `npx tsc --noEmit --incremental false`: PASS.
- `npx eslint components/explore/workflow-saved-audio-choices.tsx scripts/workflow-bookmarked-audio.test.mjs`: 0 errors; one pre-existing unused Sparkles warning.
- Targeted `git diff --check`: PASS.
- `node .tmp/audio-picker-visual.cjs`: actual TSX server-rendered with controlled hooks and actual CSS, isolated Chrome at 280/320/392px row widths. Old gender heights64/49/34px; all new heights19px; no row overflow. Screenshots before/after in `.tmp/audio-picker-visual/`, manually reviewed at280and320px. Mocked services/icons/base-button styling: not full authenticated app acceptance or an approved golden baseline.

Protected behavior: dark palette and surrounding layout VERIFIED by scoped diff/fixture; sample/proxy guards and attachment failure preservation VERIFIED in tests. Real provider attachment, integrated signed-in desktop/mobile workflow, persistence across reload, sibling navigation and production acceptance NOT VERIFIED. Generation/scheduling/provider configuration unchanged by diff, not freshly tested. No build, push or deployment started.

Incident UGC-UI-20261105-AUDIO-SAMPLE-PICKER remains OPEN for service connection and real sample attachment; only local layout and feedback are verified.
