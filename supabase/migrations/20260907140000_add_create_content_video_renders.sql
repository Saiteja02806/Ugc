-- Create Content is not a Trending assignment. Each export is an immutable
-- snapshot of one card revision, which lets a user keep editing while a prior
-- MP4 finishes safely in the background.
create table public.create_content_renders (
  id uuid primary key,
  user_id text not null,
  source_media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  card_revision integer not null check (card_revision > 0),
  overlay_json jsonb not null,
  status text not null default 'queued',
  render_job_id uuid references public.background_jobs(id) on delete set null,
  rendered_media_asset_id uuid unique references public.media_assets(id) on delete restrict,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint create_content_renders_status_chk check (
    status in ('queued', 'rendering', 'ready', 'failed')
  ),
  constraint create_content_renders_overlay_json_chk check (
    jsonb_typeof(overlay_json) = 'object'
  ),
  constraint create_content_renders_ready_chk check (
    status <> 'ready' or rendered_media_asset_id is not null
  ),
  constraint create_content_renders_error_chk check (
    error_message is null or char_length(btrim(error_message)) > 0
  ),
  constraint create_content_renders_owner_revision_uidx unique (
    user_id, source_media_asset_id, card_revision
  )
);

create index create_content_renders_source_status_idx
  on public.create_content_renders (user_id, source_media_asset_id, status, updated_at desc);

alter table public.create_content_renders enable row level security;
revoke all on table public.create_content_renders from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update
  on table public.create_content_renders to postgres, service_role;

create or replace function public.touch_create_content_render_updated_at()
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

create trigger create_content_renders_touch_updated_at
  before update on public.create_content_renders
  for each row execute function public.touch_create_content_render_updated_at();

-- The worker receives a dedicated job name; it still uses the normal video
-- render queue and publishes its ready output as a regular media asset.
alter table public.background_jobs
  drop constraint if exists background_jobs_job_type_check;
alter table public.background_jobs
  add constraint background_jobs_job_type_check check (
    job_type = any (array[
      'analytics_sync', 'carousel_content_plan_generation', 'carousel_generation',
      'hook_text_generation', 'wall_text_generation', 'wall_text_content_plan_generation',
      'generate_avatar', 'generate_carousel', 'generate_hook_video',
      'generate_image', 'generate_thumbnail', 'generate_trending_hook_copy',
      'extract_video_metadata', 'image_generation', 'media_analysis', 'paid_trending_prebuild',
      'preview_render', 'publish_social_post', 'render_demo_video', 'render_edit_video',
      'render_schedule_combination', 'render_trending_carousel_edit', 'render_wall_text_video',
      'render_create_content_video', 'social_publish', 'test_worker_job', 'video_generation',
      'final_render', 'reaction_generation'
    ]::text[])
  );

comment on table public.create_content_renders is
  'Immutable Create Content export snapshots. They preserve the source clip audio and never reference Trending plans or assignments.';

select pg_notify('pgrst', 'reload schema');
