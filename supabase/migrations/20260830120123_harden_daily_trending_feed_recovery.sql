-- Keep daily-feed recovery durable and bounded. A feed can have the expected
-- number of immutable slots while still containing planned/preparing slots
-- whose source job disappeared. The old integrity scan only detected a slot
-- count mismatch, so those feeds could remain in "Generating for you"
-- indefinitely.

alter table public.daily_trending_feeds
  add column if not exists recovery_attempt_count integer not null default 0,
  add column if not exists last_recovery_at timestamptz,
  add column if not exists last_recovery_error text;

alter table public.daily_trending_feeds
  drop constraint if exists daily_trending_feeds_recovery_attempt_count_check;

alter table public.daily_trending_feeds
  add constraint daily_trending_feeds_recovery_attempt_count_check
  check (recovery_attempt_count >= 0);

create index if not exists daily_trending_feeds_recovery_idx
  on public.daily_trending_feeds (local_date, last_recovery_at, updated_at);

create index if not exists daily_trending_feed_slots_stale_pending_idx
  on public.daily_trending_feed_slots (feed_id, updated_at)
  where state in ('planned', 'preparing', 'failed')
    and carousel_assignment_id is null
    and hook_video_assignment_id is null
    and wall_text_assignment_id is null;

-- A new same-day position or an explicit retry is fresh work. Reset the
-- bounded recovery lease so a previously exhausted feed can be prepared again
-- without changing any existing ready/decided assignment.
create or replace function public.reset_daily_trending_feed_recovery_on_slot_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    update public.daily_trending_feeds
    set recovery_attempt_count = 0,
        last_recovery_at = null,
        last_recovery_error = null,
        updated_at = now()
    where id = new.feed_id;
  elsif tg_op = 'UPDATE' and old.state = 'failed' and new.state = 'planned' then
    update public.daily_trending_feeds
    set recovery_attempt_count = 0,
        last_recovery_at = null,
        last_recovery_error = null,
        updated_at = now()
    where id = new.feed_id;
  end if;
  return new;
end;
$function$;

drop trigger if exists reset_daily_trending_feed_recovery_on_insert
  on public.daily_trending_feed_slots;
create trigger reset_daily_trending_feed_recovery_on_insert
  after insert on public.daily_trending_feed_slots
  for each row execute function public.reset_daily_trending_feed_recovery_on_slot_change();

drop trigger if exists reset_daily_trending_feed_recovery_on_retry
  on public.daily_trending_feed_slots;
create trigger reset_daily_trending_feed_recovery_on_retry
  after update of state on public.daily_trending_feed_slots
  for each row
  when (old.state = 'failed' and new.state = 'planned')
  execute function public.reset_daily_trending_feed_recovery_on_slot_change();

grant execute on function public.reset_daily_trending_feed_recovery_on_slot_change()
  to postgres, service_role;
revoke all on function public.reset_daily_trending_feed_recovery_on_slot_change()
  from public;

-- Keep the legacy count-mismatch compatibility scan bounded as well. The new
-- claim function below is authoritative, but this prevents an old caller from
-- re-entering the same exhausted feed every five minutes.
create or replace function public.list_current_trending_feed_integrity_repairs (
  p_limit integer default 25
)
returns table (
  feed_id uuid,
  user_id text
)
language sql
security definer
set search_path to 'public'
as $function$
  select feed.id, feed.user_id
  from public.daily_trending_feeds as feed
  where feed.local_date = (now() at time zone feed.timezone)::date
    and feed.recovery_attempt_count < 3
    and (
      feed.last_recovery_at is null
      or feed.last_recovery_at < now() - interval '15 minutes'
    )
    and (
      select count(*)
      from public.daily_trending_feed_slots as slot
      where slot.feed_id = feed.id
    ) <> feed.daily_limit
  order by feed.updated_at, feed.id
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$function$;

grant execute on function public.list_current_trending_feed_integrity_repairs(integer)
  to postgres, service_role;
revoke all on function public.list_current_trending_feed_integrity_repairs(integer)
  from public;

-- Atomically claims feeds that need a repair pass. A claim is deliberately
-- separate from source-job state: the application re-enters the normal
-- idempotent planners and only terminalises a slot after repeated stale scans.
create or replace function public.list_due_daily_trending_feed_repairs (
  p_limit integer default 25,
  p_stale_after_seconds integer default 900,
  p_max_attempts integer default 3
)
returns table (
  feed_id uuid,
  user_id text,
  attempt_count integer,
  oldest_pending_at timestamptz,
  pending_slot_count integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return query
  with candidates as (
    select feed.id
    from public.daily_trending_feeds as feed
    where feed.local_date = (now() at time zone feed.timezone)::date
      and feed.recovery_attempt_count < greatest(coalesce(p_max_attempts, 3), 1)
      and (
        feed.last_recovery_at is null
        or feed.last_recovery_at < now() - make_interval(
          secs => greatest(60, least(coalesce(p_stale_after_seconds, 900), 43200))
        )
      )
      and (
        (
          select count(*)
          from public.daily_trending_feed_slots as slot
          where slot.feed_id = feed.id
        ) <> feed.daily_limit
        or exists (
          select 1
          from public.daily_trending_feed_slots as slot
          where slot.feed_id = feed.id
            and slot.state in ('planned', 'preparing', 'failed')
            and slot.carousel_assignment_id is null
            and slot.hook_video_assignment_id is null
            and slot.wall_text_assignment_id is null
            and slot.updated_at < now() - make_interval(
              secs => greatest(60, least(coalesce(p_stale_after_seconds, 900), 43200))
            )
        )
      )
    order by feed.updated_at, feed.id
    limit greatest(1, least(coalesce(p_limit, 25), 100))
    for update skip locked
  ),
  claimed as (
    update public.daily_trending_feeds as feed
    set
      recovery_attempt_count = feed.recovery_attempt_count + 1,
      last_recovery_at = now(),
      updated_at = now()
    from candidates
    where feed.id = candidates.id
    returning feed.id, feed.user_id, feed.recovery_attempt_count
  )
  select claimed.id,
         claimed.user_id,
         claimed.recovery_attempt_count,
         pending.oldest_pending_at,
         pending.pending_slot_count
  from claimed
  cross join lateral (
    select min(slot.updated_at) as oldest_pending_at,
           count(*)::integer as pending_slot_count
    from public.daily_trending_feed_slots as slot
    where slot.feed_id = claimed.id
      and slot.state in ('planned', 'preparing', 'failed')
      and slot.carousel_assignment_id is null
      and slot.hook_video_assignment_id is null
      and slot.wall_text_assignment_id is null
  ) as pending;
end;
$function$;

grant execute on function public.list_due_daily_trending_feed_repairs(integer, integer, integer)
  to postgres, service_role;
revoke all on function public.list_due_daily_trending_feed_repairs(integer, integer, integer)
  from public;

-- Records the result of a claimed repair. After the bounded number of passes,
-- only still-stale, unassigned slots are marked failed; decided/ready content
-- is never replaced or touched.
create or replace function public.finish_daily_trending_feed_repair (
  p_feed_id uuid,
  p_pending_slot_count integer,
  p_error_message text default null,
  p_stale_after_seconds integer default 900,
  p_max_attempts integer default 3
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  feed_record public.daily_trending_feeds;
  stale_count integer := 0;
  pending_count integer := 0;
  bounded_error text := nullif(left(btrim(coalesce(p_error_message, '')), 1000), '');
begin
  select * into feed_record
  from public.daily_trending_feeds
  where id = p_feed_id
  for update;

  if feed_record.id is null then
    return 'missing';
  end if;

  select count(*)::integer into pending_count
  from public.daily_trending_feed_slots as slot
  where slot.feed_id = p_feed_id
    and slot.state in ('planned', 'preparing', 'failed')
    and slot.carousel_assignment_id is null
    and slot.hook_video_assignment_id is null
    and slot.wall_text_assignment_id is null;

  if pending_count = 0 then
    update public.daily_trending_feeds
    set recovery_attempt_count = 0,
        last_recovery_at = null,
        last_recovery_error = null,
        updated_at = now()
    where id = p_feed_id;
    return 'complete';
  end if;

  if feed_record.recovery_attempt_count >= greatest(coalesce(p_max_attempts, 3), 1) then
    update public.daily_trending_feed_slots as slot
    set state = 'failed', updated_at = now()
    where slot.feed_id = p_feed_id
      and slot.state in ('planned', 'preparing', 'failed')
      and slot.carousel_assignment_id is null
      and slot.hook_video_assignment_id is null
      and slot.wall_text_assignment_id is null
      and slot.updated_at < now() - make_interval(
        secs => greatest(60, least(coalesce(p_stale_after_seconds, 900), 43200))
      );

    get diagnostics stale_count = row_count;
  end if;

  select count(*)::integer into pending_count
  from public.daily_trending_feed_slots as slot
  where slot.feed_id = p_feed_id
    and slot.state in ('planned', 'preparing', 'failed')
    and slot.carousel_assignment_id is null
    and slot.hook_video_assignment_id is null
    and slot.wall_text_assignment_id is null;

  update public.daily_trending_feeds
  set status = case
        when not exists (
          select 1 from public.daily_trending_feed_slots as slot
          where slot.feed_id = p_feed_id and slot.state <> 'decided'
        ) then 'completed'
        when pending_count > 0 and exists (
          select 1 from public.daily_trending_feed_slots as slot
          where slot.feed_id = p_feed_id and slot.state = 'ready'
        ) then 'ready'
        when pending_count > 0 then 'preparing'
        else 'failed'
      end,
      last_recovery_error = case
        when pending_count = 0 then null
        else coalesce(bounded_error, 'Daily Trending preparation is still pending.')
      end,
      last_error = case
        when pending_count = 0 then null
        when stale_count > 0 then coalesce(bounded_error, 'Daily Trending preparation stopped before all reserved positions were generated.')
        else last_error
      end,
      updated_at = now()
  where id = p_feed_id;

  return case when pending_count = 0 then 'failed' else 'retry' end;
end;
$function$;

grant execute on function public.finish_daily_trending_feed_repair(uuid, integer, text, integer, integer)
  to postgres, service_role;
revoke all on function public.finish_daily_trending_feed_repair(uuid, integer, text, integer, integer)
  from public;

-- Preserve the reason for a partial terminal failure. The prior expression
-- always wrote NULL whenever any ready slot existed, making the UI and
-- support diagnostics indistinguishable from a healthy preparation.
create or replace function public.mark_daily_trending_feed_formats_failed (
  p_feed_id uuid,
  p_formats text[],
  p_message text default null
)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  feed_record public.daily_trending_feeds;
  bounded_message text := nullif(left(btrim(coalesce(p_message, '')), 1000), '');
begin
  if coalesce(array_length(p_formats, 1), 0) = 0 then return; end if;
  if exists (select 1 from unnest(p_formats) as requested_format
             where requested_format not in ('carousel', 'hook_video', 'wall_text')) then
    raise exception 'invalid_daily_trending_format';
  end if;

  select * into feed_record from public.daily_trending_feeds where id = p_feed_id;
  if feed_record.id is null then raise exception 'daily_trending_feed_not_found'; end if;

  perform pg_advisory_xact_lock(hashtextextended(feed_record.user_id || ':' || feed_record.local_date::text, 0));

  update public.daily_trending_feed_slots
  set state = 'failed', updated_at = now()
  where feed_id = p_feed_id
    and format = any(p_formats)
    and state in ('planned', 'preparing')
    and carousel_assignment_id is null
    and hook_video_assignment_id is null
    and wall_text_assignment_id is null;

  update public.daily_trending_feeds
  set status = case
      when not exists (select 1 from public.daily_trending_feed_slots as slot
                       where slot.feed_id = p_feed_id and slot.state <> 'decided') then 'completed'
      when exists (select 1 from public.daily_trending_feed_slots as slot
                   where slot.feed_id = p_feed_id and slot.state = 'ready') then 'ready'
      else 'failed'
    end,
    last_error = coalesce(bounded_message, last_error),
    last_recovery_error = coalesce(bounded_message, last_recovery_error),
    updated_at = now()
  where id = p_feed_id;
end;
$function$;

grant execute on function public.mark_daily_trending_feed_formats_failed(uuid, text[], text)
  to postgres, service_role;
revoke all on function public.mark_daily_trending_feed_formats_failed(uuid, text[], text)
  from public;
