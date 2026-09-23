# TikTok and YouTube analytics loading

- Initial panel load requests analytics automatically. Browser cache keys include the authenticated owner, platform, connection IDs, connection dates and status.
- API routes keep their existing authentication and beta access checks. Completed analytics job outputs serve as durable snapshots, scoped by owner, job type and operation.
- Fresh results are reused for five minutes. Manual refresh has a 30-second cooldown; active jobs are shared. Saved results return alongside a background refresh job, so provider latency does not hide existing content.
- Reconnected and disconnected accounts invalidate old snapshots. No public/CDN caching or new database tables are involved.
- Refresh failures keep saved values visible with a warning. Genuine zero values remain zero; unavailable/private metrics are never substituted with zero.
- Both platforms use a calendar-spaced line chart with thumbnail/count buttons, day pickers and video details. Dates follow the viewer's local timezone, matching Instagram. Unavailable-only days appear separately, not on the zero line.
- Chart ranges are 7, 30 and 90 days (30 by default). Older returned videos remain in the table; the date range affects the chart and its summaries, not the separate 30-complete-day YouTube channel report.
- Current ingestion is still limited to the 20 latest provider-returned videos per account. The chart is current video totals grouped by publication date, not a daily audience activity report or a complete historical archive.
- YouTube channel reports and video lifetime counts remain separate. This change does not grant OAuth scopes or enable cloud APIs.

Validation: `npm run test:analytics`, `npx tsc --noEmit`, and focused ESLint. Authenticated final acceptance should use the production domain, including a reload, a repeat refresh, platform switching, and day-to-video drill-down.
