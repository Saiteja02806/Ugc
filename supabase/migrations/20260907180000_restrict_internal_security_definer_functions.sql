-- These functions are internal job and trigger plumbing. They run with the
-- database owner's privileges, so exposing them through PostgREST would let
-- anonymous callers bypass the application authorization layer.
do $security$
declare
  function_signature text;
  target_function regprocedure;
begin
  foreach function_signature in array array[
    'public.create_or_get_background_job_v1(text,jsonb,text,text,integer,text,text,text)',
    'public.enqueue_completed_trending_feed_reconciliation()',
    'public.finish_daily_trending_feed_repair(uuid,integer,text,integer,integer)',
    'public.list_due_daily_trending_feed_repairs(integer,integer,integer)',
    'public.release_social_publish_account_lane_on_operation_change()',
    'public.release_video_render_slot_on_background_job_state_change()',
    'public.reset_daily_trending_feed_recovery_on_slot_change()',
    'public.terminalize_wall_text_generation_for_job(uuid)',
    'public.terminalize_wall_text_generation_on_job_status()'
  ] loop
    target_function := to_regprocedure(function_signature);

    if target_function is null then
      raise exception 'Expected internal function % is missing.', function_signature;
    end if;

    execute format(
      'revoke all on function %s from public, anon, authenticated',
      target_function
    );
    execute format(
      'grant execute on function %s to postgres, service_role',
      target_function
    );
  end loop;
end;
$security$;
