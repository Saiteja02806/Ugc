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
      'render_wall_text_video',
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
      'combined_render',
      'wall_text_render'
    )
  );

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

create or replace function public.claim_wall_text_render(
  p_assignment_id uuid,
  p_user_id text
)
returns setof public.user_wall_text_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.user_wall_text_assignments;
  requested_at timestamptz := now();
begin
  if p_assignment_id is null
    or char_length(trim(coalesce(p_user_id, ''))) = 0
  then
    raise exception 'wall_text_render_invalid_scope';
  end if;

  select assignment.*
  into claimed
  from public.user_wall_text_assignments as assignment
  where assignment.id = p_assignment_id
    and assignment.user_id = p_user_id
    and assignment.state in ('active', 'selected')
  for update;

  if not found then
    raise exception 'wall_text_render_assignment_unavailable';
  end if;

  if claimed.render_status in ('queued', 'rendering', 'ready')
    and claimed.render_id is not null
  then
    if claimed.state = 'active' then
      update public.user_wall_text_assignments
      set
        completed_at = coalesce(completed_at, requested_at),
        last_opened_at = requested_at,
        state = 'selected',
        updated_at = requested_at
      where id = claimed.id
      returning * into claimed;
    end if;

    return next claimed;
    return;
  end if;

  update public.user_wall_text_assignments
  set
    completed_at = coalesce(completed_at, requested_at),
    last_opened_at = requested_at,
    render_error = null,
    render_id = gen_random_uuid(),
    render_job_id = null,
    render_requested_at = requested_at,
    render_status = 'queued',
    rendered_at = null,
    rendered_media_asset_id = null,
    state = 'selected',
    updated_at = requested_at
  where id = claimed.id
  returning * into claimed;

  return next claimed;
end;
$$;

revoke all on function public.claim_wall_text_render(uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_wall_text_render(uuid, text)
  to service_role;

select pg_notify('pgrst', 'reload schema');
