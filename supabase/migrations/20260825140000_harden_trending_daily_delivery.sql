-- A daily Trending slot is a durable delivery promise. Repair older feeds
-- whose physical slot rows are short of the recorded allowance without
-- changing the format already promised at an existing position.
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
  else
    -- `ON CONFLICT DO NOTHING` preserves the immutable prior format, while
    -- filling any missing position caused by a partial or interrupted write.
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

-- Reopen only ready, unresolved promises. Decided content is never replaced.
-- A provider must explicitly be resolved before a missing item can reopen its
-- slot, so an outage cannot discard an otherwise-valid user delivery.
create or replace function public.reconcile_daily_trending_feed_slot_integrity(
  p_feed_id uuid,
  p_hook_video_assignment_ids uuid[] default array[]::uuid[],
  p_hook_video_provider_resolved boolean default false,
  p_wall_text_assignment_ids uuid[] default array[]::uuid[],
  p_wall_text_provider_resolved boolean default false
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  feed_record public.daily_trending_feeds;
begin
  select *
  into feed_record
  from public.daily_trending_feeds
  where id = p_feed_id;

  if feed_record.id is null then
    raise exception 'daily_trending_feed_not_found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(feed_record.user_id || ':' || feed_record.local_date::text, 0)
  );

  -- A binding can become invalid if its assignment was retired or deleted.
  update public.daily_trending_feed_slots as slot
  set
    carousel_assignment_id = null,
    hook_video_assignment_id = null,
    wall_text_assignment_id = null,
    state = 'planned',
    updated_at = now()
  where slot.feed_id = p_feed_id
    and slot.state = 'ready'
    and (
      (slot.format = 'carousel' and not exists (
        select 1
        from public.user_carousel_assignments as assignment
        where assignment.id = slot.carousel_assignment_id
          and assignment.user_id = feed_record.user_id
          and assignment.business_profile_id = feed_record.business_profile_id
          and assignment.business_profile_version = feed_record.business_profile_version
          and assignment.state in ('pending', 'in_progress')
      ))
      or (slot.format = 'hook_video' and not exists (
        select 1
        from public.user_hook_video_assignments as assignment
        where assignment.id = slot.hook_video_assignment_id
          and assignment.user_id = feed_record.user_id
          and assignment.business_profile_id = feed_record.business_profile_id
          and assignment.business_profile_version = feed_record.business_profile_version
          and assignment.state = 'active'
      ))
      or (slot.format = 'wall_text' and not exists (
        select 1
        from public.user_wall_text_assignments as assignment
        where assignment.id = slot.wall_text_assignment_id
          and assignment.user_id = feed_record.user_id
          and assignment.business_profile_id = feed_record.business_profile_id
          and assignment.business_profile_version = feed_record.business_profile_version
          and assignment.state = 'active'
      ))
    );

  -- Valid assignments whose assets no longer satisfy the provider contract
  -- are also replaced. This deliberately runs only after a successful provider
  -- read; provider errors leave all user-visible slots untouched.
  if p_hook_video_provider_resolved then
    update public.daily_trending_feed_slots as slot
    set
      carousel_assignment_id = null,
      hook_video_assignment_id = null,
      wall_text_assignment_id = null,
      state = 'planned',
      updated_at = now()
    where slot.feed_id = p_feed_id
      and slot.format = 'hook_video'
      and slot.state = 'ready'
      and not (slot.hook_video_assignment_id = any(p_hook_video_assignment_ids));
  end if;

  if p_wall_text_provider_resolved then
    update public.daily_trending_feed_slots as slot
    set
      carousel_assignment_id = null,
      hook_video_assignment_id = null,
      wall_text_assignment_id = null,
      state = 'planned',
      updated_at = now()
    where slot.feed_id = p_feed_id
      and slot.format = 'wall_text'
      and slot.state = 'ready'
      and not (slot.wall_text_assignment_id = any(p_wall_text_assignment_ids));
  end if;

  update public.daily_trending_feeds
  set
    status = case
      when (
        select count(*)
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
      ) = feed_record.daily_limit
      and not exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
          and slot.state <> 'decided'
      ) then 'completed'
      when exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
          and slot.state = 'ready'
      ) then 'ready'
      when exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
          and slot.state in ('planned', 'preparing')
      ) then 'preparing'
      else 'failed'
    end,
    last_error = null,
    updated_at = now()
  where id = p_feed_id;
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

revoke all on function public.reconcile_daily_trending_feed_slot_integrity(
  uuid, uuid[], boolean, uuid[], boolean
) from public, anon, authenticated;

grant execute on function public.reconcile_daily_trending_feed_slot_integrity(
  uuid, uuid[], boolean, uuid[], boolean
) to service_role;

select pg_notify('pgrst', 'reload schema');
