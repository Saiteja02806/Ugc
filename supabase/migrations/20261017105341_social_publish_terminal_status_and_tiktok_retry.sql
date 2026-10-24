-- A terminal worker failure must settle its current target in the same commit,
-- including failures caused by queue recovery rather than the publish handler.
-- This is an invoker trigger: it grants no additional table access.
create or replace function public.settle_failed_social_publish_job()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_target record;
  v_now timestamptz := pg_catalog.now();
begin
  if new.job_type <> 'publish_social_post' or new.status <> 'failed' then
    return new;
  end if;

  for v_target in
    select target.id, target.scheduled_post_id
    from public.scheduled_post_targets target
    join public.scheduled_posts post
      on post.id = target.scheduled_post_id and post.user_id = target.user_id
    where target.publish_job_id = new.id
      and target.user_id = new.user_id
      and new.input_json ->> 'targetId' = target.id::text
      and target.status in ('scheduling', 'scheduled', 'publishing')
      and target.platform_post_id is null and target.published_at is null
      and post.status <> 'cancelled'
      and not exists (
        select 1 from public.social_publish_operations operation
        where operation.scheduled_post_target_id = target.id
          and operation.user_id = target.user_id
          and (operation.status = 'published' or operation.platform_post_id is not null
            or operation.published_at is not null)
      )
    order by post.id, target.id
    for update of post, target
  loop
    update public.scheduled_post_targets target
    set status = 'failed', next_retry_at = null,
      last_error_code = coalesce(nullif(new.error_code, ''), target.last_error_code, 'social_publish_failed'),
      last_error_message = case
        when new.error_code = 'tiktok_file_format_check_failed'
          or target.last_error_code = 'tiktok_file_format_check_failed'
        then 'TikTok rejected this post''s media format. Its images need publishing preparation before you retry.'
        else coalesce(nullif(target.last_error_message, ''), left(new.error_message, 500), 'Publishing did not complete for this account.')
      end,
      last_reconciled_at = v_now, updated_at = v_now
    where target.id = v_target.id;

    update public.scheduled_posts post
    set status = case
        when exists (
          select 1 from public.scheduled_post_targets sibling
          where sibling.scheduled_post_id = post.id and sibling.user_id = post.user_id
            and sibling.status in ('published', 'publishing', 'draft', 'scheduling', 'scheduled')
        ) then 'partially_failed' else 'failed' end,
      last_error_code = coalesce(nullif(new.error_code, ''), 'social_publish_failed'),
      published_at = null, updated_at = v_now
    where post.id = v_target.scheduled_post_id and post.user_id = new.user_id
      and post.status <> 'cancelled';
  end loop;
  return new;
end;
$function$;

revoke all on function public.settle_failed_social_publish_job() from public, anon, authenticated;
grant execute on function public.settle_failed_social_publish_job() to service_role;

create trigger settle_failed_social_publish_job
after update of status on public.background_jobs
for each row when (new.status = 'failed')
execute function public.settle_failed_social_publish_job();

-- Repair stale status projections only. Do not create jobs, alter chosen times,
-- touch accepted publications, or retry any historical post.
update public.background_jobs job set status = job.status
where job.job_type = 'publish_social_post' and job.status = 'failed'
  and exists (
    select 1 from public.scheduled_post_targets target
    where target.publish_job_id = job.id and target.user_id = job.user_id
      and job.input_json ->> 'targetId' = target.id::text
      and target.status in ('scheduling', 'scheduled', 'publishing')
  );

-- Only an explicit owner retry with a NEW queued job can clear a rejected
-- TikTok format operation. Polling a permanently failed publish_id cannot recover.
create or replace function public.reset_tiktok_format_failure_on_manual_retry()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  if old.status <> 'failed' or old.last_error_code is distinct from 'tiktok_file_format_check_failed'
    or new.platform <> 'tiktok' or new.status <> 'scheduled'
    or new.publish_job_id is not distinct from old.publish_job_id or new.publish_job_id is null
  then return new; end if;

  if not exists (
    select 1 from public.background_jobs job
    where job.id = new.publish_job_id and job.user_id = new.user_id
      and job.job_type = 'publish_social_post' and job.status = 'queued'
      and job.input_json ->> 'targetId' = new.id::text
  ) then return new; end if;

  update public.social_publish_operations operation
  set provider_operation_id = null, provider_operation_kind = null,
    last_error_code = null, last_error_message = null, status = 'pending',
    metadata = coalesce(operation.metadata, '{}'::jsonb) - 'tiktokUploadUrl' - 'tiktokInitializationLogId',
    updated_at = pg_catalog.now()
  where operation.scheduled_post_target_id = new.id and operation.user_id = new.user_id
    and operation.platform = 'tiktok' and operation.provider_operation_kind = 'tiktok_publish'
    and operation.status <> 'published' and operation.platform_post_id is null
    and operation.published_at is null and operation.active_job_id is null
    and operation.active_claim_token is null
    and operation.last_error_code = 'tiktok_file_format_check_failed';
  return new;
end;
$function$;

revoke all on function public.reset_tiktok_format_failure_on_manual_retry() from public, anon, authenticated;
grant execute on function public.reset_tiktok_format_failure_on_manual_retry() to service_role;

create trigger reset_tiktok_format_failure_on_manual_retry
before update of status, publish_job_id on public.scheduled_post_targets
for each row execute function public.reset_tiktok_format_failure_on_manual_retry();
