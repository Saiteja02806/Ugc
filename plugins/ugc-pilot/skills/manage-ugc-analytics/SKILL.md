---
name: manage-ugc-analytics
description: Read saved UGC Pilot Instagram, TikTok, and YouTube analytics through MCP without refreshing provider data, changing connections, or publishing.
---

# Manage UGC Analytics

Use the connected UGC Pilot tools only for the account that completed OAuth.
Start with `get_analytics_capabilities`. It reports whether snapshot storage and
the consent-time verified identity permit saved analytics reads. It never
contacts a provider, refreshes a report, changes a connection, or publishes.

Saved-report tools require the separate `analytics:read` OAuth permission and a
verified UGC Pilot account email. An older grant will need normal OAuth
reauthorization for this new scope. Do not ask for tokens, provider credentials
or passwords.

For a requested report, use the narrowest discovered tool:

- `get_instagram_account_analytics` for saved account totals and daily points.
- `get_instagram_content_analytics` for saved posts, Reels and carousels. Use
  `limit_per_account` and report `items_total` / `items_truncated` faithfully.
- `get_tiktok_analytics` for the saved public video report.
- `get_youtube_analytics` for saved channel totals and uploaded-video metrics.

Treat `has_saved_snapshot`, `saved_at` and `refresh_recommended` as part of the
answer. No saved snapshot means the agent has no report to invent. A refresh
recommendation means the stored result may be partial or stale; refresh tools
are intentionally unavailable in this release. Do not call website endpoints,
provider APIs, social OAuth, or queue jobs as a substitute.

These tools return account-owned report fields only. They do not expose OAuth
scopes, provider tokens, private publishing records, or scheduler metadata.
Analytics reads do not create media, spend credits, edit drafts, schedule or
publish posts.
