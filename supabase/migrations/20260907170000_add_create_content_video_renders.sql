-- Create Content is not a Trending assignment. Each export is an immutable
-- snapshot of one card revision, which lets a user keep editing while a prior
-- MP4 finishes safely in the background.
create table public.create_content_renders (
  id uuid primary key,
  user_id text not null,
  source_media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  card_revision integer not null check (card_revision > 0),
  attempt integer not null default 1 check (attempt > 0),
  overlay_json jsonb not null,
  status text not null default 'queued',
  render_job_id uuid references public.background_jobs(id) on delete set null,
  rendered_media_asset_id uuid unique references public.media_assets(id) on delete restrict,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint create_content_renders_status_chk check (
    status in ('queued', 'rendering', 'ready', 'failed')
  ),
  constraint create_content_renders_overlay_json_chk check (
    jsonb_typeof(overlay_json) = 'object'
  ),
  constraint create_content_renders_ready_chk check (
    status <> 'ready' or rendered_media_asset_id is not null
  ),
  constraint create_content_renders_error_chk check (
    error_message is null or char_length(btrim(error_message)) > 0
  ),
  constraint create_content_renders_owner_revision_uidx unique (
    user_id, source_media_asset_id, card_revision
  )
);

create index create_content_renders_source_status_idx
  on public.create_content_renders (user_id, source_media_asset_id, status, updated_at desc);

alter table public.create_content_renders enable row level security;
revoke all on table public.create_content_renders from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update
  on table public.create_content_renders to postgres, service_role;

create or replace function public.touch_create_content_render_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger create_content_renders_touch_updated_at
  before update on public.create_content_renders
  for each row execute function public.touch_create_content_render_updated_at();

-- The worker receives a dedicated job name; it still uses the normal video
-- render queue and publishes its ready output as a regular media asset.
alter table public.background_jobs
  drop constraint if exists background_jobs_job_type_check;
alter table public.background_jobs
  add constraint background_jobs_job_type_check check (
    job_type = any (array[
      'analytics_sync', 'carousel_content_plan_generation', 'carousel_generation',
      'hook_text_generation', 'wall_text_generation', 'wall_text_content_plan_generation',
      'generate_avatar', 'generate_carousel', 'generate_hook_video',
      'generate_image', 'generate_thumbnail', 'generate_trending_hook_copy',
      'extract_video_metadata', 'image_generation', 'media_analysis', 'paid_trending_prebuild',
      'preview_render', 'publish_social_post', 'render_demo_video', 'render_edit_video',
      'render_schedule_combination', 'render_trending_carousel_edit', 'render_wall_text_video',
      'render_create_content_video', 'social_publish', 'test_worker_job', 'video_generation',
      'final_render', 'reaction_generation'
    ]::text[])
  );

comment on table public.create_content_renders is
  'Immutable Create Content export snapshots. They preserve the source clip audio and never reference Trending plans or assignments.';

-- Create Content exports share the existing bounded video-render lease. Without this entry, the launcher retries forever even when a slot is free.
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
      'reaction_generation',
      'render_create_content_video'
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

select pg_notify('pgrst', 'reload schema');
