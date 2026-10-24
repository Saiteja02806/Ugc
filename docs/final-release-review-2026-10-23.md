# Combined release review — 23 October 2026

Status: **ready for a controlled release**. Combined review, tests, final Linux
and Windows builds pass; no remaining release-blocking defect was identified.
Deployment, push and Vercel settings changes remain paused. This reviews all intentional current worktree changes,
including worker and slideshow changes, rather than only the hosting-cost batch.

## Scope

The reviewed inventory contains 205 changed/new paths including this report and
context updates: application, API, worker, UI/CSS, media derivatives, migration,
tests, build helpers and documentation. The path inventory and selected test
manifest are saved under `.tmp/final-release-review/`. Local environment files,
credentials, dependencies, caches and generated diagnostic artifacts remain
ignored and are not release source. No intentional change was staged or omitted
from the review; nothing was pushed.

- Homepage/static rendering, font preloads, video previews and marketing copy.
- Demo/Creative Assets preview lifecycle; shared editors, audio and scheduling.
- Foreground/inactive polling, receipts, recovery and Settings lazy loading.
- Hook preparation, photo/model selection, generated-frame history and handoff.
- Named slideshow planning, per-output image roles, editor recovery and worker
  compatibility with previously accepted generation contracts.
- MCP lazy loading/static schemas, native tracing, bundle checks and audit tools.
- Additive slideshow-plan migration and historical release/context records.

## Issues fixed during final review

1. Cancelling Hook replacement discarded the prior approved composer frame.
   Replacement now retains that selection until explicit approval; cancellation
   restores it without losing the replacement preparation's recovery identity.
2. Refresh lost the selected composer frame. Account-scoped persistence now saves
   identities and approved settings, re-verifies ownership/source through GET,
   refreshes media URLs and preserves custom motion/audio. It never stores signed
   URLs or starts generation. Failed recovery retains the record, offers explicit
   retry/clear and blocks fallback generation. Cancellation/revision fences and
   account isolation prevent stale reads overwriting a new selection.
3. Unresolved Hook motion was disclosed after image generation. A notice beside
   the paid image action now states the video limitation before submission. No
   motion is silently approved; existing animation gates remain intact.
4. The scheduling browser harness had stale Demo classification, source/action
   selectors, success-state selectors and a relative Firebase import escaping
   its fixture boundary. It now tests the actual explicit Save edits/Back to
   videos/Schedule flow, using isolated authentication and publishing services.

## Completed validation

- Combined changed/adjacent tests: **919 passed**, zero failed/skipped.
- Worker build and broad worker suite: **346 passed**, zero failures.
- Full `test:mcp`: **324 Node tests passed**, plus its custom read/auth/upload,
  generation, token, signing and migration runners. Local fixture networking is
  allowed; no account/provider mutation or paid media generation is performed.
- Final scoped lint over 164 changed/new code files: zero errors and warnings.
  Whitespace checks pass using the repository's normal Windows line-ending
  configuration. No unrelated line-ending rewrite was introduced.
- Demo/Creative Assets actual-card browser checks: **82 passed**, including
  desktop/mobile, hidden/offline/offscreen and retained playback state.
- Homepage production-mode browser checks: **15 passed**, covering immutable
  assets/ranges, desktop/mobile loading, on-demand original editor fonts,
  reduced motion/save-data, explicit playback and auth-action hydration.
- Settings desktop/mobile checks passed: section-only dynamic loading,
  navigation, account changes, provider gates and late async resolution.
- Demo/shared Hook/Wall editor browser checks passed at desktop and mobile
  sizes, including trim/preview controls and retained pending edits.
- Slideshow actual editor/image-panel browser checks passed: ordered editing,
  interrupted saves, exact retry, two tabs, owner isolation, upload failures and
  generation locks. Injected 404/503 fixture responses exercise recovery.
- Hook/Demo scheduling browser checks passed: unchanged and edited sequences,
  serialized renders, duplicate-submit prevention, Hook-only and Demo-only posts.
- New actual React-hook/read-client browser checks passed at 1366px and 390px:
  StrictMode, refresh, fresh owned URLs, custom motion/audio, failed read,
  explicit retry and account switching. No runtime browser errors.
- Default Windows Turbopack build passed compilation, TypeScript, all 171 static
  pages and native positive/negative postbuild checks. The last signed-out-state
  guard is included in successful final build `eEqlm8hy_XO1H3e5vQEhe` as well as
  the Linux build. The final Windows compiled MCP rejection-handler checks also
  pass with zero account/network requests and zero loaded catalogue chunks.
  Logs: `turbopack-final-complete.log`, `compiled-final-windows.log`.

The sandbox blocked loopback/browser subprocesses in initial attempts; the
affected fixtures passed with the necessary local execution permissions. A
temporary disk-backed Linux run passed the build, 164 focused regressions and
compiled handler checks, but emitted a filesystem-cache write error under local
disk pressure. It is not the clean acceptance run; validation is repeated on a
native filesystem with only the disposable compiler cache in RAM, without
changing application/build configuration. The earlier attempt to put the whole
Linux root in RAM exited during compile; it is not counted as a passing run.

## Final Linux acceptance

Build `qm-EUeaoOio9l2D_aPIOq` passes default Turbopack compilation, TypeScript,
all 171 static pages, four isolated native package resolver/executable checks
and lightweight-route exclusions. All **164** combined focused regressions pass
on Linux. Actual compiled MCP handlers pass their 401/403/421 checks with zero
account/network requests and zero tool-catalogue chunks loaded. The complete
successful run has no cache persistence failure. Runtime inputs were verified
against all 1,871 source hashes before the build, with zero mismatches.

Evidence: `linux-cache-final.log`, `linux-final-build-id.txt`,
`linux-final-traces.json`, `linux-final-native-traces/` and
`linux-source-integrity.log` under `.tmp/final-release-review/`. The temporary
Linux filesystem was unmounted after evidence export and its disk removed,
recovering local disk space. Generated Windows build caches were cleared for
validation headroom; this is not a Vercel storage/cost reduction.

## Database and release prerequisites

A fresh production **SELECT-only** check confirms migration `20261022092140`
is present; RLS is enabled; anon/authenticated table reads and function execution
are denied; service-role access is granted; the claim function is security
invoker. No migration or database data was changed during this review.

Historical migration-ledger drift recorded in
`hook-workspace-slideshow-release-2026-10-22.md` is not silently repaired. Do not
bulk-apply unrelated/deferred migrations as part of this release. The migration
required by this work is already present and its local isolated tests pass.

When deployment is separately authorized, freeze the reviewed inventory and
release the matching generation worker first, verify its exact commit/digest,
then release website and MCP. New slideshow/animation payloads require the
matching worker; do not publish the website ahead of it.

Hosted authenticated acceptance is still required after an authorized release
on the real production domains. Local fixtures do not establish generated media
quality or hosted integration behavior. No additional paid quality evaluation,
public reference upload, Vercel setting change or sibling-project retirement was
performed. The unused sibling project and later font/catalogue optimizations do
not need to block this release.

Evidence: `.tmp/final-release-review/` plus the named browser fixture directories
in each runner's receipt. Linux source integrity is checked against 1,871 runtime
input hashes. Full test counts are separate suites and may overlap; they are not
a count of unique assertions across the repository.
