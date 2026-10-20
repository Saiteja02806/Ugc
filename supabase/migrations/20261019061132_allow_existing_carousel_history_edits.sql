-- Reopen an existing slideshow edit in history without changing its assignment state.
-- UPDATE retains the existing immutable owner/assignment/creative/format checks.
-- New edits and Hook/Wall rules remain unchanged.
CREATE OR REPLACE FUNCTION public.validate_trending_creative_edit()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  assignment_is_valid boolean := false;
  source_is_valid boolean := false;
begin
  new.user_id := btrim(new.user_id);
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
      or new.assignment_id is distinct from old.assignment_id
      or new.creative_id is distinct from old.creative_id
      or new.format is distinct from old.format
    then
      raise exception 'trending_creative_edit_scope_immutable'
        using errcode = '42501';
    end if;

    if new.revision < old.revision then
      raise exception 'trending_creative_edit_revision_regressed'
        using errcode = '23514';
    end if;
  end if;

  case new.format
    when 'carousel' then
      select exists (
        select 1
        from public.user_carousel_assignments as assignment
        where assignment.id = new.assignment_id
          and assignment.user_id = new.user_id
          and assignment.carousel_id = new.creative_id
          and (
            assignment.state in ('pending', 'in_progress', 'accepted')
            or (tg_op = 'UPDATE' and assignment.state in (
              'completed_skipped', 'completed_saved', 'completed_scheduled'
            ))
          )
      ) into assignment_is_valid;
    when 'hook_video' then
      select exists (
        select 1
        from public.user_hook_video_assignments as assignment
        where assignment.id = new.assignment_id
          and assignment.user_id = new.user_id
          and assignment.hook_suggestion_id = new.creative_id
          and assignment.state in ('active', 'selected')
      ) into assignment_is_valid;
    when 'wall_text' then
      select exists (
        select 1
        from public.user_wall_text_assignments as assignment
        where assignment.id = new.assignment_id
          and assignment.user_id = new.user_id
          and assignment.wall_text_creative_id = new.creative_id
          and assignment.state in ('active', 'selected')
      ) into assignment_is_valid;
  end case;

  if not coalesce(assignment_is_valid, false) then
    raise exception 'trending_creative_edit_assignment_unavailable'
      using errcode = '42501';
  end if;

  if new.source_selection_kind = 'asset' then
    select exists (
      select 1
      from public.media_assets as asset
      where asset.id = new.resolved_media_asset_id
        and asset.user_id = new.user_id
        and asset.collection in ('video', 'influencer')
        and asset.mime_type like 'video/%'
        and asset.status = 'ready'
        and asset.deleted_at is null
    ) into source_is_valid;
  elsif new.source_selection_kind = 'group' then
    select exists (
      select 1
      from public.creative_asset_groups as asset_group
      join public.creative_asset_group_items as group_item
        on group_item.group_id = asset_group.id
       and group_item.user_id = asset_group.user_id
      join public.media_assets as asset
        on asset.id = group_item.media_asset_id
       and asset.user_id = asset_group.user_id
      where asset_group.id = new.source_group_id
        and asset_group.user_id = new.user_id
        and asset_group.media_type = 'video'
        and asset.id = new.resolved_media_asset_id
        and asset.collection in ('video', 'influencer')
        and asset.mime_type like 'video/%'
        and asset.status = 'ready'
        and asset.deleted_at is null
    ) into source_is_valid;
  else
    source_is_valid := true;
  end if;

  if not coalesce(source_is_valid, false) then
    raise exception 'trending_creative_edit_source_unavailable'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;
