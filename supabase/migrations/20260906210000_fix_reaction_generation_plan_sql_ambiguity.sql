-- The original function returns a column named `id`, which is also a
-- PL/pgSQL output variable. Make table-column precedence explicit so a plan
-- can be persisted instead of failing before any creatives are inserted.
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
#variable_conflict use_column
declare
  run_record public.reaction_generation_runs;
  item_record record;
  creative_id uuid;
  assignment_id uuid;
  next_position integer;
begin
  select run.* into run_record
  from public.reaction_generation_runs as run
  where run.id = p_run_id
    and run.user_id = p_user_id
    and run.generation_job_id = p_generation_job_id
  for update;

  if run_record.id is null then
    raise exception 'reaction_generation_run_unavailable';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_user_id),
    hashtext(run_record.business_profile_id::text || ':' || run_record.business_profile_version::text)
  );

  if exists (
    select 1 from public.reaction_generation_run_items as existing_item
    where existing_item.generation_run_id = p_run_id
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

  select coalesce(max(assignment.position), 0) into next_position
  from public.user_reaction_assignments as assignment
  where assignment.user_id = p_user_id
    and assignment.business_profile_id = run_record.business_profile_id
    and assignment.business_profile_version = run_record.business_profile_version;

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
    order by candidate.slot_index
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

    insert into public.reaction_creatives as creative (
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
    ) returning creative.id into creative_id;

    next_position := next_position + 1;
    insert into public.user_reaction_assignments as assignment (
      user_id, business_profile_id, business_profile_version,
      reaction_creative_id, position, state
    ) values (
      p_user_id, run_record.business_profile_id, run_record.business_profile_version,
      creative_id, next_position, 'active'
    ) returning assignment.id into assignment_id;

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

  update public.reaction_generation_runs as run
  set brief_payload = p_brief_payload, status = 'rendering', failure_message = null
  where run.id = p_run_id;

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
