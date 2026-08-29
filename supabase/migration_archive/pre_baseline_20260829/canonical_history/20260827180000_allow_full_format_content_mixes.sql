-- A user may devote the complete daily Trending allowance to any one format.
-- Existing 0–50 preferences remain valid under these widened constraints.
alter table public.trending_content_mix_preferences
  drop constraint if exists trending_content_mix_preferences_percentages_check;

alter table public.trending_content_mix_preferences
  add constraint trending_content_mix_preferences_percentages_check check (
    carousel_percent between 0 and 100
    and wall_text_percent between 0 and 100
    and hook_video_percent between 0 and 100
    and carousel_percent + wall_text_percent + hook_video_percent = 100
  );

alter table public.daily_trending_feeds
  drop constraint if exists daily_trending_feeds_mix_check;

alter table public.daily_trending_feeds
  add constraint daily_trending_feeds_mix_check check (
    carousel_percent between 0 and 100
    and wall_text_percent between 0 and 100
    and hook_video_percent between 0 and 100
    and carousel_percent + wall_text_percent + hook_video_percent = 100
  );

create or replace function public.save_trending_content_mix_preference(
  p_user_id text,
  p_carousel_percent integer,
  p_wall_text_percent integer,
  p_hook_video_percent integer
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  resolved_version integer;
begin
  if p_user_id is null or char_length(trim(p_user_id)) = 0 then
    raise exception 'invalid_trending_mix_user';
  end if;

  if p_carousel_percent + p_wall_text_percent + p_hook_video_percent <> 100
    or p_carousel_percent not between 0 and 100
    or p_wall_text_percent not between 0 and 100
    or p_hook_video_percent not between 0 and 100
  then
    raise exception 'invalid_trending_content_mix';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('trending-mix:' || p_user_id, 0));

  insert into public.trending_content_mix_preferences (
    user_id,
    carousel_percent,
    wall_text_percent,
    hook_video_percent,
    preference_version,
    updated_at
  )
  values (
    p_user_id,
    p_carousel_percent,
    p_wall_text_percent,
    p_hook_video_percent,
    1,
    now()
  )
  on conflict (user_id) do update
  set
    carousel_percent = excluded.carousel_percent,
    wall_text_percent = excluded.wall_text_percent,
    hook_video_percent = excluded.hook_video_percent,
    preference_version = public.trending_content_mix_preferences.preference_version + 1,
    updated_at = now()
  returning preference_version into resolved_version;

  return resolved_version;
end;
$$;

revoke all on function public.save_trending_content_mix_preference(
  text, integer, integer, integer
) from public, anon, authenticated;

grant execute on function public.save_trending_content_mix_preference(
  text, integer, integer, integer
) to service_role;

-- Keep the durable slot-repair behavior from the latest planning function;
-- only the permitted saved percentages change.
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
  inserted_slot_count integer := 0;
begin
  if p_user_id is null or char_length(trim(p_user_id)) = 0 then
    raise exception 'invalid_daily_trending_user';
  end if;

  if p_daily_limit < 1 or coalesce(array_length(p_formats, 1), 0) <> p_daily_limit then
    raise exception 'invalid_daily_trending_plan_size';
  end if;

  if p_carousel_percent + p_wall_text_percent + p_hook_video_percent <> 100
    or p_carousel_percent not between 0 and 100
    or p_wall_text_percent not between 0 and 100
    or p_hook_video_percent not between 0 and 100
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
  else
    -- Preserve an immutable existing format while repairing missing slots.
    insert into public.daily_trending_feed_slots (feed_id, position, format)
    select
      resolved_feed_id,
      requested.ordinality::integer,
      requested.format
    from unnest(p_formats) with ordinality as requested(format, ordinality)
    on conflict (feed_id, position) do nothing;

    get diagnostics inserted_slot_count = row_count;

    if resolved_daily_limit < p_daily_limit then
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
    elsif inserted_slot_count > 0 then
      update public.daily_trending_feeds
      set
        status = 'preparing',
        last_error = null,
        updated_at = now()
      where id = resolved_feed_id;
    end if;
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
