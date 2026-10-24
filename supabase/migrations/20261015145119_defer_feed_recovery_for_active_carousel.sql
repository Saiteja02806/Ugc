create or replace function public.finish_daily_trending_feed_repair (
  p_feed_id uuid,
  p_pending_slot_count integer,
  p_error_message text default null,
  p_stale_after_seconds integer default 900,
  p_max_attempts integer default 3
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  feed_record public.daily_trending_feeds;
  stale_count integer := 0;
  pending_count integer := 0;
  bounded_error text := nullif(left(btrim(coalesce(p_error_message, '')), 1000), '');
begin
  select * into feed_record
  from public.daily_trending_feeds
  where id = p_feed_id
  for update;

  if feed_record.id is null then
    return 'missing';
  end if;

  select count(*)::integer into pending_count
  from public.daily_trending_feed_slots as slot
  where slot.feed_id = p_feed_id
    and slot.state in ('planned', 'preparing', 'failed')
    and slot.carousel_assignment_id is null
    and slot.hook_video_assignment_id is null
    and slot.wall_text_assignment_id is null;

  if pending_count = 0 then
    update public.daily_trending_feeds
    set recovery_attempt_count = 0,
        last_recovery_at = null,
        last_recovery_error = null,
        updated_at = now()
    where id = p_feed_id;
    return 'complete';
  end if;

  -- A queued or running source is not a failed feed repair. Limit this
  -- guard to packs whose remaining unbound positions are all Carousels.
  if not exists (
    select 1 from public.daily_trending_feed_slots slot
    where slot.feed_id = p_feed_id and slot.format <> 'carousel'
      and slot.state in ('planned', 'preparing', 'failed')
      and slot.carousel_assignment_id is null and slot.hook_video_assignment_id is null
      and slot.wall_text_assignment_id is null and slot.reaction_assignment_id is null
  ) and exists (
    select 1 from public.daily_carousel_feeds legacy
    join public.daily_carousel_refill_batches batch on batch.feed_id = legacy.id
      and batch.superseded_at is null
      and batch.user_id = feed_record.user_id
      and batch.business_profile_id = feed_record.business_profile_id
      and batch.business_profile_version = feed_record.business_profile_version
    join public.carousel_generations generation on generation.generation_batch_id = batch.generation_batch_id
      and generation.user_id = feed_record.user_id
      and generation.business_profile_id = feed_record.business_profile_id
      and generation.business_profile_version = feed_record.business_profile_version
    join public.background_jobs job on job.id::text = generation.trigger_run_id
      and job.user_id = feed_record.user_id and job.job_type = 'generate_carousel'
      and job.status in ('queued', 'processing', 'rendering', 'waiting_external_service', 'uploading_output')
    where legacy.user_id = feed_record.user_id and legacy.local_date = feed_record.local_date
  ) then
    update public.daily_trending_feed_slots slot set state = 'planned', updated_at = now()
    where slot.feed_id = p_feed_id and slot.format = 'carousel' and slot.state = 'failed'
      and slot.carousel_assignment_id is null and slot.hook_video_assignment_id is null
      and slot.wall_text_assignment_id is null and slot.reaction_assignment_id is null;
    update public.daily_trending_feeds
    set recovery_attempt_count = greatest(recovery_attempt_count - 1, 0),
        last_recovery_error = 'Waiting for active Carousel source work.', last_error = null,
        status = case when exists (select 1 from public.daily_trending_feed_slots slot
          where slot.feed_id = p_feed_id and slot.state = 'ready') then 'ready' else 'preparing' end,
        updated_at = now()
    where id = p_feed_id;
    return 'waiting_source_job';
  end if;

  if feed_record.recovery_attempt_count >= greatest(coalesce(p_max_attempts, 3), 1) then
    update public.daily_trending_feed_slots as slot
    set state = 'failed', updated_at = now()
    where slot.feed_id = p_feed_id
      and slot.state in ('planned', 'preparing', 'failed')
      and slot.carousel_assignment_id is null
      and slot.hook_video_assignment_id is null
      and slot.wall_text_assignment_id is null
      and slot.updated_at < now() - make_interval(
        secs => greatest(60, least(coalesce(p_stale_after_seconds, 900), 43200))
      );

    get diagnostics stale_count = row_count;
  end if;

  select count(*)::integer into pending_count
  from public.daily_trending_feed_slots as slot
  where slot.feed_id = p_feed_id
    and slot.state in ('planned', 'preparing', 'failed')
    and slot.carousel_assignment_id is null
    and slot.hook_video_assignment_id is null
    and slot.wall_text_assignment_id is null;

  update public.daily_trending_feeds
  set status = case
        when not exists (
          select 1 from public.daily_trending_feed_slots as slot
          where slot.feed_id = p_feed_id and slot.state <> 'decided'
        ) then 'completed'
        when pending_count > 0 and exists (
          select 1 from public.daily_trending_feed_slots as slot
          where slot.feed_id = p_feed_id and slot.state = 'ready'
        ) then 'ready'
        when pending_count > 0 then 'preparing'
        else 'failed'
      end,
      last_recovery_error = case
        when pending_count = 0 then null
        else coalesce(bounded_error, 'Daily Trending preparation is still pending.')
      end,
      last_error = case
        when pending_count = 0 then null
        when stale_count > 0 then coalesce(bounded_error, 'Daily Trending preparation stopped before all reserved positions were generated.')
        else last_error
      end,
      updated_at = now()
  where id = p_feed_id;

  return case when pending_count = 0 then 'failed' else 'retry' end;
end;
$function$;
revoke all on function public.finish_daily_trending_feed_repair(uuid, integer, text, integer, integer) from public, anon, authenticated;
grant execute on function public.finish_daily_trending_feed_repair(uuid, integer, text, integer, integer) to postgres, service_role;
