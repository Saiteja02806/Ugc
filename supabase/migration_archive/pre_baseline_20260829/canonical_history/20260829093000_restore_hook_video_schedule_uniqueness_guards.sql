-- Production schema audit found that the original migration version is present
-- in history but its two Hook-video schedule uniqueness guards are absent.
-- The preflight found no conflicting active rows, so restore them forward.
set lock_timeout = '5s';

create unique index if not exists hook_video_drafts_unique_schedule_idx
  on public.hook_video_drafts (scheduled_post_id)
  where scheduled_post_id is not null;

create unique index if not exists scheduled_posts_active_hook_video_draft_idx
  on public.scheduled_posts ((metadata ->> 'hookVideoDraftId'))
  where
    metadata ? 'hookVideoDraftId'
    and status <> 'cancelled';

reset lock_timeout;
