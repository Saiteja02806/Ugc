-- Reaction generation is routed through the existing video-render queue and
-- Cloud Run Job. It must participate in the same bounded two-slot lease as
-- the other render jobs; otherwise its launcher keeps retrying despite idle
-- render capacity.
create or replace function public.claim_video_render_execution_slot(
  p_job_id uuid,
  p_claim_token uuid,
  p_stale_after_seconds integer default 300
)
returns table (
  slot_number smallint,
  should_launch boolean,
  is_launched boolean
)
language plpgsql
security definer
set search_path to 'public'
as $function$
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
      'render_wall_text_video',
      'reaction_generation'
    )
  for update;

  if not found or v_job.status in ('cancelled', 'completed', 'failed') then
    return;
  end if;

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
$function$;

revoke all on function public.claim_video_render_execution_slot(uuid, uuid, integer)
  from public;
grant execute on function public.claim_video_render_execution_slot(uuid, uuid, integer)
  to postgres, service_role;
