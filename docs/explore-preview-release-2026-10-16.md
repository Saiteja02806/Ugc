# Explore video picker and preview release — 16 October 2026

The user approved deploying the completed UI changes with existing names unchanged: Demo, Edit hook video, Edit demo video and Change. Text & trim/Text & edit were suggestions only and are not implemented.

This release adds recognizable posters/first video frames to the shared owned-video picker, readable titles, lazy loading for offscreen video rows, larger viewport-bounded Hook previews, matched Talking Head preview slots, consistent Edit/Change placement, an Add hook video action for empty openings, Change for restored demos, compact demo removal, and removal of Optional badges from video headings. Existing one-clip paths, demo inventories, source ownership, audio rules and natural video ratios remain.

The frozen source builds on production main e19778462896be549a023dafb2dad019c63510b0. All 102 other intentional worktree changes already match that baseline; they are preserved, including the public Hook gallery, one-box slideshow prompt rewrite, original-slide assembly, font rendering, homepage and analytics-banner corrections. No intentional change is excluded. Credentials, local tooling, generated build output and temporary evidence remain ignored. Inventory: explore-preview-release-inventory-2026-10-16.json.

## Validation and rollout

- Full isolated production webpack build passed compilation, TypeScript and route generation. Scoped ESLint passed.
- All 117 workflow regressions passed on the frozen snapshot, including source replacement, owner filtering, restored demo replacement, empty-hook actions, edit separation and audio ownership.
- Actual-component picker and demo-upload browser fixtures passed on this snapshot. Picker checks cover visible first frames, failed-poster fallback, lazy offscreen loading, readable long titles, mouse/keyboard choice and separate demo inventory at 1366×768, 1536×864 and mobile. Demo editing/Change remains usable before upload confirmation, with edits retained afterward. Existing compact footer/Wall advanced editor checks also passed.
- The aligned Talking Head/Hook editor fixture checks 1280×720, 1366×768, 1536×864, 1440×900, 1900×806, 1920×1080 and mobile. Previous local fixture evidence and final snapshot verification are kept separate from signed-in production acceptance.
- Read-only production migration parity: all 143 versions match. No SQL applied.
- All six worker services and two jobs are healthy on immutable image sha256:723cb58bf42d30c89eb6ffe7ca91ff75c7be213d4dd83f99042aff4a9e3f9e7d, built from 24a6faa4. The release worker tree is unchanged from current production; no new image, job execution or configuration/IAM change is needed.

Hold automatic website Git builds, push the validated commit, stage ugc and ugc-mcp production candidates without domain assignment, reverify workers, promote ready candidates, restore the previous Git build setting, then verify main, exact deployment SHAs, all production aliases, HTTP/auth boundaries and new bundled UI. Deployment IDs and production results belong in the subsequent receipt. Do not spend generation credits or schedule/publish customer posts for smoke testing. Signed-in editing remains a separate acceptance check if no authenticated browser is available.
