-- New account preferences default to Product stories + CTA (Structure 2).
-- ALTER DEFAULT does not overwrite saved choices or existing feed snapshots.
alter table public.trending_content_mix_preferences
  alter column helpful_tips_percent set default 0,
  alter column product_stories_cta_percent set default 100;

alter table public.daily_trending_feeds
  alter column helpful_tips_percent set default 0,
  alter column product_stories_cta_percent set default 100;

alter table public.daily_carousel_feeds
  alter column helpful_tips_percent set default 0,
  alter column product_stories_cta_percent set default 100;
