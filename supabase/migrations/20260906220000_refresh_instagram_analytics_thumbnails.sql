-- Instagram CDN media links expire independently of analytics metrics. Do not
-- backfill this timestamp: existing URLs must be fetched again from Instagram.
alter table public.instagram_analytics_content
  add column if not exists thumbnail_synced_at timestamp with time zone;
