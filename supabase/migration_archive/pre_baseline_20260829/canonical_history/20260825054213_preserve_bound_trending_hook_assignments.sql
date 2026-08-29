-- A Hook that is already bound to today's ready daily slot is part of the
-- user's durable daily pack. A later Hook refill must not retire it; doing so
-- leaves a ready slot pointing to an assignment the feed reader cannot serve.
create or replace function public.preserve_current_daily_hook_assignment_on_supersede()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.state = 'active'
    and new.state = 'superseded'
    and exists (
      select 1
      from public.daily_trending_feed_slots as slot
      join public.daily_trending_feeds as feed
        on feed.id = slot.feed_id
      where slot.hook_video_assignment_id = old.id
        and slot.state = 'ready'
        and feed.local_date = (now() at time zone feed.timezone)::date
    )
  then
    new.state := old.state;
    new.completed_at := old.completed_at;
    new.updated_at := old.updated_at;
  end if;

  return new;
end;
$$;

drop trigger if exists preserve_current_daily_hook_assignment_on_supersede
  on public.user_hook_video_assignments;

create trigger preserve_current_daily_hook_assignment_on_supersede
before update of state on public.user_hook_video_assignments
for each row
execute function public.preserve_current_daily_hook_assignment_on_supersede();

-- Repair only today's known broken state. The old assignment remains as
-- history, but the slot is reopened so the normal daily-feed preparation path
-- can bind a currently active Hook without changing any decided content.
with reopened_slots as (
  update public.daily_trending_feed_slots as slot
  set
    hook_video_assignment_id = null,
    state = 'planned',
    updated_at = now()
  from public.daily_trending_feeds as feed,
    public.user_hook_video_assignments as assignment
  where slot.feed_id = feed.id
    and assignment.id = slot.hook_video_assignment_id
    and slot.format = 'hook_video'
    and slot.state = 'ready'
    and assignment.state = 'superseded'
    and feed.local_date = (now() at time zone feed.timezone)::date
  returning slot.feed_id
), affected_feeds as (
  select distinct feed_id
  from reopened_slots
), derived_status as (
  select
    feed.id,
    case
      when not exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = feed.id
          and slot.state <> 'decided'
      ) then 'completed'
      when exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = feed.id
          and slot.state = 'ready'
      ) then 'ready'
      when exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = feed.id
          and slot.state in ('planned', 'preparing')
      ) then 'preparing'
      else 'failed'
    end as status
  from public.daily_trending_feeds as feed
  join affected_feeds on affected_feeds.feed_id = feed.id
)
update public.daily_trending_feeds as feed
set
  status = derived_status.status,
  last_error = case
    when derived_status.status in ('completed', 'preparing', 'ready') then null
    else feed.last_error
  end,
  updated_at = now()
from derived_status
where feed.id = derived_status.id;

revoke all on function public.preserve_current_daily_hook_assignment_on_supersede()
  from public, anon, authenticated;

grant execute on function public.preserve_current_daily_hook_assignment_on_supersede()
  to service_role;
