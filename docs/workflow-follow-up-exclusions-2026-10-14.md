# Workflow follow-up release exclusions

All intentional workflow source, tests and audit documentation are included. Existing Analytics application source is already merged; its local production acceptance receipt is included. Existing releases remain preserved on main.

- `docs/mcp-goal-progress-2026-10-14.md`: MCP work explicitly deferred by the user.
- `docs/seo-organic-distribution-2026-10-14.md`: SEO work explicitly deferred by the user.
- `docs/seo-production-release-2026-10-14.md`: SEO work explicitly deferred by the user.
- `outputs/`: Generated QA logs, screenshots, media and prepared social assets; not application source.

Ignored `.tmp/`, `.next/`, dependency directories and local environment/credential files are excluded as build output, local evidence or private configuration. No database migration or worker runtime source changes are present in this follow-up.
