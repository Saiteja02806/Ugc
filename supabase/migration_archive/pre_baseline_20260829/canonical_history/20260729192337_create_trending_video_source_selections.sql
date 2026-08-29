create table if not exists public.trending_video_source_selections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null
    check (char_length(trim(user_id)) > 0),
  format text not null
    check (format in ('hook_video', 'wall_text')),
  selection_kind text not null
    check (selection_kind in ('group', 'asset')),
  group_id uuid
    references public.creative_asset_groups(id) on delete cascade,
  media_asset_id uuid
    references public.media_assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trending_video_source_selections_target_check check (
    (
      selection_kind = 'group'
      and group_id is not null
      and media_asset_id is null
    )
    or (
      selection_kind = 'asset'
      and group_id is null
      and media_asset_id is not null
    )
  ),
  constraint trending_video_source_selections_user_format_key
    unique (user_id, format)
);

create index if not exists trending_video_source_selections_group_idx
  on public.trending_video_source_selections (group_id)
  where group_id is not null;

create index if not exists trending_video_source_selections_asset_idx
  on public.trending_video_source_selections (media_asset_id)
  where media_asset_id is not null;

create or replace function public.validate_trending_video_source_selection()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_is_valid boolean;
begin
  new.user_id := trim(new.user_id);
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
      or new.format is distinct from old.format then
      raise exception 'trending_video_source_scope_immutable';
    end if;
  end if;

  if new.selection_kind = 'group' then
    select exists (
      select 1
      from public.creative_asset_groups as asset_group
      where asset_group.id = new.group_id
        and asset_group.user_id = new.user_id
        and asset_group.media_type = 'video'
    )
    into target_is_valid;
  else
    select exists (
      select 1
      from public.media_assets as asset
      where asset.id = new.media_asset_id
        and asset.user_id = new.user_id
        and asset.collection in ('video', 'influencer')
        and asset.status = 'ready'
        and asset.deleted_at is null
        and asset.mime_type like 'video/%'
    )
    into target_is_valid;
  end if;

  if not coalesce(target_is_valid, false) then
    raise exception 'trending_video_source_not_available';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_trending_video_source_selection_row
  on public.trending_video_source_selections;

create trigger validate_trending_video_source_selection_row
before insert or update on public.trending_video_source_selections
for each row
execute function public.validate_trending_video_source_selection();

alter table public.overlay_media_assets
  add column if not exists source_media_asset_id uuid
    references public.media_assets(id) on delete set null;

alter table public.overlay_media_assets
  add column if not exists owner_user_id text;

create unique index if not exists overlay_media_assets_owner_source_media_uidx
  on public.overlay_media_assets (owner_user_id, source_media_asset_id);

create index if not exists overlay_media_assets_source_media_idx
  on public.overlay_media_assets (source_media_asset_id)
  where source_media_asset_id is not null;

alter table public.trending_video_source_selections enable row level security;

revoke all privileges on table public.trending_video_source_selections
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.trending_video_source_selections
  to service_role;

revoke all on function public.validate_trending_video_source_selection()
  from public, anon, authenticated;

grant execute on function public.validate_trending_video_source_selection()
  to service_role;

select pg_notify('pgrst', 'reload schema');
