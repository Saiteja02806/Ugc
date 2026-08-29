-- A Hook chunk is reserved in Postgres before the application can create its
-- physical background job. Persist a dispatch instruction in the same
-- transaction as that reservation so a process crash cannot orphan the chunk.
create table if not exists public.trending_hook_generation_dispatch_outbox (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.trending_hook_generation_runs(id) on delete cascade,
  chunk_id uuid not null unique references public.trending_hook_generation_run_chunks(id) on delete cascade,
  user_id text not null check (char_length(trim(user_id)) between 1 and 128),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  claim_token uuid,
  claimed_at timestamptz,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trending_hook_generation_dispatch_outbox_due_idx
  on public.trending_hook_generation_dispatch_outbox (status, next_attempt_at, created_at)
  where status in ('pending', 'processing');

alter table public.trending_hook_generation_dispatch_outbox enable row level security;

revoke all privileges on table public.trending_hook_generation_dispatch_outbox
  from public, anon, authenticated;
grant select, insert, update on table public.trending_hook_generation_dispatch_outbox
  to service_role;

-- This trigger fires inside the same transaction that creates a reserved
-- chunk. If the app process dies before creating a background job, this row
-- remains as durable work for the recovery dispatcher.
create or replace function public.enqueue_trending_hook_generation_chunk_dispatch_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id text;
begin
  select run.user_id
  into v_user_id
  from public.trending_hook_generation_runs as run
  where run.id = new.run_id;

  if not found then
    raise exception 'trending_hook_generation_dispatch_run_not_found';
  end if;

  insert into public.trending_hook_generation_dispatch_outbox (
    run_id,
    chunk_id,
    user_id
  ) values (
    new.run_id,
    new.id,
    v_user_id
  )
  on conflict (chunk_id) do nothing;

  return new;
end;
$$;

drop trigger if exists enqueue_trending_hook_generation_chunk_dispatch
  on public.trending_hook_generation_run_chunks;
create trigger enqueue_trending_hook_generation_chunk_dispatch
after insert on public.trending_hook_generation_run_chunks
for each row
when (new.status = 'reserved')
execute function public.enqueue_trending_hook_generation_chunk_dispatch_v1();

-- Cover reservations created before this migration as well. Only chunks with
-- no physical job are in scope; attached jobs already use normal job recovery.
insert into public.trending_hook_generation_dispatch_outbox (
  run_id,
  chunk_id,
  user_id
)
select
  chunk.run_id,
  chunk.id,
  run.user_id
from public.trending_hook_generation_run_chunks as chunk
join public.trending_hook_generation_runs as run
  on run.id = chunk.run_id
where chunk.status = 'reserved'
  and chunk.background_job_id is null
on conflict (chunk_id) do nothing;

-- Once a physical job is attached, the original reservation is no longer in
-- the crash window. If the process then dies before Cloud Tasks delivery, the
-- existing background-job recovery owns redispatching that queued job.
create or replace function public.complete_trending_hook_generation_chunk_dispatch_trigger_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.background_job_id is not null or new.status <> 'reserved' then
    update public.trending_hook_generation_dispatch_outbox
    set
      status = 'completed',
      completed_at = now(),
      claim_token = null,
      claimed_at = null,
      updated_at = now()
    where chunk_id = new.id
      and status <> 'completed';
  end if;

  return new;
end;
$$;

drop trigger if exists complete_trending_hook_generation_chunk_dispatch
  on public.trending_hook_generation_run_chunks;
create trigger complete_trending_hook_generation_chunk_dispatch
after update of background_job_id, status on public.trending_hook_generation_run_chunks
for each row
when (
  new.background_job_id is not null
  or new.status <> 'reserved'
)
execute function public.complete_trending_hook_generation_chunk_dispatch_trigger_v1();

create or replace function public.claim_due_trending_hook_generation_chunk_dispatches_v1(
  p_limit integer default 25,
  p_claim_token uuid default null,
  p_stale_after_seconds integer default 300
)
returns table (
  dispatch_id uuid,
  run_id uuid,
  chunk_id uuid,
  user_id text,
  target_valid_count integer,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  v_claim_token uuid := coalesce(p_claim_token, gen_random_uuid());
  v_stale_after_seconds integer := greatest(
    60,
    least(coalesce(p_stale_after_seconds, 300), 43200)
  );
begin
  return query
  with due as (
    select dispatch.id
    from public.trending_hook_generation_dispatch_outbox as dispatch
    join public.trending_hook_generation_run_chunks as chunk
      on chunk.id = dispatch.chunk_id
    where chunk.status = 'reserved'
      and chunk.background_job_id is null
      and (
        (dispatch.status = 'pending' and dispatch.next_attempt_at <= now())
        or (
          dispatch.status = 'processing'
          and dispatch.claimed_at <= now() - make_interval(secs => v_stale_after_seconds)
        )
      )
    order by dispatch.next_attempt_at, dispatch.created_at, dispatch.id
    limit v_limit
    for update of dispatch skip locked
  ), claimed as (
    update public.trending_hook_generation_dispatch_outbox as dispatch
    set
      status = 'processing',
      attempt_count = dispatch.attempt_count + 1,
      claim_token = v_claim_token,
      claimed_at = now(),
      updated_at = now()
    from due
    where dispatch.id = due.id
    returning dispatch.*
  )
  select
    dispatch.id,
    dispatch.run_id,
    dispatch.chunk_id,
    dispatch.user_id,
    run.target_valid_count,
    dispatch.attempt_count
  from claimed as dispatch
  join public.trending_hook_generation_runs as run
    on run.id = dispatch.run_id;
end;
$$;

create or replace function public.complete_trending_hook_generation_chunk_dispatch_v1(
  p_dispatch_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_completed boolean := false;
begin
  update public.trending_hook_generation_dispatch_outbox as dispatch
  set
    status = 'completed',
    completed_at = now(),
    claim_token = null,
    claimed_at = null,
    updated_at = now()
  from public.trending_hook_generation_run_chunks as chunk
  where dispatch.id = p_dispatch_id
    and dispatch.claim_token = p_claim_token
    and chunk.id = dispatch.chunk_id
    and (
      chunk.background_job_id is not null
      or chunk.status <> 'reserved'
    )
  returning true into v_completed;

  return v_completed;
end;
$$;

create or replace function public.reschedule_trending_hook_generation_chunk_dispatch_v1(
  p_dispatch_id uuid,
  p_claim_token uuid,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rescheduled boolean := false;
begin
  update public.trending_hook_generation_dispatch_outbox
  set
    status = 'pending',
    next_attempt_at = now() + make_interval(
      mins => least(greatest(attempt_count, 1) * 5, 30)
    ),
    claim_token = null,
    claimed_at = null,
    last_error = left(coalesce(nullif(trim(p_error_message), ''), 'Could not dispatch the reserved Hook chunk.'), 2000),
    updated_at = now()
  where id = p_dispatch_id
    and claim_token = p_claim_token
    and status = 'processing'
  returning true into v_rescheduled;

  return v_rescheduled;
end;
$$;

revoke all on function public.enqueue_trending_hook_generation_chunk_dispatch_v1()
  from public, anon, authenticated;
revoke all on function public.complete_trending_hook_generation_chunk_dispatch_trigger_v1()
  from public, anon, authenticated;
revoke all on function public.claim_due_trending_hook_generation_chunk_dispatches_v1(integer, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.complete_trending_hook_generation_chunk_dispatch_v1(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.reschedule_trending_hook_generation_chunk_dispatch_v1(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.claim_due_trending_hook_generation_chunk_dispatches_v1(integer, uuid, integer)
  to service_role;
grant execute on function public.complete_trending_hook_generation_chunk_dispatch_v1(uuid, uuid)
  to service_role;
grant execute on function public.reschedule_trending_hook_generation_chunk_dispatch_v1(uuid, uuid, text)
  to service_role;

select pg_notify('pgrst', 'reload schema');
