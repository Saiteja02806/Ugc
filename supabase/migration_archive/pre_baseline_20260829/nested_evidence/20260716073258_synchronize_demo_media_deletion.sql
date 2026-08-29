alter table public.editable_videos
  add column if not exists deleted_at timestamptz;

create index if not exists editable_videos_user_active_updated_idx
  on public.editable_videos (user_id, updated_at desc)
  where deleted_at is null;

-- Retire catalog rows whose authoritative demo has already been deleted or
-- no longer exists. Prefer the original demo deletion time when available.
update public.media_assets as media
set
  deleted_at = coalesce(
    (
      select demo.deleted_at
      from public.demo_videos as demo
      where demo.user_id = media.user_id
        and demo.id::text = coalesce(media.source_record_id, media.id::text)
        and (
          media.project_id is null
          or demo.project_id = media.project_id
        )
      order by demo.updated_at desc
      limit 1
    ),
    now()
  ),
  updated_at = now()
where media.source_type = 'demo_upload'
  and media.deleted_at is null
  and not exists (
    select 1
    from public.demo_videos as demo
    where demo.user_id = media.user_id
      and demo.id::text = coalesce(media.source_record_id, media.id::text)
      and (
        media.project_id is null
        or demo.project_id = media.project_id
      )
      and demo.deleted_at is null
  );

-- Edit exports are derivatives, so they leave active media pickers with the
-- deleted demo instead of surviving as orphaned choices.
with recursive retired_assets as (
  select media.id, media.deleted_at
  from public.media_assets as media
  where media.source_type = 'demo_upload'
    and media.deleted_at is not null

  union

  select child.id, parent.deleted_at
  from public.media_assets as child
  join retired_assets as parent
    on parent.id = child.parent_asset_id
  where child.source_type = 'edit_export'
)
update public.media_assets as media
set
  deleted_at = retired.deleted_at,
  updated_at = retired.deleted_at
from retired_assets as retired
where media.id = retired.id
  and media.source_type = 'edit_export'
  and media.deleted_at is null;

with retired_demo_sources as (
  select
    demo.user_id,
    demo.project_id,
    demo.id::text as source_video_id,
    demo.deleted_at
  from public.demo_videos as demo
  where demo.deleted_at is not null

  union

  select
    media.user_id,
    media.project_id,
    media.id::text as source_video_id,
    media.deleted_at
  from public.media_assets as media
  where media.source_type = 'demo_upload'
    and media.deleted_at is not null

  union

  select
    media.user_id,
    media.project_id,
    media.source_record_id as source_video_id,
    media.deleted_at
  from public.media_assets as media
  where media.source_type = 'demo_upload'
    and media.source_record_id is not null
    and media.deleted_at is not null
)
update public.editable_videos as editable
set
  deleted_at = retired.deleted_at,
  updated_at = retired.deleted_at
from retired_demo_sources as retired
where editable.user_id = retired.user_id
  and editable.source = 'demo'
  and editable.source_video_id = retired.source_video_id
  and (
    retired.project_id is null
    or editable.project_id = retired.project_id
  )
  and editable.deleted_at is null;

create or replace function public.sync_deleted_demo_media()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_demo_asset_ids uuid[] := array[]::uuid[];
begin
  if old.deleted_at is null and new.deleted_at is not null then
    select coalesce(array_agg(media.id), array[]::uuid[])
    into v_demo_asset_ids
    from public.media_assets as media
    where media.user_id = new.user_id
      and media.source_type = 'demo_upload'
      and (
        media.source_record_id = new.id::text
        or media.id = new.id
      )
      and (
        media.project_id is null
        or media.project_id = new.project_id
      );

    with recursive retired_asset_ids as (
      select unnest(v_demo_asset_ids) as id

      union

      select child.id
      from public.media_assets as child
      join retired_asset_ids as parent
        on parent.id = child.parent_asset_id
      where child.user_id = new.user_id
        and child.source_type = 'edit_export'
    )
    update public.media_assets as media
    set
      deleted_at = new.deleted_at,
      updated_at = new.deleted_at
    where media.id in (select retired.id from retired_asset_ids as retired)
      and media.user_id = new.user_id
      and media.deleted_at is null;

    update public.editable_videos as editable
    set
      deleted_at = new.deleted_at,
      updated_at = new.deleted_at
    where editable.user_id = new.user_id
      and editable.project_id = new.project_id
      and editable.source = 'demo'
      and editable.deleted_at is null
      and (
        editable.source_video_id = new.id::text
        or exists (
          select 1
          from unnest(v_demo_asset_ids) as media_id
          where editable.source_video_id = media_id::text
        )
      );
  end if;

  return new;
end;
$$;

drop trigger if exists sync_deleted_demo_media_trigger
  on public.demo_videos;

create trigger sync_deleted_demo_media_trigger
after update of deleted_at on public.demo_videos
for each row
execute function public.sync_deleted_demo_media();

create or replace function public.sync_deleted_demo_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_demo_id text;
begin
  if old.deleted_at is null
    and new.deleted_at is not null
    and new.source_type = 'demo_upload'
  then
    v_demo_id := coalesce(
      nullif(trim(new.source_record_id), ''),
      new.id::text
    );

    update public.demo_videos as demo
    set
      deleted_at = new.deleted_at,
      updated_at = new.deleted_at
    where demo.id::text = v_demo_id
      and demo.user_id = new.user_id
      and (
        new.project_id is null
        or demo.project_id = new.project_id
      )
      and demo.deleted_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_deleted_demo_source_trigger
  on public.media_assets;

create trigger sync_deleted_demo_source_trigger
after update of deleted_at on public.media_assets
for each row
execute function public.sync_deleted_demo_source();

create or replace function public.require_active_demo_for_media()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_demo_id text;
begin
  if new.source_type <> 'demo_upload' or new.deleted_at is not null then
    return new;
  end if;

  v_demo_id := coalesce(nullif(trim(new.source_record_id), ''), new.id::text);

  if new.project_id is null or not exists (
    select 1
    from public.demo_videos as demo
    where demo.id::text = v_demo_id
      and demo.user_id = new.user_id
      and demo.project_id = new.project_id
      and demo.deleted_at is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'Active demo media requires an active matching demo video.';
  end if;

  return new;
end;
$$;

drop trigger if exists require_active_demo_for_media_insert_trigger
  on public.media_assets;

create trigger require_active_demo_for_media_insert_trigger
before insert on public.media_assets
for each row
execute function public.require_active_demo_for_media();

drop trigger if exists require_active_demo_for_media_update_trigger
  on public.media_assets;

create trigger require_active_demo_for_media_update_trigger
before update of user_id, project_id, source_type, source_record_id, deleted_at
on public.media_assets
for each row
execute function public.require_active_demo_for_media();

revoke all on function public.sync_deleted_demo_media()
  from public, anon, authenticated;

revoke all on function public.sync_deleted_demo_source()
  from public, anon, authenticated;

revoke all on function public.require_active_demo_for_media()
  from public, anon, authenticated;

grant execute on function public.sync_deleted_demo_media()
  to service_role;

grant execute on function public.sync_deleted_demo_source()
  to service_role;

grant execute on function public.require_active_demo_for_media()
  to service_role;

select pg_notify('pgrst', 'reload schema');
