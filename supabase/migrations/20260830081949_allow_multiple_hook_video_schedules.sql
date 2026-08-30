-- A Hook draft retains its most recently created schedule for existing library
-- links, while scheduled_posts remains the durable history of every user-chosen
-- publish time. Keep a non-unique lookup index, but remove the old active-only
-- uniqueness guard that rejected a second intentional schedule for the draft.
set lock_timeout = '5s';

create index if not exists scheduled_posts_hook_video_draft_idx
  on public.scheduled_posts ((metadata ->> 'hookVideoDraftId'))
  where metadata ? 'hookVideoDraftId';

-- A cancelled post cannot publish, so it must not permanently consume the
-- idempotency key. This permits a user to intentionally schedule it again at
-- the same time after cancellation while keeping every non-cancelled request
-- protected from duplicate clicks and retries.
create unique index if not exists scheduled_posts_active_user_idempotency_idx
  on public.scheduled_posts (user_id, idempotency_key)
  where idempotency_key is not null
    and status <> 'cancelled';

drop index if exists public.scheduled_posts_active_hook_video_draft_idx;
drop index if exists public.scheduled_posts_user_idempotency_idx;

reset lock_timeout;
