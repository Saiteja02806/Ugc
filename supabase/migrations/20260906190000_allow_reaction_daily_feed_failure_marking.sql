-- Reaction slots use the same terminal-format failure path as Carousel, Hook,
-- and Wall-of-Text slots. Only an unbound pending slot may be failed: a bound
-- Reaction assignment is already user-visible content and must remain intact.
create or replace function public.mark_daily_trending_feed_formats_failed (
  p_feed_id uuid,
  p_formats text[],
  p_message text default null
)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  feed_record public.daily_trending_feeds;
  bounded_message text := nullif(left(btrim(coalesce(p_message, '')), 1000), '');
begin
  if coalesce(array_length(p_formats, 1), 0) = 0 then return; end if;
  if exists (select 1 from unnest(p_formats) as requested_format
             where requested_format not in ('carousel', 'hook_video', 'wall_text', 'reaction')) then
    raise exception 'invalid_daily_trending_format';
  end if;

  select * into feed_record from public.daily_trending_feeds where id = p_feed_id;
  if feed_record.id is null then raise exception 'daily_trending_feed_not_found'; end if;

  perform pg_advisory_xact_lock(hashtextextended(feed_record.user_id || ':' || feed_record.local_date::text, 0));

  update public.daily_trending_feed_slots
  set state = 'failed', updated_at = now()
  where feed_id = p_feed_id
    and format = any(p_formats)
    and state in ('planned', 'preparing')
    and carousel_assignment_id is null
    and hook_video_assignment_id is null
    and wall_text_assignment_id is null
    and reaction_assignment_id is null;

  update public.daily_trending_feeds
  set status = case
      when not exists (select 1 from public.daily_trending_feed_slots as slot
                       where slot.feed_id = p_feed_id and slot.state <> 'decided') then 'completed'
      when exists (select 1 from public.daily_trending_feed_slots as slot
                   where slot.feed_id = p_feed_id and slot.state = 'ready') then 'ready'
      else 'failed'
    end,
    last_error = coalesce(bounded_message, last_error),
    last_recovery_error = coalesce(bounded_message, last_recovery_error),
    updated_at = now()
  where id = p_feed_id;
end;
$function$;

grant execute on function public.mark_daily_trending_feed_formats_failed(uuid, text[], text)
  to postgres, service_role;
revoke all on function public.mark_daily_trending_feed_formats_failed(uuid, text[], text)
  from public;
