-- Phase 4: durable Reaction delivery. A Reaction is generated and rendered
-- before it reaches Trending; the feed stores only an immutable assignment to
-- that preview-ready creative. Presentation history is separate from swipe
-- decisions so the planner can distinguish "shown" from merely reserved.

create table if not exists public.reaction_creatives (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  business_profile_version integer not null check (business_profile_version > 0),
  clip_asset_id uuid not null references public.reaction_clip_assets(id) on delete restrict,
  background_asset_id uuid not null references public.reaction_background_assets(id) on delete restrict,
  primary_reaction text not null,
  caption text not null,
  content_json jsonb not null default '{}'::jsonb,
  render_plan_json jsonb not null default '{}'::jsonb,
  title text not null,
  duration_seconds numeric not null check (duration_seconds > 0 and duration_seconds <= 60),
  render_status text not null default 'queued',
  rendered_media_asset_id uuid unique references public.media_assets(id) on delete restrict,
  preview_url text,
  thumbnail_url text,
  render_job_id uuid references public.background_jobs(id) on delete set null,
  render_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reaction_creatives_primary_reaction_chk check (
    primary_reaction in (
      'side_eye', 'facepalm', 'deadpan', 'confusion', 'shock', 'relief',
      'celebration', 'laughter', 'disappointment', 'regret', 'unbothered',
      'concern', 'focused', 'playful'
    )
  ),
  constraint reaction_creatives_caption_chk check (char_length(btrim(caption)) between 1 and 400),
  constraint reaction_creatives_title_chk check (char_length(btrim(title)) between 1 and 140),
  constraint reaction_creatives_content_json_chk check (jsonb_typeof(content_json) = 'object'),
  constraint reaction_creatives_render_plan_json_chk check (jsonb_typeof(render_plan_json) = 'object'),
  constraint reaction_creatives_render_status_chk check (
    render_status in ('queued', 'rendering', 'preview_ready', 'failed')
  ),
  constraint reaction_creatives_preview_ready_chk check (
    render_status <> 'preview_ready'
    or (
      rendered_media_asset_id is not null
      and preview_url ~ '^https?://'
      and char_length(btrim(preview_url)) > 0
    )
  ),
  constraint reaction_creatives_render_error_chk check (
    render_error is null or char_length(btrim(render_error)) > 0
  )
);

create index if not exists reaction_creatives_profile_status_idx
  on public.reaction_creatives (
    user_id,
    business_profile_id,
    business_profile_version,
    render_status,
    created_at desc
  );

create unique index if not exists reaction_creatives_user_render_job_uidx
  on public.reaction_creatives (user_id, render_job_id)
  where render_job_id is not null;

create table if not exists public.user_reaction_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  business_profile_version integer not null check (business_profile_version > 0),
  reaction_creative_id uuid not null references public.reaction_creatives(id) on delete restrict,
  position integer not null check (position > 0),
  state text not null default 'active',
  completed_at timestamptz,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_reaction_assignments_state_chk check (
    state in ('active', 'selected', 'completed_skipped')
  ),
  constraint user_reaction_assignments_completed_chk check (
    (state = 'active' and completed_at is null)
    or (state in ('selected', 'completed_skipped') and completed_at is not null)
  ),
  constraint user_reaction_assignments_user_creative_uidx unique (user_id, reaction_creative_id)
);

create index if not exists user_reaction_assignments_active_idx
  on public.user_reaction_assignments (
    user_id,
    business_profile_id,
    business_profile_version,
    position
  )
  where state = 'active';

create table if not exists public.reaction_clip_presentations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  assignment_id uuid not null references public.user_reaction_assignments(id) on delete cascade,
  clip_asset_id uuid not null references public.reaction_clip_assets(id) on delete restrict,
  presented_at timestamptz not null default now(),
  constraint reaction_clip_presentations_user_assignment_uidx unique (user_id, assignment_id)
);

create index if not exists reaction_clip_presentations_rotation_idx
  on public.reaction_clip_presentations (user_id, clip_asset_id, presented_at desc);

alter table public.reaction_creatives enable row level security;
alter table public.user_reaction_assignments enable row level security;
alter table public.reaction_clip_presentations enable row level security;

revoke all on table public.reaction_creatives,
  public.user_reaction_assignments,
  public.reaction_clip_presentations from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update
  on table public.reaction_creatives,
  public.user_reaction_assignments,
  public.reaction_clip_presentations to postgres, service_role;

create or replace function public.touch_reaction_creative_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reaction_creatives_touch_updated_at on public.reaction_creatives;
create trigger reaction_creatives_touch_updated_at
  before update on public.reaction_creatives
  for each row execute function public.touch_reaction_creative_updated_at();

drop trigger if exists user_reaction_assignments_touch_updated_at on public.user_reaction_assignments;
create trigger user_reaction_assignments_touch_updated_at
  before update on public.user_reaction_assignments
  for each row execute function public.touch_reaction_creative_updated_at();

-- The final Reaction MP4 is an owner-scoped ready media asset, so the shared
-- scheduler can use its ordinary `media_asset` path without a new scheduler.
alter table public.media_assets
  drop constraint if exists media_assets_source_type_check;
alter table public.media_assets
  add constraint media_assets_source_type_check check (
    source_type in (
      'upload', 'influencer_upload', 'demo_upload', 'catalog_influencer',
      'generated_image', 'generated_video', 'edit_export', 'combined_render',
      'wall_text_render', 'reaction_render'
    )
  );

-- Reaction is part of every saved mix and daily feed snapshot. Existing packs
-- retain their saved proportions; only new or explicitly replanned slots use
-- a newly selected Reaction share.
alter table public.trending_content_mix_preferences
  add column if not exists reaction_percent integer not null default 0;
alter table public.trending_content_mix_preferences
  drop constraint if exists trending_content_mix_preferences_percentages_check;
alter table public.trending_content_mix_preferences
  add constraint trending_content_mix_preferences_percentages_check check (
    carousel_percent between 0 and 100
    and wall_text_percent between 0 and 100
    and hook_video_percent between 0 and 100
    and reaction_percent between 0 and 100
    and carousel_percent + wall_text_percent + hook_video_percent + reaction_percent = 100
  );

alter table public.daily_trending_feeds
  add column if not exists reaction_percent integer not null default 0;
alter table public.daily_trending_feeds
  drop constraint if exists daily_trending_feeds_mix_check;
alter table public.daily_trending_feeds
  add constraint daily_trending_feeds_mix_check check (
    carousel_percent between 0 and 100
    and wall_text_percent between 0 and 100
    and hook_video_percent between 0 and 100
    and reaction_percent between 0 and 100
    and carousel_percent + wall_text_percent + hook_video_percent + reaction_percent = 100
  );

alter table public.daily_trending_feed_slots
  add column if not exists reaction_assignment_id uuid
    references public.user_reaction_assignments(id) on delete restrict;

alter table public.daily_trending_feed_slots
  drop constraint if exists daily_trending_feed_slots_format_check;
alter table public.daily_trending_feed_slots
  add constraint daily_trending_feed_slots_format_check check (
    format in ('carousel', 'hook_video', 'wall_text', 'reaction')
  );

alter table public.daily_trending_feed_slots
  drop constraint if exists daily_trending_feed_slots_assignment_check;
alter table public.daily_trending_feed_slots
  add constraint daily_trending_feed_slots_assignment_check check (
    (state in ('planned', 'preparing', 'failed')
      and carousel_assignment_id is null
      and hook_video_assignment_id is null
      and wall_text_assignment_id is null
      and reaction_assignment_id is null)
    or
    (state in ('ready', 'decided') and (
      (format = 'carousel'
        and carousel_assignment_id is not null
        and hook_video_assignment_id is null
        and wall_text_assignment_id is null
        and reaction_assignment_id is null)
      or (format = 'hook_video'
        and carousel_assignment_id is null
        and hook_video_assignment_id is not null
        and wall_text_assignment_id is null
        and reaction_assignment_id is null)
      or (format = 'wall_text'
        and carousel_assignment_id is null
        and hook_video_assignment_id is null
        and wall_text_assignment_id is not null
        and reaction_assignment_id is null)
      or (format = 'reaction'
        and carousel_assignment_id is null
        and hook_video_assignment_id is null
        and wall_text_assignment_id is null
        and reaction_assignment_id is not null)
    ))
  );

create unique index if not exists daily_trending_feed_slots_reaction_assignment_uidx
  on public.daily_trending_feed_slots (reaction_assignment_id)
  where reaction_assignment_id is not null;

-- Daily slots are the source of truth for which card was actually offered.
-- These overloads add Reaction without changing the established three-format
-- functions that may still be used by an in-flight deployment.
create or replace function public.attach_daily_trending_feed_assignments (
  p_feed_id                   uuid,
  p_carousel_assignment_ids   uuid[] default array[]::uuid[],
  p_hook_video_assignment_ids uuid[] default array[]::uuid[],
  p_wall_text_assignment_ids  uuid[] default array[]::uuid[],
  p_reaction_assignment_ids   uuid[] default array[]::uuid[]
)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  feed_record public.daily_trending_feeds;
  slot_record public.daily_trending_feed_slots;
  resolved_assignment_id uuid;
begin
  select * into feed_record
  from public.daily_trending_feeds
  where id = p_feed_id;

  if feed_record.id is null then
    raise exception 'daily_trending_feed_not_found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(feed_record.user_id || ':' || feed_record.local_date::text, 0)
  );

  for slot_record in
    select * from public.daily_trending_feed_slots
    where feed_id = p_feed_id and state in ('planned', 'failed')
    order by position for update
  loop
    resolved_assignment_id := null;

    if slot_record.format = 'carousel' then
      select candidate.assignment_id into resolved_assignment_id
      from unnest(p_carousel_assignment_ids) with ordinality as candidate(assignment_id, ordinality)
      join public.user_carousel_assignments as assignment on assignment.id = candidate.assignment_id
      where assignment.user_id = feed_record.user_id
        and assignment.business_profile_id = feed_record.business_profile_id
        and assignment.business_profile_version = feed_record.business_profile_version
        and assignment.state in ('pending', 'in_progress')
        and not exists (
          select 1 from public.daily_trending_feed_slots as used_slot
          where used_slot.feed_id = p_feed_id
            and used_slot.carousel_assignment_id = candidate.assignment_id
        )
      order by candidate.ordinality limit 1;

      if resolved_assignment_id is not null then
        update public.daily_trending_feed_slots
        set carousel_assignment_id = resolved_assignment_id, state = 'ready', updated_at = now()
        where id = slot_record.id;
      end if;
    elsif slot_record.format = 'hook_video' then
      select candidate.assignment_id into resolved_assignment_id
      from unnest(p_hook_video_assignment_ids) with ordinality as candidate(assignment_id, ordinality)
      join public.user_hook_video_assignments as assignment on assignment.id = candidate.assignment_id
      where assignment.user_id = feed_record.user_id
        and assignment.business_profile_id = feed_record.business_profile_id
        and assignment.business_profile_version = feed_record.business_profile_version
        and assignment.state = 'active'
        and not exists (
          select 1 from public.daily_trending_feed_slots as used_slot
          where used_slot.hook_video_assignment_id = candidate.assignment_id
        )
      order by candidate.ordinality limit 1;

      if resolved_assignment_id is not null then
        update public.daily_trending_feed_slots
        set hook_video_assignment_id = resolved_assignment_id, state = 'ready', updated_at = now()
        where id = slot_record.id;
      end if;
    elsif slot_record.format = 'wall_text' then
      select candidate.assignment_id into resolved_assignment_id
      from unnest(p_wall_text_assignment_ids) with ordinality as candidate(assignment_id, ordinality)
      join public.user_wall_text_assignments as assignment on assignment.id = candidate.assignment_id
      where assignment.user_id = feed_record.user_id
        and assignment.business_profile_id = feed_record.business_profile_id
        and assignment.business_profile_version = feed_record.business_profile_version
        and assignment.state = 'active'
        and not exists (
          select 1 from public.daily_trending_feed_slots as used_slot
          where used_slot.wall_text_assignment_id = candidate.assignment_id
        )
      order by candidate.ordinality limit 1;

      if resolved_assignment_id is not null then
        update public.daily_trending_feed_slots
        set wall_text_assignment_id = resolved_assignment_id, state = 'ready', updated_at = now()
        where id = slot_record.id;
      end if;
    elsif slot_record.format = 'reaction' then
      select candidate.assignment_id into resolved_assignment_id
      from unnest(p_reaction_assignment_ids) with ordinality as candidate(assignment_id, ordinality)
      join public.user_reaction_assignments as assignment on assignment.id = candidate.assignment_id
      join public.reaction_creatives as creative on creative.id = assignment.reaction_creative_id
      where assignment.user_id = feed_record.user_id
        and assignment.business_profile_id = feed_record.business_profile_id
        and assignment.business_profile_version = feed_record.business_profile_version
        and assignment.state = 'active'
        and creative.user_id = feed_record.user_id
        and creative.render_status = 'preview_ready'
        and creative.rendered_media_asset_id is not null
        and not exists (
          select 1 from public.daily_trending_feed_slots as used_slot
          where used_slot.reaction_assignment_id = candidate.assignment_id
        )
      order by candidate.ordinality limit 1;

      if resolved_assignment_id is not null then
        update public.daily_trending_feed_slots
        set reaction_assignment_id = resolved_assignment_id, state = 'ready', updated_at = now()
        where id = slot_record.id;
      end if;
    end if;
  end loop;

  update public.daily_trending_feeds
  set status = case
    when not exists (
      select 1 from public.daily_trending_feed_slots as slot
      where slot.feed_id = p_feed_id and slot.state <> 'decided'
    ) then 'completed'
    when exists (
      select 1 from public.daily_trending_feed_slots as slot
      where slot.feed_id = p_feed_id and slot.state = 'ready'
    ) then 'ready'
    when exists (
      select 1 from public.daily_trending_feed_slots as slot
      where slot.feed_id = p_feed_id and slot.state in ('planned', 'preparing')
    ) then 'preparing'
    else 'failed'
  end,
  last_error = case
    when exists (
      select 1 from public.daily_trending_feed_slots as slot
      where slot.feed_id = p_feed_id and slot.state in ('ready', 'planned', 'preparing')
    ) then null else last_error
  end,
  updated_at = now()
  where id = p_feed_id;
end;
$$;

create or replace function public.reconcile_daily_trending_feed_slot_integrity (
  p_feed_id                      uuid,
  p_hook_video_assignment_ids    uuid[] default array[]::uuid[],
  p_hook_video_provider_resolved boolean default false,
  p_wall_text_assignment_ids     uuid[] default array[]::uuid[],
  p_wall_text_provider_resolved  boolean default false,
  p_reaction_assignment_ids      uuid[] default array[]::uuid[],
  p_reaction_provider_resolved   boolean default false
)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  feed_record public.daily_trending_feeds;
begin
  select * into feed_record
  from public.daily_trending_feeds
  where id = p_feed_id;

  if feed_record.id is null then
    raise exception 'daily_trending_feed_not_found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(feed_record.user_id || ':' || feed_record.local_date::text, 0)
  );

  update public.daily_trending_feed_slots as slot
  set carousel_assignment_id = null,
      hook_video_assignment_id = null,
      wall_text_assignment_id = null,
      reaction_assignment_id = null,
      state = 'planned',
      updated_at = now()
  where slot.feed_id = p_feed_id
    and slot.state = 'ready'
    and (
      (slot.format = 'carousel' and not exists (
        select 1 from public.user_carousel_assignments as assignment
        where assignment.id = slot.carousel_assignment_id
          and assignment.user_id = feed_record.user_id
          and assignment.business_profile_id = feed_record.business_profile_id
          and assignment.business_profile_version = feed_record.business_profile_version
          and assignment.state in ('pending', 'in_progress')
      ))
      or (slot.format = 'hook_video' and not exists (
        select 1 from public.user_hook_video_assignments as assignment
        where assignment.id = slot.hook_video_assignment_id
          and assignment.user_id = feed_record.user_id
          and assignment.business_profile_id = feed_record.business_profile_id
          and assignment.business_profile_version = feed_record.business_profile_version
          and assignment.state = 'active'
      ))
      or (slot.format = 'wall_text' and not exists (
        select 1 from public.user_wall_text_assignments as assignment
        where assignment.id = slot.wall_text_assignment_id
          and assignment.user_id = feed_record.user_id
          and assignment.business_profile_id = feed_record.business_profile_id
          and assignment.business_profile_version = feed_record.business_profile_version
          and assignment.state = 'active'
      ))
      or (slot.format = 'reaction' and not exists (
        select 1 from public.user_reaction_assignments as assignment
        join public.reaction_creatives as creative on creative.id = assignment.reaction_creative_id
        where assignment.id = slot.reaction_assignment_id
          and assignment.user_id = feed_record.user_id
          and assignment.business_profile_id = feed_record.business_profile_id
          and assignment.business_profile_version = feed_record.business_profile_version
          and assignment.state = 'active'
          and creative.user_id = feed_record.user_id
          and creative.render_status = 'preview_ready'
          and creative.rendered_media_asset_id is not null
      ))
    );

  if p_hook_video_provider_resolved then
    update public.daily_trending_feed_slots
    set carousel_assignment_id = null, hook_video_assignment_id = null,
        wall_text_assignment_id = null, reaction_assignment_id = null,
        state = 'planned', updated_at = now()
    where feed_id = p_feed_id and format = 'hook_video' and state = 'ready'
      and not (hook_video_assignment_id = any(p_hook_video_assignment_ids));
  end if;

  if p_wall_text_provider_resolved then
    update public.daily_trending_feed_slots
    set carousel_assignment_id = null, hook_video_assignment_id = null,
        wall_text_assignment_id = null, reaction_assignment_id = null,
        state = 'planned', updated_at = now()
    where feed_id = p_feed_id and format = 'wall_text' and state = 'ready'
      and not (wall_text_assignment_id = any(p_wall_text_assignment_ids));
  end if;

  if p_reaction_provider_resolved then
    update public.daily_trending_feed_slots
    set carousel_assignment_id = null, hook_video_assignment_id = null,
        wall_text_assignment_id = null, reaction_assignment_id = null,
        state = 'planned', updated_at = now()
    where feed_id = p_feed_id and format = 'reaction' and state = 'ready'
      and not (reaction_assignment_id = any(p_reaction_assignment_ids));
  end if;

  update public.daily_trending_feeds
  set status = case
    when (select count(*) from public.daily_trending_feed_slots as slot where slot.feed_id = p_feed_id) = feed_record.daily_limit
      and not exists (
        select 1 from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id and slot.state <> 'decided'
      ) then 'completed'
    when exists (
      select 1 from public.daily_trending_feed_slots as slot
      where slot.feed_id = p_feed_id and slot.state = 'ready'
    ) then 'ready'
    when exists (
      select 1 from public.daily_trending_feed_slots as slot
      where slot.feed_id = p_feed_id and slot.state in ('planned', 'preparing')
    ) then 'preparing'
    else 'failed'
  end,
  last_error = null,
  updated_at = now()
  where id = p_feed_id;
end;
$$;

grant execute on function public.attach_daily_trending_feed_assignments(uuid, uuid[], uuid[], uuid[], uuid[])
  to postgres, service_role;
revoke all on function public.attach_daily_trending_feed_assignments(uuid, uuid[], uuid[], uuid[], uuid[])
  from public;
grant execute on function public.reconcile_daily_trending_feed_slot_integrity(uuid, uuid[], boolean, uuid[], boolean, uuid[], boolean)
  to postgres, service_role;
revoke all on function public.reconcile_daily_trending_feed_slot_integrity(uuid, uuid[], boolean, uuid[], boolean, uuid[], boolean)
  from public;

alter table public.trending_creative_decisions
  drop constraint if exists trending_creative_decisions_format_check;
alter table public.trending_creative_decisions
  add constraint trending_creative_decisions_format_check check (
    format in ('carousel', 'hook_video', 'wall_text', 'reaction')
  );

create or replace function public.record_trending_creative_decision (
  p_user_id text,
  p_format text,
  p_assignment_id uuid,
  p_creative_id uuid,
  p_decision text
)
returns setof public.trending_creative_decisions
language plpgsql
set search_path to ''
as $$
declare
  recorded public.trending_creative_decisions;
  assignment_is_active boolean := false;
  assignment_exists boolean := false;
  decided_at_value timestamptz := now();
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_format not in ('carousel', 'hook_video', 'wall_text', 'reaction')
    or p_assignment_id is null
    or p_creative_id is null
    or p_decision not in ('accepted', 'rejected') then
    raise exception 'trending_creative_decision_invalid_scope';
  end if;

  case p_format
    when 'carousel' then
      select true, assignment.state in ('pending', 'in_progress')
      into assignment_exists, assignment_is_active
      from public.user_carousel_assignments as assignment
      where assignment.id = p_assignment_id and assignment.user_id = p_user_id
        and assignment.carousel_id = p_creative_id for update;
    when 'hook_video' then
      select true, assignment.state = 'active'
      into assignment_exists, assignment_is_active
      from public.user_hook_video_assignments as assignment
      where assignment.id = p_assignment_id and assignment.user_id = p_user_id
        and assignment.hook_suggestion_id = p_creative_id for update;
    when 'wall_text' then
      select true, assignment.state = 'active'
      into assignment_exists, assignment_is_active
      from public.user_wall_text_assignments as assignment
      where assignment.id = p_assignment_id and assignment.user_id = p_user_id
        and assignment.wall_text_creative_id = p_creative_id for update;
    when 'reaction' then
      select true, assignment.state = 'active'
      into assignment_exists, assignment_is_active
      from public.user_reaction_assignments as assignment
      where assignment.id = p_assignment_id and assignment.user_id = p_user_id
        and assignment.reaction_creative_id = p_creative_id for update;
  end case;

  if not coalesce(assignment_exists, false) then
    raise exception 'trending_creative_decision_assignment_not_found';
  end if;

  select decision.* into recorded
  from public.trending_creative_decisions as decision
  where decision.user_id = p_user_id
    and decision.format = p_format
    and decision.creative_id = p_creative_id;

  if found then
    if recorded.assignment_id <> p_assignment_id or recorded.decision <> p_decision then
      raise exception 'trending_creative_decision_conflict';
    end if;
    return next recorded;
    return;
  end if;

  if not coalesce(assignment_is_active, false) then
    raise exception 'trending_creative_decision_assignment_inactive';
  end if;

  insert into public.trending_creative_decisions (
    assignment_id, creative_id, decided_at, decision, format, user_id
  ) values (
    p_assignment_id, p_creative_id, decided_at_value, p_decision, p_format, p_user_id
  ) returning * into recorded;

  if p_format = 'reaction' then
    update public.user_reaction_assignments
    set completed_at = decided_at_value,
        last_opened_at = case when p_decision = 'accepted' then decided_at_value else last_opened_at end,
        state = case when p_decision = 'accepted' then 'selected' else 'completed_skipped' end,
        updated_at = decided_at_value
    where id = p_assignment_id;
  elsif p_format = 'carousel' then
    update public.user_carousel_assignments
    set completed_at = decided_at_value,
        completion_action = case when p_decision = 'accepted' then 'accepted' else 'skipped' end,
        state = case when p_decision = 'accepted' then 'accepted' else 'completed_skipped' end,
        updated_at = decided_at_value
    where id = p_assignment_id;
  elsif p_format = 'hook_video' then
    update public.user_hook_video_assignments
    set completed_at = decided_at_value,
        last_opened_at = case when p_decision = 'accepted' then decided_at_value else last_opened_at end,
        state = case when p_decision = 'accepted' then 'selected' else 'completed_skipped' end,
        updated_at = decided_at_value
    where id = p_assignment_id;
  else
    update public.user_wall_text_assignments
    set completed_at = decided_at_value,
        last_opened_at = case when p_decision = 'accepted' then decided_at_value else last_opened_at end,
        state = case when p_decision = 'accepted' then 'selected' else 'completed_skipped' end,
        updated_at = decided_at_value
    where id = p_assignment_id;
  end if;

  return next recorded;
end;
$$;

create or replace function public.mark_daily_trending_feed_slot_decided (
  p_user_id text,
  p_format text,
  p_assignment_id uuid
)
returns uuid
language plpgsql
set search_path to 'public'
as $$
declare
  resolved_slot_id uuid;
  resolved_feed_id uuid;
begin
  if p_format not in ('carousel', 'hook_video', 'wall_text', 'reaction') then
    raise exception 'invalid_daily_trending_format';
  end if;

  select slot.id, slot.feed_id into resolved_slot_id, resolved_feed_id
  from public.daily_trending_feed_slots as slot
  join public.daily_trending_feeds as feed on feed.id = slot.feed_id
  where feed.user_id = p_user_id and slot.state = 'ready' and (
    (p_format = 'carousel' and slot.carousel_assignment_id = p_assignment_id)
    or (p_format = 'hook_video' and slot.hook_video_assignment_id = p_assignment_id)
    or (p_format = 'wall_text' and slot.wall_text_assignment_id = p_assignment_id)
    or (p_format = 'reaction' and slot.reaction_assignment_id = p_assignment_id)
  ) order by feed.local_date desc limit 1 for update of slot;

  if resolved_slot_id is null then return null; end if;

  update public.daily_trending_feed_slots
  set state = 'decided', updated_at = now()
  where id = resolved_slot_id;

  update public.daily_trending_feeds as feed
  set status = case
    when (select count(*) from public.daily_trending_feed_slots as slot where slot.feed_id = resolved_feed_id) = feed.daily_limit
      and not exists (
        select 1 from public.daily_trending_feed_slots as remaining_slot
        where remaining_slot.feed_id = resolved_feed_id and remaining_slot.state <> 'decided'
      ) then 'completed'
    else feed.status
  end, updated_at = now()
  where feed.id = resolved_feed_id;

  return resolved_slot_id;
end;
$$;

grant execute on function public.record_trending_creative_decision(text, text, uuid, uuid, text)
  to postgres, service_role;
revoke all on function public.record_trending_creative_decision(text, text, uuid, uuid, text)
  from public;
grant execute on function public.mark_daily_trending_feed_slot_decided(text, text, uuid)
  to postgres, service_role;
revoke all on function public.mark_daily_trending_feed_slot_decided(text, text, uuid)
  from public;

-- Four-format overloads keep the old three-format functions callable during
-- a rolling deployment, while all new callers send p_reaction_percent.
create or replace function public.save_trending_content_mix_preference (
  p_user_id            text,
  p_carousel_percent   integer,
  p_wall_text_percent  integer,
  p_hook_video_percent integer,
  p_reaction_percent   integer
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
  then
    raise exception 'invalid_trending_content_mix';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('trending-mix:' || p_user_id, 0));

  insert into public.trending_content_mix_preferences (
    user_id, carousel_percent, wall_text_percent, hook_video_percent,
    reaction_percent, preference_version, updated_at
  ) values (
    p_user_id, p_carousel_percent, p_wall_text_percent, p_hook_video_percent,
    p_reaction_percent, 1, now()
  ) on conflict (user_id) do update
  set carousel_percent = excluded.carousel_percent,
      wall_text_percent = excluded.wall_text_percent,
      hook_video_percent = excluded.hook_video_percent,
      reaction_percent = excluded.reaction_percent,
      preference_version = public.trending_content_mix_preferences.preference_version + 1,
      updated_at = now()
  returning preference_version into resolved_version;

  return resolved_version;
end;
$$;

grant execute on function public.save_trending_content_mix_preference(text, integer, integer, integer, integer)
  to postgres, service_role;
revoke all on function public.save_trending_content_mix_preference(text, integer, integer, integer, integer)
  from public;

create or replace function public.ensure_daily_trending_feed_plan (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_local_date               date,
  p_timezone                 text,
  p_plan_key                 text,
  p_plan_display_name        text,
  p_daily_limit              integer,
  p_carousel_percent         integer,
  p_wall_text_percent        integer,
  p_hook_video_percent       integer,
  p_reaction_percent         integer,
  p_preference_version       integer,
  p_formats                  text[]
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
      wall_text_percent, hook_video_percent, reaction_percent, preference_version
    ) values (
      p_user_id, p_business_profile_id, p_business_profile_version, p_local_date,
      p_timezone, p_plan_key, p_plan_display_name, p_daily_limit, p_carousel_percent,
      p_wall_text_percent, p_hook_video_percent, p_reaction_percent, p_preference_version
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

grant execute on function public.ensure_daily_trending_feed_plan(text, uuid, integer, date, text, text, text, integer, integer, integer, integer, integer, integer, text[])
  to postgres, service_role;
revoke all on function public.ensure_daily_trending_feed_plan(text, uuid, integer, date, text, text, text, integer, integer, integer, integer, integer, integer, text[])
  from public;

create or replace function public.replan_daily_trending_unbound_slots (
  p_user_id            text,
  p_feed_id            uuid,
  p_positions          integer[],
  p_formats            text[],
  p_carousel_percent   integer,
  p_wall_text_percent  integer,
  p_hook_video_percent integer,
  p_reaction_percent   integer,
  p_preference_version integer
)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  changed_count integer := 0;
  requested record;
begin
  if coalesce(array_length(p_positions, 1), 0) <> coalesce(array_length(p_formats, 1), 0) then
    raise exception 'invalid_daily_trending_replan_size';
  end if;

  if p_carousel_percent + p_wall_text_percent + p_hook_video_percent + p_reaction_percent <> 100
    or p_carousel_percent not between 0 and 100
    or p_wall_text_percent not between 0 and 100
    or p_hook_video_percent not between 0 and 100
    or p_reaction_percent not between 0 and 100
  then
    raise exception 'invalid_daily_trending_mix';
  end if;

  if not exists (
    select 1 from public.daily_trending_feeds as feed
    where feed.id = p_feed_id and feed.user_id = p_user_id
  ) then
    raise exception 'daily_trending_feed_not_found';
  end if;

  if exists (
    select 1 from unnest(p_formats) as requested_format
    where requested_format not in ('carousel', 'hook_video', 'wall_text', 'reaction')
  ) then
    raise exception 'invalid_daily_trending_format';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id || ':' || p_feed_id::text, 0));

  for requested in
    select position, format
    from unnest(p_positions, p_formats) as requested_slot(position, format)
  loop
    update public.daily_trending_feed_slots
    set format = requested.format, state = 'planned', updated_at = now()
    where feed_id = p_feed_id
      and position = requested.position
      and state in ('planned', 'failed')
      and carousel_assignment_id is null
      and hook_video_assignment_id is null
      and wall_text_assignment_id is null
      and reaction_assignment_id is null;

    changed_count := changed_count + case when found then 1 else 0 end;
  end loop;

  update public.daily_trending_feeds
  set carousel_percent = p_carousel_percent,
      wall_text_percent = p_wall_text_percent,
      hook_video_percent = p_hook_video_percent,
      reaction_percent = p_reaction_percent,
      preference_version = p_preference_version,
      status = case when changed_count > 0 then 'preparing' else status end,
      updated_at = now()
  where id = p_feed_id and user_id = p_user_id;

  return changed_count;
end;
$$;

grant execute on function public.replan_daily_trending_unbound_slots(text, uuid, integer[], text[], integer, integer, integer, integer, integer)
  to postgres, service_role;
revoke all on function public.replan_daily_trending_unbound_slots(text, uuid, integer[], text[], integer, integer, integer, integer, integer)
  from public;

comment on table public.reaction_creatives is
  'Pre-rendered Reaction Trending creatives. Only preview_ready rows may appear in the feed.';
comment on table public.reaction_clip_presentations is
  'Idempotent first presentation history used for per-user Reaction clip rotation.';

select pg_notify('pgrst', 'reload schema');
