-- Phase 5: durable Reaction generation and rendering. A generation run
-- persists its validated plan before a worker starts rendering so reclaiming a
-- background job never needs to choose different assets or call the writer
-- again. Each item owns its final MP4 and owner-scoped media asset.

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
      'social_publish', 'test_worker_job', 'video_generation', 'final_render',
      'reaction_generation'
    ]::text[])
  );

-- A batch worker renders several chosen pairs. The old per-creative unique
-- index prevented that durable batch linkage, so retain the lookup index but
-- allow every creative in the same generation run to reference the same job.
drop index if exists public.reaction_creatives_user_render_job_uidx;
create index if not exists reaction_creatives_user_render_job_idx
  on public.reaction_creatives (user_id, render_job_id)
  where render_job_id is not null;

create table if not exists public.reaction_generation_runs (
  id uuid primary key default gen_random_uuid(),
  generation_job_id uuid not null unique references public.background_jobs(id) on delete restrict,
  user_id text not null,
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  business_profile_version integer not null check (business_profile_version > 0),
  project_id text not null,
  request_key text not null,
  requested_count integer not null check (requested_count between 1 and 12),
  generation_context jsonb not null default '{}'::jsonb,
  brief_payload jsonb,
  status text not null default 'queued',
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reaction_generation_runs_context_chk check (jsonb_typeof(generation_context) = 'object'),
  constraint reaction_generation_runs_briefs_chk check (brief_payload is null or jsonb_typeof(brief_payload) = 'object'),
  constraint reaction_generation_runs_status_chk check (
    status in ('queued', 'planning', 'rendering', 'completed', 'partial', 'failed')
  ),
  constraint reaction_generation_runs_request_key_uidx unique (user_id, request_key)
);

create table if not exists public.reaction_generation_run_items (
  id uuid primary key default gen_random_uuid(),
  generation_run_id uuid not null references public.reaction_generation_runs(id) on delete cascade,
  slot_index integer not null check (slot_index >= 0),
  clip_asset_id uuid not null references public.reaction_clip_assets(id) on delete restrict,
  background_asset_id uuid not null references public.reaction_background_assets(id) on delete restrict,
  primary_reaction text not null,
  caption text not null,
  content_json jsonb not null,
  render_plan_json jsonb not null,
  title text not null,
  duration_seconds numeric not null check (duration_seconds > 0 and duration_seconds <= 60),
  reaction_creative_id uuid not null unique references public.reaction_creatives(id) on delete restrict,
  reaction_assignment_id uuid not null unique references public.user_reaction_assignments(id) on delete restrict,
  render_status text not null default 'queued',
  rendered_media_asset_id uuid unique references public.media_assets(id) on delete restrict,
  preview_url text,
  render_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reaction_generation_run_items_slot_uidx unique (generation_run_id, slot_index),
  constraint reaction_generation_run_items_render_status_chk check (
    render_status in ('queued', 'rendering', 'ready', 'failed')
  ),
  constraint reaction_generation_run_items_content_chk check (jsonb_typeof(content_json) = 'object'),
  constraint reaction_generation_run_items_render_plan_chk check (jsonb_typeof(render_plan_json) = 'object'),
  constraint reaction_generation_run_items_ready_chk check (
    render_status <> 'ready'
    or (rendered_media_asset_id is not null and preview_url ~ '^https?://')
  )
);

create index if not exists reaction_generation_runs_recovery_idx
  on public.reaction_generation_runs (status, updated_at)
  where status in ('queued', 'planning', 'rendering');
create index if not exists reaction_generation_runs_user_profile_idx
  on public.reaction_generation_runs (user_id, business_profile_id, business_profile_version, created_at desc);
create index if not exists reaction_generation_run_items_pending_idx
  on public.reaction_generation_run_items (generation_run_id, slot_index)
  where render_status in ('queued', 'rendering', 'failed');

alter table public.reaction_generation_runs enable row level security;
alter table public.reaction_generation_run_items enable row level security;
revoke all on table public.reaction_generation_runs, public.reaction_generation_run_items
  from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update
  on table public.reaction_generation_runs, public.reaction_generation_run_items
  to postgres, service_role;

create or replace function public.touch_reaction_generation_updated_at()
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

drop trigger if exists reaction_generation_runs_touch_updated_at on public.reaction_generation_runs;
create trigger reaction_generation_runs_touch_updated_at
  before update on public.reaction_generation_runs
  for each row execute function public.touch_reaction_generation_updated_at();

drop trigger if exists reaction_generation_run_items_touch_updated_at on public.reaction_generation_run_items;
create trigger reaction_generation_run_items_touch_updated_at
  before update on public.reaction_generation_run_items
  for each row execute function public.touch_reaction_generation_updated_at();

create or replace function public.ensure_reaction_generation_run_v1(
  p_generation_job_id uuid,
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_project_id text,
  p_request_key text,
  p_requested_count integer,
  p_generation_context jsonb
)
returns setof public.reaction_generation_runs
language plpgsql
set search_path = public
as $$
declare
  run_record public.reaction_generation_runs;
begin
  if p_user_id is null or btrim(p_user_id) = ''
    or p_request_key is null or btrim(p_request_key) = ''
    or p_project_id is null or btrim(p_project_id) = ''
    or p_requested_count not between 1 and 12
    or jsonb_typeof(p_generation_context) <> 'object'
  then
    raise exception 'reaction_generation_request_invalid';
  end if;

  insert into public.reaction_generation_runs (
    generation_job_id, user_id, business_profile_id, business_profile_version,
    project_id, request_key, requested_count, generation_context, status
  ) values (
    p_generation_job_id, p_user_id, p_business_profile_id, p_business_profile_version,
    p_project_id, p_request_key, p_requested_count, p_generation_context, 'queued'
  )
  on conflict (user_id, request_key) do nothing;

  select * into run_record
  from public.reaction_generation_runs
  where user_id = p_user_id and request_key = p_request_key
  for update;

  if run_record.id is null
    or run_record.generation_job_id <> p_generation_job_id
    or run_record.business_profile_id <> p_business_profile_id
    or run_record.business_profile_version <> p_business_profile_version
    or run_record.project_id <> p_project_id
    or run_record.requested_count <> p_requested_count
  then
    raise exception 'reaction_generation_request_conflict';
  end if;

  if run_record.status = 'queued' then
    update public.reaction_generation_runs
    set status = 'planning', failure_message = null
    where id = run_record.id;
  end if;

  return query
  select * from public.reaction_generation_runs where id = run_record.id;
end;
$$;

create or replace function public.persist_reaction_generation_plan_v1(
  p_generation_job_id uuid,
  p_run_id uuid,
  p_user_id text,
  p_brief_payload jsonb,
  p_items jsonb
)
returns table (
  id uuid,
  slot_index integer,
  clip_asset_id uuid,
  background_asset_id uuid,
  primary_reaction text,
  caption text,
  content_json jsonb,
  render_plan_json jsonb,
  title text,
  duration_seconds numeric,
  reaction_creative_id uuid,
  reaction_assignment_id uuid,
  render_status text,
  rendered_media_asset_id uuid,
  preview_url text,
  render_error text
)
language plpgsql
set search_path = public
as $$
declare
  run_record public.reaction_generation_runs;
  item_record record;
  creative_id uuid;
  assignment_id uuid;
  next_position integer;
begin
  select * into run_record
  from public.reaction_generation_runs
  where id = p_run_id and user_id = p_user_id and generation_job_id = p_generation_job_id
  for update;

  if run_record.id is null then
    raise exception 'reaction_generation_run_unavailable';
  end if;

  -- A user/profile gets one planner transaction at a time. Together with the
  -- active-assignment check below, this makes clip reservation race-safe.
  perform pg_advisory_xact_lock(
    hashtext(p_user_id),
    hashtext(run_record.business_profile_id::text || ':' || run_record.business_profile_version::text)
  );

  if exists (
    select 1 from public.reaction_generation_run_items
    where generation_run_id = p_run_id
  ) then
    return query
    select item.id, item.slot_index, item.clip_asset_id, item.background_asset_id,
      item.primary_reaction, item.caption, item.content_json, item.render_plan_json,
      item.title, item.duration_seconds, item.reaction_creative_id,
      item.reaction_assignment_id, item.render_status, item.rendered_media_asset_id,
      item.preview_url, item.render_error
    from public.reaction_generation_run_items as item
    where item.generation_run_id = p_run_id
    order by item.slot_index;
    return;
  end if;

  if jsonb_typeof(p_brief_payload) <> 'object'
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > run_record.requested_count
  then
    raise exception 'reaction_generation_plan_invalid';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as candidate(slot_index integer)
    group by candidate.slot_index
    having count(*) > 1 or min(candidate.slot_index) < 0
  ) then
    raise exception 'reaction_generation_plan_slots_invalid';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as candidate(clip_asset_id uuid)
    group by candidate.clip_asset_id
    having count(*) > 1
  ) then
    raise exception 'reaction_generation_plan_reuses_clip';
  end if;

  select coalesce(max(position), 0) into next_position
  from public.user_reaction_assignments
  where user_id = p_user_id
    and business_profile_id = run_record.business_profile_id
    and business_profile_version = run_record.business_profile_version;

  for item_record in
    select *
    from jsonb_to_recordset(p_items) as candidate(
      slot_index integer,
      clip_asset_id uuid,
      background_asset_id uuid,
      primary_reaction text,
      caption text,
      content_json jsonb,
      render_plan_json jsonb,
      title text,
      duration_seconds numeric
    )
    order by slot_index
  loop
    if item_record.slot_index is null
      or item_record.clip_asset_id is null
      or item_record.background_asset_id is null
      or item_record.primary_reaction is null
      or item_record.caption is null
      or item_record.title is null
      or item_record.duration_seconds is null
      or item_record.duration_seconds <= 0
      or item_record.duration_seconds > 60
      or jsonb_typeof(item_record.content_json) <> 'object'
      or jsonb_typeof(item_record.render_plan_json) <> 'object'
    then
      raise exception 'reaction_generation_plan_item_invalid';
    end if;

    if not exists (
      select 1 from public.reaction_clip_assets as clip
      where clip.id = item_record.clip_asset_id
        and clip.status = 'active'
        and clip.has_alpha
        and item_record.primary_reaction = any(clip.reactions)
    ) or not exists (
      select 1 from public.reaction_background_assets as background
      where background.id = item_record.background_asset_id
        and background.status = 'active'
    ) then
      raise exception 'reaction_generation_plan_asset_unavailable';
    end if;

    if exists (
      select 1
      from public.user_reaction_assignments as assignment
      join public.reaction_creatives as creative
        on creative.id = assignment.reaction_creative_id
      where assignment.user_id = p_user_id
        and assignment.business_profile_id = run_record.business_profile_id
        and assignment.business_profile_version = run_record.business_profile_version
        and assignment.state = 'active'
        and creative.clip_asset_id = item_record.clip_asset_id
        and creative.render_status in ('queued', 'rendering', 'preview_ready')
    ) then
      raise exception 'reaction_generation_plan_clip_reserved';
    end if;

    insert into public.reaction_creatives (
      user_id, business_profile_id, business_profile_version,
      clip_asset_id, background_asset_id, primary_reaction, caption,
      content_json, render_plan_json, title, duration_seconds,
      render_status, render_job_id
    ) values (
      p_user_id, run_record.business_profile_id, run_record.business_profile_version,
      item_record.clip_asset_id, item_record.background_asset_id,
      item_record.primary_reaction, btrim(item_record.caption),
      item_record.content_json, item_record.render_plan_json,
      btrim(item_record.title), item_record.duration_seconds,
      'queued', p_generation_job_id
    ) returning id into creative_id;

    next_position := next_position + 1;
    insert into public.user_reaction_assignments (
      user_id, business_profile_id, business_profile_version,
      reaction_creative_id, position, state
    ) values (
      p_user_id, run_record.business_profile_id, run_record.business_profile_version,
      creative_id, next_position, 'active'
    ) returning id into assignment_id;

    insert into public.reaction_generation_run_items (
      generation_run_id, slot_index, clip_asset_id, background_asset_id,
      primary_reaction, caption, content_json, render_plan_json, title,
      duration_seconds, reaction_creative_id, reaction_assignment_id, render_status
    ) values (
      p_run_id, item_record.slot_index, item_record.clip_asset_id,
      item_record.background_asset_id, item_record.primary_reaction,
      btrim(item_record.caption), item_record.content_json,
      item_record.render_plan_json, btrim(item_record.title),
      item_record.duration_seconds, creative_id, assignment_id, 'queued'
    );
  end loop;

  update public.reaction_generation_runs
  set brief_payload = p_brief_payload, status = 'rendering', failure_message = null
  where id = p_run_id;

  return query
  select item.id, item.slot_index, item.clip_asset_id, item.background_asset_id,
    item.primary_reaction, item.caption, item.content_json, item.render_plan_json,
    item.title, item.duration_seconds, item.reaction_creative_id,
    item.reaction_assignment_id, item.render_status, item.rendered_media_asset_id,
    item.preview_url, item.render_error
  from public.reaction_generation_run_items as item
  where item.generation_run_id = p_run_id
  order by item.slot_index;
end;
$$;

create or replace function public.complete_reaction_generation_item_render_v1(
  p_generation_job_id uuid,
  p_item_id uuid,
  p_user_id text,
  p_media_asset_id uuid,
  p_preview_url text
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  item_record public.reaction_generation_run_items;
begin
  select item.* into item_record
  from public.reaction_generation_run_items as item
  join public.reaction_generation_runs as run on run.id = item.generation_run_id
  where item.id = p_item_id
    and run.generation_job_id = p_generation_job_id
    and run.user_id = p_user_id
  for update;

  if item_record.id is null then
    raise exception 'reaction_generation_item_unavailable';
  end if;

  update public.reaction_generation_run_items
  set render_status = 'ready', rendered_media_asset_id = p_media_asset_id,
      preview_url = p_preview_url, render_error = null
  where id = item_record.id and render_status in ('queued', 'rendering', 'ready', 'failed');

  update public.reaction_creatives
  set render_status = 'preview_ready', rendered_media_asset_id = p_media_asset_id,
      preview_url = p_preview_url, thumbnail_url = null, render_error = null
  where id = item_record.reaction_creative_id
    and user_id = p_user_id
    and render_job_id = p_generation_job_id
    and render_status in ('queued', 'rendering', 'preview_ready', 'failed');

  return found;
end;
$$;

create or replace function public.fail_reaction_generation_item_render_v1(
  p_generation_job_id uuid,
  p_item_id uuid,
  p_user_id text,
  p_error_message text
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  item_record public.reaction_generation_run_items;
begin
  select item.* into item_record
  from public.reaction_generation_run_items as item
  join public.reaction_generation_runs as run on run.id = item.generation_run_id
  where item.id = p_item_id and run.generation_job_id = p_generation_job_id and run.user_id = p_user_id
  for update;

  if item_record.id is null then
    raise exception 'reaction_generation_item_unavailable';
  end if;

  update public.reaction_generation_run_items
  set render_status = 'failed', render_error = left(coalesce(nullif(btrim(p_error_message), ''), 'Reaction render failed.'), 1000)
  where id = item_record.id and render_status in ('queued', 'rendering', 'failed');

  update public.reaction_creatives
  set render_status = 'failed', render_error = left(coalesce(nullif(btrim(p_error_message), ''), 'Reaction render failed.'), 1000)
  where id = item_record.reaction_creative_id and user_id = p_user_id and render_job_id = p_generation_job_id
    and render_status in ('queued', 'rendering', 'failed');

  return found;
end;
$$;

create or replace function public.complete_reaction_generation_run_v1(
  p_generation_job_id uuid,
  p_run_id uuid,
  p_user_id text
)
returns table (ready_count integer, failed_count integer, status text)
language plpgsql
set search_path = public
as $$
declare
  run_record public.reaction_generation_runs;
  current_ready_count integer;
  current_failed_count integer;
  next_status text;
begin
  select * into run_record
  from public.reaction_generation_runs
  where id = p_run_id and generation_job_id = p_generation_job_id and user_id = p_user_id
  for update;

  if run_record.id is null then
    raise exception 'reaction_generation_run_unavailable';
  end if;

  select
    count(*) filter (where render_status = 'ready'),
    count(*) filter (where render_status = 'failed')
  into current_ready_count, current_failed_count
  from public.reaction_generation_run_items
  where generation_run_id = p_run_id;

  next_status := case
    when current_ready_count = 0 then 'failed'
    when current_ready_count < run_record.requested_count or current_failed_count > 0 then 'partial'
    else 'completed'
  end;

  update public.reaction_generation_runs
  set status = next_status,
      failure_message = case
        when current_ready_count = 0 then 'No Reaction Reels could be rendered.'
        when current_failed_count > 0 then 'One or more Reaction Reels could not be rendered.'
        when current_ready_count < run_record.requested_count then 'The approved Reaction catalog could not cover every requested Reel.'
        else null
      end
  where id = p_run_id;

  return query select current_ready_count, current_failed_count, next_status;
end;
$$;

create or replace function public.fail_reaction_generation_run_v1(
  p_generation_job_id uuid,
  p_user_id text,
  p_error_message text
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  run_record public.reaction_generation_runs;
  failure text := left(coalesce(nullif(btrim(p_error_message), ''), 'Reaction generation failed.'), 1000);
begin
  select * into run_record
  from public.reaction_generation_runs
  where generation_job_id = p_generation_job_id and user_id = p_user_id
  for update;

  if run_record.id is null then
    return false;
  end if;

  update public.reaction_generation_run_items
  set render_status = 'failed', render_error = failure
  where generation_run_id = run_record.id
    and render_status in ('queued', 'rendering');

  update public.reaction_creatives as creative
  set render_status = 'failed', render_error = failure
  from public.reaction_generation_run_items as item
  where item.generation_run_id = run_record.id
    and item.reaction_creative_id = creative.id
    and creative.user_id = p_user_id
    and creative.render_status in ('queued', 'rendering');

  update public.reaction_generation_runs
  set status = 'failed', failure_message = failure
  where id = run_record.id;

  return true;
end;
$$;

revoke all on function public.ensure_reaction_generation_run_v1(uuid, text, uuid, integer, text, text, integer, jsonb) from public;
revoke all on function public.persist_reaction_generation_plan_v1(uuid, uuid, text, jsonb, jsonb) from public;
revoke all on function public.complete_reaction_generation_item_render_v1(uuid, uuid, text, uuid, text) from public;
revoke all on function public.fail_reaction_generation_item_render_v1(uuid, uuid, text, text) from public;
revoke all on function public.complete_reaction_generation_run_v1(uuid, uuid, text) from public;
revoke all on function public.fail_reaction_generation_run_v1(uuid, text, text) from public;
grant execute on function public.ensure_reaction_generation_run_v1(uuid, text, uuid, integer, text, text, integer, jsonb) to postgres, service_role;
grant execute on function public.persist_reaction_generation_plan_v1(uuid, uuid, text, jsonb, jsonb) to postgres, service_role;
grant execute on function public.complete_reaction_generation_item_render_v1(uuid, uuid, text, uuid, text) to postgres, service_role;
grant execute on function public.fail_reaction_generation_item_render_v1(uuid, uuid, text, text) to postgres, service_role;
grant execute on function public.complete_reaction_generation_run_v1(uuid, uuid, text) to postgres, service_role;
grant execute on function public.fail_reaction_generation_run_v1(uuid, text, text) to postgres, service_role;

comment on table public.reaction_generation_runs is
  'Durable per-request Reaction planner state. Validated briefs and chosen pairs are saved before rendering.';
comment on table public.reaction_generation_run_items is
  'One immutable selected Reaction creative per requested slot with independent persisted render outcome.';

select pg_notify('pgrst', 'reload schema');
