-- A terminal daily Carousel writer failure must wake the same durable Trending
-- reconciliation used after successful generation. Reconciliation preserves
-- completed Carousels and extends the daily refill only for the true shortfall;
-- it never replays a partially completed five-Carousel writer batch.
create or replace function public.enqueue_completed_trending_feed_reconciliation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  should_reconcile boolean := true;
begin
  -- Preserve the durable Hook-run cleanup introduced with chunked Hook
  -- generation. Its candidates must be released before reconciliation wakes
  -- the next chunk.
  if new.status in ('failed', 'cancelled')
    and new.job_type = 'generate_trending_hook_copy'
    and new.input_json ? 'generationRunId'
  then
    perform public.fail_trending_hook_generation_chunk_v1(
      new.id,
      coalesce(new.error_message, 'The Hook generation worker failed.')
    );
  end if;

  -- Only a Carousel job that owns daily-feed inventory should prepare a daily
  -- replacement. Manual and non-daily Carousel failures remain isolated.
  if new.status in ('failed', 'cancelled')
    and new.job_type = 'generate_carousel'
  then
    select exists (
      select 1
      from public.carousel_generations as generation
      where generation.trigger_run_id = new.id::text
        and generation.origin_daily_feed_id is not null
    )
    into should_reconcile;
  end if;

  if not should_reconcile then
    return new;
  end if;

  insert into public.trending_feed_reconciliation_outbox (
    source_job_id,
    user_id,
    status,
    next_attempt_at
  ) values (
    new.id,
    new.user_id,
    'pending',
    now()
  )
  on conflict (source_job_id) do nothing;

  return new;
end;
$$;

drop trigger if exists enqueue_completed_trending_feed_reconciliation
  on public.background_jobs;

create trigger enqueue_completed_trending_feed_reconciliation
after update of status on public.background_jobs
for each row
when (
  old.status is distinct from new.status
  and new.user_id is not null
  and (
    (
      new.status = 'completed'
      and new.job_type in (
        'carousel_content_plan_generation',
        'generate_carousel',
        'generate_trending_hook_copy',
        'wall_text_content_plan_generation',
        'wall_text_generation'
      )
    )
    or (
      new.status in ('failed', 'cancelled')
      and new.job_type = 'generate_trending_hook_copy'
      and new.input_json ? 'generationRunId'
    )
    or (
      new.status in ('failed', 'cancelled')
      and new.job_type = 'generate_carousel'
    )
  )
)
execute function public.enqueue_completed_trending_feed_reconciliation();

select pg_notify('pgrst', 'reload schema');
