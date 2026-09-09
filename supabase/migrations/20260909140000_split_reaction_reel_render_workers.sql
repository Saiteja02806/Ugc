-- Reaction planning is short-lived AI work. Each selected Reel now owns an
-- independent durable render job so a slow FFmpeg render cannot serialize its
-- siblings or hold the planner worker open.

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
      'final_render', 'reaction_generation', 'reaction_render'
    ]::text[])
  );

alter table public.reaction_generation_run_items
  add column if not exists render_job_id uuid
    references public.background_jobs(id) on delete set null;

create unique index if not exists reaction_generation_run_items_render_job_uidx
  on public.reaction_generation_run_items (render_job_id)
  where render_job_id is not null;

create index if not exists reaction_generation_run_items_render_job_pending_idx
  on public.reaction_generation_run_items (generation_run_id, render_status, slot_index)
  where render_status in ('queued', 'rendering');

create or replace function public.create_reaction_generation_render_jobs_v1(
  p_generation_job_id uuid,
  p_run_id uuid,
  p_user_id text
)
returns table (
  item_id uuid,
  job_id uuid,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.reaction_generation_runs%rowtype;
  v_item public.reaction_generation_run_items%rowtype;
  v_job public.background_jobs%rowtype;
  v_result jsonb;
begin
  select run.* into v_run
  from public.reaction_generation_runs as run
  where run.id = p_run_id
    and run.generation_job_id = p_generation_job_id
    and run.user_id = p_user_id
  for update;

  if not found then
    raise exception 'reaction_generation_run_unavailable';
  end if;

  for v_item in
    select item.*
    from public.reaction_generation_run_items as item
    where item.generation_run_id = v_run.id
      and item.render_status in ('queued', 'rendering')
    order by item.slot_index
    for update
  loop
    if v_item.render_job_id is not null then
      select job.* into v_job
      from public.background_jobs as job
      where job.id = v_item.render_job_id
        and job.user_id = p_user_id
        and job.job_type = 'reaction_render';
      if not found then
        raise exception 'reaction_generation_item_render_job_missing';
      end if;

      item_id := v_item.id;
      job_id := v_job.id;
      created := false;
      return next;
      continue;
    end if;

    v_result := public.create_or_get_background_job_v1(
      'reaction-render:' || v_item.id::text,
      jsonb_build_object(
        'generationJobId', p_generation_job_id,
        'generationRunId', v_run.id,
        'itemId', v_item.id,
        'projectId', v_run.project_id,
        'userId', p_user_id
      ),
      'reaction_generation_run_item:' || v_item.id::text,
      'reaction_render',
      3,
      v_run.project_id,
      'reaction-render',
      p_user_id
    );

    select * into v_job
    from jsonb_populate_record(
      null::public.background_jobs,
      v_result -> 'job'
    );

    if v_job.id is null or v_job.job_type <> 'reaction_render'
      or v_job.user_id is distinct from p_user_id then
      raise exception 'reaction_generation_item_render_job_invalid';
    end if;

    update public.reaction_generation_run_items as item
    set render_job_id = v_job.id
    where item.id = v_item.id
      and item.render_job_id is null;

    item_id := v_item.id;
    job_id := v_job.id;
    created := coalesce((v_result ->> 'created')::boolean, false);
    return next;
  end loop;
end;
$$;

create or replace function public.claim_reaction_generation_item_render_v1(
  p_generation_job_id uuid,
  p_item_id uuid,
  p_render_job_id uuid,
  p_user_id text
)
returns setof public.reaction_generation_run_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.reaction_generation_run_items%rowtype;
begin
  select item.* into v_item
  from public.reaction_generation_run_items as item
  join public.reaction_generation_runs as run on run.id = item.generation_run_id
  where item.id = p_item_id
    and run.generation_job_id = p_generation_job_id
    and run.user_id = p_user_id
  for update of item;

  if not found then
    raise exception 'reaction_generation_item_unavailable';
  end if;

  if v_item.render_job_id is distinct from p_render_job_id then
    raise exception 'reaction_generation_item_render_job_mismatch';
  end if;

  if v_item.render_status = 'ready' then
    return query select item.*
      from public.reaction_generation_run_items as item
      where item.id = v_item.id;
    return;
  end if;

  if v_item.render_status = 'failed' then
    return;
  end if;

  update public.reaction_generation_run_items as item
  set render_status = 'rendering', render_error = null
  where item.id = v_item.id;

  update public.reaction_creatives as creative
  set render_status = 'rendering', render_error = null
  where creative.id = v_item.reaction_creative_id
    and creative.user_id = p_user_id
    and creative.render_status in ('queued', 'rendering');

  return query select item.*
    from public.reaction_generation_run_items as item
    where item.id = v_item.id;
end;
$$;

create or replace function public.complete_reaction_generation_item_render_v2(
  p_generation_job_id uuid,
  p_item_id uuid,
  p_render_job_id uuid,
  p_user_id text,
  p_media_asset_id uuid,
  p_preview_url text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.reaction_generation_run_items%rowtype;
begin
  select item.* into v_item
  from public.reaction_generation_run_items as item
  join public.reaction_generation_runs as run on run.id = item.generation_run_id
  where item.id = p_item_id
    and item.render_job_id = p_render_job_id
    and run.generation_job_id = p_generation_job_id
    and run.user_id = p_user_id
  for update of item;

  if not found then
    raise exception 'reaction_generation_item_unavailable';
  end if;

  update public.reaction_generation_run_items
  set render_status = 'ready', rendered_media_asset_id = p_media_asset_id,
      preview_url = p_preview_url, render_error = null
  where id = v_item.id
    and render_status in ('queued', 'rendering', 'ready', 'failed');

  if not found then
    raise exception 'reaction_generation_item_not_updatable';
  end if;

  update public.reaction_creatives
  set render_status = 'preview_ready', rendered_media_asset_id = p_media_asset_id,
      preview_url = p_preview_url, thumbnail_url = null, render_error = null
  where id = v_item.reaction_creative_id
    and user_id = p_user_id
    and render_status in ('queued', 'rendering', 'preview_ready', 'failed');

  return true;
end;
$$;

create or replace function public.fail_reaction_generation_item_render_v2(
  p_generation_job_id uuid,
  p_item_id uuid,
  p_render_job_id uuid,
  p_user_id text,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.reaction_generation_run_items%rowtype;
  v_error text := left(coalesce(nullif(btrim(p_error_message), ''), 'Reaction render failed.'), 1000);
begin
  select item.* into v_item
  from public.reaction_generation_run_items as item
  join public.reaction_generation_runs as run on run.id = item.generation_run_id
  where item.id = p_item_id
    and item.render_job_id = p_render_job_id
    and run.generation_job_id = p_generation_job_id
    and run.user_id = p_user_id
  for update of item;

  if not found then
    raise exception 'reaction_generation_item_unavailable';
  end if;

  update public.reaction_generation_run_items
  set render_status = 'failed', render_error = v_error
  where id = v_item.id and render_status in ('queued', 'rendering', 'failed');

  if not found then
    raise exception 'reaction_generation_item_not_updatable';
  end if;

  update public.reaction_creatives
  set render_status = 'failed', render_error = v_error
  where id = v_item.reaction_creative_id
    and user_id = p_user_id
    and render_status in ('queued', 'rendering', 'failed');

  return true;
end;
$$;

-- A run remains rendering while any independently dispatched item is still
-- queued or in-flight. The old batch implementation treated the first ready
-- item as a partial or failed run because it only finalized after every item.
create or replace function public.complete_reaction_generation_run_v1(
  p_generation_job_id uuid,
  p_run_id uuid,
  p_user_id text
)
returns table (ready_count integer, failed_count integer, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.reaction_generation_runs%rowtype;
  v_ready_count integer;
  v_failed_count integer;
  v_pending_count integer;
  v_status text;
begin
  select run.* into v_run
  from public.reaction_generation_runs as run
  where run.id = p_run_id
    and run.generation_job_id = p_generation_job_id
    and run.user_id = p_user_id
  for update;

  if not found then
    raise exception 'reaction_generation_run_unavailable';
  end if;

  select
    count(*) filter (where item.render_status = 'ready'),
    count(*) filter (where item.render_status = 'failed'),
    count(*) filter (where item.render_status in ('queued', 'rendering'))
  into v_ready_count, v_failed_count, v_pending_count
  from public.reaction_generation_run_items as item
  where item.generation_run_id = v_run.id;

  v_status := case
    when v_pending_count > 0 then 'rendering'
    when v_ready_count = 0 then 'failed'
    when v_ready_count < v_run.requested_count or v_failed_count > 0 then 'partial'
    else 'completed'
  end;

  update public.reaction_generation_runs as run
  set status = v_status,
      failure_message = case
        when v_status = 'failed' then 'No Reaction Reels could be rendered.'
        when v_status = 'partial' then 'One or more Reaction Reels could not be rendered.'
        else null
      end
  where run.id = v_run.id;

  return query select v_ready_count, v_failed_count, v_status;
end;
$$;

revoke all on function public.create_reaction_generation_render_jobs_v1(uuid, uuid, text) from public;
revoke all on function public.claim_reaction_generation_item_render_v1(uuid, uuid, uuid, text) from public;
revoke all on function public.complete_reaction_generation_item_render_v2(uuid, uuid, uuid, text, uuid, text) from public;
revoke all on function public.fail_reaction_generation_item_render_v2(uuid, uuid, uuid, text, text) from public;
grant execute on function public.create_reaction_generation_render_jobs_v1(uuid, uuid, text) to postgres, service_role;
grant execute on function public.claim_reaction_generation_item_render_v1(uuid, uuid, uuid, text) to postgres, service_role;
grant execute on function public.complete_reaction_generation_item_render_v2(uuid, uuid, uuid, text, uuid, text) to postgres, service_role;
grant execute on function public.fail_reaction_generation_item_render_v2(uuid, uuid, uuid, text, text) to postgres, service_role;

comment on column public.reaction_generation_run_items.render_job_id is
  'The durable per-item Reaction render job. It fences each Reels render independently of the planner.';

select pg_notify('pgrst', 'reload schema');
