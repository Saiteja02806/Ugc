-- A recovered feed can be fully resolved while retaining the transient error
-- written when one of its source jobs was still pending. That stale field can
-- make a ready account appear to still be generating. Clear it only when all
-- slots have a final ready/decided state; failed and in-flight slots retain
-- their diagnostics.
create or replace function public.reset_daily_trending_feed_recovery_on_slot_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    update public.daily_trending_feeds
    set recovery_attempt_count = 0,
        last_recovery_at = null,
        last_recovery_error = null,
        updated_at = now()
    where id = new.feed_id;
  elsif tg_op = 'UPDATE' and old.state = 'failed' and new.state = 'planned' then
    update public.daily_trending_feeds
    set recovery_attempt_count = 0,
        last_recovery_at = null,
        last_recovery_error = null,
        updated_at = now()
    where id = new.feed_id;
  elsif tg_op = 'UPDATE' and old.state is distinct from new.state then
    update public.daily_trending_feeds as feed
    set recovery_attempt_count = 0,
        last_recovery_at = null,
        last_recovery_error = null,
        updated_at = now()
    where feed.id = new.feed_id
      and not exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = new.feed_id
          and slot.state in ('planned', 'preparing', 'failed')
      );
  end if;
  return new;
end;
$function$;

grant execute on function public.reset_daily_trending_feed_recovery_on_slot_change()
  to postgres, service_role;
revoke all on function public.reset_daily_trending_feed_recovery_on_slot_change()
  from public;

-- Reconcile historical feeds already fully resolved under the old trigger.
update public.daily_trending_feeds as feed
set
  recovery_attempt_count = 0,
  last_recovery_at = null,
  last_recovery_error = null,
  updated_at = now()
where feed.status in ('ready', 'completed')
  and feed.last_recovery_error is not null
  and not exists (
    select 1
    from public.daily_trending_feed_slots as slot
    where slot.feed_id = feed.id
      and slot.state in ('planned', 'preparing', 'failed')
  );
