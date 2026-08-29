-- This repair intentionally does not touch background_jobs_job_type_check.
-- The deployed constraint already contains the current job types; the older
-- missing Wall Text migration had an outdated list that would remove them.

alter table public.user_wall_text_assignments
  add column if not exists render_id uuid,
  add column if not exists render_job_id uuid
    references public.background_jobs(id) on delete set null,
  add column if not exists render_status text not null
    default 'not_requested',
  add column if not exists rendered_media_asset_id uuid
    references public.media_assets(id) on delete set null,
  add column if not exists render_error text,
  add column if not exists render_requested_at timestamptz,
  add column if not exists rendered_at timestamptz;

alter table public.user_wall_text_assignments
  drop constraint if exists user_wall_text_assignments_render_status_check;

alter table public.user_wall_text_assignments
  add constraint user_wall_text_assignments_render_status_check
  check (
    render_status in (
      'not_requested',
      'queued',
      'rendering',
      'ready',
      'failed'
    )
  );

create unique index if not exists user_wall_text_assignments_render_id_uidx
  on public.user_wall_text_assignments (render_id)
  where render_id is not null;

create index if not exists user_wall_text_assignments_selected_idx
  on public.user_wall_text_assignments (user_id, state, updated_at desc)
  where state = 'selected';

create index if not exists user_wall_text_assignments_render_job_idx
  on public.user_wall_text_assignments (render_job_id)
  where render_job_id is not null;

create index if not exists user_wall_text_assignments_rendered_media_idx
  on public.user_wall_text_assignments (rendered_media_asset_id)
  where rendered_media_asset_id is not null;

alter table public.media_assets
  drop constraint if exists media_assets_source_type_check;

alter table public.media_assets
  add constraint media_assets_source_type_check
  check (
    source_type in (
      'upload',
      'influencer_upload',
      'demo_upload',
      'catalog_influencer',
      'generated_image',
      'generated_video',
      'edit_export',
      'combined_render',
      'wall_text_render'
    )
  );

select pg_notify('pgrst', 'reload schema');
