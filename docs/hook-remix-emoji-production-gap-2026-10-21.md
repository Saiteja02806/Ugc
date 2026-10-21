# Hook Remix cross/tick production recurrence — 21 October 2026

The symptom is reproduced and the production release gap is confirmed. The
existing fix works locally; production video rendering has not received it.
This investigation did not deploy, submit generation, schedule or publish.

## Expanded all-emoji verification

The user's follow-up asks whether every emoji is now correct. A fresh live
service/job read still shows the old active revision/digest recorded below;
deployment is pending. The other release chat acknowledges both render targets
must be updated, but has not reported completion.

An expanded **actual local MP4** sample covers 16 emojis: `😂 😭 🔥 🚀 ❤️ 👍🏽
👩🏽‍💻 🇮🇳 1️⃣ 💯 ✨ 🎉 ❌ ✅ ✔️ ☑️`. The four explicit artwork marks retain
color. All 12 font-fallback examples have zero colored pixels in this Windows
export, despite visible glyph pixels. Visual inspection also finds the flag and
person/skin-tone sequences incorrect. Evidence:
`.tmp/hook-emoji-coverage-20261021/coverage.json` and
`.tmp/hook-emoji-coverage-20261021/local-mp4-emoji-sample.png`.

This is **not** a Linux production-font result: the production Dockerfile installs
Noto Color Emoji, whereas this local renderer resolves Windows fonts. Docker is
installed locally but its Linux daemon is unavailable. The result demonstrates
that system-font fallback is not uniformly reliable; it does not establish which
of those samples pass or fail in the production container.

The existing raw-Unicode/grapheme tests establish preserved text and unsplit
inputs, not correct colored glyphs. Keep the verified cross/check correction,
but do not claim universal emoji coverage or 100% confidence. Broader support
needs an explicit supported emoji set/version and actual preview/export glyph,
color and joined-sequence checks in the shipped rendering environment.

## Evidence

- Active service: `ugc-video-render-worker-hookfix2-fac61da3`, 100% traffic,
  READY. Read the active revision's `status.imageDigest`, not just the service
  template: the template already points at a different image without directing
  production traffic to it.
- Active digest and `ugc-video-render-job` image:
  `sha256:96afdde1f42c980281c3b68182ad91874c41c997d9d20219bd472f8d0f15a36d`.
- Base source: `fac61da34608dc3f4414702ab87f3f332bdcc14f`.
  `git show fac61da3:worker/src/lib/explore-inline-symbols.ts` confirms the
  module is absent. The three old rendering modules have no symbol artwork.
- The fix first appears in `c3bedc52` (20 October, 16:16 IST). The older
  19 October local implementation note is not evidence of worker deployment.
- Fresh public GET of the production Hook page and all 28 script chunks finds
  `data-format-inline-symbol`, red and green artwork in
  `/_next/static/immutable/chunks/2yx_4uld6zl5z.js`. The website preview fix is
  present; changing the website alone cannot repair the old video worker.
- The production browser reaches the real domain and redirects to sign-in.
  Public JavaScript and GCP configuration inspection are not signed-in acceptance.

## Reproduction and verification

Exact copy: `Hiring UGC creators ❌\nCreating UGC with AI ✅`.
Reconstructed only the three relevant renderer modules from the active source
revision, with the same Inter Bold caption input and synthetic source MP4 for
both implementations. At 600 ms the old source yields zero red/green pixels;
corrected source yields 162 red and 448 green pixels in decoded MP4 pictures.
Visual inspection confirms white cross/check versus red cross/green checkbox.
This is a local source comparison, not an execution inside the deployed image.

Local artifacts (ignored):

- `.tmp/hook-emoji-audit-20261021/live-web.json`
- `.tmp/hook-emoji-audit-20261021/comparison-NbCbMU/comparison.json`
- `.tmp/hook-emoji-audit-20261021/comparison-NbCbMU/before-after.png`
- `.tmp/hook-emoji-audit-20261021/comparison-NbCbMU/emoji-renderer.patch`
- `.tmp/hook-remix-emoji-yJQunl/corrected-caption.png`

`scripts/hook-remix-emoji-render.test.mjs` exercises the actual Add-to-hook
application function, serialized draft recovery, standalone export and final
Hook + demo composition. It verifies the exact caption plus `✖️/☑️`, `✗/✓`,
and `✘/✔️`, Unicode preservation, colored MP4 pixels, unchanged source bytes,
and no Hook text in the following demo. There are eight new actual-video cases.
Other emoji still rely on installed color-font coverage; this does not promise
support for every Unicode character or change explicitly requested text presentation.

Passed: worker TypeScript build; 4 existing symbol-render tests; 31 related
font, editor, timing and real-video tests; the new regression; scoped ESLint.

## Concrete rollout scope

An independent hotfix can backport these four already committed modules onto
the active renderer base:

1. `worker/src/lib/explore-inline-symbols.ts`
2. `worker/src/lib/explore-format-edit.ts`
3. `worker/src/lib/explore-format-render.ts`
4. `worker/src/lib/explore-text-outlines.ts`

The patch above contains exactly that scope, with no new package dependencies.
Build and verify that isolated source, then deploy its pinned image to both
`ugc-video-render-worker` and `ugc-video-render-job`. Preserve runtime settings,
job configuration, existing request identities, database state and website code.
Verify the actual active service revision, baked source identity and job digest
after rollout. A READY image without active traffic is insufficient.

Existing completed MP4s are immutable. Reuse the existing remix text and raw
editable clip for an explicit new export after rollout. Do not trigger another
paid text remix or footage generation. Do not globally change finishing hashes:
that would break replay of accepted requests. No automatic regeneration or
modification of saved/scheduled outputs is part of this fix.

The concurrent chat **Review hook video audio and frames** is already preparing
a wider production release from this workspace. During this investigation it
committed its MCP dependency work as `e309dec6` and this task's new regression as
`7db9d22a`. This task did not run Git commits or pushes. Avoid competing releases:
the wider release can instead deploy its already reviewed complete image to BOTH
render targets and verify the active revision/digest. Sending these findings to
that chat requires the user's explicit messaging authorization. The user
subsequently approved **Send findings and include the fix**. The verified
findings and instruction to include both render targets were sent to that
ongoing release chat. Deployment acceptance is still pending its completion.

Unrelated pre-existing worktree paths were `app/mcp/route.ts`, `lib/mcp/server.ts`,
`package.json`, `package-lock.json`, `lib/mcp/transport-limits.ts` and its test.
This investigation left them untouched; the other release committed them.
