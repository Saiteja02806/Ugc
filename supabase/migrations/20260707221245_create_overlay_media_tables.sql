create table if not exists public.overlay_media_assets (
  id uuid primary key default gen_random_uuid(),

  asset_type text not null
    check (asset_type in ('image', 'video')),
  format_family text not null default 'wall_text_overlay'
    check (format_family in ('wall_text_overlay')),
  aspect_ratio text not null default '9:16'
    check (aspect_ratio in ('9:16', '1:1', '4:5', '16:9', 'other')),
  source_type text not null default 'owned'
    check (source_type in ('owned')),

  source_file_name text
    check (
      source_file_name is null
      or char_length(trim(source_file_name)) > 0
    ),
  content_type text
    check (
      content_type is null
      or content_type in (
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'video/webm'
      )
    ),
  file_size_bytes bigint
    check (file_size_bytes is null or file_size_bytes > 0),

  s3_key text not null
    check (char_length(trim(s3_key)) > 0),
  preview_url text
    check (preview_url is null or preview_url ~ '^https?://'),
  thumbnail_s3_key text
    check (
      thumbnail_s3_key is null
      or char_length(trim(thumbnail_s3_key)) > 0
    ),
  thumbnail_url text
    check (thumbnail_url is null or thumbnail_url ~ '^https?://'),

  duration_seconds numeric
    check (duration_seconds is null or duration_seconds > 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),

  analysis_status text not null default 'pending'
    check (
      analysis_status in (
        'pending',
        'analyzing',
        'succeeded',
        'failed',
        'skipped_missing_ffmpeg'
      )
    ),
  status text not null default 'inactive'
    check (status in ('active', 'inactive', 'archived')),
  analysis_model text
    check (
      analysis_model is null
      or char_length(trim(analysis_model)) > 0
    ),
  analysis_error text,
  analyzed_at timestamptz,
  metadata_schema_version text not null default 'overlay_asset_metadata_v1'
    check (metadata_schema_version in ('overlay_asset_metadata_v1')),

  primary_profiles jsonb not null default '[]'::jsonb
    check (jsonb_typeof(primary_profiles) = 'array'),
  generic_profiles jsonb not null default '[]'::jsonb
    check (jsonb_typeof(generic_profiles) = 'array'),
  use_case_tags jsonb not null default '[]'::jsonb
    check (jsonb_typeof(use_case_tags) = 'array'),
  recommended_position text,
  text_capacity text
    check (
      text_capacity is null
      or text_capacity in ('low', 'medium', 'high')
    ),
  readability_score numeric
    check (
      readability_score is null
      or (
        readability_score >= 0
        and readability_score <= 1
      )
    ),
  motion_level text
    check (
      motion_level is null
      or motion_level in ('none', 'low', 'medium', 'high')
    ),
  vision_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(vision_metadata) = 'object'),

  usage_count integer not null default 0
    check (usage_count >= 0),
  last_used_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint overlay_media_assets_active_requires_analysis_chk check (
    status <> 'active'
    or analysis_status = 'succeeded'
  ),
  constraint overlay_media_assets_video_duration_chk check (
    asset_type <> 'video'
    or duration_seconds is null
    or duration_seconds > 0
  )
);

create unique index if not exists overlay_media_assets_s3_key_idx
  on public.overlay_media_assets (s3_key)
  where status <> 'archived';

create index if not exists overlay_media_assets_selectable_idx
  on public.overlay_media_assets (
    format_family,
    asset_type,
    aspect_ratio,
    status,
    usage_count,
    created_at desc
  )
  where status = 'active';

create index if not exists overlay_media_assets_analysis_status_idx
  on public.overlay_media_assets (analysis_status, status, created_at desc);

create index if not exists overlay_media_assets_primary_profiles_gin_idx
  on public.overlay_media_assets using gin (primary_profiles);

create index if not exists overlay_media_assets_generic_profiles_gin_idx
  on public.overlay_media_assets using gin (generic_profiles);

create index if not exists overlay_media_assets_use_case_tags_gin_idx
  on public.overlay_media_assets using gin (use_case_tags);

create table if not exists public.overlay_creatives (
  id uuid primary key default gen_random_uuid(),

  overlay_media_asset_id uuid not null
    references public.overlay_media_assets(id) on delete restrict,

  creative_type text not null
    check (creative_type in ('text_overlay_image', 'text_overlay_video')),
  format_family text not null default 'wall_text_overlay'
    check (format_family in ('wall_text_overlay')),
  format text not null
    check (format in ('pick_two_list', 'choose_one', 'hot_take')),
  profile text
    check (profile is null or char_length(trim(profile)) > 0),

  overlay_text jsonb not null
    check (jsonb_typeof(overlay_text) = 'object'),
  render_box jsonb not null
    check (jsonb_typeof(render_box) = 'object'),
  render_style jsonb not null
    check (jsonb_typeof(render_style) = 'object'),
  source_context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_context) = 'object'),

  status text not null default 'preview_ready'
    check (status in ('preview_ready', 'failed', 'archived')),
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists overlay_creatives_asset_idx
  on public.overlay_creatives (overlay_media_asset_id, created_at desc);

create index if not exists overlay_creatives_profile_format_idx
  on public.overlay_creatives (profile, format, status, created_at desc)
  where status = 'preview_ready';

alter table public.overlay_media_assets enable row level security;
alter table public.overlay_creatives enable row level security;

-- Overlay media is managed by trusted server scripts and server routes in MVP.
-- RLS remains enabled; browser clients should not access these tables directly.
revoke all privileges on table public.overlay_media_assets
  from anon, authenticated;

revoke all privileges on table public.overlay_creatives
  from anon, authenticated;

grant select, insert, update on table public.overlay_media_assets
  to service_role;

grant select, insert, update on table public.overlay_creatives
  to service_role;

select pg_notify('pgrst', 'reload schema');
