-- Aggregate only genuinely attributed, published Hook outcomes. This function
-- returns data for an internal selector; it never exposes a "risk" score or
-- raw performance number in the customer interface or generation prompt.
create or replace function public.get_hook_performance_pattern_aggregates(
  p_user_id text,
  p_business_profile_id uuid
)
returns table(
  pattern_id text,
  campaign_purpose text,
  observed_post_count bigint,
  view_count bigint,
  share_count bigint,
  save_count bigint,
  average_watch_time_seconds numeric,
  completion_rate numeric,
  conversion_count bigint,
  attributed_sales_amount numeric,
  attributed_sales_currency text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0 or
     p_business_profile_id is null or
     not exists (
       select 1
       from public.business_profiles as profile
       where profile.id = p_business_profile_id
         and profile.user_id = p_user_id
     )
  then
    return;
  end if;

  return query
    select
      suggestion.pattern_id,
      suggestion.campaign_purpose,
      count(observation.id)::bigint as observed_post_count,
      sum(observation.view_count)::bigint as view_count,
      sum(observation.share_count)::bigint as share_count,
      sum(observation.save_count)::bigint as save_count,
      avg(observation.average_watch_time_seconds) as average_watch_time_seconds,
      avg(observation.completion_rate) as completion_rate,
      sum(observation.conversion_count)::bigint as conversion_count,
      sum(observation.attributed_sales_amount) as attributed_sales_amount,
      case
        when count(distinct observation.attributed_sales_currency) filter (
          where observation.attributed_sales_amount is not null
            and observation.attributed_sales_currency is not null
        ) = 1
        and count(*) filter (
          where observation.attributed_sales_amount is not null
            and observation.attributed_sales_currency is null
        ) = 0
          then min(observation.attributed_sales_currency) filter (
            where observation.attributed_sales_amount is not null
          )
        else null
      end as attributed_sales_currency
    from public.hook_performance_observations as observation
    join public.hook_video_suggestions as suggestion
      on suggestion.id = observation.hook_video_suggestion_id
      and suggestion.user_id = p_user_id
    where observation.user_id = p_user_id
      and suggestion.business_profile_id = p_business_profile_id
      and suggestion.suggestion_context in ('trending', 'composition')
      and suggestion.pattern_id is not null
    group by suggestion.pattern_id, suggestion.campaign_purpose;
end
$$;

revoke all on function public.get_hook_performance_pattern_aggregates(text, uuid)
  from public, anon, authenticated;

grant execute on function public.get_hook_performance_pattern_aggregates(text, uuid)
  to service_role;

select pg_notify('pgrst', 'reload schema');
