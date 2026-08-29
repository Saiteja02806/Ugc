create or replace function public.set_carousel_structure_mode(
  p_structure_mode text,
  p_updated_by_user_id text
)
returns setof public.carousel_global_settings
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_structure_mode not in (
       'rotate',
       'structure_1_only',
       'structure_2_only'
     )
     or nullif(trim(coalesce(p_updated_by_user_id, '')), '') is null then
    raise exception 'carousel_admin_structure_mode_input_invalid';
  end if;

  update public.carousel_global_settings as settings
  set
    structure_mode = p_structure_mode,
    structure_config_version = settings.structure_config_version + 1,
    updated_by_user_id = trim(p_updated_by_user_id),
    updated_at = timezone('utc', now())
  where settings.singleton = true
    and settings.structure_mode is distinct from p_structure_mode;

  return query
  select settings.*
  from public.carousel_global_settings as settings
  where settings.singleton = true;
end;
$$;

revoke all on function public.set_carousel_structure_mode(text, text)
  from public, anon, authenticated;
grant execute on function public.set_carousel_structure_mode(text, text)
  to service_role;

comment on function public.set_carousel_structure_mode(text, text) is
  'Service-only, idempotent owner control for future five-Carousel batch routing. Changing the mode increments the configuration version; choosing the current mode leaves it unchanged.';

create or replace function public.get_carousel_admin_analytics(
  p_window_days integer default 30
)
returns table(
  scope text,
  structure_id text,
  content_format_id text,
  generated_count bigint,
  saved_count bigint,
  scheduled_count bigint,
  published_count bigint,
  evaluated_post_count bigint,
  total_view_count bigint,
  average_view_count numeric,
  median_view_count numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_window_days < 1 or p_window_days > 365 then
    raise exception 'carousel_admin_analytics_window_invalid';
  end if;

  return query
  with structures(structure_id) as (
    values ('structure_1'::text), ('structure_2'::text)
  ),
  generated_events as (
    select
      generation.id::text as event_id,
      generation.structure_id,
      generation.content_format_id
    from public.carousel_generations as generation
    where generation.status = 'completed'
      and generation.business_profile_id is not null
      and generation.content_format_id is not null
      and generation.structure_id in ('structure_1', 'structure_2')
      and generation.created_at >=
        timezone('utc', now()) - make_interval(days => p_window_days)
  ),
  saved_events as (
    select distinct
      item.id::text as event_id,
      generation.structure_id,
      generation.content_format_id
    from public.library_items as item
    join public.library_carousel_slides as slide
      on slide.library_item_id = item.id
    join public.carousel_generations as generation
      on generation.id = slide.carousel_generation_id
    where item.source_type = 'generated_carousel'
      and generation.business_profile_id is not null
      and generation.content_format_id is not null
      and generation.structure_id in ('structure_1', 'structure_2')
      and item.created_at >=
        timezone('utc', now()) - make_interval(days => p_window_days)
  ),
  scheduled_events as (
    select distinct
      scheduled.id::text as event_id,
      generation.structure_id,
      generation.content_format_id
    from public.scheduled_posts as scheduled
    join public.library_items as item
      on item.id = scheduled.library_item_id
    join public.library_carousel_slides as slide
      on slide.library_item_id = item.id
    join public.carousel_generations as generation
      on generation.id = slide.carousel_generation_id
    where scheduled.source_kind = 'library_item'
      and scheduled.scheduled_for is not null
      and scheduled.status in (
        'scheduling',
        'scheduled',
        'publishing',
        'published',
        'partially_failed',
        'failed'
      )
      and generation.business_profile_id is not null
      and generation.content_format_id is not null
      and generation.structure_id in ('structure_1', 'structure_2')
      and scheduled.created_at >=
        timezone('utc', now()) - make_interval(days => p_window_days)
  ),
  published_events as (
    select distinct
      target.id::text as event_id,
      generation.structure_id,
      generation.content_format_id
    from public.scheduled_post_targets as target
    join public.scheduled_posts as scheduled
      on scheduled.id = target.scheduled_post_id
    join public.library_items as item
      on item.id = scheduled.library_item_id
    join public.library_carousel_slides as slide
      on slide.library_item_id = item.id
    join public.carousel_generations as generation
      on generation.id = slide.carousel_generation_id
    where scheduled.source_kind = 'library_item'
      and target.status = 'published'
      and target.published_at is not null
      and generation.business_profile_id is not null
      and generation.content_format_id is not null
      and generation.structure_id in ('structure_1', 'structure_2')
      and target.published_at >=
        timezone('utc', now()) - make_interval(days => p_window_days)
  ),
  view_events as (
    select
      observation.id::text as event_id,
      observation.structure_id,
      observation.content_format_id,
      observation.view_count
    from public.carousel_performance_observations as observation
    where observation.evaluated_at is not null
      and observation.view_count is not null
      and observation.structure_id in ('structure_1', 'structure_2')
      and observation.evaluated_at >=
        timezone('utc', now()) - make_interval(days => p_window_days)
  ),
  format_keys as (
    select generated_events.structure_id, generated_events.content_format_id
    from generated_events
    union
    select saved_events.structure_id, saved_events.content_format_id
    from saved_events
    union
    select scheduled_events.structure_id, scheduled_events.content_format_id
    from scheduled_events
    union
    select published_events.structure_id, published_events.content_format_id
    from published_events
    union
    select view_events.structure_id, view_events.content_format_id
    from view_events
  ),
  generated_by_format as (
    select
      generated_events.structure_id,
      generated_events.content_format_id,
      count(*)::bigint as event_count
    from generated_events
    group by generated_events.structure_id, generated_events.content_format_id
  ),
  saved_by_format as (
    select
      saved_events.structure_id,
      saved_events.content_format_id,
      count(*)::bigint as event_count
    from saved_events
    group by saved_events.structure_id, saved_events.content_format_id
  ),
  scheduled_by_format as (
    select
      scheduled_events.structure_id,
      scheduled_events.content_format_id,
      count(*)::bigint as event_count
    from scheduled_events
    group by scheduled_events.structure_id, scheduled_events.content_format_id
  ),
  published_by_format as (
    select
      published_events.structure_id,
      published_events.content_format_id,
      count(*)::bigint as event_count
    from published_events
    group by published_events.structure_id, published_events.content_format_id
  ),
  views_by_format as (
    select
      view_events.structure_id,
      view_events.content_format_id,
      count(*)::bigint as evaluated_count,
      sum(view_events.view_count)::bigint as total_views,
      avg(view_events.view_count)::numeric as average_views,
      percentile_cont(0.5) within group (
        order by view_events.view_count
      )::numeric as median_views
    from view_events
    group by view_events.structure_id, view_events.content_format_id
  ),
  format_rollup as (
    select
      'format'::text as analytics_scope,
      key.structure_id,
      key.content_format_id,
      coalesce(generated.event_count, 0::bigint) as generated_count,
      coalesce(saved.event_count, 0::bigint) as saved_count,
      coalesce(scheduled.event_count, 0::bigint) as scheduled_count,
      coalesce(published.event_count, 0::bigint) as published_count,
      coalesce(views.evaluated_count, 0::bigint) as evaluated_post_count,
      coalesce(views.total_views, 0::bigint) as total_view_count,
      views.average_views as average_view_count,
      views.median_views as median_view_count
    from format_keys as key
    left join generated_by_format as generated
      on generated.structure_id = key.structure_id
      and generated.content_format_id = key.content_format_id
    left join saved_by_format as saved
      on saved.structure_id = key.structure_id
      and saved.content_format_id = key.content_format_id
    left join scheduled_by_format as scheduled
      on scheduled.structure_id = key.structure_id
      and scheduled.content_format_id = key.content_format_id
    left join published_by_format as published
      on published.structure_id = key.structure_id
      and published.content_format_id = key.content_format_id
    left join views_by_format as views
      on views.structure_id = key.structure_id
      and views.content_format_id = key.content_format_id
  ),
  generated_by_structure as (
    select generated_events.structure_id, count(*)::bigint as event_count
    from generated_events
    group by generated_events.structure_id
  ),
  saved_by_structure as (
    select saved_events.structure_id, count(*)::bigint as event_count
    from saved_events
    group by saved_events.structure_id
  ),
  scheduled_by_structure as (
    select scheduled_events.structure_id, count(*)::bigint as event_count
    from scheduled_events
    group by scheduled_events.structure_id
  ),
  published_by_structure as (
    select published_events.structure_id, count(*)::bigint as event_count
    from published_events
    group by published_events.structure_id
  ),
  views_by_structure as (
    select
      view_events.structure_id,
      count(*)::bigint as evaluated_count,
      sum(view_events.view_count)::bigint as total_views,
      avg(view_events.view_count)::numeric as average_views,
      percentile_cont(0.5) within group (
        order by view_events.view_count
      )::numeric as median_views
    from view_events
    group by view_events.structure_id
  ),
  structure_rollup as (
    select
      'structure'::text as analytics_scope,
      structure.structure_id,
      null::text as content_format_id,
      coalesce(generated.event_count, 0::bigint) as generated_count,
      coalesce(saved.event_count, 0::bigint) as saved_count,
      coalesce(scheduled.event_count, 0::bigint) as scheduled_count,
      coalesce(published.event_count, 0::bigint) as published_count,
      coalesce(views.evaluated_count, 0::bigint) as evaluated_post_count,
      coalesce(views.total_views, 0::bigint) as total_view_count,
      views.average_views as average_view_count,
      views.median_views as median_view_count
    from structures as structure
    left join generated_by_structure as generated
      on generated.structure_id = structure.structure_id
    left join saved_by_structure as saved
      on saved.structure_id = structure.structure_id
    left join scheduled_by_structure as scheduled
      on scheduled.structure_id = structure.structure_id
    left join published_by_structure as published
      on published.structure_id = structure.structure_id
    left join views_by_structure as views
      on views.structure_id = structure.structure_id
  ),
  combined as (
    select * from structure_rollup
    union all
    select * from format_rollup
  )
  select
    combined.analytics_scope,
    combined.structure_id,
    combined.content_format_id,
    combined.generated_count,
    combined.saved_count,
    combined.scheduled_count,
    combined.published_count,
    combined.evaluated_post_count,
    combined.total_view_count,
    combined.average_view_count,
    combined.median_view_count
  from combined
  order by
    case when combined.analytics_scope = 'structure' then 0 else 1 end,
    combined.structure_id,
    combined.content_format_id nulls first;
end;
$$;

revoke all on function public.get_carousel_admin_analytics(integer)
  from public, anon, authenticated;
grant execute on function public.get_carousel_admin_analytics(integer)
  to service_role;

comment on function public.get_carousel_admin_analytics(integer) is
  'Service-only Phase 8 dashboard analytics. Structure and format identities remain paired, lifecycle counts come from their authoritative records, and views use frozen seven-day evidence only.';

select pg_notify('pgrst', 'reload schema');
