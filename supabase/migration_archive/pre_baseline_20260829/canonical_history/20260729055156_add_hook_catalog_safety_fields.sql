alter table public.avatar_assets
  add column if not exists source_file_sha256 text,
  add column if not exists source_batch text,
  add column if not exists influencer_key text,
  add column if not exists visual_group text,
  add column if not exists has_audio boolean not null default false;

alter table public.avatar_assets
  drop constraint if exists avatar_assets_source_file_sha256_chk,
  add constraint avatar_assets_source_file_sha256_chk check (
    source_file_sha256 is null
    or source_file_sha256 ~ '^[a-f0-9]{64}$'
  ),
  drop constraint if exists avatar_assets_source_batch_chk,
  add constraint avatar_assets_source_batch_chk check (
    source_batch is null
    or (
      char_length(source_batch) between 1 and 100
      and source_batch ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    )
  ),
  drop constraint if exists avatar_assets_influencer_key_chk,
  add constraint avatar_assets_influencer_key_chk check (
    influencer_key is null
    or (
      char_length(influencer_key) between 1 and 100
      and influencer_key ~ '^[a-z0-9]+(_[a-z0-9]+)*$'
    )
  ),
  drop constraint if exists avatar_assets_visual_group_chk,
  add constraint avatar_assets_visual_group_chk check (
    visual_group is null
    or (
      char_length(visual_group) between 1 and 100
      and visual_group ~ '^[a-z0-9]+(_[a-z0-9]+)*$'
    )
  ),
  drop constraint if exists avatar_assets_ready_catalog_metadata_chk,
  add constraint avatar_assets_ready_catalog_metadata_chk check (
    status <> 'ready'
    or deleted_at is not null
    or (
      source_file_sha256 is not null
      and source_batch is not null
      and influencer_key is not null
      and visual_group is not null
    )
  );

create unique index if not exists avatar_assets_source_file_sha256_idx
  on public.avatar_assets (source_file_sha256)
  where deleted_at is null
    and source_file_sha256 is not null;

create index if not exists avatar_assets_source_batch_idx
  on public.avatar_assets (source_batch, created_at desc)
  where deleted_at is null
    and source_batch is not null;

create index if not exists avatar_assets_ready_selection_idx
  on public.avatar_assets (
    has_audio,
    visual_group,
    influencer_key,
    sort_order,
    created_at desc
  )
  where status = 'ready'
    and deleted_at is null;

comment on column public.avatar_assets.source_file_sha256 is
  'SHA-256 of the original Hook source file. Used for idempotent imports and exact duplicate prevention.';

comment on column public.avatar_assets.source_batch is
  'Stable identifier for the reviewed Hook catalog import batch.';

comment on column public.avatar_assets.influencer_key is
  'Normalized Hook influencer identity used for grouping and diverse selection.';

comment on column public.avatar_assets.visual_group is
  'One primary visual similarity group used to avoid repetitive Hook selections.';

comment on column public.avatar_assets.has_audio is
  'True only when the original Hook source contains an audio stream intended to be preserved.';

select pg_notify('pgrst', 'reload schema');
