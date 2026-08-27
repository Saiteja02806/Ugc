-- A payment webhook must not wait for Trending preparation. This trigger runs
-- in the same transaction as the activated subscription and creates at most
-- one durable prebuild job for the subscription period and plan. Cloud Tasks
-- delivery deliberately happens after this transaction has committed.

alter table public.background_jobs
  drop constraint if exists background_jobs_job_type_check;

alter table public.background_jobs
  add constraint background_jobs_job_type_check
  check (
    job_type in (
      'hook_text_generation',
      'wall_text_generation',
      'wall_text_content_plan_generation',
      'carousel_generation',
      'carousel_content_plan_generation',
      'paid_trending_prebuild',
      'image_generation',
      'video_generation',
      'preview_render',
      'final_render',
      'media_analysis',
      'social_publish',
      'analytics_sync',
      'generate_avatar',
      'generate_carousel',
      'generate_hook_video',
      'generate_image',
      'generate_thumbnail',
      'generate_trending_hook_copy',
      'extract_video_metadata',
      'publish_social_post',
      'render_demo_video',
      'render_edit_video',
      'render_schedule_combination',
      'render_trending_carousel_edit',
      'render_wall_text_video',
      'test_worker_job'
    )
  );

create or replace function public.enqueue_paid_trending_prebuild()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_idempotency_key text;
  v_period_key text;
begin
  if new.status <> 'active'
     or new.plan_key not in ('starter', 'growth') then
    return new;
  end if;

  -- A subscription can be delivered more than once by Dodo. A period start
  -- makes renewals eligible while keeping all duplicate deliveries in the same
  -- billing period bound to this one durable job. Older payloads without a
  -- period start fall back to one job for that subscription and plan.
  v_period_key := coalesce(
    to_char(
      new.current_period_start at time zone 'UTC',
      'YYYYMMDD"T"HH24MISS"Z"'
    ),
    'subscription'
  );
  v_idempotency_key := concat_ws(
    ':',
    'paid-trending-prebuild',
    'v1',
    new.dodo_subscription_id,
    new.plan_key,
    v_period_key
  );

  insert into public.background_jobs (
    user_id,
    job_type,
    queue_name,
    queue_provider,
    status,
    stage,
    queued_at,
    max_attempts,
    idempotency_key,
    input_reference,
    input_json,
    updated_at
  )
  values (
    new.user_id,
    'paid_trending_prebuild',
    'ai-generation',
    'gcp',
    'queued',
    'queued',
    now(),
    5,
    v_idempotency_key,
    'billing-subscription:' || new.dodo_subscription_id,
    jsonb_build_object(
      'expectedPlanKey', new.plan_key,
      'subscriptionId', new.dodo_subscription_id,
      'periodStart', new.current_period_start
    ),
    now()
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists billing_subscriptions_enqueue_paid_trending_prebuild
  on public.billing_subscriptions;

create trigger billing_subscriptions_enqueue_paid_trending_prebuild
after insert or update of status, plan_key, current_period_start, user_id
on public.billing_subscriptions
for each row
execute function public.enqueue_paid_trending_prebuild();

revoke all on function public.enqueue_paid_trending_prebuild() from public,
  anon, authenticated;

select pg_notify('pgrst', 'reload schema');
