create or replace function public.finalize_edit_render(
  p_render_id uuid,
  p_user_id text,
  p_project_id text,
  p_source_video_id text,
  p_terminal_status text,
  p_output_s3_key text,
  p_output_url text,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_render_job public.video_render_jobs%rowtype;
  v_now timestamptz := now();
  v_output_s3_key text;
  v_output_url text;
begin
  if p_terminal_status is null
    or p_terminal_status not in ('completed', 'failed')
  then
    raise exception 'Edit render terminal status must be completed or failed.';
  end if;

  if nullif(trim(p_user_id), '') is null
    or nullif(trim(p_project_id), '') is null
    or nullif(trim(p_source_video_id), '') is null
  then
    raise exception 'Edit render ownership fields are required.';
  end if;

  select render_job.*
  into v_render_job
  from public.video_render_jobs as render_job
  where render_job.render_id = p_render_id
    and render_job.user_id = p_user_id
    and render_job.project_id = p_project_id
    and render_job.source_video_id = p_source_video_id
  for update;

  if not found then
    return false;
  end if;

  -- A retry of the same terminal transition repairs all dependent rows. The
  -- opposite terminal transition remains fenced and cannot overwrite it.
  if v_render_job.status not in ('queued', 'rendering', p_terminal_status) then
    return false;
  end if;

  if p_terminal_status = 'completed' then
    v_output_s3_key := coalesce(
      nullif(trim(v_render_job.output_s3_key), ''),
      nullif(trim(p_output_s3_key), '')
    );
    v_output_url := coalesce(
      nullif(trim(v_render_job.output_url), ''),
      nullif(trim(p_output_url), '')
    );

    if v_output_s3_key is null then
      raise exception 'Completed edit render requires an output storage key.';
    end if;

    if v_output_url is null or v_output_url !~ '^https?://' then
      raise exception 'Completed edit render requires an HTTP output URL.';
    end if;

    if v_render_job.status in ('queued', 'rendering')
      or v_render_job.output_s3_key is null
      or v_render_job.output_url is null
    then
      update public.video_render_jobs as render_job
      set
        completed_at = coalesce(render_job.completed_at, v_now),
        error_message = null,
        output_s3_key = v_output_s3_key,
        output_url = v_output_url,
        status = 'completed',
        updated_at = v_now
      where render_job.render_id = p_render_id;
    end if;

    update public.editable_videos as editable
    set
      rendered_video_url = v_output_url,
      status = case
        when editable.draft_json is not distinct from v_render_job.draft_json
          then 'rendered'
        else 'draft'
      end,
      updated_at = case
        when editable.draft_json is not distinct from v_render_job.draft_json
          then v_now
        else editable.updated_at
      end
    where editable.user_id = p_user_id
      and editable.project_id = p_project_id
      and editable.source_video_id = p_source_video_id
      and editable.latest_render_id = p_render_id
      and editable.deleted_at is null;

    update public.demo_videos as demo
    set
      error_message = null,
      rendered_video_url = v_output_url,
      status = case
        when demo.draft_json is not distinct from v_render_job.draft_json
          then 'rendered'
        else 'draft'
      end,
      updated_at = case
        when demo.draft_json is not distinct from v_render_job.draft_json
          then v_now
        else demo.updated_at
      end
    where demo.id::text = p_source_video_id
      and demo.user_id = p_user_id
      and demo.project_id = p_project_id
      and demo.latest_render_id = p_render_id
      and demo.deleted_at is null;
  else
    if v_render_job.status in ('queued', 'rendering') then
      update public.video_render_jobs as render_job
      set
        completed_at = coalesce(render_job.completed_at, v_now),
        error_message = left(
          coalesce(nullif(trim(p_error_message), ''), 'Edit render failed.'),
          1000
        ),
        status = 'failed',
        updated_at = v_now
      where render_job.render_id = p_render_id;
    end if;

    update public.editable_videos as editable
    set
      status = case
        when editable.draft_json is not distinct from v_render_job.draft_json
          then 'failed'
        else 'draft'
      end,
      updated_at = case
        when editable.draft_json is not distinct from v_render_job.draft_json
          then v_now
        else editable.updated_at
      end
    where editable.user_id = p_user_id
      and editable.project_id = p_project_id
      and editable.source_video_id = p_source_video_id
      and editable.latest_render_id = p_render_id
      and editable.deleted_at is null;

    update public.demo_videos as demo
    set
      error_message = left(
        coalesce(nullif(trim(p_error_message), ''), 'Edit render failed.'),
        1000
      ),
      status = case
        when demo.draft_json is not distinct from v_render_job.draft_json
          then 'failed'
        else 'draft'
      end,
      updated_at = case
        when demo.draft_json is not distinct from v_render_job.draft_json
          then v_now
        else demo.updated_at
      end
    where demo.id::text = p_source_video_id
      and demo.user_id = p_user_id
      and demo.project_id = p_project_id
      and demo.latest_render_id = p_render_id
      and demo.deleted_at is null;
  end if;

  return true;
end;
$$;

-- Repair rows left in rendering by the former multi-request terminal update.
update public.editable_videos as editable
set
  rendered_video_url = render_job.output_url,
  status = case
    when editable.draft_json is not distinct from render_job.draft_json
      then 'rendered'
    else 'draft'
  end,
  updated_at = case
    when editable.draft_json is not distinct from render_job.draft_json
      then now()
    else editable.updated_at
  end
from public.video_render_jobs as render_job
where render_job.render_id = editable.latest_render_id
  and render_job.user_id = editable.user_id
  and render_job.project_id = editable.project_id
  and render_job.source_video_id = editable.source_video_id
  and render_job.status = 'completed'
  and nullif(trim(render_job.output_url), '') is not null
  and editable.status = 'rendering'
  and editable.deleted_at is null;

update public.editable_videos as editable
set
  status = case
    when editable.draft_json is not distinct from render_job.draft_json
      then 'failed'
    else 'draft'
  end,
  updated_at = case
    when editable.draft_json is not distinct from render_job.draft_json
      then now()
    else editable.updated_at
  end
from public.video_render_jobs as render_job
where render_job.render_id = editable.latest_render_id
  and render_job.user_id = editable.user_id
  and render_job.project_id = editable.project_id
  and render_job.source_video_id = editable.source_video_id
  and render_job.status = 'failed'
  and editable.status = 'rendering'
  and editable.deleted_at is null;

update public.demo_videos as demo
set
  error_message = null,
  rendered_video_url = render_job.output_url,
  status = case
    when demo.draft_json is not distinct from render_job.draft_json
      then 'rendered'
    else 'draft'
  end,
  updated_at = case
    when demo.draft_json is not distinct from render_job.draft_json
      then now()
    else demo.updated_at
  end
from public.video_render_jobs as render_job
where render_job.render_id = demo.latest_render_id
  and render_job.user_id = demo.user_id
  and render_job.project_id = demo.project_id
  and render_job.source_video_id = demo.id::text
  and render_job.status = 'completed'
  and nullif(trim(render_job.output_url), '') is not null
  and demo.status = 'rendering'
  and demo.deleted_at is null;

update public.demo_videos as demo
set
  error_message = render_job.error_message,
  status = case
    when demo.draft_json is not distinct from render_job.draft_json
      then 'failed'
    else 'draft'
  end,
  updated_at = case
    when demo.draft_json is not distinct from render_job.draft_json
      then now()
    else demo.updated_at
  end
from public.video_render_jobs as render_job
where render_job.render_id = demo.latest_render_id
  and render_job.user_id = demo.user_id
  and render_job.project_id = demo.project_id
  and render_job.source_video_id = demo.id::text
  and render_job.status = 'failed'
  and demo.status = 'rendering'
  and demo.deleted_at is null;

revoke all on function public.finalize_edit_render(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.finalize_edit_render(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to service_role;

select pg_notify('pgrst', 'reload schema');
