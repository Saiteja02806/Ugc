# Complete worktree push — 20 October 2026

The user explicitly requested all intentional worktree changes, including the
Hook/Wall person-photo guide. The release branch is
`codex/complete-release-20261020`. This is a source push, not production rollout
or evidence of facial-fidelity acceptance.

## Photo guide

The person chooser header now contains **Photo guide & examples**. It opens a
separate accessible dialog with Main face photo, Supporting photo 1 and Supporting
photo 2, each accompanied by photo-taking guidance. Closing returns to the
existing selection. Example images are never selectable generation references.
The existing fictional example asset remains at
`public/explore/guidance/person-views.webp`; no additional paid generation was run.
The guide recommends a clear front view and optional different side angles, with
no aspect-ratio quota or waist-up requirement. Provider routing is unchanged.

## Release scope

All 567 audited modified/untracked project paths were captured in `c3bedc52`.
This includes source, tests, documentation, migrations, configuration examples,
licensed fonts and shipped reference assets. Main was then reconciled in
`37cb3994`, retaining existing production fixes and current local product work.
The net change relative to main is smaller because many previous changes had
already been merged through other release branches.

The full local exclusion manifest is
`outputs/combined-release-exclusions.json` (422 ignored paths/directories).
These are local credentials/configuration, dependency/build caches, tooling and
generated review evidence. No intentional unignored project path was excluded.
The environment example contains empty credential placeholders, not secrets.
A credential-pattern scan found no obvious keys in the audited source; this is
not a full security assessment.

## Validation

- Photo-picker tests: 107 passed.
- Base application tests: 649 passed.
- Changed application tests: 1,393 exercised. The final broad run passed 1,360;
  the remaining scheduling/mock and sandbox-rename cases passed in focused
  rechecks (99 scheduling tests and 10 catalog tests).
- Selected worker tests: 137 passed; worker TypeScript build passed.
- Application TypeScript passed. ESLint checked 226 source files with zero
  errors and two warnings.
- Migration reconciliation guard and all six parity-tool tests passed. No
  production migration was applied by this release task.
- Test fixtures were updated for the retained slideshow-only generation gate,
  atomic scheduling handoff, connection-cache dependencies, historical pre-trim
  Hook receipts, and current UI behavior. Production policies were not relaxed
  to make tests pass.
- Full production build passed (webpack, including all 168 static pages).
  Evidence: `outputs/combined-release-build-webpack.log`.
  Initial attempts encountered sandbox permissions and disk exhaustion; only the
  regenerable `.next/cache/webpack` cache was cleared. The missing local
  ffmpeg-static executable was restored from the installed FFmpeg binary.

## Outstanding acceptance

Local browser tools continue to report that browser use is disabled in Work
settings, including after the user offered to enable it. The new guide popup's
visual/focus acceptance is pending. Earlier chooser screenshots do not prove the
new popup. No authenticated production acceptance, provider test, production
deployment or merge to main was performed by this task.
