-- A Wall creative is unique per user/profile/version/background asset. The
-- source list is assembled before a generation batch is reserved, so two
-- refills can otherwise choose the same assets and fail much later while
-- persisting copy. Guard reservations at their transactional boundary.

create or replace function public.enforce_wall_text_generation_assignment_background_uniqueness()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_batch public.wall_text_generation_batches%rowtype;
begin
  select batch.*
  into v_batch
  from public.wall_text_generation_batches as batch
  where batch.id = new.batch_id;

  if not found then
    raise exception 'wall_text_generation_batch_unavailable';
  end if;

  -- The normal reservation function already locks the profile row. Keep an
  -- explicit lock here too so direct or future assignment writers preserve
  -- the same per-profile asset invariant.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'wall-text-background-reservation:'
        || v_batch.user_id
        || ':' || v_batch.business_profile_id::text
        || ':v' || v_batch.business_profile_version::text,
      0
    )
  );

  if exists (
    select 1
    from public.wall_text_creatives as creative
    where creative.user_id = v_batch.user_id
      and creative.business_profile_id = v_batch.business_profile_id
      and creative.business_profile_version = v_batch.business_profile_version
      and creative.overlay_media_asset_id = new.overlay_media_asset_id
  ) then
    raise exception 'wall_text_background_already_used';
  end if;

  if exists (
    select 1
    from public.wall_text_generation_assignments as assignment
    join public.wall_text_generation_batches as batch
      on batch.id = assignment.batch_id
    where assignment.id <> new.id
      and assignment.overlay_media_asset_id = new.overlay_media_asset_id
      and assignment.status <> 'completed'
      and batch.user_id = v_batch.user_id
      and batch.business_profile_id = v_batch.business_profile_id
      and batch.business_profile_version = v_batch.business_profile_version
      and batch.status in ('pending', 'processing')
  ) then
    raise exception 'wall_text_background_already_reserved';
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_wall_text_generation_assignment_background_uniqueness_trigger
  on public.wall_text_generation_assignments;

create trigger enforce_wall_text_generation_assignment_background_uniqueness_trigger
before insert or update of batch_id, overlay_media_asset_id
on public.wall_text_generation_assignments
for each row
execute function public.enforce_wall_text_generation_assignment_background_uniqueness();

revoke all on function public.enforce_wall_text_generation_assignment_background_uniqueness() from public;
grant execute on function public.enforce_wall_text_generation_assignment_background_uniqueness() to postgres, service_role;
