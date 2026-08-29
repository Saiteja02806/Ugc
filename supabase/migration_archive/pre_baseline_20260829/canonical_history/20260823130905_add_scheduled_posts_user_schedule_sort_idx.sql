-- Add composite index to accelerate listScheduledPostsForUser queries
create index if not exists scheduled_posts_user_schedule_sort_idx
  on public.scheduled_posts (user_id, scheduled_for asc nulls last, updated_at desc);
