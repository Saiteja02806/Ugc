alter table public.subscription_entitlements
  add column if not exists daily_trending_limit integer;

update public.subscription_entitlements
set
  display_name = 'Starter',
  daily_trending_limit = 20,
  updated_at = now()
where plan_key = 'pro';

insert into public.subscription_entitlements (
  plan_key,
  display_name,
  daily_carousel_limit,
  daily_trending_limit,
  is_active
)
values ('creator', 'Growth', 10, 50, true)
on conflict (plan_key) do update
set
  display_name = excluded.display_name,
  daily_trending_limit = excluded.daily_trending_limit,
  is_active = excluded.is_active,
  updated_at = now();

update public.subscription_entitlements
set
  display_name = 'Growth (legacy)',
  daily_trending_limit = 50,
  is_active = false,
  updated_at = now()
where plan_key = 'ultra_pro';

alter table public.subscription_entitlements
  drop constraint if exists subscription_entitlements_daily_trending_limit_check;

alter table public.subscription_entitlements
  add constraint subscription_entitlements_daily_trending_limit_check
  check (daily_trending_limit is null or daily_trending_limit > 0);

create table if not exists public.trending_content_mix_preferences (
  user_id text primary key,
  carousel_percent integer not null default 25,
  wall_text_percent integer not null default 50,
  hook_video_percent integer not null default 25,
  preference_version integer not null default 1 check (preference_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trending_content_mix_preferences_percentages_check check (
    carousel_percent between 0 and 100
    and wall_text_percent between 0 and 50
    and hook_video_percent between 0 and 50
    and carousel_percent + wall_text_percent + hook_video_percent = 100
  )
);

create table if not exists public.daily_trending_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  business_profile_id uuid not null
    references public.business_profiles(id) on delete cascade,
  business_profile_version integer not null
    check (business_profile_version > 0),
  local_date date not null,
  timezone text not null
    check (char_length(trim(timezone)) between 1 and 100),
  plan_key text not null
    references public.subscription_entitlements(plan_key),
  plan_display_name text not null,
  daily_limit integer not null check (daily_limit > 0),
  carousel_percent integer not null,
  wall_text_percent integer not null,
  hook_video_percent integer not null,
  preference_version integer not null check (preference_version > 0),
  status text not null default 'preparing'
    check (status in ('preparing', 'ready', 'completed', 'failed')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_trending_feeds_mix_check check (
    carousel_percent between 0 and 100
    and wall_text_percent between 0 and 50
    and hook_video_percent between 0 and 50
    and carousel_percent + wall_text_percent + hook_video_percent = 100
  ),
  unique (user_id, local_date)
);

create index if not exists daily_trending_feeds_user_date_idx
  on public.daily_trending_feeds (user_id, local_date desc);

create index if not exists daily_trending_feeds_profile_idx
  on public.daily_trending_feeds (
    business_profile_id,
    business_profile_version,
    local_date desc
  );

create table if not exists public.daily_trending_feed_slots (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null
    references public.daily_trending_feeds(id) on delete cascade,
  position integer not null check (position > 0),
  format text not null
    check (format in ('carousel', 'hook_video', 'wall_text')),
  state text not null default 'planned'
    check (state in ('planned', 'preparing', 'ready', 'decided', 'failed')),
  source text not null default 'new'
    check (source in ('new', 'carried')),
  carousel_assignment_id uuid
    references public.user_carousel_assignments(id) on delete restrict,
  hook_video_assignment_id uuid
    references public.user_hook_video_assignments(id) on delete restrict,
  wall_text_assignment_id uuid
    references public.user_wall_text_assignments(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_trending_feed_slots_assignment_check check (
    (
      state in ('planned', 'preparing', 'failed')
      and carousel_assignment_id is null
      and hook_video_assignment_id is null
      and wall_text_assignment_id is null
    )
    or (
      state in ('ready', 'decided')
      and (
        (
          format = 'carousel'
          and carousel_assignment_id is not null
          and hook_video_assignment_id is null
          and wall_text_assignment_id is null
        )
        or (
          format = 'hook_video'
          and carousel_assignment_id is null
          and hook_video_assignment_id is not null
          and wall_text_assignment_id is null
        )
        or (
          format = 'wall_text'
          and carousel_assignment_id is null
          and hook_video_assignment_id is null
          and wall_text_assignment_id is not null
        )
      )
    )
  ),
  unique (feed_id, position)
);

create unique index if not exists daily_trending_feed_slots_carousel_assignment_uidx
  on public.daily_trending_feed_slots (carousel_assignment_id)
  where carousel_assignment_id is not null;

create unique index if not exists daily_trending_feed_slots_hook_assignment_uidx
  on public.daily_trending_feed_slots (hook_video_assignment_id)
  where hook_video_assignment_id is not null;

create unique index if not exists daily_trending_feed_slots_wall_assignment_uidx
  on public.daily_trending_feed_slots (wall_text_assignment_id)
  where wall_text_assignment_id is not null;

create index if not exists daily_trending_feed_slots_feed_state_idx
  on public.daily_trending_feed_slots (feed_id, state, position);

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
    or p_wall_text_percent not between 0 and 50
    or p_hook_video_percent not between 0 and 50
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

  perform pg_advisory_xact_lock(hashtextextended(p_user_id || ':' || p_local_date::text, 0));

  select feed.id
  into resolved_feed_id
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
  end if;

  return resolved_feed_id;
end;
$$;

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

  perform pg_advisory_xact_lock(hashtextextended(feed_record.user_id || ':' || feed_record.local_date::text, 0));

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
          where used_slot.carousel_assignment_id = candidate.assignment_id
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
      when not exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
          and slot.state in ('planned', 'preparing', 'failed')
      ) then 'ready'
      else 'preparing'
    end,
    last_error = null,
    updated_at = now()
  where id = p_feed_id;
end;
$$;

create or replace function public.mark_daily_trending_feed_slot_decided(
  p_user_id text,
  p_format text,
  p_assignment_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  resolved_slot_id uuid;
  resolved_feed_id uuid;
begin
  if p_format not in ('carousel', 'hook_video', 'wall_text') then
    raise exception 'invalid_daily_trending_format';
  end if;

  select slot.id, slot.feed_id
  into resolved_slot_id, resolved_feed_id
  from public.daily_trending_feed_slots as slot
  join public.daily_trending_feeds as feed on feed.id = slot.feed_id
  where feed.user_id = p_user_id
    and slot.state = 'ready'
    and (
      (p_format = 'carousel' and slot.carousel_assignment_id = p_assignment_id)
      or (p_format = 'hook_video' and slot.hook_video_assignment_id = p_assignment_id)
      or (p_format = 'wall_text' and slot.wall_text_assignment_id = p_assignment_id)
    )
  order by feed.local_date desc
  limit 1
  for update of slot;

  if resolved_slot_id is null then
    return null;
  end if;

  update public.daily_trending_feed_slots
  set state = 'decided', updated_at = now()
  where id = resolved_slot_id;

  update public.daily_trending_feeds
  set
    status = case
      when not exists (
        select 1
        from public.daily_trending_feed_slots as remaining_slot
        where remaining_slot.feed_id = resolved_feed_id
          and remaining_slot.state <> 'decided'
      ) then 'completed'
      else status
    end,
    updated_at = now()
  where id = resolved_feed_id;

  return resolved_slot_id;
end;
$$;

create or replace function public.replan_daily_trending_unbound_slots(
  p_user_id text,
  p_feed_id uuid,
  p_positions integer[],
  p_formats text[],
  p_carousel_percent integer,
  p_wall_text_percent integer,
  p_hook_video_percent integer,
  p_preference_version integer
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  changed_count integer := 0;
  requested record;
begin
  if coalesce(array_length(p_positions, 1), 0) <> coalesce(array_length(p_formats, 1), 0) then
    raise exception 'invalid_daily_trending_replan_size';
  end if;

  if p_carousel_percent + p_wall_text_percent + p_hook_video_percent <> 100
    or p_carousel_percent not between 0 and 100
    or p_wall_text_percent not between 0 and 50
    or p_hook_video_percent not between 0 and 50
  then
    raise exception 'invalid_daily_trending_mix';
  end if;

  if not exists (
    select 1
    from public.daily_trending_feeds as feed
    where feed.id = p_feed_id
      and feed.user_id = p_user_id
  ) then
    raise exception 'daily_trending_feed_not_found';
  end if;

  if exists (
    select 1
    from unnest(p_formats) as requested_format
    where requested_format not in ('carousel', 'hook_video', 'wall_text')
  ) then
    raise exception 'invalid_daily_trending_format';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id || ':' || p_feed_id::text, 0));

  for requested in
    select position, format
    from unnest(p_positions, p_formats) as requested_slot(position, format)
  loop
    update public.daily_trending_feed_slots
    set
      format = requested.format,
      state = 'planned',
      updated_at = now()
    where feed_id = p_feed_id
      and position = requested.position
      and state in ('planned', 'failed')
      and carousel_assignment_id is null
      and hook_video_assignment_id is null
      and wall_text_assignment_id is null;

    changed_count := changed_count + case when found then 1 else 0 end;
  end loop;

  update public.daily_trending_feeds
  set
    carousel_percent = p_carousel_percent,
    wall_text_percent = p_wall_text_percent,
    hook_video_percent = p_hook_video_percent,
    preference_version = p_preference_version,
    status = case when changed_count > 0 then 'preparing' else status end,
    updated_at = now()
  where id = p_feed_id
    and user_id = p_user_id;

  return changed_count;
end;
$$;

alter table public.trending_content_mix_preferences enable row level security;
alter table public.daily_trending_feeds enable row level security;
alter table public.daily_trending_feed_slots enable row level security;

revoke all privileges on table public.trending_content_mix_preferences
  from anon, authenticated;
revoke all privileges on table public.daily_trending_feeds
  from anon, authenticated;
revoke all privileges on table public.daily_trending_feed_slots
  from anon, authenticated;

grant select, insert, update on table public.trending_content_mix_preferences
  to service_role;
grant select, insert, update on table public.daily_trending_feeds
  to service_role;
grant select, insert, update on table public.daily_trending_feed_slots
  to service_role;

revoke all on function public.save_trending_content_mix_preference(
  text,
  integer,
  integer,
  integer
) from public, anon, authenticated;
grant execute on function public.save_trending_content_mix_preference(
  text,
  integer,
  integer,
  integer
) to service_role;

revoke all on function public.ensure_daily_trending_feed_plan(
  text,
  uuid,
  integer,
  date,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  text[]
) from public, anon, authenticated;

grant execute on function public.ensure_daily_trending_feed_plan(
  text,
  uuid,
  integer,
  date,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  text[]
) to service_role;

revoke all on function public.attach_daily_trending_feed_assignments(
  uuid,
  uuid[],
  uuid[],
  uuid[]
) from public, anon, authenticated;
grant execute on function public.attach_daily_trending_feed_assignments(
  uuid,
  uuid[],
  uuid[],
  uuid[]
) to service_role;

revoke all on function public.mark_daily_trending_feed_slot_decided(
  text,
  text,
  uuid
) from public, anon, authenticated;
grant execute on function public.mark_daily_trending_feed_slot_decided(
  text,
  text,
  uuid
) to service_role;

revoke all on function public.replan_daily_trending_unbound_slots(
  text,
  uuid,
  integer[],
  text[],
  integer,
  integer,
  integer,
  integer
) from public, anon, authenticated;
grant execute on function public.replan_daily_trending_unbound_slots(
  text,
  uuid,
  integer[],
  text[],
  integer,
  integer,
  integer,
  integer
) to service_role;

select pg_notify('pgrst', 'reload schema');
