-- A completed Trending source job must always leave a durable instruction to
-- reconcile the user's daily feed. This is deliberately an outbox instead of
-- a browser-side retry: a temporary app outage must not strand the remaining
-- promised slots.
create table if not exists public.trending_feed_reconciliation_outbox (
  source_job_id uuid primary key references public.background_jobs(id) on delete cascade,
  user_id text not null check (char_length(trim(user_id)) between 1 and 128),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trending_feed_reconciliation_outbox_due_idx
  on public.trending_feed_reconciliation_outbox (next_attempt_at, created_at)
  where status = 'pending';

create index if not exists trending_feed_reconciliation_outbox_stale_idx
  on public.trending_feed_reconciliation_outbox (locked_at)
  where status = 'processing';

alter table public.trending_feed_reconciliation_outbox enable row level security;

revoke all privileges on table public.trending_feed_reconciliation_outbox
  from public, anon, authenticated;
grant select, insert, update on table public.trending_feed_reconciliation_outbox
  to service_role;

create or replace function public.enqueue_completed_trending_feed_reconciliation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trending_feed_reconciliation_outbox (
    source_job_id,
    user_id,
    status,
    next_attempt_at
  ) values (
    new.id,
    new.user_id,
    'pending',
    now()
  )
  on conflict (source_job_id) do nothing;

  return new;
end;
$$;

drop trigger if exists enqueue_completed_trending_feed_reconciliation
  on public.background_jobs;

create trigger enqueue_completed_trending_feed_reconciliation
after update of status on public.background_jobs
for each row
when (
  old.status is distinct from new.status
  and new.status = 'completed'
  and new.user_id is not null
  and new.job_type in (
    'carousel_content_plan_generation',
    'generate_carousel',
    'generate_trending_hook_copy',
    'wall_text_content_plan_generation',
    'wall_text_generation'
  )
)
execute function public.enqueue_completed_trending_feed_reconciliation();

create or replace function public.claim_due_trending_feed_reconciliations(
  p_limit integer default 25,
  p_source_job_id uuid default null
)
returns table (
  source_job_id uuid,
  user_id text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with eligible as (
    select outbox.source_job_id
    from public.trending_feed_reconciliation_outbox as outbox
    where (
      (
        outbox.status = 'pending'
        and outbox.next_attempt_at <= now()
      ) or (
        outbox.status = 'processing'
        and outbox.locked_at < now() - interval '10 minutes'
      )
    )
    and (p_source_job_id is null or outbox.source_job_id = p_source_job_id)
    order by outbox.next_attempt_at, outbox.created_at
    limit greatest(1, least(coalesce(p_limit, 25), 100))
    for update skip locked
  ), claimed as (
    update public.trending_feed_reconciliation_outbox as outbox
    set
      status = 'processing',
      attempt_count = outbox.attempt_count + 1,
      locked_at = now(),
      last_attempt_at = now(),
      updated_at = now()
    from eligible
    where outbox.source_job_id = eligible.source_job_id
    returning outbox.source_job_id, outbox.user_id, outbox.attempt_count
  )
  select claimed.source_job_id, claimed.user_id, claimed.attempt_count
  from claimed;
end;
$$;

create or replace function public.complete_trending_feed_reconciliation(
  p_source_job_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trending_feed_reconciliation_outbox as outbox
  set
    status = 'completed',
    completed_at = now(),
    locked_at = null,
    last_error = null,
    next_attempt_at = now(),
    updated_at = now()
  where outbox.source_job_id = p_source_job_id
    and outbox.status = 'processing';

  return found;
end;
$$;

create or replace function public.reschedule_trending_feed_reconciliation(
  p_source_job_id uuid,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  delay_seconds integer;
begin
  select case least(outbox.attempt_count, 6)
    when 1 then 60
    when 2 then 120
    when 3 then 240
    when 4 then 480
    when 5 then 900
    else 1800
  end
  into delay_seconds
  from public.trending_feed_reconciliation_outbox as outbox
  where outbox.source_job_id = p_source_job_id
    and outbox.status = 'processing'
  for update;

  if delay_seconds is null then
    return false;
  end if;

  update public.trending_feed_reconciliation_outbox as outbox
  set
    status = 'pending',
    locked_at = null,
    last_error = left(
      coalesce(nullif(btrim(p_error_message), ''), 'Trending reconciliation failed.'),
      1000
    ),
    next_attempt_at = now() + make_interval(secs => delay_seconds),
    updated_at = now()
  where outbox.source_job_id = p_source_job_id
    and outbox.status = 'processing';

  return found;
end;
$$;

-- A feed is complete only when every promised position exists and was decided.
-- Counting only the existing rows incorrectly allowed a historical 9/10 feed
-- to be called complete.
create or replace function public.mark_daily_trending_feed_slot_decided(
  p_user_id text,
  p_format text,
  p_assignment_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  resolved_slot_id uuid;
  resolved_feed_id uuid;
begin
  if p_format not in ('carousel', 'hook_video', 'wall_text') then
    raise exception 'invalid_daily_trending_format';
  end if;

  select slot.id, slot.feed_id
  into resolved_slot_id, resolved_feed_id
  from public.daily_trending_feed_slots as slot
  join public.daily_trending_feeds as feed on feed.id = slot.feed_id
  where feed.user_id = p_user_id
    and slot.state = 'ready'
    and (
      (p_format = 'carousel' and slot.carousel_assignment_id = p_assignment_id)
      or (p_format = 'hook_video' and slot.hook_video_assignment_id = p_assignment_id)
      or (p_format = 'wall_text' and slot.wall_text_assignment_id = p_assignment_id)
    )
  order by feed.local_date desc
  limit 1
  for update of slot;

  if resolved_slot_id is null then
    return null;
  end if;

  update public.daily_trending_feed_slots
  set state = 'decided', updated_at = now()
  where id = resolved_slot_id;

  update public.daily_trending_feeds as feed
  set
    status = case
      when (
        select count(*)
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = resolved_feed_id
      ) = feed.daily_limit
      and not exists (
        select 1
        from public.daily_trending_feed_slots as remaining_slot
        where remaining_slot.feed_id = resolved_feed_id
          and remaining_slot.state <> 'decided'
      ) then 'completed'
      else feed.status
    end,
    updated_at = now()
  where feed.id = resolved_feed_id;

  return resolved_slot_id;
end;
$$;

-- Historical interrupted writes can leave a current feed short one or more
-- physical positions. The recovery scheduler scans this small, durable set so
-- a final swipe does not require the browser to discover the shortfall.
create or replace function public.list_current_trending_feed_integrity_repairs(
  p_limit integer default 25
)
returns table (
  feed_id uuid,
  user_id text
)
language sql
security definer
set search_path = public
as $$
  select feed.id, feed.user_id
  from public.daily_trending_feeds as feed
  where feed.local_date = (now() at time zone feed.timezone)::date
    and (
      select count(*)
      from public.daily_trending_feed_slots as slot
      where slot.feed_id = feed.id
    ) <> feed.daily_limit
  order by feed.updated_at, feed.id
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$$;

revoke all on function public.claim_due_trending_feed_reconciliations(integer, uuid)
  from public, anon, authenticated;
revoke all on function public.complete_trending_feed_reconciliation(uuid)
  from public, anon, authenticated;
revoke all on function public.reschedule_trending_feed_reconciliation(uuid, text)
  from public, anon, authenticated;
revoke all on function public.mark_daily_trending_feed_slot_decided(text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.list_current_trending_feed_integrity_repairs(integer)
  from public, anon, authenticated;

grant execute on function public.claim_due_trending_feed_reconciliations(integer, uuid)
  to service_role;
grant execute on function public.complete_trending_feed_reconciliation(uuid)
  to service_role;
grant execute on function public.reschedule_trending_feed_reconciliation(uuid, text)
  to service_role;
grant execute on function public.mark_daily_trending_feed_slot_decided(text, text, uuid)
  to service_role;
grant execute on function public.list_current_trending_feed_integrity_repairs(integer)
  to service_role;

select pg_notify('pgrst', 'reload schema');
