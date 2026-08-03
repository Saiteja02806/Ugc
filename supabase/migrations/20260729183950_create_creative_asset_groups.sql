create table if not exists public.creative_asset_groups (
  id uuid primary key default gen_random_uuid(),
  user_id text not null
    check (
      char_length(btrim(user_id)) > 0
      and char_length(btrim(user_id)) <= 200
    ),
  name text not null
    check (
      char_length(btrim(name)) > 0
      and char_length(btrim(name)) <= 80
    ),
  media_type text not null
    check (media_type in ('video', 'image')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_asset_groups_owner_type_updated_idx
  on public.creative_asset_groups (user_id, media_type, updated_at desc);

create table if not exists public.creative_asset_group_items (
  user_id text not null
    check (
      char_length(btrim(user_id)) > 0
      and char_length(btrim(user_id)) <= 200
    ),
  group_id uuid not null
    references public.creative_asset_groups(id) on delete cascade,
  media_asset_id uuid not null
    references public.media_assets(id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (group_id, media_asset_id)
);

create index if not exists creative_asset_group_items_owner_asset_idx
  on public.creative_asset_group_items (user_id, media_asset_id);

create or replace function public.prepare_creative_asset_group()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := btrim(new.user_id);
  new.name := btrim(new.name);

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'A creative asset group cannot change owners.'
        using errcode = '42501';
    end if;

    if new.media_type is distinct from old.media_type then
      raise exception 'A creative asset group cannot change media type.'
        using errcode = '23514';
    end if;

    new.updated_at := now();
  end if;

  return new;
end;
$$;

create trigger prepare_creative_asset_group_row
before insert or update on public.creative_asset_groups
for each row
execute function public.prepare_creative_asset_group();

create or replace function public.validate_creative_asset_group_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  asset_collection text;
  asset_deleted_at timestamptz;
  asset_status text;
  asset_user_id text;
  group_media_type text;
  group_user_id text;
begin
  new.user_id := btrim(new.user_id);

  select asset_group.user_id, asset_group.media_type
  into group_user_id, group_media_type
  from public.creative_asset_groups as asset_group
  where asset_group.id = new.group_id
  for share;

  if not found then
    raise exception 'Creative asset group does not exist.'
      using errcode = '23503';
  end if;

  if group_user_id is distinct from new.user_id then
    raise exception 'Creative asset group belongs to another user.'
      using errcode = '42501';
  end if;

  select
    asset.user_id,
    asset.collection,
    asset.status,
    asset.deleted_at
  into
    asset_user_id,
    asset_collection,
    asset_status,
    asset_deleted_at
  from public.media_assets as asset
  where asset.id = new.media_asset_id
  for share;

  if not found then
    raise exception 'Media asset does not exist.'
      using errcode = '23503';
  end if;

  if asset_user_id is distinct from new.user_id then
    raise exception 'Media asset belongs to another user.'
      using errcode = '42501';
  end if;

  if asset_status <> 'ready' or asset_deleted_at is not null then
    raise exception 'Only ready, active media assets can be added to a group.'
      using errcode = '23514';
  end if;

  if (
    group_media_type = 'image'
    and asset_collection <> 'image'
  ) or (
    group_media_type = 'video'
    and asset_collection not in ('video', 'influencer')
  ) then
    raise exception 'Media asset type does not match the group.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger validate_creative_asset_group_item_row
before insert or update on public.creative_asset_group_items
for each row
execute function public.validate_creative_asset_group_item();

alter table public.creative_asset_groups enable row level security;
alter table public.creative_asset_group_items enable row level security;

revoke all privileges on table public.creative_asset_groups
  from anon, authenticated;
revoke all privileges on table public.creative_asset_group_items
  from anon, authenticated;

grant select, insert, update, delete on table public.creative_asset_groups
  to service_role;
grant select, insert, delete on table public.creative_asset_group_items
  to service_role;

revoke all on function public.prepare_creative_asset_group()
  from public, anon, authenticated;
revoke all on function public.validate_creative_asset_group_item()
  from public, anon, authenticated;

grant execute on function public.prepare_creative_asset_group()
  to service_role;
grant execute on function public.validate_creative_asset_group_item()
  to service_role;

select pg_notify('pgrst', 'reload schema');
