-- Phase 1 catalog for the Reaction Trending format. Reviewers enter only the
-- small tag set used for matching and placement; probe-derived metadata is
-- persisted separately and is never inferred at render time.

create or replace function public.reaction_asset_tags_are_clean(p_tags text[])
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select
    cardinality(p_tags) = cardinality(
      array(select distinct btrim(tag_value) from unnest(p_tags) as tags(tag_value))
    )
    and bool_and(btrim(tag_value) <> '')
  from unnest(p_tags) as tags(tag_value);
$$;

create table if not exists public.reaction_clip_assets (
  id uuid primary key default gen_random_uuid(),
  asset_key text not null unique,
  source_file_name text not null,
  source_sha256 text not null,
  source_storage_key text unique,
  codec text not null,
  pixel_format text not null,
  duration_seconds numeric not null check (duration_seconds > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  has_alpha boolean not null,
  reactions text[] not null default '{}'::text[],
  subject_count text,
  composition text,
  foreground_anchor text,
  foreground_height_percent numeric,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reaction_clip_assets_status_chk
    check (status in ('pending', 'active', 'excluded')),
  constraint reaction_clip_assets_reactions_chk
    check (
      cardinality(reactions) <= 3
      and public.reaction_asset_tags_are_clean(reactions)
      and reactions <@ array[
        'side_eye', 'facepalm', 'deadpan', 'confusion', 'shock', 'relief',
        'celebration', 'laughter', 'disappointment', 'regret', 'unbothered',
        'concern', 'focused', 'playful'
      ]::text[]
    ),
  constraint reaction_clip_assets_subject_count_chk
    check (subject_count is null or subject_count in ('one', 'two', 'group')),
  constraint reaction_clip_assets_composition_chk
    check (composition is null or composition in ('close_up', 'bust', 'full_body', 'wide')),
  constraint reaction_clip_assets_foreground_anchor_chk
    check (foreground_anchor is null or foreground_anchor in ('bottom_center', 'bottom_left', 'bottom_right', 'center')),
  constraint reaction_clip_assets_foreground_height_chk
    check (
      foreground_height_percent is null
      or foreground_height_percent between 0.25 and 0.90
    ),
  constraint reaction_clip_assets_active_metadata_chk
    check (
      status <> 'active'
      or (
        has_alpha
        and nullif(btrim(source_storage_key), '') is not null
        and cardinality(reactions) between 1 and 3
        and subject_count is not null
        and composition is not null
        and foreground_anchor is not null
        and foreground_height_percent is not null
      )
    )
);

create table if not exists public.reaction_background_assets (
  id uuid primary key default gen_random_uuid(),
  asset_key text not null unique,
  source_file_name text not null,
  source_sha256 text not null,
  source_storage_key text unique,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  context_tags text[] not null default '{}'::text[],
  foreground_placement text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reaction_background_assets_status_chk
    check (status in ('pending', 'active', 'excluded')),
  constraint reaction_background_assets_foreground_placement_chk
    check (foreground_placement is null or foreground_placement in ('bottom_center', 'bottom_left', 'bottom_right', 'center')),
  constraint reaction_background_assets_context_tags_chk
    check (public.reaction_asset_tags_are_clean(context_tags)),
  constraint reaction_background_assets_active_metadata_chk
    check (
      status <> 'active'
      or (
        nullif(btrim(source_storage_key), '') is not null
        and cardinality(context_tags) >= 1
        and foreground_placement is not null
      )
    )
);

create unique index if not exists reaction_clip_assets_source_sha256_idx
  on public.reaction_clip_assets (source_sha256);
create unique index if not exists reaction_background_assets_source_sha256_idx
  on public.reaction_background_assets (source_sha256);
create index if not exists reaction_clip_assets_active_selection_idx
  on public.reaction_clip_assets (foreground_anchor, subject_count, composition)
  where status = 'active' and has_alpha;
create index if not exists reaction_background_assets_active_selection_idx
  on public.reaction_background_assets (foreground_placement)
  where status = 'active';
create index if not exists reaction_clip_assets_reactions_idx
  on public.reaction_clip_assets using gin (reactions);
create index if not exists reaction_background_assets_context_tags_idx
  on public.reaction_background_assets using gin (context_tags);

create or replace function public.touch_reaction_asset_updated_at()
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

drop trigger if exists reaction_clip_assets_touch_updated_at on public.reaction_clip_assets;
create trigger reaction_clip_assets_touch_updated_at
  before update on public.reaction_clip_assets
  for each row execute function public.touch_reaction_asset_updated_at();

drop trigger if exists reaction_background_assets_touch_updated_at on public.reaction_background_assets;
create trigger reaction_background_assets_touch_updated_at
  before update on public.reaction_background_assets
  for each row execute function public.touch_reaction_asset_updated_at();

alter table public.reaction_clip_assets enable row level security;
alter table public.reaction_background_assets enable row level security;

revoke all on table public.reaction_clip_assets, public.reaction_background_assets
  from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update
  on table public.reaction_clip_assets, public.reaction_background_assets
  to postgres, service_role;

comment on table public.reaction_clip_assets is
  'Reviewed transparent foreground clips for Reaction Trending creatives.';
comment on table public.reaction_background_assets is
  'Reviewed static backgrounds for Reaction Trending creatives.';
comment on column public.reaction_clip_assets.reactions is
  'One to three distinct visible reactions, ordered with the primary reaction first.';
comment on column public.reaction_clip_assets.source_storage_key is
  'Assigned during the storage-import phase; an active asset must have a renderable source object.';
comment on column public.reaction_background_assets.source_storage_key is
  'Assigned during the storage-import phase; an active asset must have a renderable source object.';

select pg_notify('pgrst', 'reload schema');
