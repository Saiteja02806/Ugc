alter table public.background_jobs
  drop constraint if exists background_jobs_job_type_check;

alter table public.background_jobs
  add constraint background_jobs_job_type_check
  check (
    job_type in (
      'test_worker_job',
      'render_edit_video',
      'render_demo_video',
      'generate_thumbnail',
      'extract_video_metadata',
      'generate_image',
      'generate_avatar',
      'generate_carousel',
      'generate_hook_video',
      'publish_social_post'
    )
  );
