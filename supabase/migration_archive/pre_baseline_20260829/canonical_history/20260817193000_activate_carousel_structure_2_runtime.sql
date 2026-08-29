alter table public.carousel_experiment_assignments
  alter column hook_family_id drop not null,
  alter column hook_selection_mode drop not null,
  alter column hook_selection_multiplier drop not null,
  drop constraint if exists carousel_experiment_assignments_structure_grammar_check,
  add constraint carousel_experiment_assignments_structure_grammar_check
    check (
      (
        structure_id = 'structure_1'
        and hook_family_id is not null
        and hook_selection_mode is not null
        and hook_selection_multiplier is not null
      )
      or
      (
        structure_id = 'structure_2'
        and assigned_format_id in (
          'wrong_belief',
          'perfect_plan_breaks',
          'stopped_behavior',
          'terrible_at',
          'result_without_sacrifice',
          'identity_transformation',
          'new_rule',
          'wrong_villain'
        )
        and rotation_candidate_format_id in (
          'wrong_belief',
          'perfect_plan_breaks',
          'stopped_behavior',
          'terrible_at',
          'result_without_sacrifice',
          'identity_transformation',
          'new_rule',
          'wrong_villain'
        )
        and (
          actual_format_id is null
          or actual_format_id in (
            'wrong_belief',
            'perfect_plan_breaks',
            'stopped_behavior',
            'terrible_at',
            'result_without_sacrifice',
            'identity_transformation',
            'new_rule',
            'wrong_villain'
          )
        )
        and (
          replacement_for_format_id is null
          or replacement_for_format_id in (
            'wrong_belief',
            'perfect_plan_breaks',
            'stopped_behavior',
            'terrible_at',
            'result_without_sacrifice',
            'identity_transformation',
            'new_rule',
            'wrong_villain'
          )
        )
        and hook_family_id is null
        and hook_selection_mode is null
        and hook_selection_multiplier is null
      )
    );

alter table public.carousel_generations
  drop constraint if exists carousel_generations_structure_grammar_check,
  add constraint carousel_generations_structure_grammar_check
    check (
      structure_id = 'structure_1'
      or (
        structure_id = 'structure_2'
        and content_assigned_format_id in (
          'wrong_belief',
          'perfect_plan_breaks',
          'stopped_behavior',
          'terrible_at',
          'result_without_sacrifice',
          'identity_transformation',
          'new_rule',
          'wrong_villain'
        )
        and content_format_id in (
          'wrong_belief',
          'perfect_plan_breaks',
          'stopped_behavior',
          'terrible_at',
          'result_without_sacrifice',
          'identity_transformation',
          'new_rule',
          'wrong_villain'
        )
        and hook_family_id is null
      )
    );

alter table public.carousel_performance_observations
  alter column hook_family_id drop not null,
  drop constraint if exists carousel_performance_observations_structure_grammar_check,
  add constraint carousel_performance_observations_structure_grammar_check
    check (
      (
        structure_id = 'structure_1'
        and hook_family_id is not null
      )
      or
      (
        structure_id = 'structure_2'
        and content_format_id in (
          'wrong_belief',
          'perfect_plan_breaks',
          'stopped_behavior',
          'terrible_at',
          'result_without_sacrifice',
          'identity_transformation',
          'new_rule',
          'wrong_villain'
        )
        and hook_family_id is null
      )
    );

create or replace function public.record_carousel_performance_observation(
  p_user_id text,
  p_platform text,
  p_social_connection_id uuid,
  p_platform_post_id text,
  p_published_at timestamptz,
  p_observed_at timestamptz,
  p_view_count bigint
)
returns table(recorded boolean, evaluated boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_business_profile_id uuid;
  v_carousel_generation_id uuid;
  v_content_format_id text;
  v_due_at timestamptz;
  v_existing public.carousel_performance_observations%rowtype;
  v_format_version integer;
  v_hook_family_id text;
  v_published_at timestamptz;
  v_structure_id text;
  v_structure_version integer;
  v_target_id uuid;
  v_view_count bigint;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or p_platform <> 'instagram'
     or p_social_connection_id is null
     or nullif(trim(coalesce(p_platform_post_id, '')), '') is null
     or p_published_at is null
     or p_observed_at is null
     or (p_view_count is not null and p_view_count < 0) then
    raise exception 'carousel_performance_input_invalid';
  end if;

  select
    target.id,
    target.published_at,
    generation.id,
    generation.business_profile_id,
    generation.content_format_id,
    generation.hook_family_id,
    coalesce(generation.content_format_version, 1),
    generation.structure_id,
    generation.structure_version
  into
    v_target_id,
    v_published_at,
    v_carousel_generation_id,
    v_business_profile_id,
    v_content_format_id,
    v_hook_family_id,
    v_format_version,
    v_structure_id,
    v_structure_version
  from public.scheduled_post_targets as target
  join public.scheduled_posts as post
    on post.id = target.scheduled_post_id
    and post.user_id = p_user_id
    and post.source_kind = 'library_item'
  join public.library_items as item
    on item.id = post.library_item_id
    and item.user_id = p_user_id
    and item.source_type = 'generated_carousel'
    and item.deleted_at is null
  join public.carousel_generations as generation
    on generation.id::text = item.source_id
    and generation.user_id = p_user_id
    and generation.status = 'completed'
    and generation.business_profile_id is not null
    and generation.content_format_id is not null
    and (
      (
        generation.structure_id = 'structure_1'
        and generation.hook_family_id is not null
      )
      or
      (
        generation.structure_id = 'structure_2'
        and generation.hook_family_id is null
      )
    )
  where target.user_id = p_user_id
    and target.platform = p_platform
    and target.social_connection_id = p_social_connection_id
    and target.platform_post_id = trim(p_platform_post_id)
    and target.status = 'published'
    and target.published_at is not null
    and (
      item.metadata -> 'trendingCreativeEdit' is null
      or item.metadata -> 'trendingCreativeEdit' = 'null'::jsonb
    )
  order by target.published_at desc, target.created_at desc
  limit 1;

  if not found
     or abs(extract(epoch from (v_published_at - p_published_at))) > 86400
     or p_observed_at < v_published_at then
    return query select false, false;
    return;
  end if;

  v_due_at := v_published_at + interval '7 days';
  v_view_count := p_view_count;

  select observation.*
  into v_existing
  from public.carousel_performance_observations as observation
  where observation.scheduled_post_target_id = v_target_id
  for update;

  if not found then
    insert into public.carousel_performance_observations (
      user_id,
      business_profile_id,
      carousel_generation_id,
      scheduled_post_target_id,
      social_connection_id,
      platform,
      platform_post_id,
      content_format_id,
      hook_family_id,
      format_version,
      published_at,
      evaluation_due_at,
      snapshot_observed_at,
      evaluated_at,
      view_count,
      structure_id,
      structure_version
    ) values (
      p_user_id,
      v_business_profile_id,
      v_carousel_generation_id,
      v_target_id,
      p_social_connection_id,
      p_platform,
      trim(p_platform_post_id),
      v_content_format_id,
      v_hook_family_id,
      v_format_version,
      v_published_at,
      v_due_at,
      p_observed_at,
      case
        when p_observed_at between v_due_at and v_due_at + interval '24 hours'
          and v_view_count is not null
          then timezone('utc', now())
        else null
      end,
      v_view_count,
      v_structure_id,
      v_structure_version
    );

    return query select true, (
      p_observed_at between v_due_at and v_due_at + interval '24 hours'
      and v_view_count is not null
    );
    return;
  end if;

  if v_existing.evaluated_at is not null then
    return query select true, true;
    return;
  end if;

  if p_observed_at < v_due_at then
    if p_observed_at > v_existing.snapshot_observed_at then
      update public.carousel_performance_observations
      set
        snapshot_observed_at = p_observed_at,
        view_count = v_view_count,
        updated_at = timezone('utc', now())
      where scheduled_post_target_id = v_target_id;
    end if;

    return query select true, false;
    return;
  end if;

  if v_existing.snapshot_observed_at between
       v_due_at - interval '24 hours' and v_due_at
     and v_existing.view_count is not null
     and (
       p_observed_at > v_due_at + interval '24 hours'
       or v_view_count is null
       or v_due_at - v_existing.snapshot_observed_at
          <= p_observed_at - v_due_at
     ) then
    update public.carousel_performance_observations
    set
      evaluated_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
    where scheduled_post_target_id = v_target_id;

    return query select true, true;
    return;
  end if;

  if p_observed_at <= v_due_at + interval '24 hours'
     and v_view_count is not null then
    update public.carousel_performance_observations
    set
      snapshot_observed_at = p_observed_at,
      evaluated_at = timezone('utc', now()),
      view_count = v_view_count,
      updated_at = timezone('utc', now())
    where scheduled_post_target_id = v_target_id;

    return query select true, true;
    return;
  end if;

  return query select true, false;
end;
$$;

revoke all on function public.record_carousel_performance_observation(
  text,
  text,
  uuid,
  text,
  timestamptz,
  timestamptz,
  bigint
) from public, anon, authenticated;
grant execute on function public.record_carousel_performance_observation(
  text,
  text,
  uuid,
  text,
  timestamptz,
  timestamptz,
  bigint
) to service_role;

create or replace function public.get_carousel_performance_aggregates(
  p_user_id text,
  p_business_profile_id uuid,
  p_structure_id text
)
returns table(
  scope text,
  content_format_id text,
  hook_family_id text,
  evaluated_post_count bigint,
  average_view_count numeric,
  median_view_count numeric,
  view_standard_deviation numeric,
  baseline_median_view_count numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or p_business_profile_id is null
     or p_structure_id not in ('structure_1', 'structure_2')
     or not exists (
       select 1
       from public.business_profiles as profile
       where profile.id = p_business_profile_id
         and profile.user_id = p_user_id
     ) then
    return;
  end if;

  return query
  with ranked as (
    select
      observation.content_format_id,
      observation.hook_family_id,
      observation.view_count,
      row_number() over (
        partition by observation.content_format_id
        order by observation.published_at desc, observation.id desc
      ) as recency_rank
    from public.carousel_performance_observations as observation
    where observation.user_id = p_user_id
      and observation.business_profile_id = p_business_profile_id
      and observation.structure_id = p_structure_id
      and observation.evaluated_at is not null
      and observation.view_count is not null
      and observation.published_at >= timezone('utc', now()) - interval '180 days'
  ),
  recent as (
    select ranked.content_format_id, ranked.hook_family_id, ranked.view_count
    from ranked
    where ranked.recency_rank <= 20
  ),
  baseline as (
    select
      percentile_cont(0.5) within group (order by recent.view_count)::numeric
        as median_views
    from recent
  ),
  format_stats as (
    select
      'format'::text as aggregate_scope,
      recent.content_format_id,
      null::text as hook_family_id,
      count(*)::bigint as post_count,
      avg(recent.view_count)::numeric as average_views,
      percentile_cont(0.5) within group (order by recent.view_count)::numeric
        as median_views,
      coalesce(stddev_pop(recent.view_count), 0)::numeric as view_stddev
    from recent
    group by recent.content_format_id
  ),
  hook_stats as (
    select
      'format_hook'::text as aggregate_scope,
      recent.content_format_id,
      recent.hook_family_id,
      count(*)::bigint as post_count,
      avg(recent.view_count)::numeric as average_views,
      percentile_cont(0.5) within group (order by recent.view_count)::numeric
        as median_views,
      coalesce(stddev_pop(recent.view_count), 0)::numeric as view_stddev
    from recent
    where recent.hook_family_id is not null
    group by recent.content_format_id, recent.hook_family_id
  ),
  combined as (
    select * from format_stats
    union all
    select * from hook_stats
  )
  select
    combined.aggregate_scope,
    combined.content_format_id,
    combined.hook_family_id,
    combined.post_count,
    combined.average_views,
    combined.median_views,
    combined.view_stddev,
    baseline.median_views
  from combined
  cross join baseline
  order by
    combined.aggregate_scope,
    combined.content_format_id,
    combined.hook_family_id nulls first;
end;
$$;

revoke all on function public.get_carousel_performance_aggregates(
  text,
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.get_carousel_performance_aggregates(
  text,
  uuid,
  text
) to service_role;

revoke all on function public.get_carousel_performance_aggregates(text, uuid)
  from public, anon, authenticated, service_role;

alter table public.carousel_global_settings
  alter column structure_mode set default 'structure_1_only';

comment on column public.carousel_experiment_assignments.hook_family_id is
  'Structure 1 hook family. It is null for Structure 2 because Structure 2 owns a separate eight-format story grammar and never borrows Structure 1 hook families.';
comment on function public.get_carousel_performance_aggregates(text, uuid, text) is
  'Returns view-only learning evidence inside one business and one structure namespace. Structure 2 returns format aggregates only.';
comment on column public.carousel_global_settings.structure_mode is
  'Global owner-controlled structure mode. Deployment keeps Structure 1 selected until the new database, worker, and application are verified together; the release then explicitly enables strict batch-level rotation.';

select pg_notify('pgrst', 'reload schema');
