-- Clear a successfully published target's own error state without referring to
-- an undefined scheduled_posts alias in the target update.
create or replace function public.reconcile_social_schedule_state(
  p_limit integer,
  p_stale_after_seconds integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cancelled_targets integer := 0;
  v_failed_targets integer := 0;
  v_now timestamptz := now();
  v_published_targets integer := 0;
  v_reconciled integer := 0;
  v_stale_targets integer := 0;
  v_stale_after_seconds integer := greatest(
    60,
    least(coalesce(p_stale_after_seconds, 300), 3600)
  );
begin
  with published_operation_targets as (
    select target.id
    from public.scheduled_post_targets as target
    join public.social_publish_operations as operation
      on operation.scheduled_post_target_id = target.id
      and operation.user_id = target.user_id
    where operation.status = 'published'
      and operation.platform_post_id is not null
      and (
        target.status <> 'published'
        or target.platform_post_id is distinct from operation.platform_post_id
        or target.platform_post_url is distinct from operation.platform_post_url
      )
    order by operation.published_at, target.id
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  )
  update public.scheduled_post_targets as target
  set
    last_error_code = null,
    last_error_message = null,
    last_reconciled_at = v_now,
    next_retry_at = null,
    platform_post_id = operation.platform_post_id,
    platform_post_url = operation.platform_post_url,
    published_at = coalesce(operation.published_at, v_now),
    status = 'published',
    updated_at = v_now
  from public.social_publish_operations as operation
  where target.id in (
      select published_target.id
      from published_operation_targets as published_target
    )
    and operation.scheduled_post_target_id = target.id
    and operation.user_id = target.user_id;

  get diagnostics v_published_targets = row_count;
  v_reconciled := v_reconciled + v_published_targets;

  update public.scheduled_posts as post
  set
    last_error_code = null,
    published_at = case
      when not exists (
        select 1
        from public.scheduled_post_targets as target
        where target.scheduled_post_id = post.id
          and target.status <> 'published'
      ) then v_now
      else post.published_at
    end,
    status = case
      when not exists (
        select 1
        from public.scheduled_post_targets as target
        where target.scheduled_post_id = post.id
          and target.status <> 'published'
      ) then 'published'
      when post.status = 'cancelled' then 'partially_failed'
      else post.status
    end,
    updated_at = v_now
  where exists (
    select 1
    from public.scheduled_post_targets as target
    where target.scheduled_post_id = post.id
      and target.status = 'published'
      and target.last_reconciled_at = v_now
  );

  with stale_targets as (
    select target.id
    from public.scheduled_post_targets as target
    where target.status = 'scheduling'
      and target.publish_job_id is not null
      and exists (
        select 1
        from public.background_jobs as job
        where job.id = target.publish_job_id
          and job.status in ('queued', 'processing')
      )
      and target.updated_at <
        v_now - make_interval(secs => v_stale_after_seconds)
    order by target.updated_at, target.id
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  )
  update public.scheduled_post_targets as target
  set
    last_error_code = 'scheduler_fallback_active',
    last_error_message = null,
    last_reconciled_at = v_now,
    status = 'scheduled',
    updated_at = v_now
  where target.id in (select stale_target.id from stale_targets as stale_target);

  get diagnostics v_stale_targets = row_count;
  v_reconciled := v_reconciled + v_stale_targets;

  with failed_job_targets as (
    select target.id
    from public.scheduled_post_targets as target
    join public.background_jobs as job
      on job.id = target.publish_job_id
      and job.user_id = target.user_id
    where target.status in ('scheduling', 'scheduled', 'publishing')
      and job.status = 'failed'
      and not exists (
        select 1
        from public.social_publish_operations as operation
        where operation.scheduled_post_target_id = target.id
          and operation.status = 'published'
      )
    order by job.updated_at, target.id
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  )
  update public.scheduled_post_targets as target
  set
    last_error_code = case
      when target.last_error_code is null
        or target.last_error_code = 'scheduler_fallback_active'
        then 'social_publish_failed'
      else target.last_error_code
    end,
    last_error_message = left(job.error_message, 500),
    last_reconciled_at = v_now,
    next_retry_at = null,
    status = 'failed',
    updated_at = v_now
  from public.background_jobs as job
  where target.id in (
      select failed_target.id
      from failed_job_targets as failed_target
    )
    and job.id = target.publish_job_id;

  get diagnostics v_failed_targets = row_count;
  v_reconciled := v_reconciled + v_failed_targets;

  update public.scheduled_posts as post
  set
    last_error_code = case
      when post.last_error_code is null
        or post.last_error_code = 'scheduler_fallback_active'
        then 'social_publish_failed'
      else post.last_error_code
    end,
    status = case
      when exists (
        select 1
        from public.scheduled_post_targets as target
        where target.scheduled_post_id = post.id
          and target.status <> 'failed'
      ) then 'partially_failed'
      else 'failed'
    end,
    updated_at = v_now
  where post.status <> 'cancelled'
    and exists (
      select 1
      from public.scheduled_post_targets as target
      where target.scheduled_post_id = post.id
        and target.status = 'failed'
        and target.last_reconciled_at = v_now
    );

  with cancelled_parent_targets as (
    select target.id
    from public.scheduled_post_targets as target
    join public.scheduled_posts as post
      on post.id = target.scheduled_post_id
      and post.user_id = target.user_id
    where post.status = 'cancelled'
      and target.status in (
        'draft',
        'scheduling',
        'scheduled',
        'publishing',
        'failed'
      )
      and not exists (
        select 1
        from public.social_publish_operations as operation
        where operation.scheduled_post_target_id = target.id
          and (
            operation.active_claim_token is not null
            or operation.status = 'published'
          )
      )
    order by target.updated_at, target.id
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  )
  update public.scheduled_post_targets as target
  set
    cancelled_at = coalesce(target.cancelled_at, v_now),
    last_reconciled_at = v_now,
    next_retry_at = null,
    status = 'cancelled',
    updated_at = v_now
  where target.id in (
    select cancelled_target.id
    from cancelled_parent_targets as cancelled_target
  );

  get diagnostics v_cancelled_targets = row_count;
  v_reconciled := v_reconciled + v_cancelled_targets;

  update public.background_jobs as job
  set
    claim_token = null,
    completed_at = v_now,
    next_attempt_at = null,
    status = 'cancelled',
    updated_at = v_now
  where job.status in ('queued', 'processing')
    and exists (
      select 1
      from public.scheduled_post_targets as target
      where target.publish_job_id = job.id
        and target.status = 'cancelled'
    );

  update public.scheduled_posts as post
  set
    last_error_code = case
      when exists (
        select 1
        from public.scheduled_post_targets as target
        where target.scheduled_post_id = post.id
          and target.last_error_code = 'scheduler_fallback_active'
      ) then 'scheduler_fallback_active'
      else null
    end,
    status = 'scheduled',
    updated_at = v_now
  where post.status = 'scheduling'
    and exists (
      select 1
      from public.scheduled_post_targets as target
      where target.scheduled_post_id = post.id
        and target.status = 'scheduled'
    )
    and not exists (
      select 1
      from public.scheduled_post_targets as target
      where target.scheduled_post_id = post.id
        and target.status <> 'scheduled'
    );

  return v_reconciled;
end;
$$;

revoke all on function public.reconcile_social_schedule_state(integer, integer)
  from public;
revoke all on function public.reconcile_social_schedule_state(integer, integer)
  from anon;
revoke all on function public.reconcile_social_schedule_state(integer, integer)
  from authenticated;
grant execute on function public.reconcile_social_schedule_state(integer, integer)
  to service_role;
