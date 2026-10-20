-- Production-safe database regression: every row/event change rolls back.
-- No queues, workers, provider calls, or public posts are created.
begin;
do $test$
declare
  v_target public.scheduled_post_targets;
  v_job_id uuid := gen_random_uuid();
  v_generic_id uuid := gen_random_uuid();
  v_count integer;
begin
  select * into strict v_target from public.scheduled_post_targets
    where status = 'published' and publish_job_id is not null
    order by created_at desc limit 1;
  insert into public.background_jobs(id, user_id, job_type, queue_name, status,
    input_json, queued_at, created_at, updated_at)
  values (v_job_id, v_target.user_id, 'publish_social_post', 'social-publish',
    'queued', jsonb_build_object('targetId', v_target.id),
    now() - interval '2 hours', now() - interval '2 hours', now() - interval '2 hours');
  update public.scheduled_post_targets set status = 'scheduled',
    scheduled_for = now() + interval '24 hours', publish_job_id = v_job_id
    where id = v_target.id;

  select count(*) into v_count from public.list_recoverable_background_jobs(500, 60) where id=v_job_id;
  if v_count <> 0 then raise exception 'Future publish appeared in recovery list'; end if;
  select count(*) into v_count from public.recover_background_job(v_job_id);
  if v_count <> 0 then raise exception 'Future publish was recovered'; end if;
  select count(*) into v_count from public.claim_background_job(v_job_id, 'schedule-regression', gen_random_uuid(), 60);
  if v_count <> 0 then raise exception 'Future publish was claimed'; end if;
  if (select attempt_count from public.background_jobs where id=v_job_id) <> 0 then
    raise exception 'Future wait consumed an attempt';
  end if;

  -- At the exact scheduled instant, all boundaries allow execution.
  update public.scheduled_post_targets set scheduled_for = now() where id=v_target.id;
  select count(*) into v_count from public.list_recoverable_background_jobs(500, 60) where id=v_job_id;
  if v_count <> 1 then raise exception 'Due publish missing from recovery list'; end if;
  select count(*) into v_count from public.recover_background_job(v_job_id);
  if v_count <> 1 then raise exception 'Due publish could not recover'; end if;

  -- Recovery must honor a provider retry wait too.
  update public.background_jobs set next_attempt_at = now() + interval '1 hour',
    queued_at = now() - interval '2 hours', updated_at = now() - interval '2 hours'
    where id=v_job_id;
  select count(*) into v_count from public.list_recoverable_background_jobs(500, 60) where id=v_job_id;
  if v_count <> 0 then raise exception 'Retry wait appeared in recovery list'; end if;
  select count(*) into v_count from public.recover_background_job(v_job_id);
  if v_count <> 0 then raise exception 'Recovery cleared a retry wait'; end if;
  update public.background_jobs set next_attempt_at = null where id=v_job_id;
  select count(*) into v_count from public.claim_background_job(v_job_id, 'schedule-regression', gen_random_uuid(), 60);
  if v_count <> 1 then raise exception 'Due publish could not be claimed'; end if;

  -- Owner mismatch and superseded jobs cannot pass the scheduling boundary.
  update public.background_jobs set status='queued' where id=v_job_id;
  update public.scheduled_post_targets set publish_job_id=null where id=v_target.id;
  select count(*) into v_count from public.claim_background_job(v_job_id, 'schedule-regression', gen_random_uuid(), 60);
  if v_count <> 0 then raise exception 'Orphaned publish was claimed'; end if;
  update public.scheduled_post_targets set publish_job_id=v_job_id where id=v_target.id;
  update public.background_jobs set user_id='schedule-regression-owner-mismatch' where id=v_job_id;
  select count(*) into v_count from public.claim_background_job(v_job_id, 'schedule-regression', gen_random_uuid(), 60);
  if v_count <> 0 then raise exception 'Owner mismatch was claimed'; end if;

  -- A generic generation/test job keeps its existing recovery and claim behavior.
  insert into public.background_jobs(id, job_type, queue_name, status, input_json,
    queued_at, created_at, updated_at)
  values (v_generic_id, 'test_worker_job', 'ai-generation', 'queued', '{}',
    now() - interval '2 hours', now() - interval '2 hours', now() - interval '2 hours');
  select count(*) into v_count from public.recover_background_job(v_generic_id);
  if v_count <> 1 then raise exception 'Generic recovery regressed'; end if;
  select count(*) into v_count from public.claim_background_job(v_generic_id, 'schedule-regression', gen_random_uuid(), 60);
  if v_count <> 1 then raise exception 'Generic claim regressed'; end if;
end;
$test$;
rollback;
