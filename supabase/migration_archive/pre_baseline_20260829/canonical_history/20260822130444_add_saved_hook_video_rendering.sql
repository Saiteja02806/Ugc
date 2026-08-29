alter table public.hook_video_drafts
  add column if not exists render_id uuid,
  add column if not exists render_job_id uuid
    references public.background_jobs(id) on delete set null,
  add column if not exists render_status text not null
    default 'not_requested',
  add column if not exists render_fingerprint text,
  add column if not exists rendered_media_asset_id uuid
    references public.media_assets(id) on delete set null,
  add column if not exists rendered_video_url text,
  add column if not exists render_error text,
  add column if not exists render_requested_at timestamptz,
  add column if not exists rendered_at timestamptz;

alter table public.hook_video_drafts
  drop constraint if exists hook_video_drafts_render_status_check;

alter table public.hook_video_drafts
  add constraint hook_video_drafts_render_status_check
  check (
    render_status in (
      'not_requested',
      'queued',
      'rendering',
      'ready',
      'failed'
    )
  );

create unique index if not exists hook_video_drafts_render_id_uidx
  on public.hook_video_drafts (render_id)
  where render_id is not null;

create index if not exists hook_video_drafts_render_job_idx
  on public.hook_video_drafts (render_job_id)
  where render_job_id is not null;

create index if not exists hook_video_drafts_rendered_media_idx
  on public.hook_video_drafts (rendered_media_asset_id)
  where rendered_media_asset_id is not null;

create or replace function public.claim_hook_video_library_render(
  p_draft_id uuid,
  p_render_fingerprint text,
  p_user_id text
)
returns setof public.hook_video_drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.hook_video_drafts;
  requested_at timestamptz := now();
begin
  if p_draft_id is null
    or char_length(trim(coalesce(p_render_fingerprint, ''))) = 0
    or char_length(trim(coalesce(p_user_id, ''))) = 0
  then
    raise exception 'hook_video_render_invalid_scope';
  end if;

  select draft.*
  into claimed
  from public.hook_video_drafts as draft
  where draft.id = p_draft_id
    and draft.user_id = p_user_id
    and draft.library_saved_at is not null
  for update;

  if not found then
    raise exception 'hook_video_render_draft_unavailable';
  end if;

  if claimed.render_status in ('queued', 'rendering', 'ready')
    and claimed.render_id is not null
    and claimed.render_fingerprint = p_render_fingerprint
  then
    return next claimed;
    return;
  end if;

  update public.hook_video_drafts
  set
    render_error = null,
    render_fingerprint = p_render_fingerprint,
    render_id = gen_random_uuid(),
    render_job_id = null,
    render_requested_at = requested_at,
    render_status = 'queued',
    rendered_at = null,
    rendered_media_asset_id = null,
    rendered_video_url = null,
    updated_at = requested_at
  where id = claimed.id
  returning * into claimed;

  return next claimed;
end;
$$;

revoke all on function public.claim_hook_video_library_render(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_hook_video_library_render(uuid, text, text)
  to service_role;

select pg_notify('pgrst', 'reload schema');
