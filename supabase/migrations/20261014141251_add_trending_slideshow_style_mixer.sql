-- A per-account style mixer sits inside the existing slideshow-only Trending
-- format. These columns are additive: current daily packs retain their old
-- behavior until a new plan records a style snapshot.
alter table public.trending_content_mix_preferences
  add column if not exists helpful_tips_percent integer not null default 50,
  add column if not exists product_stories_cta_percent integer not null default 50;

alter table public.daily_trending_feeds
  add column if not exists helpful_tips_percent integer not null default 50,
  add column if not exists product_stories_cta_percent integer not null default 50,
  add column if not exists slideshow_style_mix_enabled boolean not null default false;

alter table public.daily_carousel_feeds
  add column if not exists helpful_tips_percent integer not null default 50,
  add column if not exists product_stories_cta_percent integer not null default 50,
  add column if not exists slideshow_style_mix_enabled boolean not null default false;

alter table public.trending_content_mix_preferences
  drop constraint if exists trending_content_mix_preferences_slideshow_style_mix_check,
  add constraint trending_content_mix_preferences_slideshow_style_mix_check
    check (
      helpful_tips_percent between 0 and 100
      and product_stories_cta_percent between 0 and 100
      and helpful_tips_percent + product_stories_cta_percent = 100
    );

alter table public.daily_trending_feeds
  drop constraint if exists daily_trending_feeds_slideshow_style_mix_check,
  add constraint daily_trending_feeds_slideshow_style_mix_check
    check (
      helpful_tips_percent between 0 and 100
      and product_stories_cta_percent between 0 and 100
      and helpful_tips_percent + product_stories_cta_percent = 100
    );

alter table public.daily_carousel_feeds
  drop constraint if exists daily_carousel_feeds_slideshow_style_mix_check,
  add constraint daily_carousel_feeds_slideshow_style_mix_check
    check (
      helpful_tips_percent between 0 and 100
      and product_stories_cta_percent between 0 and 100
      and helpful_tips_percent + product_stories_cta_percent = 100
    );

alter table public.carousel_experiment_batches
  drop constraint if exists carousel_experiment_batches_structure_selection_mode_check,
  add constraint carousel_experiment_batches_structure_selection_mode_check
    check (
      structure_selection_mode in (
        'legacy_default',
        'rotation',
        'global_override',
        'account_preference'
      )
    );

-- Keep the old five-argument function available during a rolling deployment.
-- New callers use this seven-argument overload so a format-mix save and a
-- slideshow-style save advance together under the existing user advisory lock.
create or replace function public.save_trending_content_mix_preference (
  p_user_id                    text,
  p_carousel_percent           integer,
  p_wall_text_percent          integer,
  p_hook_video_percent         integer,
  p_reaction_percent           integer,
  p_helpful_tips_percent       integer,
  p_product_stories_cta_percent integer
)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  resolved_version integer;
begin
  if p_user_id is null or char_length(trim(p_user_id)) = 0 then
    raise exception 'invalid_trending_mix_user';
  end if;

  if p_carousel_percent + p_wall_text_percent + p_hook_video_percent + p_reaction_percent <> 100
    or p_carousel_percent not between 0 and 100
    or p_wall_text_percent not between 0 and 100
    or p_hook_video_percent not between 0 and 100
    or p_reaction_percent not between 0 and 100
    or p_helpful_tips_percent not between 0 and 100
    or p_product_stories_cta_percent not between 0 and 100
    or p_helpful_tips_percent + p_product_stories_cta_percent <> 100
  then
    raise exception 'invalid_trending_content_mix';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('trending-mix:' || p_user_id, 0));

  insert into public.trending_content_mix_preferences (
    user_id, carousel_percent, wall_text_percent, hook_video_percent,
    reaction_percent, helpful_tips_percent, product_stories_cta_percent,
    preference_version, updated_at
  ) values (
    p_user_id, p_carousel_percent, p_wall_text_percent, p_hook_video_percent,
    p_reaction_percent, p_helpful_tips_percent, p_product_stories_cta_percent,
    1, now()
  ) on conflict (user_id) do update
  set carousel_percent = excluded.carousel_percent,
      wall_text_percent = excluded.wall_text_percent,
      hook_video_percent = excluded.hook_video_percent,
      reaction_percent = excluded.reaction_percent,
      helpful_tips_percent = excluded.helpful_tips_percent,
      product_stories_cta_percent = excluded.product_stories_cta_percent,
      preference_version = public.trending_content_mix_preferences.preference_version + 1,
      updated_at = now()
  returning preference_version into resolved_version;

  return resolved_version;
end;
$$;

grant execute on function public.save_trending_content_mix_preference(text, integer, integer, integer, integer, integer, integer)
  to postgres, service_role;
revoke all on function public.save_trending_content_mix_preference(text, integer, integer, integer, integer, integer, integer)
  from public;

-- Keep style values immutable after the first daily pack reservation. Format
-- upgrades retain their current behavior, but do not overwrite this snapshot.
create or replace function public.ensure_daily_trending_feed_plan (
  p_user_id                    text,
  p_business_profile_id        uuid,
  p_business_profile_version   integer,
  p_local_date                 date,
  p_timezone                   text,
  p_plan_key                   text,
  p_plan_display_name          text,
  p_daily_limit                integer,
  p_carousel_percent           integer,
  p_wall_text_percent          integer,
  p_hook_video_percent         integer,
  p_reaction_percent           integer,
  p_preference_version         integer,
  p_formats                    text[],
  p_helpful_tips_percent       integer,
  p_product_stories_cta_percent integer
)
returns uuid
language plpgsql
set search_path to 'public'
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

  if p_carousel_percent + p_wall_text_percent + p_hook_video_percent + p_reaction_percent <> 100
    or p_carousel_percent not between 0 and 100
    or p_wall_text_percent not between 0 and 100
    or p_hook_video_percent not between 0 and 100
    or p_reaction_percent not between 0 and 100
    or p_helpful_tips_percent not between 0 and 100
    or p_product_stories_cta_percent not between 0 and 100
    or p_helpful_tips_percent + p_product_stories_cta_percent <> 100
  then
    raise exception 'invalid_daily_trending_mix';
  end if;

  if exists (
    select 1 from unnest(p_formats) as requested_format
    where requested_format not in ('carousel', 'hook_video', 'wall_text', 'reaction')
  ) then
    raise exception 'invalid_daily_trending_format';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id || ':' || p_local_date::text, 0));

  select feed.id, feed.daily_limit into resolved_feed_id, resolved_daily_limit
  from public.daily_trending_feeds as feed
  where feed.user_id = p_user_id and feed.local_date = p_local_date;

  if resolved_feed_id is null then
    insert into public.daily_trending_feeds (
      user_id, business_profile_id, business_profile_version, local_date,
      timezone, plan_key, plan_display_name, daily_limit, carousel_percent,
      wall_text_percent, hook_video_percent, reaction_percent, preference_version,
      helpful_tips_percent, product_stories_cta_percent, slideshow_style_mix_enabled
    ) values (
      p_user_id, p_business_profile_id, p_business_profile_version, p_local_date,
      p_timezone, p_plan_key, p_plan_display_name, p_daily_limit, p_carousel_percent,
      p_wall_text_percent, p_hook_video_percent, p_reaction_percent, p_preference_version,
      p_helpful_tips_percent, p_product_stories_cta_percent, true
    ) returning id into resolved_feed_id;

    insert into public.daily_trending_feed_slots (feed_id, position, format)
    select resolved_feed_id, requested.ordinality::integer, requested.format
    from unnest(p_formats) with ordinality as requested(format, ordinality);
  else
    insert into public.daily_trending_feed_slots (feed_id, position, format)
    select resolved_feed_id, requested.ordinality::integer, requested.format
    from unnest(p_formats) with ordinality as requested(format, ordinality)
    on conflict (feed_id, position) do nothing;

    get diagnostics inserted_slot_count = row_count;

    if resolved_daily_limit < p_daily_limit then
      update public.daily_trending_feeds
      set timezone = p_timezone,
          plan_key = p_plan_key,
          plan_display_name = p_plan_display_name,
          daily_limit = p_daily_limit,
          carousel_percent = p_carousel_percent,
          wall_text_percent = p_wall_text_percent,
          hook_video_percent = p_hook_video_percent,
          reaction_percent = p_reaction_percent,
          preference_version = p_preference_version,
          status = 'preparing',
          last_error = null,
          updated_at = now()
      where id = resolved_feed_id;
    elsif inserted_slot_count > 0 then
      update public.daily_trending_feeds
      set status = 'preparing', last_error = null, updated_at = now()
      where id = resolved_feed_id;
    end if;
  end if;

  return resolved_feed_id;
end;
$$;

grant execute on function public.ensure_daily_trending_feed_plan(text, uuid, integer, date, text, text, text, integer, integer, integer, integer, integer, integer, text[], integer, integer)
  to postgres, service_role;
revoke all on function public.ensure_daily_trending_feed_plan(text, uuid, integer, date, text, text, text, integer, integer, integer, integer, integer, integer, text[], integer, integer)
  from public;

-- This overload is used only for a saved account style preference. It preserves
-- exact replay semantics and marks batches so the Structure 1 worker cannot
-- silently take them over as Structure 2 after a planner failure.
create or replace function public.reserve_carousel_experiment_batches (
  p_business_profile_id       uuid,
  p_business_profile_version  integer,
  p_generation_batch_id       uuid,
  p_batch_count               integer,
  p_requested_structures      text[]
)
returns setof public.carousel_experiment_batches
language plpgsql
set search_path to ''
as $$
declare
  v_existing_count integer;
  v_next_sequence integer;
  v_offset integer;
  v_structure_batch_sequence integer;
  v_structure_id text;
  v_structure_mode text;
begin
  if p_batch_count < 1 or p_batch_count > 10 then
    raise exception 'carousel_experiment_batch_count_invalid';
  end if;

  if coalesce(array_length(p_requested_structures, 1), 0) <> p_batch_count
    or exists (
      select 1 from unnest(p_requested_structures) as requested_structure
      where requested_structure not in ('structure_1', 'structure_2')
    ) then
    raise exception 'carousel_experiment_batch_requested_structures_invalid';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_business_profile_id::text, 246813579)
  );

  select settings.structure_mode into v_structure_mode
  from public.carousel_global_settings as settings
  where settings.singleton = true;

  if v_structure_mode is null
     or v_structure_mode not in ('rotate', 'structure_1_only', 'structure_2_only') then
    raise exception 'carousel_global_structure_mode_invalid';
  end if;

  select count(*)::integer into v_existing_count
  from public.carousel_experiment_batches as batch
  where batch.generation_batch_id = p_generation_batch_id
    and batch.business_profile_id = p_business_profile_id
    and batch.business_profile_version = p_business_profile_version;

  if v_existing_count > p_batch_count then
    raise exception 'carousel_experiment_batch_count_cannot_shrink';
  end if;

  if exists (
    select 1
    from (
      select
        batch.requested_structure_id,
        row_number() over (order by batch.batch_sequence) as requested_index
      from public.carousel_experiment_batches as batch
      where batch.generation_batch_id = p_generation_batch_id
        and batch.business_profile_id = p_business_profile_id
        and batch.business_profile_version = p_business_profile_version
    ) as existing_batch
    where existing_batch.requested_structure_id is distinct from
      p_requested_structures[existing_batch.requested_index::integer]
  ) then
    raise exception 'carousel_experiment_batch_structure_replay_mismatch';
  end if;

  select coalesce(max(batch.batch_sequence), -1) + 1 into v_next_sequence
  from public.carousel_experiment_batches as batch
  where batch.business_profile_id = p_business_profile_id;

  for v_offset in v_existing_count..(p_batch_count - 1) loop
    v_structure_id := p_requested_structures[v_offset + 1];

    select coalesce(max(batch.structure_batch_sequence), -1) + 1
    into v_structure_batch_sequence
    from public.carousel_experiment_batches as batch
    where batch.business_profile_id = p_business_profile_id
      and batch.structure_id = v_structure_id;

    insert into public.carousel_experiment_batches (
      business_profile_id,
      business_profile_version,
      generation_batch_id,
      batch_sequence,
      cycle_number,
      cycle_batch_position,
      structure_id,
      structure_version,
      structure_selection_mode,
      structure_mode_snapshot,
      structure_batch_sequence,
      structure_rotation_sequence
    ) values (
      p_business_profile_id,
      p_business_profile_version,
      p_generation_batch_id,
      v_next_sequence + (v_offset - v_existing_count),
      case when v_structure_id = 'structure_1' then (v_structure_batch_sequence / 3) + 1 else null end,
      case when v_structure_id = 'structure_1' then v_structure_batch_sequence % 3 else null end,
      v_structure_id,
      1,
      'account_preference',
      v_structure_mode,
      v_structure_batch_sequence,
      null
    );
  end loop;

  return query
  select batch.*
  from public.carousel_experiment_batches as batch
  where batch.generation_batch_id = p_generation_batch_id
    and batch.business_profile_id = p_business_profile_id
    and batch.business_profile_version = p_business_profile_version
  order by batch.batch_sequence asc;
end;
$$;

grant execute on function public.reserve_carousel_experiment_batches(uuid, integer, uuid, integer, text[])
  to postgres, service_role;
revoke all on function public.reserve_carousel_experiment_batches(uuid, integer, uuid, integer, text[])
  from public;

comment on function public.reserve_carousel_experiment_batches(uuid, integer, uuid, integer, text[])
  is 'Atomically reserves complete five-Carousel batches using an immutable account-selected slideshow style sequence.';

select pg_notify('pgrst', 'reload schema');
