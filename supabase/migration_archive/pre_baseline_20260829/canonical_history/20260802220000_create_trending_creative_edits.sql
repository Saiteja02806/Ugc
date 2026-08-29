alter table public.background_jobs
  drop constraint if exists background_jobs_job_type_check;

alter table public.background_jobs
  add constraint background_jobs_job_type_check
  check (
    job_type in (
      'hook_text_generation',
      'wall_text_generation',
      'carousel_generation',
      'image_generation',
      'video_generation',
      'preview_render',
      'final_render',
      'media_analysis',
      'social_publish',
      'analytics_sync',
      'generate_avatar',
      'generate_carousel',
      'generate_hook_video',
      'generate_image',
      'generate_thumbnail',
      'generate_trending_hook_copy',
      'extract_video_metadata',
      'publish_social_post',
      'render_demo_video',
      'render_edit_video',
      'render_schedule_combination',
      'render_trending_carousel_edit',
      'render_wall_text_video',
      'test_worker_job'
    )
  );

create table if not exists public.trending_creative_edits (
  id uuid primary key default gen_random_uuid(),
  user_id text not null
    check (
      char_length(btrim(user_id)) > 0
      and char_length(btrim(user_id)) <= 200
    ),
  assignment_id uuid not null,
  creative_id uuid not null,
  format text not null
    check (format in ('carousel', 'hook_video', 'wall_text')),
  revision integer not null default 1
    check (revision > 0),
  content_json jsonb not null
    check (jsonb_typeof(content_json) = 'object'),
  position_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(position_json) = 'object'),
  source_selection_kind text
    check (
      source_selection_kind is null
      or source_selection_kind in ('asset', 'group')
    ),
  source_group_id uuid
    references public.creative_asset_groups(id) on delete restrict,
  source_media_asset_id uuid
    references public.media_assets(id) on delete restrict,
  resolved_media_asset_id uuid
    references public.media_assets(id) on delete restrict,
  render_status text not null default 'draft'
    check (render_status in ('draft', 'queued', 'rendering', 'ready', 'failed')),
  render_job_id uuid
    references public.background_jobs(id) on delete set null,
  render_output_json jsonb
    check (
      render_output_json is null
      or jsonb_typeof(render_output_json) = 'object'
    ),
  render_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trending_creative_edits_owner_creative_key unique (
    user_id,
    format,
    creative_id
  ),
  constraint trending_creative_edits_assignment_key unique (
    format,
    assignment_id
  ),
  constraint trending_creative_edits_content_format_check check (
    content_json ->> 'format' = format
  ),
  constraint trending_creative_edits_source_shape_check check (
    (
      source_selection_kind is null
      and source_group_id is null
      and source_media_asset_id is null
      and resolved_media_asset_id is null
    )
    or (
      source_selection_kind = 'asset'
      and source_group_id is null
      and source_media_asset_id is not null
      and resolved_media_asset_id = source_media_asset_id
    )
    or (
      source_selection_kind = 'group'
      and source_group_id is not null
      and source_media_asset_id is null
      and resolved_media_asset_id is not null
    )
  ),
  constraint trending_creative_edits_carousel_source_check check (
    format <> 'carousel' or source_selection_kind is null
  ),
  constraint trending_creative_edits_queued_job_check check (
    render_status not in ('queued', 'rendering') or render_job_id is not null
  ),
  constraint trending_creative_edits_ready_output_check check (
    render_status <> 'ready' or render_output_json is not null
  )
);

create index if not exists trending_creative_edits_owner_updated_idx
  on public.trending_creative_edits (user_id, updated_at desc);

create index if not exists trending_creative_edits_render_job_idx
  on public.trending_creative_edits (render_job_id)
  where render_job_id is not null;

create or replace function public.validate_trending_creative_edit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  assignment_is_valid boolean := false;
  source_is_valid boolean := false;
begin
  new.user_id := btrim(new.user_id);
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
      or new.assignment_id is distinct from old.assignment_id
      or new.creative_id is distinct from old.creative_id
      or new.format is distinct from old.format
    then
      raise exception 'trending_creative_edit_scope_immutable'
        using errcode = '42501';
    end if;

    if new.revision < old.revision then
      raise exception 'trending_creative_edit_revision_regressed'
        using errcode = '23514';
    end if;
  end if;

  case new.format
    when 'carousel' then
      select exists (
        select 1
        from public.user_carousel_assignments as assignment
        where assignment.id = new.assignment_id
          and assignment.user_id = new.user_id
          and assignment.carousel_id = new.creative_id
          and assignment.state in ('pending', 'in_progress', 'accepted')
      ) into assignment_is_valid;
    when 'hook_video' then
      select exists (
        select 1
        from public.user_hook_video_assignments as assignment
        where assignment.id = new.assignment_id
          and assignment.user_id = new.user_id
          and assignment.hook_suggestion_id = new.creative_id
          and assignment.state in ('active', 'selected')
      ) into assignment_is_valid;
    when 'wall_text' then
      select exists (
        select 1
        from public.user_wall_text_assignments as assignment
        where assignment.id = new.assignment_id
          and assignment.user_id = new.user_id
          and assignment.wall_text_creative_id = new.creative_id
          and assignment.state in ('active', 'selected')
      ) into assignment_is_valid;
  end case;

  if not coalesce(assignment_is_valid, false) then
    raise exception 'trending_creative_edit_assignment_unavailable'
      using errcode = '42501';
  end if;

  if new.source_selection_kind = 'asset' then
    select exists (
      select 1
      from public.media_assets as asset
      where asset.id = new.resolved_media_asset_id
        and asset.user_id = new.user_id
        and asset.collection in ('video', 'influencer')
        and asset.mime_type like 'video/%'
        and asset.status = 'ready'
        and asset.deleted_at is null
    ) into source_is_valid;
  elsif new.source_selection_kind = 'group' then
    select exists (
      select 1
      from public.creative_asset_groups as asset_group
      join public.creative_asset_group_items as group_item
        on group_item.group_id = asset_group.id
       and group_item.user_id = asset_group.user_id
      join public.media_assets as asset
        on asset.id = group_item.media_asset_id
       and asset.user_id = asset_group.user_id
      where asset_group.id = new.source_group_id
        and asset_group.user_id = new.user_id
        and asset_group.media_type = 'video'
        and asset.id = new.resolved_media_asset_id
        and asset.collection in ('video', 'influencer')
        and asset.mime_type like 'video/%'
        and asset.status = 'ready'
        and asset.deleted_at is null
    ) into source_is_valid;
  else
    source_is_valid := true;
  end if;

  if not coalesce(source_is_valid, false) then
    raise exception 'trending_creative_edit_source_unavailable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_trending_creative_edit_row
  on public.trending_creative_edits;

create trigger validate_trending_creative_edit_row
before insert or update on public.trending_creative_edits
for each row
execute function public.validate_trending_creative_edit();

alter table public.trending_creative_edits enable row level security;

revoke all privileges on table public.trending_creative_edits
  from public, anon, authenticated;
grant select, insert, update, delete on table public.trending_creative_edits
  to service_role;

revoke all on function public.validate_trending_creative_edit()
  from public, anon, authenticated;
grant execute on function public.validate_trending_creative_edit()
  to service_role;

alter table public.user_wall_text_assignments
  add column if not exists render_edit_id uuid
    references public.trending_creative_edits(id) on delete restrict,
  add column if not exists render_edit_revision integer;

alter table public.user_wall_text_assignments
  drop constraint if exists user_wall_text_assignments_render_edit_check;

alter table public.user_wall_text_assignments
  add constraint user_wall_text_assignments_render_edit_check check (
    (
      render_edit_id is null
      and render_edit_revision is null
    )
    or (
      render_edit_id is not null
      and render_edit_revision is not null
      and render_edit_revision > 0
    )
  );

drop function if exists public.claim_wall_text_render(uuid, text);

create function public.claim_wall_text_render(
  p_assignment_id uuid,
  p_user_id text,
  p_edit_id uuid default null,
  p_edit_revision integer default null
)
returns setof public.user_wall_text_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed public.user_wall_text_assignments;
  requested_at timestamptz := now();
begin
  if p_assignment_id is null
    or char_length(btrim(coalesce(p_user_id, ''))) = 0
    or ((p_edit_id is null) <> (p_edit_revision is null))
    or (p_edit_revision is not null and p_edit_revision <= 0)
  then
    raise exception 'wall_text_render_invalid_scope';
  end if;

  if p_edit_id is not null and not exists (
    select 1
    from public.trending_creative_edits as edit
    where edit.id = p_edit_id
      and edit.user_id = btrim(p_user_id)
      and edit.assignment_id = p_assignment_id
      and edit.format = 'wall_text'
      and edit.revision = p_edit_revision
  ) then
    raise exception 'wall_text_render_edit_unavailable';
  end if;

  select assignment.*
  into claimed
  from public.user_wall_text_assignments as assignment
  where assignment.id = p_assignment_id
    and assignment.user_id = btrim(p_user_id)
    and assignment.state in ('active', 'selected')
  for update;

  if not found then
    raise exception 'wall_text_render_assignment_unavailable';
  end if;

  if claimed.render_status in ('queued', 'rendering', 'ready')
    and claimed.render_id is not null
    and claimed.render_edit_id is not distinct from p_edit_id
    and claimed.render_edit_revision is not distinct from p_edit_revision
  then
    if claimed.state = 'active' then
      update public.user_wall_text_assignments
      set
        completed_at = coalesce(completed_at, requested_at),
        last_opened_at = requested_at,
        state = 'selected',
        updated_at = requested_at
      where id = claimed.id
      returning * into claimed;
    end if;

    return next claimed;
    return;
  end if;

  update public.user_wall_text_assignments
  set
    completed_at = coalesce(completed_at, requested_at),
    last_opened_at = requested_at,
    render_edit_id = p_edit_id,
    render_edit_revision = p_edit_revision,
    render_error = null,
    render_id = gen_random_uuid(),
    render_job_id = null,
    render_requested_at = requested_at,
    render_status = 'queued',
    rendered_at = null,
    rendered_media_asset_id = null,
    state = 'selected',
    updated_at = requested_at
  where id = claimed.id
  returning * into claimed;

  return next claimed;
end;
$$;

revoke all on function public.claim_wall_text_render(uuid, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_wall_text_render(uuid, text, uuid, integer)
  to service_role;

create or replace function public.save_generated_carousel_library_item(
  p_user_id text,
  p_project_id text,
  p_source_id text,
  p_title text,
  p_cover_url text,
  p_thumbnail_url text,
  p_metadata jsonb,
  p_slides jsonb
)
returns table(item_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_id uuid;
  v_slide jsonb;
  v_created boolean := false;
begin
  select item.id
  into v_item_id
  from public.library_items as item
  where item.user_id = p_user_id
    and item.source_type = 'generated_carousel'
    and item.source_id = p_source_id
    and item.deleted_at is null
  limit 1
  for update;

  if v_item_id is null then
    insert into public.library_items (
      user_id,
      project_id,
      source_type,
      source_id,
      media_type,
      title,
      cover_url,
      thumbnail_url,
      metadata
    )
    values (
      p_user_id,
      p_project_id,
      'generated_carousel',
      p_source_id,
      'carousel',
      p_title,
      p_cover_url,
      p_thumbnail_url,
      coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into v_item_id;

    v_created := true;
  else
    update public.library_items
    set
      cover_url = p_cover_url,
      metadata = coalesce(p_metadata, '{}'::jsonb),
      project_id = p_project_id,
      status = 'ready',
      thumbnail_url = p_thumbnail_url,
      title = p_title,
      updated_at = now()
    where id = v_item_id;

    delete from public.library_carousel_slides
    where library_item_id = v_item_id;
  end if;

  for v_slide in
    select value
    from jsonb_array_elements(coalesce(p_slides, '[]'::jsonb))
  loop
    insert into public.library_carousel_slides (
      library_item_id,
      carousel_generation_id,
      carousel_slide_id,
      slide_number,
      slide_type,
      headline,
      subtext,
      rendered_url,
      rendered_s3_key,
      metadata
    )
    values (
      v_item_id,
      (v_slide ->> 'carouselGenerationId')::uuid,
      nullif(v_slide ->> 'carouselSlideId', '')::uuid,
      (v_slide ->> 'slideNumber')::integer,
      nullif(v_slide ->> 'slideType', ''),
      nullif(v_slide ->> 'headline', ''),
      nullif(v_slide ->> 'subtext', ''),
      v_slide ->> 'renderedUrl',
      nullif(v_slide ->> 'renderedS3Key', ''),
      coalesce(v_slide -> 'metadata', '{}'::jsonb)
    );
  end loop;

  return query select v_item_id, v_created;
end;
$$;

revoke all on function public.save_generated_carousel_library_item(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) from public, anon, authenticated;
grant execute on function public.save_generated_carousel_library_item(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) to service_role;

select pg_notify('pgrst', 'reload schema');
