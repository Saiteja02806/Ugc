-- Atomically retries one failed platform target without republishing siblings.
create or replace function public.retry_social_publish_target(
  p_post_id uuid,
  p_target_id uuid,
  p_user_id text
)
returns table(outcome text, job_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_job_id uuid;
  v_active_job_status text;
  v_connection_id uuid;
  v_last_error_code text;
  v_media_asset_id uuid;
  v_now timestamptz := now();
  v_operation_post_id text;
  v_operation_post_url text;
  v_operation_published_at timestamptz;
  v_platform text;
  v_post_status text;
  v_previous_job_id uuid;
  v_project_id text;
  v_target_status text;
begin
  select post.status, post.project_id, post.media_asset_id
  into v_post_status, v_project_id, v_media_asset_id
  from public.scheduled_posts as post
  where post.id = p_post_id
    and post.user_id = p_user_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid;
    return;
  end if;

  select
    target.status,
    target.platform,
    target.social_connection_id,
    target.last_error_code,
    target.publish_job_id
  into
    v_target_status,
    v_platform,
    v_connection_id,
    v_last_error_code,
    v_previous_job_id
  from public.scheduled_post_targets as target
  where target.id = p_target_id
    and target.scheduled_post_id = p_post_id
    and target.user_id = p_user_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid;
    return;
  end if;

  if v_post_status = 'cancelled' or v_target_status = 'cancelled' then
    return query select 'cancelled'::text, null::uuid;
    return;
  end if;

  select
    operation.platform_post_id,
    operation.platform_post_url,
    operation.published_at
  into
    v_operation_post_id,
    v_operation_post_url,
    v_operation_published_at
  from public.social_publish_operations as operation
  where operation.scheduled_post_target_id = p_target_id
    and operation.user_id = p_user_id
    and operation.status = 'published'
    and operation.platform_post_id is not null
  limit 1;

  if v_operation_post_id is not null then
    update public.scheduled_post_targets as target
    set
      last_error_code = null,
      last_error_message = null,
      last_reconciled_at = v_now,
      next_retry_at = null,
      platform_post_id = v_operation_post_id,
      platform_post_url = v_operation_post_url,
      published_at = coalesce(v_operation_published_at, v_now),
      status = 'published',
      updated_at = v_now
    where target.id = p_target_id
      and target.user_id = p_user_id;

    update public.scheduled_posts as post
    set
      last_error_code = (
        select sibling.last_error_code
        from public.scheduled_post_targets as sibling
        where sibling.scheduled_post_id = post.id
          and sibling.status in ('failed', 'action_required')
        order by sibling.updated_at desc
        limit 1
      ),
      published_at = case
        when not exists (
          select 1
          from public.scheduled_post_targets as sibling
          where sibling.scheduled_post_id = post.id
            and sibling.status <> 'published'
        ) then coalesce(post.published_at, v_now)
        else post.published_at
      end,
      status = case
        when not exists (
          select 1
          from public.scheduled_post_targets as sibling
          where sibling.scheduled_post_id = post.id
            and sibling.status <> 'published'
        ) then 'published'
        when exists (
          select 1
          from public.scheduled_post_targets as sibling
          where sibling.scheduled_post_id = post.id
            and sibling.status in (
              'failed',
              'action_required',
              'cancelled',
              'skipped'
            )
        ) then 'partially_failed'
        when exists (
          select 1
          from public.scheduled_post_targets as sibling
          where sibling.scheduled_post_id = post.id
            and sibling.status = 'publishing'
        ) then 'publishing'
        else 'scheduled'
      end,
      updated_at = v_now
    where post.id = p_post_id
      and post.user_id = p_user_id;

    return query select 'already_published'::text, v_previous_job_id;
    return;
  end if;

  if v_target_status = 'published' then
    return query select 'already_published'::text, v_previous_job_id;
    return;
  end if;

  if v_target_status = 'action_required' then
    return query select 'action_required'::text, null::uuid;
    return;
  end if;

  if v_target_status in ('scheduled', 'scheduling', 'publishing', 'failed') then
    select job.id, job.status
    into v_active_job_id, v_active_job_status
    from public.background_jobs as job
    where job.user_id = p_user_id
      and job.job_type = 'publish_social_post'
      and job.status in ('queued', 'processing')
      and (
        job.id = v_previous_job_id
        or job.input_json ->> 'targetId' = p_target_id::text
      )
    order by
      case when job.id = v_previous_job_id then 0 else 1 end,
      job.created_at desc
    limit 1
    for update;
  end if;

  if v_active_job_id is not null then
    update public.scheduled_post_targets as target
    set
      last_error_code = null,
      last_error_message = null,
      next_retry_at = null,
      publish_job_id = v_active_job_id,
      status = case
        when v_active_job_status = 'processing' then 'publishing'
        else 'scheduled'
      end,
      updated_at = v_now
    where target.id = p_target_id
      and target.user_id = p_user_id;

    update public.scheduled_posts as post
    set
      last_error_code = (
        select sibling.last_error_code
        from public.scheduled_post_targets as sibling
        where sibling.scheduled_post_id = post.id
          and sibling.status in ('failed', 'action_required')
        order by sibling.updated_at desc
        limit 1
      ),
      status = case
        when exists (
          select 1
          from public.scheduled_post_targets as sibling
          where sibling.scheduled_post_id = post.id
            and sibling.status in ('failed', 'action_required')
        ) then 'partially_failed'
        when v_active_job_status = 'processing' then 'publishing'
        else 'scheduled'
      end,
      updated_at = v_now
    where post.id = p_post_id
      and post.user_id = p_user_id
      and post.status <> 'cancelled';

    return query select 'already_queued'::text, v_active_job_id;
    return;
  end if;

  if v_target_status <> 'failed' or v_post_status = 'published' then
    return query select 'not_retryable'::text, null::uuid;
    return;
  end if;

  if v_last_error_code = 'scheduler_create_failed' then
    return query select 'scheduling_retry_required'::text, null::uuid;
    return;
  end if;

  if v_previous_job_id is null then
    return query select 'not_retryable'::text, null::uuid;
    return;
  end if;

  if not exists (
    select 1
    from public.media_assets as media
    where media.id = v_media_asset_id
      and media.user_id = p_user_id
      and media.status = 'ready'
      and media.collection = 'video'
      and media.source_type in (
        'combined_render',
        'demo_upload',
        'upload',
        'generated_video',
        'edit_export'
      )
  ) then
    return query select 'media_unavailable'::text, null::uuid;
    return;
  end if;

  if not exists (
    select 1
    from public.social_connections as connection
    where connection.id = v_connection_id
      and connection.user_id = p_user_id
      and connection.platform = v_platform
      and connection.status = 'connected'
      and connection.revoked_at is null
      and (
        connection.expires_at is null
        or connection.expires_at > v_now
        or (
          v_platform in ('tiktok', 'youtube')
          and connection.refresh_token_ciphertext is not null
          and (
            connection.refresh_expires_at is null
            or connection.refresh_expires_at > v_now
          )
        )
      )
  ) then
    return query select 'connection_unavailable'::text, null::uuid;
    return;
  end if;

  insert into public.background_jobs (
    input_json,
    job_type,
    next_attempt_at,
    project_id,
    queue_name,
    status,
    updated_at,
    user_id
  ) values (
    jsonb_build_object('targetId', p_target_id::text),
    'publish_social_post',
    v_now,
    v_project_id,
    'social-publish',
    'queued',
    v_now,
    p_user_id
  )
  returning id into v_active_job_id;

  update public.scheduled_post_targets as target
  set
    last_error_code = null,
    last_error_message = null,
    last_reconciled_at = v_now,
    next_retry_at = null,
    publish_job_id = v_active_job_id,
    scheduled_for = v_now,
    status = 'scheduled',
    updated_at = v_now
  where target.id = p_target_id
    and target.user_id = p_user_id;

  update public.scheduled_posts as post
  set
    last_error_code = (
      select sibling.last_error_code
      from public.scheduled_post_targets as sibling
      where sibling.scheduled_post_id = post.id
        and sibling.status in ('failed', 'action_required')
      order by sibling.updated_at desc
      limit 1
    ),
    status = case
      when exists (
        select 1
        from public.scheduled_post_targets as sibling
        where sibling.scheduled_post_id = post.id
          and sibling.status in ('failed', 'action_required')
      ) then 'partially_failed'
      else 'scheduled'
    end,
    updated_at = v_now
  where post.id = p_post_id
    and post.user_id = p_user_id
    and post.status <> 'cancelled';

  return query select 'retry_created'::text, v_active_job_id;
end;
$$;

revoke all on function public.retry_social_publish_target(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.retry_social_publish_target(uuid, uuid, text)
  to service_role;

select pg_notify('pgrst', 'reload schema');
