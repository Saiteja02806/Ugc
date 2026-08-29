alter table public.background_jobs
  drop constraint if exists background_jobs_job_type_check;

alter table public.background_jobs
  add constraint background_jobs_job_type_check
  check (
    job_type in (
      'test_worker_job',
      'render_edit_video',
      'render_demo_video',
      'render_schedule_combination',
      'generate_thumbnail',
      'extract_video_metadata',
      'generate_image',
      'generate_avatar',
      'generate_carousel',
      'generate_hook_video',
      'publish_social_post'
    )
  );

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
      'combined_render'
    )
  );

select pg_notify('pgrst', 'reload schema');
