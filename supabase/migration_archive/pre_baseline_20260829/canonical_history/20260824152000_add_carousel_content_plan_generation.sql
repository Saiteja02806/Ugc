alter table public.carousel_content_plans
  add column if not exists generation_job_id uuid
    references public.background_jobs(id) on delete set null,
  add column if not exists generation_started_at timestamptz,
  add column if not exists generation_completed_at timestamptz;

create unique index if not exists carousel_content_plans_generation_job_uidx
  on public.carousel_content_plans (generation_job_id)
  where generation_job_id is not null;

alter table public.background_jobs
  drop constraint if exists background_jobs_job_type_check;

alter table public.background_jobs
  add constraint background_jobs_job_type_check
  check (
    job_type in (
      'hook_text_generation',
      'wall_text_generation',
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

create or replace function public.ensure_carousel_content_plan(
  p_user_id text,
  p_project_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_timezone text,
  p_business_description text,
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
     or p_target_item_count is null
     or p_target_item_count not between 150 and 10000
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
    p_target_item_count,
    p_planner_model,
    trim(p_planner_prompt_version)
  )
  returning * into v_plan;

  return v_plan;
end;
$$;

create or replace function public.attach_carousel_content_plan_generation_job(
  p_user_id text,
  p_plan_id uuid,
  p_job_id uuid
)
returns public.carousel_content_plans
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_plan public.carousel_content_plans%rowtype;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or p_plan_id is null
     or p_job_id is null then
    raise exception 'carousel_content_plan_job_input_invalid';
  end if;

  select plan.*
  into v_plan
  from public.carousel_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id
  for update;

  if not found or v_plan.status <> 'generating' then
    raise exception 'carousel_content_plan_not_generating';
  end if;

  perform 1
  from public.background_jobs as job
  where job.id = p_job_id
    and job.user_id = p_user_id
    and job.job_type = 'carousel_content_plan_generation'
    and job.input_json ->> 'planId' = p_plan_id::text
  for share;

  if not found then
    raise exception 'carousel_content_plan_generation_job_mismatch';
  end if;

  if v_plan.generation_job_id is not null
     and v_plan.generation_job_id <> p_job_id then
    raise exception 'carousel_content_plan_generation_job_conflict';
  end if;

  update public.carousel_content_plans as plan
  set
    generation_job_id = p_job_id,
    generation_started_at = coalesce(plan.generation_started_at, v_now),
    updated_at = v_now
  where plan.id = p_plan_id
  returning plan.* into v_plan;

  return v_plan;
end;
$$;

create or replace function public.complete_carousel_content_plan_generation(
  p_user_id text,
  p_plan_id uuid,
  p_job_id uuid
)
returns public.carousel_content_plans
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_plan public.carousel_content_plans%rowtype;
begin
  select plan.*
  into v_plan
  from public.carousel_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id
    and plan.generation_job_id = p_job_id
  for update;

  if not found then
    raise exception 'carousel_content_plan_generation_completion_mismatch';
  end if;

  if v_plan.status = 'active' then
    return v_plan;
  end if;

  if v_plan.status <> 'generating' then
    raise exception 'carousel_content_plan_not_generating';
  end if;

  update public.carousel_content_plans as plan
  set
    generation_completed_at = v_now,
    updated_at = v_now
  where plan.id = p_plan_id;

  select activated.*
  into v_plan
  from public.activate_carousel_content_plan(p_user_id, p_plan_id) as activated;

  return v_plan;
end;
$$;

revoke all on function public.ensure_carousel_content_plan(
  text,
  text,
  uuid,
  integer,
  text,
  text,
  integer,
  text,
  text
) from public, anon, authenticated;
revoke all on function public.attach_carousel_content_plan_generation_job(
  text,
  uuid,
  uuid
) from public, anon, authenticated;
revoke all on function public.complete_carousel_content_plan_generation(
  text,
  uuid,
  uuid
) from public, anon, authenticated;

grant execute on function public.ensure_carousel_content_plan(
  text,
  text,
  uuid,
  integer,
  text,
  text,
  integer,
  text,
  text
) to service_role;
grant execute on function public.attach_carousel_content_plan_generation_job(
  text,
  uuid,
  uuid
) to service_role;
grant execute on function public.complete_carousel_content_plan_generation(
  text,
  uuid,
  uuid
) to service_role;

comment on function public.ensure_carousel_content_plan(
  text,
  text,
  uuid,
  integer,
  text,
  text,
  integer,
  text,
  text
) is
  'Returns the current profile-version plan or creates a new 30-day generating plan using only the supplied minimal business description.';

select pg_notify('pgrst', 'reload schema');
