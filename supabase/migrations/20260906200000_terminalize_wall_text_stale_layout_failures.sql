-- A legacy Wall creative can be valid historical content but impossible to
-- reflow under the current fixed 50px layout contract. Keep its creative row
-- to preserve immutable history and its profile/asset and profile/candidate
-- uniqueness reservations, but retire any still-active Trending assignment.
-- This is intentionally one transaction: a bad card must not remain visible
-- in a current or future daily slot after it is excluded from future refresh
-- attempts. Past feed rows remain historical records.
create or replace function public.terminalize_wall_text_stale_layout_failures_v1(
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_current_generator_version text,
  p_creative_ids uuid[]
)
returns setof uuid
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if nullif(btrim(coalesce(p_user_id, '')), '') is null
    or p_business_profile_id is null
    or coalesce(p_business_profile_version, 0) <= 0
    or nullif(btrim(coalesce(p_current_generator_version, '')), '') is null
    or coalesce(cardinality(p_creative_ids), 0) < 1 then
    raise exception 'wall_text_stale_layout_terminalization_invalid_scope';
  end if;

  return query
  with terminalized as (
    update public.wall_text_creatives as creative
    set
      -- Do not change `status`: `preview_ready` deliberately keeps this
      -- historical row in the used-background set, preventing a later refill
      -- from reusing an asset that is still protected by a unique constraint.
      error_message = 'wall_text_stale_layout_terminal:wall_text_render_fit_rejected',
      updated_at = timezone('utc', now())
    where creative.id = any(p_creative_ids)
      and creative.user_id = p_user_id
      and creative.business_profile_id = p_business_profile_id
      and creative.business_profile_version = p_business_profile_version
      and creative.status = 'preview_ready'
      -- The application supplies the release's current generator version, so
      -- this remains safe when a future typography version replaces V9.
      and creative.generator_version <> p_current_generator_version
    returning creative.id
  ), retired_assignments as (
    update public.user_wall_text_assignments as assignment
    set
      completed_at = coalesce(assignment.completed_at, timezone('utc', now())),
      state = 'completed_skipped',
      updated_at = timezone('utc', now())
    where assignment.user_id = p_user_id
      and assignment.business_profile_id = p_business_profile_id
      and assignment.business_profile_version = p_business_profile_version
      and assignment.wall_text_creative_id in (select id from terminalized)
      and assignment.state = 'active'
    returning assignment.id
  ), detached_current_slots as (
    update public.daily_trending_feed_slots as slot
    set
      carousel_assignment_id = null,
      hook_video_assignment_id = null,
      wall_text_assignment_id = null,
      reaction_assignment_id = null,
      state = 'planned',
      updated_at = timezone('utc', now())
    from public.daily_trending_feeds as feed
    where slot.feed_id = feed.id
      and slot.format = 'wall_text'
      and slot.state = 'ready'
      and slot.wall_text_assignment_id in (select id from retired_assignments)
      and feed.user_id = p_user_id
      and feed.business_profile_id = p_business_profile_id
      and feed.business_profile_version = p_business_profile_version
      and feed.local_date >= timezone(feed.timezone, now())::date
    returning slot.feed_id
  ), reopened_feeds as (
    update public.daily_trending_feeds as feed
    set
      last_error = null,
      status = 'preparing',
      updated_at = timezone('utc', now())
    where feed.id in (select distinct feed_id from detached_current_slots)
    returning feed.id
  )
  select id from terminalized;
end;
$$;

revoke all on function public.terminalize_wall_text_stale_layout_failures_v1(
  text, uuid, integer, text, uuid[]
) from public, anon, authenticated;

grant execute on function public.terminalize_wall_text_stale_layout_failures_v1(
  text, uuid, integer, text, uuid[]
) to service_role;

select pg_notify('pgrst', 'reload schema');
