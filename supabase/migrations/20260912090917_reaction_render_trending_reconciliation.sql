-- Reaction renders complete in a dedicated Cloud Run service.  Each terminal
-- child render must therefore enter the same durable feed-reconciliation
-- outbox as the other Trending formats; otherwise a preview-ready Reel can
-- remain stranded behind a failed daily-feed slot.

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
          'wall_text_generation',
          'reaction_generation',
          'reaction_render'
        )
      )
      or (
        new.status in ('failed', 'cancelled')
        and (
          (
            new.job_type = 'generate_trending_hook_copy'
            and new.input_json ? 'generationRunId'
          )
          or new.job_type in (
            'carousel_content_plan_generation',
            'generate_carousel',
            'wall_text_content_plan_generation',
            'wall_text_generation',
            'reaction_generation',
            'reaction_render'
          )
        )
      )
    )
  )
  execute function public.enqueue_completed_trending_feed_reconciliation();
