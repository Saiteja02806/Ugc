update public.subscription_entitlements
set
  daily_trending_limit = 10,
  display_name = 'Free',
  is_active = true,
  updated_at = now()
where plan_key = 'free';

create or replace function public.ensure_daily_trending_feed_plan(
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_local_date date,
  p_timezone text,
  p_plan_key text,
  p_plan_display_name text,
  p_daily_limit integer,
  p_carousel_percent integer,
  p_wall_text_percent integer,
  p_hook_video_percent integer,
  p_preference_version integer,
  p_formats text[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  resolved_daily_limit integer;
  resolved_feed_id uuid;
begin
  if p_user_id is null or char_length(trim(p_user_id)) = 0 then
    raise exception 'invalid_daily_trending_user';
  end if;

  if p_daily_limit < 1 or coalesce(array_length(p_formats, 1), 0) <> p_daily_limit then
    raise exception 'invalid_daily_trending_plan_size';
  end if;

  if p_carousel_percent + p_wall_text_percent + p_hook_video_percent <> 100
    or p_carousel_percent not between 0 and 100
    or p_wall_text_percent not between 0 and 50
    or p_hook_video_percent not between 0 and 50
  then
    raise exception 'invalid_daily_trending_mix';
  end if;

  if exists (
    select 1
    from unnest(p_formats) as requested_format
    where requested_format not in ('carousel', 'hook_video', 'wall_text')
  ) then
    raise exception 'invalid_daily_trending_format';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id || ':' || p_local_date::text, 0)
  );

  select feed.id, feed.daily_limit
  into resolved_feed_id, resolved_daily_limit
  from public.daily_trending_feeds as feed
  where feed.user_id = p_user_id
    and feed.local_date = p_local_date;

  if resolved_feed_id is null then
    insert into public.daily_trending_feeds (
      user_id,
      business_profile_id,
      business_profile_version,
      local_date,
      timezone,
      plan_key,
      plan_display_name,
      daily_limit,
      carousel_percent,
      wall_text_percent,
      hook_video_percent,
      preference_version
    )
    values (
      p_user_id,
      p_business_profile_id,
      p_business_profile_version,
      p_local_date,
      p_timezone,
      p_plan_key,
      p_plan_display_name,
      p_daily_limit,
      p_carousel_percent,
      p_wall_text_percent,
      p_hook_video_percent,
      p_preference_version
    )
    returning id into resolved_feed_id;

    insert into public.daily_trending_feed_slots (feed_id, position, format)
    select
      resolved_feed_id,
      requested.ordinality::integer,
      requested.format
    from unnest(p_formats) with ordinality as requested(format, ordinality);
  elsif resolved_daily_limit < p_daily_limit then
    insert into public.daily_trending_feed_slots (feed_id, position, format)
    select
      resolved_feed_id,
      requested.ordinality::integer,
      requested.format
    from unnest(p_formats) with ordinality as requested(format, ordinality)
    where requested.ordinality > resolved_daily_limit
    on conflict (feed_id, position) do nothing;

    update public.daily_trending_feeds
    set
      timezone = p_timezone,
      plan_key = p_plan_key,
      plan_display_name = p_plan_display_name,
      daily_limit = p_daily_limit,
      carousel_percent = p_carousel_percent,
      wall_text_percent = p_wall_text_percent,
      hook_video_percent = p_hook_video_percent,
      preference_version = p_preference_version,
      status = 'preparing',
      last_error = null,
      updated_at = now()
    where id = resolved_feed_id;
  end if;

  return resolved_feed_id;
end;
$$;

revoke all on function public.ensure_daily_trending_feed_plan(
  text, uuid, integer, date, text, text, text, integer,
  integer, integer, integer, integer, text[]
) from public, anon, authenticated;

grant execute on function public.ensure_daily_trending_feed_plan(
  text, uuid, integer, date, text, text, text, integer,
  integer, integer, integer, integer, text[]
) to service_role;

select pg_notify('pgrst', 'reload schema');
