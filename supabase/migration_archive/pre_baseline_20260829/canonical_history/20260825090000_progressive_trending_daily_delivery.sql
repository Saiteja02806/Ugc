-- A daily Carousel assignment may be carried forward by the legacy inventory
-- feed. It can therefore appear in one unified feed per local day, but never
-- more than once inside the same daily feed.
drop index if exists public.daily_trending_feed_slots_carousel_assignment_uidx;

create unique index if not exists daily_trending_feed_slots_feed_carousel_assignment_uidx
  on public.daily_trending_feed_slots (feed_id, carousel_assignment_id)
  where carousel_assignment_id is not null;

create or replace function public.attach_daily_trending_feed_assignments(
  p_feed_id uuid,
  p_carousel_assignment_ids uuid[] default array[]::uuid[],
  p_hook_video_assignment_ids uuid[] default array[]::uuid[],
  p_wall_text_assignment_ids uuid[] default array[]::uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  feed_record public.daily_trending_feeds;
  slot_record public.daily_trending_feed_slots;
  resolved_assignment_id uuid;
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

  for slot_record in
    select *
    from public.daily_trending_feed_slots
    where feed_id = p_feed_id
      and state in ('planned', 'failed')
    order by position
    for update
  loop
    resolved_assignment_id := null;

    if slot_record.format = 'carousel' then
      select candidate.assignment_id
      into resolved_assignment_id
      from unnest(p_carousel_assignment_ids) with ordinality
        as candidate(assignment_id, ordinality)
      join public.user_carousel_assignments as assignment
        on assignment.id = candidate.assignment_id
      where assignment.user_id = feed_record.user_id
        and assignment.business_profile_id = feed_record.business_profile_id
        and assignment.business_profile_version = feed_record.business_profile_version
        and assignment.state in ('pending', 'in_progress')
        and not exists (
          select 1
          from public.daily_trending_feed_slots as used_slot
          where used_slot.feed_id = p_feed_id
            and used_slot.carousel_assignment_id = candidate.assignment_id
        )
      order by candidate.ordinality
      limit 1;

      if resolved_assignment_id is not null then
        update public.daily_trending_feed_slots
        set
          carousel_assignment_id = resolved_assignment_id,
          state = 'ready',
          updated_at = now()
        where id = slot_record.id;
      end if;
    elsif slot_record.format = 'hook_video' then
      select candidate.assignment_id
      into resolved_assignment_id
      from unnest(p_hook_video_assignment_ids) with ordinality
        as candidate(assignment_id, ordinality)
      join public.user_hook_video_assignments as assignment
        on assignment.id = candidate.assignment_id
      where assignment.user_id = feed_record.user_id
        and assignment.business_profile_id = feed_record.business_profile_id
        and assignment.business_profile_version = feed_record.business_profile_version
        and assignment.state = 'active'
        and not exists (
          select 1
          from public.daily_trending_feed_slots as used_slot
          where used_slot.hook_video_assignment_id = candidate.assignment_id
        )
      order by candidate.ordinality
      limit 1;

      if resolved_assignment_id is not null then
        update public.daily_trending_feed_slots
        set
          hook_video_assignment_id = resolved_assignment_id,
          state = 'ready',
          updated_at = now()
        where id = slot_record.id;
      end if;
    elsif slot_record.format = 'wall_text' then
      select candidate.assignment_id
      into resolved_assignment_id
      from unnest(p_wall_text_assignment_ids) with ordinality
        as candidate(assignment_id, ordinality)
      join public.user_wall_text_assignments as assignment
        on assignment.id = candidate.assignment_id
      where assignment.user_id = feed_record.user_id
        and assignment.business_profile_id = feed_record.business_profile_id
        and assignment.business_profile_version = feed_record.business_profile_version
        and assignment.state = 'active'
        and not exists (
          select 1
          from public.daily_trending_feed_slots as used_slot
          where used_slot.wall_text_assignment_id = candidate.assignment_id
        )
      order by candidate.ordinality
      limit 1;

      if resolved_assignment_id is not null then
        update public.daily_trending_feed_slots
        set
          wall_text_assignment_id = resolved_assignment_id,
          state = 'ready',
          updated_at = now()
        where id = slot_record.id;
      end if;
    end if;
  end loop;

  update public.daily_trending_feeds
  set
    status = case
      when not exists (
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
    last_error = case
      when exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
          and slot.state in ('ready', 'planned', 'preparing')
      ) then null
      else last_error
    end,
    updated_at = now()
  where id = p_feed_id;
end;
$$;

create or replace function public.mark_daily_trending_feed_formats_failed(
  p_feed_id uuid,
  p_formats text[],
  p_message text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  feed_record public.daily_trending_feeds;
begin
  if coalesce(array_length(p_formats, 1), 0) = 0 then
    return;
  end if;

  if exists (
    select 1
    from unnest(p_formats) as requested_format
    where requested_format not in ('carousel', 'hook_video', 'wall_text')
  ) then
    raise exception 'invalid_daily_trending_format';
  end if;

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

  update public.daily_trending_feed_slots
  set state = 'failed', updated_at = now()
  where feed_id = p_feed_id
    and format = any(p_formats)
    and state in ('planned', 'preparing')
    and carousel_assignment_id is null
    and hook_video_assignment_id is null
    and wall_text_assignment_id is null;

  update public.daily_trending_feeds
  set
    status = case
      when not exists (
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
    last_error = case
      when exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
          and slot.state in ('ready', 'planned', 'preparing')
      ) then null
      else nullif(left(btrim(coalesce(p_message, '')), 1000), '')
    end,
    updated_at = now()
  where id = p_feed_id;
end;
$$;

-- Repair legacy whole-pack statuses from the durable slot state. This only
-- corrects status/error metadata; it does not recreate, delete, or alter a
-- user's content assignments.
with derived_status as (
  select
    feed.id,
    case
      when not exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = feed.id
          and slot.state <> 'decided'
      ) then 'completed'
      when exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = feed.id
          and slot.state = 'ready'
      ) then 'ready'
      when exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = feed.id
          and slot.state in ('planned', 'preparing')
      ) then 'preparing'
      else 'failed'
    end as status
  from public.daily_trending_feeds as feed
)
update public.daily_trending_feeds as feed
set
  status = derived_status.status,
  last_error = case
    when derived_status.status in ('completed', 'preparing', 'ready') then null
    else feed.last_error
  end,
  updated_at = now()
from derived_status
where feed.id = derived_status.id
  and (
    feed.status is distinct from derived_status.status
    or (
      derived_status.status in ('completed', 'preparing', 'ready')
      and feed.last_error is not null
    )
  );

revoke all on function public.mark_daily_trending_feed_formats_failed(
  uuid,
  text[],
  text
) from public, anon, authenticated;

grant execute on function public.mark_daily_trending_feed_formats_failed(
  uuid,
  text[],
  text
) to service_role;

select pg_notify('pgrst', 'reload schema');
