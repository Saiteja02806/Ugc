-- The Wall-of-Text plan is private generation context. It is intentionally
-- separate from Carousel planning and does not replace the established Wall
-- writer, measured layout, source, audio, or rendering contracts.

alter table public.background_jobs
  drop constraint if exists background_jobs_job_type_check;

alter table public.background_jobs
  add constraint background_jobs_job_type_check
  check (
    job_type in (
      'hook_text_generation',
      'wall_text_generation',
      'wall_text_content_plan_generation',
      'carousel_generation',
      'carousel_content_plan_generation',
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

create table if not exists public.wall_text_content_plans (
  id uuid primary key default gen_random_uuid(),
  user_id text not null
    check (char_length(btrim(user_id)) between 1 and 240),
  project_id text not null
    check (char_length(btrim(project_id)) between 1 and 240),
  business_profile_id uuid not null
    references public.business_profiles(id) on delete cascade,
  business_profile_version integer not null
    check (business_profile_version > 0),
  period_start_date date not null,
  period_end_date date not null
    check (period_end_date = period_start_date + 29),
  timezone text not null
    check (char_length(btrim(timezone)) between 1 and 120),
  plan_version integer not null
    check (plan_version > 0),
  business_description text not null
    check (char_length(btrim(business_description)) between 12 and 4000),
  planning_context jsonb not null
    check (jsonb_typeof(planning_context) = 'object'),
  target_item_count integer not null default 200
    check (target_item_count = 200),
  planner_model text not null
    check (char_length(btrim(planner_model)) between 1 and 120),
  planner_prompt_version text not null
    check (char_length(btrim(planner_prompt_version)) between 1 and 160),
  status text not null default 'generating'
    check (status in ('generating', 'active', 'failed', 'superseded')),
  generation_job_id uuid
    references public.background_jobs(id) on delete set null,
  generation_started_at timestamptz,
  generation_completed_at timestamptz,
  activated_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  superseded_at timestamptz,
  superseded_by_plan_id uuid
    references public.wall_text_content_plans(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  unique (
    user_id,
    business_profile_id,
    business_profile_version,
    period_start_date,
    plan_version
  )
);

create unique index if not exists wall_text_content_plans_generation_job_uidx
  on public.wall_text_content_plans (generation_job_id)
  where generation_job_id is not null;

create index if not exists wall_text_content_plans_current_idx
  on public.wall_text_content_plans (
    user_id,
    business_profile_id,
    business_profile_version,
    status,
    period_start_date desc
  );

create table if not exists public.wall_text_content_plan_briefs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id text not null
    check (char_length(btrim(user_id)) between 1 and 240),
  brief_index smallint not null
    check (brief_index between 1 and 40),
  creative_seed text not null
    check (char_length(btrim(creative_seed)) between 12 and 400),
  audience_context text not null
    check (char_length(btrim(audience_context)) between 2 and 240),
  human_moment text not null
    check (char_length(btrim(human_moment)) between 12 and 400),
  emotional_tension text not null
    check (char_length(btrim(emotional_tension)) between 2 and 160),
  supported_angle text not null
    check (char_length(btrim(supported_angle)) between 12 and 400),
  preferred_format_family text not null
    check (
      preferred_format_family in (
        'common_problem',
        'contrast',
        'emotional_observation',
        'practical_reframe',
        'relatable_situation',
        'small_story'
      )
    ),
  brief_fingerprint text not null
    check (brief_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (plan_id, user_id)
    references public.wall_text_content_plans (id, user_id)
    on delete cascade,
  unique (id, plan_id, user_id),
  unique (plan_id, brief_index),
  unique (plan_id, brief_fingerprint)
);

create index if not exists wall_text_content_plan_briefs_plan_idx
  on public.wall_text_content_plan_briefs (plan_id, brief_index);

create table if not exists public.wall_text_content_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id text not null
    check (char_length(btrim(user_id)) between 1 and 240),
  creative_brief_id uuid not null,
  sequence_index integer not null
    check (sequence_index between 1 and 200),
  content_idea text not null
    check (char_length(btrim(content_idea)) between 12 and 400),
  feeling text not null
    check (char_length(btrim(feeling)) between 2 and 120),
  idea_fingerprint text not null
    check (idea_fingerprint ~ '^[a-f0-9]{64}$'),
  status text not null default 'available'
    check (status in ('available', 'reserved', 'consumed', 'retired')),
  reserved_at timestamptz,
  consumed_at timestamptz,
  retired_at timestamptz,
  retirement_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (plan_id, user_id)
    references public.wall_text_content_plans (id, user_id)
    on delete cascade,
  foreign key (creative_brief_id, plan_id, user_id)
    references public.wall_text_content_plan_briefs (id, plan_id, user_id)
    on delete restrict
    deferrable initially deferred,
  unique (id, plan_id, user_id),
  unique (plan_id, sequence_index),
  unique (plan_id, idea_fingerprint)
);

create index if not exists wall_text_content_plan_items_available_idx
  on public.wall_text_content_plan_items (plan_id, sequence_index)
  where status = 'available';

alter table public.wall_text_generation_assignments
  add column if not exists wall_text_content_plan_id uuid,
  add column if not exists wall_text_content_plan_item_id uuid;

alter table public.wall_text_generation_assignments
  drop constraint if exists wall_text_generation_assignments_content_plan_pair_chk,
  drop constraint if exists wall_text_generation_assignments_content_plan_fkey,
  drop constraint if exists wall_text_generation_assignments_content_plan_item_fkey;

alter table public.wall_text_generation_assignments
  add constraint wall_text_generation_assignments_content_plan_pair_chk
    check (
      (wall_text_content_plan_id is null)
      = (wall_text_content_plan_item_id is null)
    ),
  add constraint wall_text_generation_assignments_content_plan_fkey
    foreign key (wall_text_content_plan_id)
    references public.wall_text_content_plans(id)
    on delete restrict,
  add constraint wall_text_generation_assignments_content_plan_item_fkey
    foreign key (wall_text_content_plan_item_id)
    references public.wall_text_content_plan_items(id)
    on delete restrict;

create unique index if not exists wall_text_generation_assignments_plan_item_uidx
  on public.wall_text_generation_assignments (wall_text_content_plan_item_id)
  where wall_text_content_plan_item_id is not null;

create or replace function public.ensure_wall_text_content_plan(
  p_user_id text,
  p_project_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_timezone text,
  p_business_description text,
  p_planning_context jsonb,
  p_target_item_count integer,
  p_planner_model text,
  p_planner_prompt_version text
)
returns public.wall_text_content_plans
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current_date date;
  v_next_plan_version integer;
  v_plan public.wall_text_content_plans%rowtype;
begin
  if nullif(btrim(coalesce(p_user_id, '')), '') is null
     or nullif(btrim(coalesce(p_project_id, '')), '') is null
     or p_business_profile_id is null
     or p_business_profile_version is null
     or p_business_profile_version <= 0
     or nullif(btrim(coalesce(p_timezone, '')), '') is null
     or nullif(btrim(coalesce(p_business_description, '')), '') is null
     or char_length(btrim(p_business_description)) > 4000
     or p_planning_context is null
     or jsonb_typeof(p_planning_context) <> 'object'
     or p_target_item_count <> 200
     or nullif(btrim(coalesce(p_planner_model, '')), '') is null
     or nullif(btrim(coalesce(p_planner_prompt_version, '')), '') is null then
    raise exception 'wall_text_content_plan_ensure_input_invalid';
  end if;

  begin
    v_current_date := timezone(btrim(p_timezone), timezone('utc', now()))::date;
  exception
    when invalid_parameter_value then
      raise exception 'wall_text_content_plan_timezone_invalid';
  end;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'wall-text-content-plan:' || p_user_id || ':' || p_business_profile_id::text,
      819325101
    )
  );

  perform 1
  from public.business_profiles as profile
  where profile.id = p_business_profile_id
    and profile.user_id = p_user_id
    and profile.project_id = p_project_id
    and profile.profile_version = p_business_profile_version
  for share;
  if not found then
    raise exception 'business_profile_version_changed';
  end if;

  select plan.* into v_plan
  from public.wall_text_content_plans as plan
  where plan.user_id = p_user_id
    and plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.status in ('generating', 'active')
    and v_current_date between plan.period_start_date and plan.period_end_date
  order by plan.plan_version desc
  limit 1
  for update;

  if found then
    return v_plan;
  end if;

  select coalesce(max(plan.plan_version), 0) + 1 into v_next_plan_version
  from public.wall_text_content_plans as plan
  where plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.period_start_date = v_current_date;

  insert into public.wall_text_content_plans (
    user_id, project_id, business_profile_id, business_profile_version,
    period_start_date, period_end_date, timezone, plan_version,
    business_description, planning_context, target_item_count,
    planner_model, planner_prompt_version
  ) values (
    p_user_id, p_project_id, p_business_profile_id, p_business_profile_version,
    v_current_date, v_current_date + 29, btrim(p_timezone), v_next_plan_version,
    btrim(p_business_description), p_planning_context, p_target_item_count,
    btrim(p_planner_model), btrim(p_planner_prompt_version)
  ) returning * into v_plan;

  return v_plan;
end;
$$;

create or replace function public.attach_wall_text_content_plan_generation_job(
  p_user_id text,
  p_plan_id uuid,
  p_job_id uuid
)
returns public.wall_text_content_plans
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan public.wall_text_content_plans%rowtype;
begin
  select plan.* into v_plan
  from public.wall_text_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id
    and plan.status = 'generating'
  for update;
  if not found then
    raise exception 'wall_text_content_plan_not_generating';
  end if;

  perform 1
  from public.background_jobs as job
  where job.id = p_job_id
    and job.user_id = p_user_id
    and job.job_type = 'wall_text_content_plan_generation'
    and job.input_json ->> 'planId' = p_plan_id::text
  for share;
  if not found then
    raise exception 'wall_text_content_plan_generation_job_mismatch';
  end if;

  if v_plan.generation_job_id is not null
     and v_plan.generation_job_id <> p_job_id then
    raise exception 'wall_text_content_plan_generation_job_conflict';
  end if;

  update public.wall_text_content_plans as plan
  set
    generation_job_id = p_job_id,
    generation_started_at = coalesce(plan.generation_started_at, timezone('utc', now())),
    updated_at = timezone('utc', now())
  where plan.id = p_plan_id
  returning plan.* into v_plan;

  return v_plan;
end;
$$;

create or replace function public.persist_wall_text_content_plan_brief_chunk(
  p_user_id text,
  p_plan_id uuid,
  p_briefs jsonb,
  p_items jsonb
)
returns setof public.wall_text_content_plan_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_brief_count integer;
  v_existing_item_count integer;
  v_invalid_item_count integer;
  v_plan public.wall_text_content_plans%rowtype;
begin
  if nullif(btrim(coalesce(p_user_id, '')), '') is null
     or p_plan_id is null
     or p_briefs is null
     or p_items is null
     or jsonb_typeof(p_briefs) <> 'array'
     or jsonb_typeof(p_items) <> 'array' then
    raise exception 'wall_text_content_plan_chunk_input_invalid';
  end if;

  select plan.* into v_plan
  from public.wall_text_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id
    and plan.status = 'generating'
  for update;
  if not found then
    raise exception 'wall_text_content_plan_not_generating';
  end if;

  select count(*)::integer into v_brief_count
  from jsonb_to_recordset(p_briefs) as brief(
    brief_index integer,
    creative_seed text,
    audience_context text,
    human_moment text,
    emotional_tension text,
    supported_angle text,
    preferred_format_family text,
    brief_fingerprint text
  );

  if v_brief_count not between 1 and 5
     or jsonb_array_length(p_items) <> v_brief_count * 5 then
    raise exception 'wall_text_content_plan_chunk_shape_invalid';
  end if;

  select count(*)::integer into v_invalid_item_count
  from (
    select item.brief_index
    from jsonb_to_recordset(p_items) as item(
      brief_index integer,
      content_idea text,
      feeling text,
      sequence_index integer,
      idea_fingerprint text
    )
    group by item.brief_index
    having count(*) <> 5
  ) as invalid_items;

  if v_invalid_item_count <> 0 or exists (
    select 1
    from jsonb_to_recordset(p_items) as item(
      brief_index integer,
      content_idea text,
      feeling text,
      sequence_index integer,
      idea_fingerprint text
    )
    left join jsonb_to_recordset(p_briefs) as brief(
      brief_index integer,
      creative_seed text,
      audience_context text,
      human_moment text,
      emotional_tension text,
      supported_angle text,
      preferred_format_family text,
      brief_fingerprint text
    ) using (brief_index)
    where brief.brief_index is null
  ) then
    raise exception 'wall_text_content_plan_chunk_parent_invalid';
  end if;

  select count(*)::integer into v_existing_item_count
  from public.wall_text_content_plan_items as item
  where item.plan_id = p_plan_id;
  if v_existing_item_count + jsonb_array_length(p_items) > v_plan.target_item_count then
    raise exception 'wall_text_content_plan_chunk_exceeds_target';
  end if;

  insert into public.wall_text_content_plan_briefs (
    plan_id, user_id, brief_index, creative_seed, audience_context,
    human_moment, emotional_tension, supported_angle,
    preferred_format_family, brief_fingerprint
  )
  select
    p_plan_id, p_user_id, brief.brief_index, btrim(brief.creative_seed),
    btrim(brief.audience_context), btrim(brief.human_moment),
    btrim(brief.emotional_tension), btrim(brief.supported_angle),
    btrim(brief.preferred_format_family), btrim(brief.brief_fingerprint)
  from jsonb_to_recordset(p_briefs) as brief(
    brief_index integer,
    creative_seed text,
    audience_context text,
    human_moment text,
    emotional_tension text,
    supported_angle text,
    preferred_format_family text,
    brief_fingerprint text
  );

  return query
  with inserted as (
    insert into public.wall_text_content_plan_items (
      plan_id, user_id, creative_brief_id, sequence_index,
      content_idea, feeling, idea_fingerprint, status
    )
    select
      p_plan_id, p_user_id, brief.id, item.sequence_index,
      btrim(item.content_idea), btrim(item.feeling),
      btrim(item.idea_fingerprint), 'available'
    from jsonb_to_recordset(p_items) as item(
      brief_index integer,
      content_idea text,
      feeling text,
      sequence_index integer,
      idea_fingerprint text
    )
    join public.wall_text_content_plan_briefs as brief
      on brief.plan_id = p_plan_id
      and brief.user_id = p_user_id
      and brief.brief_index = item.brief_index
    returning *
  )
  select * from inserted order by sequence_index;
end;
$$;

create or replace function public.complete_wall_text_content_plan_generation(
  p_user_id text,
  p_plan_id uuid,
  p_job_id uuid
)
returns public.wall_text_content_plans
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_brief_count integer;
  v_invalid_item_count integer;
  v_item_count integer;
  v_plan public.wall_text_content_plans%rowtype;
begin
  select plan.* into v_plan
  from public.wall_text_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id
    and plan.generation_job_id = p_job_id
  for update;
  if not found then
    raise exception 'wall_text_content_plan_completion_mismatch';
  end if;
  if v_plan.status = 'active' then
    return v_plan;
  end if;
  if v_plan.status <> 'generating' then
    raise exception 'wall_text_content_plan_not_generating';
  end if;

  select count(*)::integer into v_brief_count
  from public.wall_text_content_plan_briefs as brief
  where brief.plan_id = p_plan_id and brief.user_id = p_user_id;
  select count(*)::integer into v_item_count
  from public.wall_text_content_plan_items as item
  where item.plan_id = p_plan_id and item.user_id = p_user_id;
  select count(*)::integer into v_invalid_item_count
  from (
    select item.creative_brief_id
    from public.wall_text_content_plan_items as item
    where item.plan_id = p_plan_id and item.user_id = p_user_id
    group by item.creative_brief_id
    having count(*) <> 5
  ) as invalid_items;
  if v_brief_count <> 40
     or v_item_count <> v_plan.target_item_count
     or v_invalid_item_count <> 0 then
    raise exception 'wall_text_content_plan_incomplete';
  end if;

  update public.wall_text_content_plans as prior_plan
  set
    status = 'superseded',
    superseded_at = timezone('utc', now()),
    superseded_by_plan_id = p_plan_id,
    updated_at = timezone('utc', now())
  where prior_plan.user_id = p_user_id
    and prior_plan.business_profile_id = v_plan.business_profile_id
    and prior_plan.id <> p_plan_id
    and prior_plan.status = 'active';

  update public.wall_text_content_plans as plan
  set
    status = 'active',
    activated_at = timezone('utc', now()),
    generation_completed_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where plan.id = p_plan_id
  returning plan.* into v_plan;
  return v_plan;
end;
$$;

create or replace function public.reserve_wall_text_generation_batch_v1(
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_request_key text,
  p_request_hash text,
  p_generator_version text,
  p_prompt_version text,
  p_format_library_version text,
  p_selector_version text,
  p_assignments jsonb
)
returns setof public.wall_text_generation_batches
language plpgsql
security invoker
set search_path = ''
as $$
declare
  assignment_count integer;
  ordinary_assignment_count integer;
  batch_record public.wall_text_generation_batches;
  candidate_start integer;
  v_content_plan_id uuid;
  v_plan_item_ids uuid[];
begin
  assignment_count := jsonb_array_length(p_assignments);
  if jsonb_typeof(p_assignments) <> 'array'
    or assignment_count < 1
    or assignment_count > 50 then
    raise exception 'wall_text_batch_invalid_assignments';
  end if;

  select count(*) into ordinary_assignment_count
  from jsonb_array_elements(p_assignments) as item(value)
  where item.value ->> 'sourceKind' <> 'instagram_reel';

  perform 1
  from public.business_profiles as profile
  where profile.id = p_business_profile_id
    and profile.user_id = p_user_id
    and profile.profile_version = p_business_profile_version
  for update;
  if not found then
    raise exception 'wall_text_business_profile_changed';
  end if;

  select batch.* into batch_record
  from public.wall_text_generation_batches as batch
  where batch.user_id = p_user_id and batch.request_key = p_request_key;
  if found then
    if batch_record.request_hash <> p_request_hash then
      raise exception 'wall_text_batch_idempotency_mismatch';
    end if;
    return next batch_record;
    return;
  end if;

  if ordinary_assignment_count > 1 and exists (
    select 1 from jsonb_array_elements(p_assignments) as item
    where item ->> 'assignedFormatId' is not null
      and item ->> 'sourceKind' <> 'instagram_reel'
    group by item ->> 'assignedFormatId'
    having count(*) > floor(ordinary_assignment_count * 0.5)
  ) then
    raise exception 'wall_text_batch_format_share_exceeded';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignments) as item(value)
    where item.value ->> 'sourceKind' = 'instagram_reel'
      and not exists (
        select 1 from public.wall_text_instagram_reel_templates as template
        where template.id = nullif(item.value ->> 'instagramReelTemplateId', '')::uuid
          and template.status = 'active'
          and template.template_version = (item.value ->> 'instagramReelTemplateVersion')::integer
          and template.overlay_media_asset_id = (item.value ->> 'overlayMediaAssetId')::uuid
          and template.locked_audio_asset_id = item.value ->> 'instagramLockedAudioAssetId'
          and template.reference_text = item.value ->> 'instagramReferenceText'
          and template.reference_text_hash = item.value ->> 'instagramReferenceTextHash'
          and template.audio_fit_mode = item.value ->> 'instagramAudioFitMode'
          and template.writer_format_id = item.value ->> 'assignedFormatId'
          and abs((template.safe_text_box ->> 'x')::numeric - (item.value #>> '{layout,textBox,x}')::numeric) < 0.000001
          and abs((template.safe_text_box ->> 'y')::numeric - (item.value #>> '{layout,textBox,y}')::numeric) < 0.000001
          and abs((template.safe_text_box ->> 'width')::numeric - (item.value #>> '{layout,textBox,width}')::numeric) < 0.000001
          and abs((template.safe_text_box ->> 'height')::numeric - (item.value #>> '{layout,textBox,height}')::numeric) < 0.000001
      )
  ) then
    raise exception 'wall_text_instagram_reservation_mismatch';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_assignments) as item(value)
    where item.value ->> 'sourceKind' <> 'instagram_reel'
      and (
        item.value ->> 'instagramReelTemplateId' is not null
        or item.value ->> 'instagramReelTemplateVersion' is not null
        or item.value ->> 'instagramReferenceText' is not null
        or item.value ->> 'instagramReferenceTextHash' is not null
        or item.value ->> 'instagramLockedAudioAssetId' is not null
        or item.value ->> 'instagramAudioFitMode' is not null
      )
  ) then
    raise exception 'wall_text_non_instagram_snapshot_invalid';
  end if;

  select greatest(
    coalesce((
      select max(creative.candidate_index) + 1
      from public.wall_text_creatives as creative
      where creative.user_id = p_user_id
        and creative.business_profile_id = p_business_profile_id
        and creative.business_profile_version = p_business_profile_version
    ), 0),
    coalesce((
      select max(batch.candidate_index_start + batch.requested_count)
      from public.wall_text_generation_batches as batch
      where batch.user_id = p_user_id
        and batch.business_profile_id = p_business_profile_id
        and batch.business_profile_version = p_business_profile_version
    ), 0)
  ) into candidate_start;

  -- A plan is optional during rollout. If no complete batch of ready private
  -- ideas exists, the original Wall generation path proceeds unchanged.
  select plan.id into v_content_plan_id
  from public.wall_text_content_plans as plan
  where plan.user_id = p_user_id
    and plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.status in ('generating', 'active')
    and timezone(plan.timezone, timezone('utc', now()))::date
      between plan.period_start_date and plan.period_end_date
  order by plan.plan_version desc
  limit 1
  for update;

  if found then
    select array_agg(available.id order by available.sequence_index)
    into v_plan_item_ids
    from (
      select item.id, item.sequence_index
      from public.wall_text_content_plan_items as item
      where item.plan_id = v_content_plan_id
        and item.user_id = p_user_id
        and item.status = 'available'
      order by item.sequence_index
      limit assignment_count
      for update skip locked
    ) as available;

    if coalesce(cardinality(v_plan_item_ids), 0) <> assignment_count then
      v_content_plan_id := null;
      v_plan_item_ids := null;
    end if;
  end if;

  insert into public.wall_text_generation_batches (
    user_id, business_profile_id, business_profile_version, request_key,
    request_hash, requested_count, chunk_count, candidate_index_start,
    generator_version, prompt_version, format_library_version, selector_version
  ) values (
    p_user_id, p_business_profile_id, p_business_profile_version,
    btrim(p_request_key), p_request_hash, assignment_count,
    ceil(assignment_count / 10.0)::integer, candidate_start,
    p_generator_version, p_prompt_version, p_format_library_version, p_selector_version
  ) returning * into batch_record;

  insert into public.wall_text_generation_chunks (
    batch_id, chunk_index, first_batch_candidate_index, candidate_count,
    idempotency_key, request_hash
  )
  select batch_record.id, chunk_index, chunk_index * 10,
    least(10, assignment_count - chunk_index * 10),
    'wall-text-batch:' || batch_record.id::text || ':chunk:' || chunk_index::text,
    p_request_hash
  from generate_series(0, batch_record.chunk_count - 1) as chunk_index;

  insert into public.wall_text_generation_assignments (
    batch_id, chunk_id, batch_candidate_index, creative_candidate_index,
    assigned_format_id, format_library_version, selection_mode,
    selection_weight_snapshot, source_kind, overlay_media_asset_id,
    instagram_reel_template_id, instagram_reel_template_version,
    instagram_reference_text, instagram_reference_text_hash,
    instagram_locked_audio_asset_id, instagram_audio_fit_mode,
    duration_seconds, layout_json, target_words, max_words, focus_json,
    wall_text_content_plan_id, wall_text_content_plan_item_id
  )
  select
    batch_record.id, chunk.id, item.ordinality - 1,
    candidate_start + item.ordinality - 1, item.value ->> 'assignedFormatId',
    p_format_library_version, item.value ->> 'selectionMode',
    coalesce((item.value ->> 'selectionWeight')::numeric, 1),
    item.value ->> 'sourceKind', (item.value ->> 'overlayMediaAssetId')::uuid,
    nullif(item.value ->> 'instagramReelTemplateId', '')::uuid,
    nullif(item.value ->> 'instagramReelTemplateVersion', '')::integer,
    item.value ->> 'instagramReferenceText',
    item.value ->> 'instagramReferenceTextHash',
    item.value ->> 'instagramLockedAudioAssetId',
    item.value ->> 'instagramAudioFitMode',
    (item.value ->> 'durationSeconds')::numeric, item.value -> 'layout',
    (item.value ->> 'targetWords')::integer, (item.value ->> 'maxWords')::integer,
    coalesce(item.value -> 'focus', '{}'::jsonb), v_content_plan_id,
    planned_item.item_id
  from jsonb_array_elements(p_assignments) with ordinality as item(value, ordinality)
  join public.wall_text_generation_chunks as chunk
    on chunk.batch_id = batch_record.id
    and chunk.chunk_index = floor((item.ordinality - 1) / 10.0)::integer
  left join unnest(v_plan_item_ids) with ordinality as planned_item(item_id, item_ordinal)
    on planned_item.item_ordinal = item.ordinality;

  if v_content_plan_id is not null then
    update public.wall_text_content_plan_items as item
    set status = 'reserved', reserved_at = timezone('utc', now()), updated_at = timezone('utc', now())
    where item.plan_id = v_content_plan_id
      and item.user_id = p_user_id
      and item.id = any(v_plan_item_ids)
      and item.status = 'available';

    if (
      select count(*)
      from public.wall_text_content_plan_items as item
      where item.plan_id = v_content_plan_id
        and item.user_id = p_user_id
        and item.id = any(v_plan_item_ids)
        and item.status = 'reserved'
    ) <> assignment_count then
      raise exception 'wall_text_content_plan_reservation_incomplete';
    end if;
  end if;

  return next batch_record;
end;
$$;

create or replace function public.record_wall_text_generation_chunk_failure_v1(
  p_user_id text,
  p_chunk_id uuid,
  p_claim_token uuid,
  p_error_code text,
  p_error_message text,
  p_retryable boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  batch_id_value uuid;
begin
  select chunk.batch_id into batch_id_value
  from public.wall_text_generation_chunks as chunk
  join public.wall_text_generation_batches as batch on batch.id = chunk.batch_id
  where chunk.id = p_chunk_id
    and batch.user_id = p_user_id
    and chunk.status = 'processing'
    and chunk.claim_token = p_claim_token
  for update of chunk;
  if not found then
    raise exception 'wall_text_generation_chunk_stale_claim';
  end if;

  update public.wall_text_generation_chunks
  set content_retry_count = case when not p_retryable then 1 else content_retry_count end,
      last_error_code = left(btrim(p_error_code), 120),
      last_error_message = left(btrim(p_error_message), 1000),
      claim_token = null, locked_at = null,
      status = case when p_retryable then 'retry_pending' else 'failed' end,
      updated_at = timezone('utc', now())
  where id = p_chunk_id and status <> 'completed';

  update public.wall_text_generation_assignments
  set last_failure_code = left(btrim(p_error_code), 120),
      status = case when p_retryable then 'retry_pending' else 'failed' end,
      updated_at = timezone('utc', now())
  where chunk_id = p_chunk_id and status <> 'completed';

  if not p_retryable then
    update public.wall_text_content_plan_items as item
    set status = 'retired', retired_at = timezone('utc', now()),
        retirement_reason = left(btrim(p_error_code), 120), updated_at = timezone('utc', now())
    from public.wall_text_generation_assignments as assignment
    where assignment.chunk_id = p_chunk_id
      and assignment.status = 'failed'
      and assignment.wall_text_content_plan_item_id = item.id
      and item.user_id = p_user_id
      and item.status = 'reserved';

    update public.wall_text_generation_batches
    set status = 'failed', updated_at = timezone('utc', now())
    where id = batch_id_value and status <> 'completed';
  end if;
end;
$$;

create or replace function public.save_wall_text_generation_candidate_v1(
  p_user_id text,
  p_assignment_id uuid,
  p_claim_token uuid,
  p_creative_id uuid,
  p_generator_model text,
  p_text_content jsonb,
  p_layout jsonb,
  p_normalized_text text,
  p_content_hash text,
  p_similarity_signature jsonb
)
returns setof public.wall_text_creatives
language plpgsql
security invoker
set search_path = ''
as $$
declare
  assignment_record public.wall_text_generation_assignments;
  batch_record public.wall_text_generation_batches;
  saved_creative public.wall_text_creatives;
begin
  select assignment.* into assignment_record
  from public.wall_text_generation_assignments as assignment
  join public.wall_text_generation_batches as batch on batch.id = assignment.batch_id
  where assignment.id = p_assignment_id and batch.user_id = p_user_id;
  if not found then
    raise exception 'wall_text_generation_assignment_unavailable';
  end if;

  select batch.* into batch_record
  from public.wall_text_generation_batches as batch
  where batch.id = assignment_record.batch_id;

  if assignment_record.status = 'completed' then
    return query select creative.* from public.wall_text_creatives as creative
      where creative.id = assignment_record.wall_text_creative_id;
    return;
  end if;

  perform 1 from public.wall_text_generation_chunks as chunk
  where chunk.id = assignment_record.chunk_id
    and chunk.status = 'processing'
    and chunk.claim_token = p_claim_token
  for update;
  if not found then
    raise exception 'wall_text_generation_candidate_stale_claim';
  end if;

  select assignment.* into assignment_record
  from public.wall_text_generation_assignments as assignment
  where assignment.id = p_assignment_id
  for update;

  if assignment_record.status = 'completed' then
    return query select creative.* from public.wall_text_creatives as creative
      where creative.id = assignment_record.wall_text_creative_id;
    return;
  end if;

  insert into public.wall_text_creatives (
    id, user_id, business_profile_id, business_profile_version,
    overlay_media_asset_id, generation_id, candidate_index,
    duration_seconds, text_content, layout, generator_version,
    generator_model, status, source_kind, instagram_reel_template_id
  ) values (
    p_creative_id, batch_record.user_id, batch_record.business_profile_id,
    batch_record.business_profile_version, assignment_record.overlay_media_asset_id,
    batch_record.id, assignment_record.creative_candidate_index,
    assignment_record.duration_seconds, p_text_content, p_layout,
    batch_record.generator_version, btrim(p_generator_model), 'preview_ready',
    assignment_record.source_kind, assignment_record.instagram_reel_template_id
  ) returning * into saved_creative;

  insert into public.wall_text_content_history (
    user_id, business_profile_id, wall_text_creative_id, normalized_text,
    content_hash, normalization_version, similarity_signature,
    similarity_version, format_id, format_version, format_attribution,
    performance_eligible, performance_exclusion_reason
  ) values (
    batch_record.user_id, batch_record.business_profile_id, saved_creative.id,
    p_normalized_text, p_content_hash, 'wall-text-normalization-v1',
    p_similarity_signature, 'wall-text-duplicate-signature-v1',
    assignment_record.assigned_format_id, assignment_record.format_version,
    'original', assignment_record.source_kind <> 'instagram_reel',
    case when assignment_record.source_kind = 'instagram_reel'
      then 'instagram_template_performance_is_separate' else null end
  );

  if assignment_record.wall_text_content_plan_item_id is not null then
    update public.wall_text_content_plan_items as item
    set status = 'consumed', consumed_at = timezone('utc', now()), updated_at = timezone('utc', now())
    where item.id = assignment_record.wall_text_content_plan_item_id
      and item.plan_id = assignment_record.wall_text_content_plan_id
      and item.user_id = batch_record.user_id
      and item.status = 'reserved';
    if not found then
      raise exception 'wall_text_content_plan_item_not_reserved';
    end if;
  end if;

  update public.wall_text_generation_assignments
  set actual_format_id = assignment_record.assigned_format_id,
      content_attempt_count = content_attempt_count + 1,
      last_failure_code = null, status = 'completed',
      wall_text_creative_id = saved_creative.id, updated_at = timezone('utc', now())
  where id = assignment_record.id;

  if not exists (
    select 1 from public.wall_text_generation_assignments as pending
    where pending.chunk_id = assignment_record.chunk_id and pending.status <> 'completed'
  ) then
    update public.wall_text_generation_chunks
    set status = 'completed', claim_token = null, locked_at = null,
        completed_at = timezone('utc', now()), updated_at = timezone('utc', now())
    where id = assignment_record.chunk_id;
  end if;

  if not exists (
    select 1 from public.wall_text_generation_assignments as pending
    where pending.batch_id = assignment_record.batch_id and pending.status <> 'completed'
  ) then
    update public.wall_text_generation_batches
    set status = 'completed', completed_at = timezone('utc', now()), updated_at = timezone('utc', now())
    where id = assignment_record.batch_id;
  else
    update public.wall_text_generation_batches
    set status = 'processing', updated_at = timezone('utc', now())
    where id = assignment_record.batch_id and status = 'pending';
  end if;

  return next saved_creative;
end;
$$;

alter table public.wall_text_content_plans enable row level security;
alter table public.wall_text_content_plan_briefs enable row level security;
alter table public.wall_text_content_plan_items enable row level security;

revoke all privileges on table
  public.wall_text_content_plans,
  public.wall_text_content_plan_briefs,
  public.wall_text_content_plan_items
from public, anon, authenticated;

grant select, insert, update on table
  public.wall_text_content_plans,
  public.wall_text_content_plan_briefs,
  public.wall_text_content_plan_items
to service_role;

revoke all on function public.ensure_wall_text_content_plan(
  text, text, uuid, integer, text, text, jsonb, integer, text, text
) from public, anon, authenticated;
revoke all on function public.attach_wall_text_content_plan_generation_job(text, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.persist_wall_text_content_plan_brief_chunk(text, uuid, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.complete_wall_text_content_plan_generation(text, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.ensure_wall_text_content_plan(
  text, text, uuid, integer, text, text, jsonb, integer, text, text
) to service_role;
grant execute on function public.attach_wall_text_content_plan_generation_job(text, uuid, uuid)
  to service_role;
grant execute on function public.persist_wall_text_content_plan_brief_chunk(text, uuid, jsonb, jsonb)
  to service_role;
grant execute on function public.complete_wall_text_content_plan_generation(text, uuid, uuid)
  to service_role;

comment on table public.wall_text_content_plan_briefs is
  'Private six-field Wall-of-Text creative context. One brief guides five different child ideas and never becomes rendered overlay text.';
comment on table public.wall_text_content_plan_items is
  'Private Wall-of-Text contentIdea plus feeling inventory. The complete parent brief is loaded only by the final Wall writer.';
comment on column public.wall_text_generation_assignments.wall_text_content_plan_item_id is
  'Optional private planned idea used by this existing Wall generation assignment. Null preserves legacy and rollout fallback behavior.';

select pg_notify('pgrst', 'reload schema');
