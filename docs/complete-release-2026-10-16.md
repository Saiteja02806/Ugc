# Combined release, 16 October 2026

The user authorized reviewing and deploying every intentional workspace change,
then renamed the public hook gallery to `/hookvideos`. `/aivideos` permanently
redirects to the new address. The gallery retains 128 mixed-creator clips,
reaction-only labels and no bulk-download or original-storage link.

The release includes compact video font/weight controls and matching rendering,
custom Explore reference playback and source-post access, image-picker polish,
slideshow version grouping, selected-original assembly, and the final one-box
text-only prompt rewrite with Undo. It preserves the homepage positioning from
latest main `09e31b01`; unrelated local temporary files and secrets are excluded
by Git ignore rules. No intentional changed path is excluded.

Validation completed before release: 113 focused tests; scoped lint; application
TypeScript; worker compilation; actual font raster/video rendering; one-box prompt
browser checks; slideshow assembly browser checks. The complete release build and
production checks are tracked separately in local deployment receipts.

The new private prompt-receipt migration was applied and assigned production
version `20261016133514`. The local filename matches the actual migration ledger.
RLS is enabled; anon cannot read and authenticated cannot execute the claim RPC.
Only service_role can write. The web runtime enables the rewrite feature after
schema rollout. No paid generation is required by deployment acceptance.

The worker source matches previously built commit `24a6faa4` exactly (ignoring
line endings), so its existing immutable image digest is reused. Complete the
interrupted rollout across six services and two jobs before promoting web/MCP.
Preserve service configuration, use explicit revision traffic, and verify every
target; prior rollout left the new AI worker revision retired with old traffic.

Authenticated production editing and actual AI rewrite quality require a signed-in
session; fixture success is not evidence of provider quality. The public gallery,
redirect and API authentication boundaries can be accepted without generating.
