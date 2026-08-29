-- Carousel creative briefs are private planning context. They never become
-- visible slide fields and do not replace the existing reservation lifecycle.

alter table public.carousel_content_plans
  add column if not exists planning_context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(planning_context) = 'object');

create table if not exists public.carousel_content_plan_briefs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id text not null
    check (char_length(trim(user_id)) between 1 and 240),
  brief_index smallint not null
    check (brief_index between 1 and 30),
  creative_seed text not null
    check (char_length(trim(creative_seed)) between 12 and 400),
  audience_context text not null
    check (char_length(trim(audience_context)) between 2 and 240),
  human_moment text not null
    check (char_length(trim(human_moment)) between 12 and 400),
  emotional_tension text not null
    check (char_length(trim(emotional_tension)) between 2 and 160),
  supported_angle text not null
    check (char_length(trim(supported_angle)) between 12 and 400),
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
    check (brief_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  foreign key (plan_id, user_id)
    references public.carousel_content_plans (id, user_id)
    on delete cascade,
  unique (id, plan_id, user_id),
  unique (plan_id, brief_index),
  unique (plan_id, brief_fingerprint)
);

create index if not exists carousel_content_plan_briefs_plan_idx
  on public.carousel_content_plan_briefs (plan_id, brief_index);

alter table public.carousel_content_plan_items
  add column if not exists creative_brief_id uuid;

alter table public.carousel_content_plan_items
  drop constraint if exists carousel_content_plan_items_creative_brief_fkey;

alter table public.carousel_content_plan_items
  add constraint carousel_content_plan_items_creative_brief_fkey
  foreign key (creative_brief_id, plan_id, user_id)
  references public.carousel_content_plan_briefs (id, plan_id, user_id)
  on delete restrict
  deferrable initially deferred;

create index if not exists carousel_content_plan_items_creative_brief_idx
  on public.carousel_content_plan_items (creative_brief_id)
  where creative_brief_id is not null;

alter table public.carousel_content_plan_briefs enable row level security;

revoke all privileges on table public.carousel_content_plan_briefs
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.carousel_content_plan_briefs
  to service_role;

create or replace function public.persist_carousel_content_plan_brief_chunk(
  p_user_id text,
  p_plan_id uuid,
  p_briefs jsonb,
  p_items jsonb
)
returns setof public.carousel_content_plan_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_brief_count integer;
  v_invalid_item_count integer;
  v_plan public.carousel_content_plans%rowtype;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or p_plan_id is null
     or p_briefs is null
     or p_items is null
     or jsonb_typeof(p_briefs) <> 'array'
     or jsonb_typeof(p_items) <> 'array' then
    raise exception 'carousel_content_plan_brief_chunk_input_invalid';
  end if;

  select plan.*
  into v_plan
  from public.carousel_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id
    and plan.status = 'generating'
  for update;

  if not found then
    raise exception 'carousel_content_plan_brief_chunk_plan_not_generating';
  end if;

  select count(*)::integer
  into v_brief_count
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
    raise exception 'carousel_content_plan_brief_chunk_shape_invalid';
  end if;

  select count(*)::integer
  into v_invalid_item_count
  from (
    select item.brief_index
    from jsonb_to_recordset(p_items) as item(
      brief_index integer,
      creative_seed text,
      emotion text,
      sequence_index integer,
      day_number integer,
      day_slot_index integer,
      seed_fingerprint text
    )
    group by item.brief_index
    having count(*) <> 5
  ) as invalid_items;

  if v_invalid_item_count <> 0 then
    raise exception 'carousel_content_plan_brief_chunk_item_balance_invalid';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(
      brief_index integer,
      creative_seed text,
      emotion text,
      sequence_index integer,
      day_number integer,
      day_slot_index integer,
      seed_fingerprint text
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
    raise exception 'carousel_content_plan_brief_chunk_item_parent_missing';
  end if;

  insert into public.carousel_content_plan_briefs (
    plan_id,
    user_id,
    brief_index,
    creative_seed,
    audience_context,
    human_moment,
    emotional_tension,
    supported_angle,
    preferred_format_family,
    brief_fingerprint
  )
  select
    p_plan_id,
    p_user_id,
    brief.brief_index,
    trim(brief.creative_seed),
    trim(brief.audience_context),
    trim(brief.human_moment),
    trim(brief.emotional_tension),
    trim(brief.supported_angle),
    trim(brief.preferred_format_family),
    trim(brief.brief_fingerprint)
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
    insert into public.carousel_content_plan_items (
      plan_id,
      user_id,
      creative_brief_id,
      sequence_index,
      day_number,
      day_slot_index,
      creative_seed,
      emotion,
      seed_fingerprint,
      status
    )
    select
      p_plan_id,
      p_user_id,
      brief.id,
      item.sequence_index,
      item.day_number,
      item.day_slot_index,
      trim(item.creative_seed),
      trim(item.emotion),
      trim(item.seed_fingerprint),
      'planned'
    from jsonb_to_recordset(p_items) as item(
      brief_index integer,
      creative_seed text,
      emotion text,
      sequence_index integer,
      day_number integer,
      day_slot_index integer,
      seed_fingerprint text
    )
    join public.carousel_content_plan_briefs as brief
      on brief.plan_id = p_plan_id
      and brief.user_id = p_user_id
      and brief.brief_index = item.brief_index
    returning *
  )
  select *
  from inserted
  order by sequence_index;
end;
$$;

create or replace function public.ensure_carousel_content_plan(
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
returns public.carousel_content_plans
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current_date date;
  v_next_plan_version integer;
  v_now timestamptz := timezone('utc', now());
  v_plan public.carousel_content_plans%rowtype;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or nullif(trim(coalesce(p_project_id, '')), '') is null
     or p_business_profile_id is null
     or p_business_profile_version is null
     or p_business_profile_version <= 0
     or nullif(trim(coalesce(p_timezone, '')), '') is null
     or nullif(trim(coalesce(p_business_description, '')), '') is null
     or char_length(trim(p_business_description)) > 4000
     or p_planning_context is null
     or jsonb_typeof(p_planning_context) <> 'object'
     or p_target_item_count is null
     or p_target_item_count <> 150
     or p_planner_model <> 'gpt-4o-mini'
     or nullif(trim(coalesce(p_planner_prompt_version, '')), '') is null then
    raise exception 'carousel_content_plan_ensure_input_invalid';
  end if;

  begin
    v_current_date := timezone(trim(p_timezone), v_now)::date;
  exception
    when invalid_parameter_value then
      raise exception 'carousel_content_plan_timezone_invalid';
  end;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'carousel-content-plan:' || p_user_id || ':' || p_business_profile_id::text,
      641902731
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

  select plan.*
  into v_plan
  from public.carousel_content_plans as plan
  where plan.user_id = p_user_id
    and plan.project_id = p_project_id
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

  select coalesce(max(plan.plan_version), 0) + 1
  into v_next_plan_version
  from public.carousel_content_plans as plan
  where plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.period_start_date = v_current_date;

  insert into public.carousel_content_plans (
    user_id,
    project_id,
    business_profile_id,
    business_profile_version,
    period_start_date,
    period_end_date,
    timezone,
    plan_version,
    business_description,
    planning_context,
    target_item_count,
    planner_model,
    planner_prompt_version
  ) values (
    p_user_id,
    p_project_id,
    p_business_profile_id,
    p_business_profile_version,
    v_current_date,
    v_current_date + 29,
    trim(p_timezone),
    v_next_plan_version,
    trim(p_business_description),
    p_planning_context,
    p_target_item_count,
    p_planner_model,
    trim(p_planner_prompt_version)
  )
  returning * into v_plan;

  return v_plan;
end;
$$;

create or replace function public.activate_carousel_content_plan(
  p_user_id text,
  p_plan_id uuid
)
returns public.carousel_content_plans
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_brief_count integer;
  v_invalid_brief_item_count integer;
  v_item_count integer;
  v_minimum_day_count integer;
  v_now timestamptz := timezone('utc', now());
  v_plan public.carousel_content_plans%rowtype;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or p_plan_id is null then
    raise exception 'carousel_content_plan_activation_input_invalid';
  end if;

  select plan.*
  into v_plan
  from public.carousel_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id;

  if not found then
    raise exception 'carousel_content_plan_not_found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'carousel-content-plan:' || p_user_id || ':' || v_plan.business_profile_id::text,
      641902731
    )
  );

  select plan.*
  into v_plan
  from public.carousel_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id
  for update;

  if v_plan.status = 'active' then
    return v_plan;
  end if;

  if v_plan.status <> 'generating' then
    raise exception 'carousel_content_plan_not_activatable';
  end if;

  perform 1
  from public.business_profiles as profile
  where profile.id = v_plan.business_profile_id
    and profile.user_id = p_user_id
    and profile.project_id = v_plan.project_id
    and profile.profile_version = v_plan.business_profile_version
  for share;

  if not found then
    raise exception 'business_profile_version_changed';
  end if;

  if timezone(v_plan.timezone, v_now)::date
       not between v_plan.period_start_date and v_plan.period_end_date then
    raise exception 'carousel_content_plan_period_not_current';
  end if;

  select count(*)::integer
  into v_item_count
  from public.carousel_content_plan_items as item
  where item.plan_id = v_plan.id
    and item.user_id = p_user_id
    and item.status = 'planned';

  select min(day_items.item_count)::integer
  into v_minimum_day_count
  from (
    select item.day_number, count(*)::integer as item_count
    from public.carousel_content_plan_items as item
    where item.plan_id = v_plan.id
      and item.user_id = p_user_id
      and item.status = 'planned'
    group by item.day_number
  ) as day_items;

  if v_item_count < v_plan.target_item_count
     or (
       select count(distinct item.day_number)
       from public.carousel_content_plan_items as item
       where item.plan_id = v_plan.id
         and item.user_id = p_user_id
         and item.status = 'planned'
     ) <> 30
     or coalesce(v_minimum_day_count, 0) < 5 then
    raise exception 'carousel_content_plan_incomplete';
  end if;

  if v_plan.planner_prompt_version in (
    'carousel-content-plan-creative-briefs-v2',
    'carousel-content-plan-creative-briefs-v3-explicit-definitions'
  ) then
    select count(*)::integer
    into v_brief_count
    from public.carousel_content_plan_briefs as brief
    where brief.plan_id = v_plan.id
      and brief.user_id = p_user_id;

    select count(*)::integer
    into v_invalid_brief_item_count
    from (
      select item.creative_brief_id
      from public.carousel_content_plan_items as item
      where item.plan_id = v_plan.id
        and item.user_id = p_user_id
        and item.status = 'planned'
      group by item.creative_brief_id
      having item.creative_brief_id is null or count(*) <> 5
    ) as invalid_brief_items;

    if v_brief_count <> 30
       or v_invalid_brief_item_count <> 0 then
      raise exception 'carousel_content_plan_creative_briefs_incomplete';
    end if;
  end if;

  update public.carousel_content_plans as prior_plan
  set
    status = 'superseded',
    superseded_at = v_now,
    superseded_by_plan_id = v_plan.id,
    updated_at = v_now
  where prior_plan.user_id = p_user_id
    and prior_plan.business_profile_id = v_plan.business_profile_id
    and prior_plan.id <> v_plan.id
    and prior_plan.status = 'active';

  update public.carousel_content_plan_items as item
  set
    status = 'available',
    updated_at = v_now
  where item.plan_id = v_plan.id
    and item.user_id = p_user_id
    and item.status = 'planned';

  update public.carousel_content_plans as plan
  set
    activated_at = v_now,
    status = 'active',
    updated_at = v_now
  where plan.id = v_plan.id
  returning plan.* into v_plan;

  return v_plan;
end;
$$;

revoke all on function public.persist_carousel_content_plan_brief_chunk(text, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.persist_carousel_content_plan_brief_chunk(text, uuid, jsonb, jsonb)
  to service_role;

revoke all on function public.ensure_carousel_content_plan(
  text, text, uuid, integer, text, text, jsonb, integer, text, text
) from public, anon, authenticated;
grant execute on function public.ensure_carousel_content_plan(
  text, text, uuid, integer, text, text, jsonb, integer, text, text
) to service_role;

comment on table public.carousel_content_plan_briefs is
  'Private, source-grounded six-field creative context. Each brief creates five durable Carousel ideas and is never exposed as slide content.';
comment on column public.carousel_content_plans.planning_context is
  'Private approved-business snapshot used only to create creative briefs. It is not user-visible Carousel copy.';
comment on column public.carousel_content_plan_items.creative_brief_id is
  'Private parent brief that may inform final writing; legacy items remain null and keep their original seed-plus-emotion behavior.';
comment on function public.ensure_carousel_content_plan(
  text, text, uuid, integer, text, text, jsonb, integer, text, text
) is
  'Returns the current profile-version plan or creates a new 150-item 30-day plan with a private, approved-business planning context.';

select pg_notify('pgrst', 'reload schema');
