create table if not exists public.hook_audio_assets (
  id text primary key
    check (id ~ '^hook_audio_[0-9]{3}$'),
  source_package text not null
    check (
      char_length(btrim(source_package)) between 1 and 120
    ),
  source_file_name text not null
    check (
      char_length(btrim(source_file_name)) between 5 and 255
      and lower(source_file_name) like '%.mp3'
    ),
  storage_provider text not null default 'gcp'
    check (storage_provider = 'gcp'),
  storage_key text not null unique
    check (char_length(btrim(storage_key)) > 0),
  audio_url text not null
    check (audio_url ~ '^https://'),
  duration_seconds numeric(10, 3) not null
    check (duration_seconds > 0 and duration_seconds <= 600),
  codec text not null default 'mp3'
    check (codec = 'mp3'),
  sample_rate_hz integer
    check (sample_rate_hz is null or sample_rate_hz > 0),
  channels integer
    check (channels is null or channels between 1 and 8),
  bit_rate_bps integer
    check (bit_rate_bps is null or bit_rate_bps > 0),
  moods text[] not null default '{}'::text[],
  hook_types text[] not null default '{}'::text[],
  energy text
    check (energy is null or energy in ('low', 'medium', 'high')),
  impact_at_seconds numeric(10, 3)
    check (
      impact_at_seconds is null
      or (
        impact_at_seconds >= 0
        and impact_at_seconds < duration_seconds
      )
    ),
  loopable boolean not null default false
    check (not loopable),
  measured_integrated_lufs numeric(6, 2),
  measured_true_peak_db numeric(6, 2),
  sha256 text not null unique
    check (sha256 ~ '^[a-f0-9]{64}$'),
  file_size_bytes bigint not null
    check (file_size_bytes > 0),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  review_notes text,
  status text not null default 'inactive'
    check (status in ('inactive', 'active')),
  schema_version text not null default 'hook-audio-library-v1'
    check (char_length(btrim(schema_version)) > 0),
  tagging_version text not null default 'hook-audio-tagging-v1'
    check (char_length(btrim(tagging_version)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint hook_audio_assets_moods_check check (
    moods <@ array[
      'curious',
      'uplifting',
      'serious',
      'calm',
      'urgent',
      'playful'
    ]::text[]
    and cardinality(moods) <= 2
  ),
  constraint hook_audio_assets_hook_types_check check (
    hook_types <@ array[
      'curiosity',
      'problem',
      'warning',
      'transformation',
      'benefit',
      'story',
      'authority'
    ]::text[]
    and cardinality(hook_types) <= 4
  ),
  constraint hook_audio_assets_tag_completeness_check check (
    (
      cardinality(moods) = 0
      and cardinality(hook_types) = 0
      and energy is null
    )
    or (
      cardinality(moods) between 1 and 2
      and cardinality(hook_types) between 2 and 4
      and energy is not null
    )
  ),
  constraint hook_audio_assets_active_review_check check (
    status <> 'active'
    or (
      review_status = 'approved'
      and reviewed_at is not null
      and cardinality(moods) between 1 and 2
      and cardinality(hook_types) between 2 and 4
      and energy is not null
    )
  ),
  constraint hook_audio_assets_review_timestamp_check check (
    (review_status = 'pending' and reviewed_at is null)
    or (review_status in ('approved', 'rejected') and reviewed_at is not null)
  )
);

create index if not exists hook_audio_assets_active_matching_idx
  on public.hook_audio_assets (energy, duration_seconds, id)
  where status = 'active' and review_status = 'approved';

create index if not exists hook_audio_assets_review_queue_idx
  on public.hook_audio_assets (review_status, status, id);

alter table public.hook_audio_assets enable row level security;

revoke all privileges on table public.hook_audio_assets
  from public, anon, authenticated;

grant select, insert, update on table public.hook_audio_assets
  to service_role;

select pg_notify('pgrst', 'reload schema');
