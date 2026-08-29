create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),

  user_id text not null,
  project_id text,
  collection text not null
    check (collection in ('influencer', 'video', 'image')),
  source_type text not null
    check (
      source_type in (
        'upload',
        'influencer_upload',
        'demo_upload',
        'catalog_influencer',
        'generated_image',
        'generated_video',
        'edit_export'
      )
    ),
  source_record_id text,
  parent_asset_id uuid references public.media_assets(id) on delete set null,

  title text not null
    check (char_length(trim(title)) > 0 and char_length(title) <= 140),
  storage_key text not null
    check (char_length(trim(storage_key)) > 0),
  url text not null
    check (url ~ '^https?://'),
  thumbnail_url text
    check (thumbnail_url is null or thumbnail_url ~ '^https?://'),

  mime_type text not null
    check (char_length(trim(mime_type)) > 0),
  file_name text,
  file_size_bytes bigint
    check (file_size_bytes is null or file_size_bytes > 0),
  duration_seconds numeric
    check (duration_seconds is null or duration_seconds >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  ratio text not null default 'other'
    check (ratio in ('9:16', '1:1', '4:5', '16:9', 'other')),

  status text not null default 'uploading'
    check (status in ('uploading', 'processing', 'ready', 'failed')),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists media_assets_user_storage_key_idx
  on public.media_assets (user_id, storage_key)
  where deleted_at is null;

create unique index if not exists media_assets_user_source_record_idx
  on public.media_assets (user_id, source_type, source_record_id)
  where source_record_id is not null and deleted_at is null;

create index if not exists media_assets_user_collection_updated_idx
  on public.media_assets (user_id, collection, updated_at desc)
  where deleted_at is null;

create index if not exists media_assets_parent_idx
  on public.media_assets (parent_asset_id)
  where parent_asset_id is not null and deleted_at is null;

alter table public.media_assets enable row level security;

revoke all privileges on table public.media_assets
  from anon, authenticated;

grant select, insert, update, delete on table public.media_assets
  to service_role;

-- Existing customer uploads become user videos without duplicating the S3 object.
insert into public.media_assets (
  user_id,
  project_id,
  collection,
  source_type,
  source_record_id,
  title,
  storage_key,
  url,
  thumbnail_url,
  mime_type,
  file_name,
  file_size_bytes,
  duration_seconds,
  width,
  height,
  ratio,
  status,
  metadata,
  created_at,
  updated_at
)
select
  user_id,
  project_id,
  'video',
  'demo_upload',
  id::text,
  title,
  source_s3_key,
  source_video_url,
  thumbnail_url,
  file_type,
  file_name,
  file_size_bytes,
  duration_seconds,
  width,
  height,
  ratio,
  case when status = 'failed' then 'failed' else 'ready' end,
  jsonb_build_object('legacyDemoId', id::text),
  created_at,
  updated_at
from public.demo_videos
where deleted_at is null
  and status <> 'uploading'
on conflict do nothing;

-- Completed worker generations become owned image/video assets.
insert into public.media_assets (
  user_id,
  project_id,
  collection,
  source_type,
  source_record_id,
  title,
  storage_key,
  url,
  mime_type,
  status,
  metadata,
  created_at,
  updated_at
)
select
  user_id,
  project_id,
  case when job_type = 'generate_hook_video' then 'video' else 'image' end,
  case when job_type = 'generate_hook_video' then 'generated_video' else 'generated_image' end,
  id::text,
  case
    when job_type = 'generate_hook_video' then 'Generated influencer video'
    when job_type = 'generate_avatar' then 'Generated influencer image'
    else 'Generated image'
  end,
  output_json ->> 'key',
  output_json ->> 'url',
  case when job_type = 'generate_hook_video' then 'video/mp4' else 'image/png' end,
  'ready',
  jsonb_build_object('backgroundJobId', id::text, 'jobType', job_type),
  created_at,
  updated_at
from public.background_jobs
where user_id is not null
  and status = 'completed'
  and job_type in ('generate_image', 'generate_avatar', 'generate_hook_video')
  and coalesce(output_json ->> 'key', '') <> ''
  and coalesce(output_json ->> 'url', '') ~ '^https?://'
on conflict do nothing;

-- Completed editor renders become new user videos linked to their source when possible.
insert into public.media_assets (
  user_id,
  project_id,
  collection,
  source_type,
  source_record_id,
  parent_asset_id,
  title,
  storage_key,
  url,
  thumbnail_url,
  mime_type,
  duration_seconds,
  ratio,
  status,
  metadata,
  created_at,
  updated_at
)
select
  render.user_id,
  render.project_id,
  'video',
  'edit_export',
  render.render_id::text,
  source_asset.id,
  concat(editable.title, ' export'),
  render.output_s3_key,
  render.output_url,
  editable.thumbnail_url,
  'video/mp4',
  editable.duration_seconds,
  editable.ratio,
  'ready',
  jsonb_build_object('renderId', render.render_id::text),
  render.created_at,
  render.updated_at
from public.video_render_jobs render
join public.editable_videos editable
  on editable.user_id = render.user_id
  and editable.project_id = render.project_id
  and editable.source_video_id = render.source_video_id
  and editable.latest_render_id = render.render_id
left join public.media_assets source_asset
  on source_asset.user_id = render.user_id
  and source_asset.id::text = editable.source_video_id
  and source_asset.deleted_at is null
where render.status = 'completed'
  and coalesce(render.output_s3_key, '') <> ''
  and coalesce(render.output_url, '') ~ '^https?://'
on conflict do nothing;

select pg_notify('pgrst', 'reload schema');
