# Hook starting-frame prompt v4 — production receipt

Status: deployed and verified; final check 23 October 2026 (Asia/Calcutta).

The user approved the v4 image and requested this approach as the production
default. The influencer defines the person to photograph. The decoded Hook frame
guides the scene, pose, expression, gesture and composition. Recognizable likeness
takes priority over copying the source performer's exact facial geometry.
This shared template applies to all Hook references and selected influencers.
The exact tested wording remains unchanged; Pro remains the existing default.

## Source and deployment

- PR: https://github.com/Saiteja02806/Ugc/pull/82 (merged).
- Reviewed source: `dffa8a95fe5076d98143967332ee1f16242d995a`.
- Main merge: `14be89fb36a796b28332f074f63a048006559266`.
- Initial production-target build: `dpl_6xH2EqkthNrG4BX5jx8xvoC6ecuK`, explicitly
  promoted after worker compatibility was verified.
- Current automatic main deployment: `dpl_8VmfmCjFcprdyNZt65nVNia182Uo`, Ready,
  `ugc-1mwlxsrzj-ugcpilot.vercel.app`. Its Git source is the exact main merge above;
  getugcpilot.com and www.getugcpilot.com resolve to it.
- Worker: `ugc-ai-generation-worker-promptv4dffa8a95`, 100% generation traffic.
  Image digest: `sha256:1e1dc32e7860f750429d0d1609889f79b109e3dec27891e44ff17e6ffd8766c9`.
  Active revision readiness, pinned digest and verified startup log establish
  baked/runtime source identity equal to the reviewed source.
- Cloud Build: `459f6602-0883-426d-93ec-fab30b51200c`, successful.
- Previous worker `ugc-ai-generation-worker-check618d89fe` remains at 0% traffic
  with its existing release tag available for rollback.

## Validation and limits

40 application tests and 29 worker/provider tests pass. Application TypeScript,
worker compilation and diff checks pass. Hosted build passed native decoder
runtime and function-bundle checks. The merged remote prompt/worker code matches
the reviewed release. Regression hashes pin the exact prompt and adjacent image
labels used for the approved test.

Signed-in browser checks on the real production domain confirmed Recreate opens
preparation, the actual source frame loads, owned face photos can be selected,
Pro is selected by default and View image instructions shows the v4 template.
These checks stopped before Save preparation or Generate starting image. The
production homepage returned HTTP 200; an unauthenticated starting-frame cost
request returned HTTP 401 with private/no-store caching as expected.

The paid visual evidence remains the earlier single user-approved direct Google
test using gemini-3-pro-image, 2K, 9:16 and the exact source/main/two-support images.
Prompt SHA-256: `f3d622fdc0b37c225bf0e1d40367cba76e12425a1e5ca15e7b8a55a650fb1c76`.
No additional paid generation was submitted for this release. One preferred
sample does not establish cross-influencer reliability or Flash image quality.
Prior accepted requests keep their original prompts/labels and recovery identity.

An auxiliary Vercel project `trending-release-web-3f35202` failed its automatic
preview with Firebase `auth/invalid-api-key`. It is not the production deployment
target. Its configuration was not changed; both production-target builds passed.

## Remaining work and release boundary

This focused release contains only the prompt, versioned provider labels,
receipt/draft compatibility, worker forwarding and focused checks/records.
Other pending UI, scheduling, slideshow, polling, marketing and migration changes
remain in the original checkout under the earlier pause. No schema, billing,
catalogue or model-selection changes were released. Private test images,
credentials, local environment files and generated artifacts were excluded.

Production still shows the separate saved-influencer/photo controls, lacks the
Starting frames tab in the photo picker and retains the legacy Use source video
composer option. The locally prepared UI corrections need their own validation
and release. Do not describe them as shipped with this prompt update.

For image quality, keep v4 fixed as the baseline and next evaluate multiple
influencers across several Hook scenes, scoring likeness, pose/expression,
scene preservation, occlusions and text omission separately. Evaluate Flash
separately. Retain explicit user image review before animation and never silently
retry a poor result with another paid generation.
