create table if not exists public.hook_performance_observations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  hook_video_suggestion_id uuid not null
    references public.hook_video_suggestions(id) on delete cascade,
  hook_video_draft_id uuid not null
    references public.hook_video_drafts(id) on delete cascade,
  scheduled_post_target_id uuid not null
    references public.scheduled_post_targets(id) on delete cascade,
  social_connection_id uuid not null
    references public.social_connections(id) on delete cascade,
  platform text not null
    check (platform in ('instagram', 'tiktok')),
  platform_post_id text not null
    check (char_length(trim(platform_post_id)) between 1 and 240),
  source text not null default 'platform_api'
    check (source in ('platform_api', 'conversion_api')),

  view_count bigint check (view_count is null or view_count >= 0),
  reach_count bigint check (reach_count is null or reach_count >= 0),
  interaction_count bigint check (interaction_count is null or interaction_count >= 0),
  like_count bigint check (like_count is null or like_count >= 0),
  comment_count bigint check (comment_count is null or comment_count >= 0),
  share_count bigint check (share_count is null or share_count >= 0),
  save_count bigint check (save_count is null or save_count >= 0),
  watch_time_seconds numeric check (
    watch_time_seconds is null or watch_time_seconds >= 0
  ),
  average_watch_time_seconds numeric check (
    average_watch_time_seconds is null or average_watch_time_seconds >= 0
  ),
  completion_rate numeric check (
    completion_rate is null or completion_rate between 0 and 1
  ),
  click_count bigint check (click_count is null or click_count >= 0),
  conversion_count bigint check (
    conversion_count is null or conversion_count >= 0
  ),
  attributed_sales_amount numeric check (
    attributed_sales_amount is null or attributed_sales_amount >= 0
  ),
  attributed_sales_currency text check (
    attributed_sales_currency is null or
    attributed_sales_currency ~ '^[A-Z]{3}$'
  ),

  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists hook_performance_target_idx
  on public.hook_performance_observations (scheduled_post_target_id);

create index if not exists hook_performance_user_observed_idx
  on public.hook_performance_observations (user_id, observed_at desc);

create index if not exists hook_performance_suggestion_idx
  on public.hook_performance_observations (
    hook_video_suggestion_id,
    observed_at desc
  );

alter table public.hook_performance_observations enable row level security;

revoke all privileges on table public.hook_performance_observations
  from anon, authenticated;

grant select, insert, update, delete
  on table public.hook_performance_observations
  to service_role;

create or replace function public.hook_performance_nonnegative_numeric(
  p_metrics jsonb,
  p_key text
)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_value jsonb;
  v_number numeric;
begin
  v_value := p_metrics -> p_key;

  if v_value is null or jsonb_typeof(v_value) <> 'number' then
    return null;
  end if;

  v_number := (v_value #>> '{}')::numeric;
  return case when v_number >= 0 then v_number else null end;
exception
  when numeric_value_out_of_range or invalid_text_representation then
    return null;
end
$$;

create or replace function public.hook_performance_nonnegative_bigint(
  p_metrics jsonb,
  p_key text
)
returns bigint
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_number numeric;
begin
  v_number := public.hook_performance_nonnegative_numeric(p_metrics, p_key);

  if v_number is null or
     trunc(v_number) <> v_number or
     v_number > 9223372036854775807 then
    return null;
  end if;

  return v_number::bigint;
end
$$;

create or replace function public.hook_performance_rate(
  p_metrics jsonb,
  p_key text
)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_number numeric;
begin
  v_number := public.hook_performance_nonnegative_numeric(p_metrics, p_key);
  return case when v_number between 0 and 1 then v_number else null end;
end
$$;

create or replace function public.hook_performance_currency(
  p_metrics jsonb,
  p_key text
)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when jsonb_typeof(p_metrics -> p_key) = 'string' and
         upper(p_metrics ->> p_key) ~ '^[A-Z]{3}$'
      then upper(p_metrics ->> p_key)
    else null
  end
$$;

revoke all on function public.hook_performance_nonnegative_numeric(jsonb, text)
  from public, anon, authenticated;
revoke all on function public.hook_performance_nonnegative_bigint(jsonb, text)
  from public, anon, authenticated;
revoke all on function public.hook_performance_rate(jsonb, text)
  from public, anon, authenticated;
revoke all on function public.hook_performance_currency(jsonb, text)
  from public, anon, authenticated;

create or replace function public.record_hook_performance_observation(
  p_user_id text,
  p_platform text,
  p_social_connection_id uuid,
  p_platform_post_id text,
  p_observed_at timestamptz,
  p_metrics jsonb
)
returns table(recorded boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target public.scheduled_post_targets%rowtype;
  v_draft public.hook_video_drafts%rowtype;
begin
  if p_platform not in ('instagram', 'tiktok') or
     nullif(trim(p_platform_post_id), '') is null or
     jsonb_typeof(p_metrics) is distinct from 'object' then
    raise exception 'hook_performance_input_invalid';
  end if;

  select target.*
  into v_target
  from public.scheduled_post_targets target
  where target.user_id = p_user_id
    and target.platform = p_platform
    and target.social_connection_id = p_social_connection_id
    and target.platform_post_id = p_platform_post_id
    and target.status = 'published'
  order by target.published_at desc nulls last, target.created_at desc
  limit 1;

  if not found then
    return query select false;
    return;
  end if;

  select draft.*
  into v_draft
  from public.hook_video_drafts draft
  where draft.user_id = p_user_id
    and draft.scheduled_post_id = v_target.scheduled_post_id
  limit 1;

  if not found then
    return query select false;
    return;
  end if;

  insert into public.hook_performance_observations (
    user_id,
    hook_video_suggestion_id,
    hook_video_draft_id,
    scheduled_post_target_id,
    social_connection_id,
    platform,
    platform_post_id,
    source,
    view_count,
    reach_count,
    interaction_count,
    like_count,
    comment_count,
    share_count,
    save_count,
    watch_time_seconds,
    average_watch_time_seconds,
    completion_rate,
    click_count,
    conversion_count,
    attributed_sales_amount,
    attributed_sales_currency,
    observed_at
  ) values (
    p_user_id,
    v_draft.selected_hook_id,
    v_draft.id,
    v_target.id,
    p_social_connection_id,
    p_platform,
    trim(p_platform_post_id),
    'platform_api',
    public.hook_performance_nonnegative_bigint(p_metrics, 'viewCount'),
    public.hook_performance_nonnegative_bigint(p_metrics, 'reachCount'),
    public.hook_performance_nonnegative_bigint(p_metrics, 'interactionCount'),
    public.hook_performance_nonnegative_bigint(p_metrics, 'likeCount'),
    public.hook_performance_nonnegative_bigint(p_metrics, 'commentCount'),
    public.hook_performance_nonnegative_bigint(p_metrics, 'shareCount'),
    public.hook_performance_nonnegative_bigint(p_metrics, 'saveCount'),
    public.hook_performance_nonnegative_numeric(p_metrics, 'watchTimeSeconds'),
    public.hook_performance_nonnegative_numeric(p_metrics, 'averageWatchTimeSeconds'),
    public.hook_performance_rate(p_metrics, 'completionRate'),
    public.hook_performance_nonnegative_bigint(p_metrics, 'clickCount'),
    public.hook_performance_nonnegative_bigint(p_metrics, 'conversionCount'),
    public.hook_performance_nonnegative_numeric(p_metrics, 'attributedSalesAmount'),
    public.hook_performance_currency(p_metrics, 'attributedSalesCurrency'),
    p_observed_at
  )
  on conflict (scheduled_post_target_id) do update set
    platform_post_id = excluded.platform_post_id,
    view_count = coalesce(excluded.view_count, hook_performance_observations.view_count),
    reach_count = coalesce(excluded.reach_count, hook_performance_observations.reach_count),
    interaction_count = coalesce(excluded.interaction_count, hook_performance_observations.interaction_count),
    like_count = coalesce(excluded.like_count, hook_performance_observations.like_count),
    comment_count = coalesce(excluded.comment_count, hook_performance_observations.comment_count),
    share_count = coalesce(excluded.share_count, hook_performance_observations.share_count),
    save_count = coalesce(excluded.save_count, hook_performance_observations.save_count),
    watch_time_seconds = coalesce(excluded.watch_time_seconds, hook_performance_observations.watch_time_seconds),
    average_watch_time_seconds = coalesce(excluded.average_watch_time_seconds, hook_performance_observations.average_watch_time_seconds),
    completion_rate = coalesce(excluded.completion_rate, hook_performance_observations.completion_rate),
    click_count = coalesce(excluded.click_count, hook_performance_observations.click_count),
    conversion_count = coalesce(excluded.conversion_count, hook_performance_observations.conversion_count),
    attributed_sales_amount = coalesce(excluded.attributed_sales_amount, hook_performance_observations.attributed_sales_amount),
    attributed_sales_currency = coalesce(excluded.attributed_sales_currency, hook_performance_observations.attributed_sales_currency),
    observed_at = greatest(excluded.observed_at, hook_performance_observations.observed_at),
    updated_at = now();

  return query select true;
end
$$;

revoke all on function public.record_hook_performance_observation(
  text,
  text,
  uuid,
  text,
  timestamptz,
  jsonb
) from public, anon, authenticated;

grant execute on function public.record_hook_performance_observation(
  text,
  text,
  uuid,
  text,
  timestamptz,
  jsonb
) to service_role;

select pg_notify('pgrst', 'reload schema');
