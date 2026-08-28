-- Cloud Tasks limits requests to the launch endpoint, not active Cloud Run Job
-- executions. These durable slots are the source of truth for the maximum
-- number of concurrently launched video renders.
create table if not exists public.video_render_execution_slots (
  slot_number smallint primary key
    check (slot_number between 1 and 10),
  background_job_id uuid unique
    references public.background_jobs(id) on delete restrict,
  claim_token uuid,
  claimed_at timestamptz,
  worker_execution_id text,
  updated_at timestamptz not null default now(),
  check (
    (background_job_id is null and claim_token is null and claimed_at is null and worker_execution_id is null)
    or (background_job_id is not null and claim_token is not null and claimed_at is not null)
  )
);

insert into public.video_render_execution_slots (slot_number)
select value::smallint
from generate_series(1, 10) as value
on conflict (slot_number) do nothing;

alter table public.video_render_execution_slots enable row level security;
revoke all privileges on table public.video_render_execution_slots from anon, authenticated;
grant select, update on table public.video_render_execution_slots to service_role;

create or replace function public.claim_video_render_execution_slot(
  p_job_id uuid,
  p_claim_token uuid,
  p_stale_after_seconds integer default 300
)
returns table(slot_number smallint, should_launch boolean, is_launched boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.background_jobs%rowtype;
  v_slot public.video_render_execution_slots%rowtype;
  v_now timestamptz := now();
  v_stale_after_seconds integer := greatest(
    60,
    least(coalesce(p_stale_after_seconds, 300), 3600)
  );
begin
  if p_claim_token is null then
    raise exception 'render slot claim token is required';
  end if;

  select job.*
  into v_job
  from public.background_jobs as job
  where job.id = p_job_id
    and job.queue_name = 'video-render'
    and job.job_type in (
      'render_edit_video',
      'render_schedule_combination',
      'render_trending_carousel_edit',
      'render_wall_text_video'
    )
  for update;

  if not found or v_job.status in ('cancelled', 'completed', 'failed') then
    return;
  end if;

  -- A redelivered launcher task first reuses its existing durable slot. A
  -- fresh lease means another launcher is still attaching the Cloud Run
  -- execution, so it must not start a second render.
  select slot.*
  into v_slot
  from public.video_render_execution_slots as slot
  where slot.background_job_id = p_job_id
  for update;

  if found then
    if v_slot.worker_execution_id is not null
      or v_job.status in ('processing', 'waiting_external_service', 'rendering', 'uploading_output')
      or v_slot.claimed_at >= v_now - make_interval(secs => v_stale_after_seconds) then
      return query select
        v_slot.slot_number,
        false,
        v_slot.worker_execution_id is not null
          or v_job.status in ('processing', 'waiting_external_service', 'rendering', 'uploading_output');
      return;
    end if;

    update public.video_render_execution_slots as slot
    set
      claim_token = p_claim_token,
      claimed_at = v_now,
      updated_at = v_now,
      worker_execution_id = null
    where slot.slot_number = v_slot.slot_number;

    return query select v_slot.slot_number, true, false;
    return;
  end if;

  -- Reclaim only a stale, unlaunched queued slot. A slot for a processing
  -- render stays occupied until the background job reaches a terminal state.
  update public.video_render_execution_slots as slot
  set
    background_job_id = null,
    claim_token = null,
    claimed_at = null,
    updated_at = v_now,
    worker_execution_id = null
  where slot.background_job_id is not null
    and slot.worker_execution_id is null
    and slot.claimed_at < v_now - make_interval(secs => v_stale_after_seconds)
    and exists (
      select 1
      from public.background_jobs as old_job
      where old_job.id = slot.background_job_id
        and old_job.status in ('created', 'queued', 'stalled')
    );

  select slot.*
  into v_slot
  from public.video_render_execution_slots as slot
  where slot.background_job_id is null
  order by slot.slot_number
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.video_render_execution_slots as slot
  set
    background_job_id = p_job_id,
    claim_token = p_claim_token,
    claimed_at = v_now,
    updated_at = v_now,
    worker_execution_id = null
  where slot.slot_number = v_slot.slot_number;

  return query select v_slot.slot_number, true, false;
end;
$$;

create or replace function public.attach_video_render_execution_slot(
  p_job_id uuid,
  p_claim_token uuid,
  p_worker_execution_id text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  with attached as (
    update public.video_render_execution_slots as slot
    set
      updated_at = now(),
      worker_execution_id = left(trim(p_worker_execution_id), 255)
    where slot.background_job_id = p_job_id
      and slot.claim_token = p_claim_token
      and slot.worker_execution_id is null
    returning 1
  )
  select exists(select 1 from attached);
$$;

create or replace function public.release_video_render_execution_slot(
  p_job_id uuid,
  p_claim_token uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  with released as (
    update public.video_render_execution_slots as slot
    set
      background_job_id = null,
      claim_token = null,
      claimed_at = null,
      updated_at = now(),
      worker_execution_id = null
    where slot.background_job_id = p_job_id
      and slot.claim_token = p_claim_token
      and slot.worker_execution_id is null
    returning 1
  )
  select exists(select 1 from released);
$$;

create or replace function public.release_video_render_slot_on_background_job_state_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
    and new.status in ('queued', 'completed', 'failed', 'cancelled', 'stalled') then
    update public.video_render_execution_slots as slot
    set
      background_job_id = null,
      claim_token = null,
      claimed_at = null,
      updated_at = now(),
      worker_execution_id = null
    where slot.background_job_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists release_video_render_slot_on_background_job_state_change
  on public.background_jobs;
create trigger release_video_render_slot_on_background_job_state_change
after update of status on public.background_jobs
for each row
execute function public.release_video_render_slot_on_background_job_state_change();

revoke all on function public.claim_video_render_execution_slot(uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.attach_video_render_execution_slot(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.release_video_render_execution_slot(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_video_render_execution_slot(uuid, uuid, integer)
  to service_role;
grant execute on function public.attach_video_render_execution_slot(uuid, uuid, text)
  to service_role;
grant execute on function public.release_video_render_execution_slot(uuid, uuid)
  to service_role;
