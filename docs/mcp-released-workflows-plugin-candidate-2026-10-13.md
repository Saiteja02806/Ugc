# Released MCP workflows — plugin 0.1.11 candidate

Base: released backend `e3de4a4eb66cb7c7c6e6de6bda9bc9062aafbc63`; branch `codex/mcp-released-workflows`. The three new workflows cover application references/text remix, Creative Asset groups/membership, and saved Carousel/slideshow Library snapshots. They use the already released 73-tool contract. Version 0.1.10 belongs to the separate unpublished advanced-generation PR #45; this candidate uses 0.1.11 without absorbing that PR or its migration.

## Resulting behavior

- `remix-ugc-reference` distinguishes catalogue IDs, reviewed/manual source text, saved application remix results and ready owned media. It checks write/provider/business prerequisites, preserves camelCase creation and snake_case recovery identities, and never treats paired soundtrack metadata as an owned attachment.
- `manage-ugc-groups` uses current metadata/full-membership revisions, atomically validates selected eligible media, preserves exact UUID inputs and historical receipts, and distinguishes group deletion from file deletion.
- `manage-ugc-library` saves latest ready Carousel renders using both source and destination revisions, or 2–10 selected already rendered raster slides in exact order. It preserves archive/recreate intent. Saving raw images cannot satisfy a request for rendered slideshow text.
- Existing finishing instructions now account for the observed one-active-job rule: trim opening, wait, trim demo, wait, compose. The short Codex production test completed three render jobs and verified a real two-second local file; this does not prove new generation, local uploads or Claude Code.

The package contains 13 skills and 40 allowlisted files. Metadata overlays, creative routing, onboarding and standalone setup guide are updated. The download page selects the new immutable candidate ZIP, guide and checksum. Existing published artifacts and both binary-transfer helpers are preserved. The standalone guide converts package-local links to named bundle paths; it retains external and in-document links.

## Validation and acceptance boundary

All three skill frontmatter checks, seven metadata/resource/package tests and five deterministic/extracted-helper build tests passed on the candidate. Lint and TypeScript passed. Full MCP regressions and application build are recorded below when complete. The additional evaluation cases are criteria, not recorded installed-host executions.

This candidate does not change backend registrations, migrations, bucket/IAM, workers, OAuth settings, provider keys, or server flags. Production still disables new group, Library, text-remix, imported-audio and private-upload writes. Audio runtime remains unavailable. Native discovery in the existing chat still lacks the 27 added tools; fresh standalone discovery is not current-chat owner acceptance. Claude Code authentication/terminal acceptance remains pending.

Source/package review, release, supported installed-client update, and real intended workflows for these new features are separate steps. Full application access remains incomplete: slideshow backend text rendering, broader advanced generation/characters, full settings, Trending/Carousel operations, social publishing and analytics remain tracked gaps.

## Final local checks

The full `npm run test:mcp` command completed with exit 0 (all reported failures 0). Seven package metadata/resource tests, five real deterministic ZIP/extracted-helper tests, all three new skill frontmatter checks, targeted ESLint and TypeScript completed successfully. The first unconfigured application build compiled but failed Firebase prerendering; the repository's existing `check-isolated-release-build.mjs` succeeded using only the six public Firebase browser values from the primary workspace and disabled generation/finishing/audio during verification. No environment file or server credential was copied into this checkout.

The compiled setup HTML contains all three 0.1.11 download links and retains noindex. All 17 tracked earlier downloads match the base source byte-for-byte after canonical text newline normalization; both transfer helpers and both MCP configuration files also match. The new ZIP contains 40 entries, 121217 bytes, SHA-256 `e9e73d12ffb8ba6767d3fb43fb7c42ca8502f144574d4851f6280f016e79b7f5`. Deterministic rebuild and immutable-version refusal checks passed.

No backend/schema/infrastructure files changed. Local ignored logs, dependencies and build output are excluded. The primary workspace's unrelated dirty UI/worker/settings/migration work remains outside this isolated package PR. Production and installed packages remain at 0.1.9 until a coordinated release and supported host update; this candidate is not a claim of 0.1.11 activation.
