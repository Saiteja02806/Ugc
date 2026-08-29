-- A failed daily slot is not a reason to keep the interface loading forever.
-- This explicit recovery path preserves a user's daily positions and creates a
-- fresh Wall job only when they choose to retry a terminal failure.
alter table public.daily_trending_feeds
  add column if not exists wall_text_retry_key uuid;

create or replace function public.restart_failed_daily_trending_feed_slots(
  p_feed_id uuid,
  p_user_id text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  feed_record public.daily_trending_feeds;
  restarted_count integer := 0;
  retry_key uuid;
begin
  select *
  into feed_record
  from public.daily_trending_feeds as feed
  where feed.id = p_feed_id
    and feed.user_id = p_user_id
  for update;

  if feed_record.id is null then
    raise exception 'daily_trending_feed_not_found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(feed_record.user_id || ':' || feed_record.local_date::text, 0)
  );

  update public.daily_trending_feed_slots as slot
  set state = 'planned', updated_at = now()
  where slot.feed_id = p_feed_id
    and slot.state = 'failed'
    and slot.carousel_assignment_id is null
    and slot.hook_video_assignment_id is null
    and slot.wall_text_assignment_id is null;

  get diagnostics restarted_count = row_count;

  if restarted_count = 0 then
    return null;
  end if;

  retry_key := gen_random_uuid();

  update public.daily_trending_feeds
  set
    status = 'preparing',
    last_error = null,
    wall_text_retry_key = retry_key,
    updated_at = now()
  where id = p_feed_id;

  return retry_key;
end;
$$;

-- Repair the exact historical failure caused by the old Wall text-content
-- constraint. No content is deleted or generated in this migration. It only
-- converts impossible retries into a visible terminal state, so users can
-- choose the normal retry action after the compatible schema is deployed.
with affected_chunks as (
  update public.wall_text_generation_chunks as chunk
  set
    content_retry_count = greatest(chunk.content_retry_count, 1),
    last_error_code = 'wall_text_persistence_rejected',
    last_error_message = 'Wall-of-text could not be saved because the database rejected the newer text structure.',
    claim_token = null,
    locked_at = null,
    status = 'failed',
    updated_at = now()
  where chunk.status = 'retry_pending'
    and lower(coalesce(chunk.last_error_message, '')) like '%wall_text_creatives_text_content_chk%'
  returning chunk.id, chunk.batch_id
), affected_assignments as (
  update public.wall_text_generation_assignments as assignment
  set
    last_failure_code = 'wall_text_persistence_rejected',
    status = 'failed',
    updated_at = now()
  where assignment.chunk_id in (select id from affected_chunks)
    and assignment.status <> 'completed'
  returning assignment.batch_id, assignment.wall_text_content_plan_item_id
), retired_plan_items as (
  update public.wall_text_content_plan_items as item
  set
    status = 'retired',
    retired_at = now(),
    retirement_reason = 'wall_text_persistence_rejected',
    updated_at = now()
  where item.id in (
    select assignment.wall_text_content_plan_item_id
    from affected_assignments as assignment
    where assignment.wall_text_content_plan_item_id is not null
  )
    and item.status = 'reserved'
), affected_batches as (
  update public.wall_text_generation_batches as batch
  set status = 'failed', updated_at = now()
  where batch.id in (select batch_id from affected_chunks)
    and batch.status <> 'completed'
  returning
    batch.business_profile_id,
    batch.business_profile_version,
    batch.created_at,
    batch.request_key,
    batch.user_id
), affected_jobs as (
  update public.background_jobs as job
  set
    error_code = 'wall_text_persistence_rejected',
    error_message = 'Wall-of-text could not be saved because the database rejected the newer text structure.',
    failed_at = coalesce(job.failed_at, now()),
    stage = 'failed',
    status = 'failed',
    updated_at = now()
  from affected_batches as batch
  where job.user_id = batch.user_id
    and job.job_type = 'wall_text_generation'
    and job.input_json ->> 'requestKey' = batch.request_key
    and job.status not in ('completed', 'cancelled')
), affected_slots as (
  update public.daily_trending_feed_slots as slot
  set state = 'failed', updated_at = now()
  from public.daily_trending_feeds as feed
  where slot.feed_id = feed.id
    and slot.format = 'wall_text'
    and slot.state in ('planned', 'preparing')
    and slot.wall_text_assignment_id is null
    and exists (
      select 1
      from affected_batches as batch
      where batch.user_id = feed.user_id
        and batch.business_profile_id = feed.business_profile_id
        and batch.business_profile_version = feed.business_profile_version
        and feed.local_date = timezone(feed.timezone, batch.created_at)::date
    )
  returning slot.feed_id
)
update public.daily_trending_feeds as feed
set
  status = case
    when not exists (
      select 1
      from public.daily_trending_feed_slots as slot
      where slot.feed_id = feed.id
        and slot.state <> 'decided'
    ) then 'completed'
    when exists (
      select 1
      from public.daily_trending_feed_slots as slot
      where slot.feed_id = feed.id
        and slot.state = 'ready'
    ) then 'ready'
    when exists (
      select 1
      from public.daily_trending_feed_slots as slot
      where slot.feed_id = feed.id
        and slot.state in ('planned', 'preparing')
    ) then 'preparing'
    else 'failed'
  end,
  last_error = 'Some Wall-of-text ideas could not be saved. Retry to generate them again.',
  updated_at = now()
where feed.id in (select distinct feed_id from affected_slots);

revoke all on function public.restart_failed_daily_trending_feed_slots(uuid, text)
  from public, anon, authenticated;

grant execute on function public.restart_failed_daily_trending_feed_slots(uuid, text)
  to service_role;

select pg_notify('pgrst', 'reload schema');
