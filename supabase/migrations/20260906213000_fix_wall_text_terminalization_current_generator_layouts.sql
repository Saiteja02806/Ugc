-- V1 only recognized a stale generator version. A V9 creative can still be
-- stale when it carries an older final-layout or render-safety contract, so it
-- must be terminalizable after its deterministic re-layout failure as well.
-- Keep V1 in place for rolling deployments; the application calls this V2
-- function once both the migration and application release are live.
create function public.terminalize_wall_text_stale_layout_failures_v2(
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_current_generator_version text,
  p_current_render_safety_version text,
  p_current_final_layout_version text,
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
    or nullif(btrim(coalesce(p_current_render_safety_version, '')), '') is null
    or nullif(btrim(coalesce(p_current_final_layout_version, '')), '') is null
    or coalesce(cardinality(p_creative_ids), 0) < 1 then
    raise exception 'wall_text_stale_layout_terminalization_invalid_scope';
  end if;

  return query
  with terminalized as (
    update public.wall_text_creatives as creative
    set
      -- Retain the historical row and its source/candidate reservations, but
      -- make the record ineligible for active Wall delivery and re-backfill.
      error_message = 'wall_text_stale_layout_terminal:wall_text_render_fit_rejected',
      updated_at = timezone('utc', now())
    where creative.id = any(p_creative_ids)
      and creative.user_id = p_user_id
      and creative.business_profile_id = p_business_profile_id
      and creative.business_profile_version = p_business_profile_version
      and creative.status = 'preview_ready'
      and (
        creative.generator_version is distinct from p_current_generator_version
        or creative.text_content ->> 'renderSafetyVersion'
          is distinct from p_current_render_safety_version
        or creative.text_content -> 'finalLayout' ->> 'version'
          is distinct from p_current_final_layout_version
        or creative.layout is null
      )
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

revoke all on function public.terminalize_wall_text_stale_layout_failures_v2(
  text, uuid, integer, text, text, text, uuid[]
) from public, anon, authenticated;

grant execute on function public.terminalize_wall_text_stale_layout_failures_v2(
  text, uuid, integer, text, text, text, uuid[]
) to service_role;

select pg_notify('pgrst', 'reload schema');
