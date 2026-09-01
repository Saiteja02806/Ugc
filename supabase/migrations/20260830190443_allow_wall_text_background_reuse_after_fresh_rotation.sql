-- A Wall background may be used again after the user has exhausted newer
-- sources. Keep the lock that protects simultaneous batches, but do not make
-- a completed creative a permanent exclusion for that profile/version.

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
    from public.wall_text_generation_assignments as assignment
    join public.wall_text_generation_batches as batch
      on batch.id = assignment.batch_id
    where assignment.id <> new.id
      and assignment.overlay_media_asset_id = new.overlay_media_asset_id
      and assignment.status in ('pending', 'processing', 'retry_pending')
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

revoke all on function public.enforce_wall_text_generation_assignment_background_uniqueness() from public;
grant execute on function public.enforce_wall_text_generation_assignment_background_uniqueness() to postgres, service_role;
