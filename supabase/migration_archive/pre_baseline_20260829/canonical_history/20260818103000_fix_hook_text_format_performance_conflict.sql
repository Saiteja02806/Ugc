-- Resolve the PL/pgSQL output-variable ambiguity in the Global Hook
-- performance upsert by targeting the table's primary-key constraint.

create or replace function public.get_hook_text_format_performance_profiles(
  p_user_id text,
  p_business_profile_id uuid
)
returns table(
  hook_text_format_id text,
  campaign_purpose text,
  times_generated bigint,
  last_generated_at timestamptz,
  published_result_count bigint,
  recent_view_counts bigint[],
  median_views numeric,
  selection_weight numeric,
  temporary_boost numeric
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_business_profile_id is null
    or not exists (
      select 1
      from public.business_profiles as profile
      where profile.id = p_business_profile_id
        and profile.user_id = p_user_id
    )
  then
    return;
  end if;

  with generation_stats as (
    select
      suggestion.hook_text_format_id,
      count(*)::bigint as times_generated,
      max(suggestion.created_at) as last_generated_at,
      (array_agg(
        suggestion.campaign_purpose
        order by suggestion.created_at desc
      ) filter (where suggestion.campaign_purpose is not null))[1]
        as campaign_purpose
    from public.hook_video_suggestions as suggestion
    where suggestion.user_id = p_user_id
      and suggestion.business_profile_id = p_business_profile_id
      and suggestion.hook_text_format_id is not null
      and suggestion.suggestion_context in ('trending', 'composition')
    group by suggestion.hook_text_format_id
  ), ranked_views as (
    select
      suggestion.hook_text_format_id,
      observation.view_count,
      observation.observed_at,
      row_number() over (
        partition by suggestion.hook_text_format_id
        order by observation.observed_at desc, observation.id desc
      ) as result_rank
    from public.hook_performance_observations as observation
    join public.hook_video_suggestions as suggestion
      on suggestion.id = observation.hook_video_suggestion_id
      and suggestion.user_id = p_user_id
    where observation.user_id = p_user_id
      and observation.platform = 'instagram'
      and observation.view_count is not null
      and suggestion.business_profile_id = p_business_profile_id
      and suggestion.hook_text_format_id is not null
  ), result_stats as (
    select
      ranked.hook_text_format_id,
      count(*)::bigint as published_result_count,
      array_agg(
        ranked.view_count order by ranked.observed_at desc
      )::bigint[] as recent_view_counts,
      percentile_cont(0.5) within group (
        order by ranked.view_count
      )::numeric as median_views,
      avg(ranked.view_count)::numeric as average_views,
      greatest(
        0::numeric,
        least(
          1::numeric,
          1 - coalesce(
            stddev_pop(ranked.view_count)::numeric /
              nullif(avg(ranked.view_count)::numeric, 0),
            0
          )
        )
      ) as consistency_score
    from ranked_views as ranked
    where ranked.result_rank <= 12
    group by ranked.hook_text_format_id
  ), combined as (
    select
      format.id as hook_text_format_id,
      generation.campaign_purpose,
      coalesce(generation.times_generated, 0)::bigint as times_generated,
      generation.last_generated_at,
      coalesce(results.published_result_count, 0)::bigint
        as published_result_count,
      coalesce(results.recent_view_counts, '{}'::bigint[])
        as recent_view_counts,
      results.median_views,
      results.average_views,
      coalesce(results.consistency_score, 0.5) as consistency_score
    from public.hook_text_formats as format
    left join generation_stats as generation
      on generation.hook_text_format_id = format.id
    left join result_stats as results
      on results.hook_text_format_id = format.id
    where format.enabled
      and format.global_status = 'global_v1'
  ), baseline as (
    select percentile_cont(0.5) within group (
      order by combined.median_views
    )::numeric as median_views
    from combined
    where combined.median_views is not null
  ), scored as (
    select
      combined.*,
      case
        when combined.median_views is not null
          and baseline.median_views > 0
          then combined.median_views / baseline.median_views
        else 1::numeric
      end as performance_score,
      least(1::numeric, combined.published_result_count::numeric / 5)
        as confidence_score
    from combined
    cross join baseline
  ), final_scores as (
    select
      scored.*,
      case
        when scored.published_result_count = 1
          and scored.performance_score >= 1.2 then 0.08::numeric
        else 0::numeric
      end as temporary_boost,
      greatest(
        0.8::numeric,
        least(
          1.3::numeric,
          1 +
          case
            when scored.published_result_count >= 2 then greatest(
              -0.12::numeric,
              least(
                0.22::numeric,
                (scored.performance_score - 1) * 0.16 *
                  least(
                    1::numeric,
                    greatest(
                      0::numeric,
                      (scored.published_result_count - 1)::numeric / 5
                    )
                  )
              )
            )
            else 0::numeric
          end +
          case
            when scored.published_result_count >= 3
              then (scored.consistency_score - 0.5) * 0.04
            else 0::numeric
          end
        )
      ) as selection_weight
    from scored
  )
  insert into public.user_hook_text_format_performance (
    user_id,
    business_profile_id,
    hook_text_format_id,
    campaign_purpose,
    times_used,
    recent_results,
    median_views,
    average_views,
    consistency_score,
    performance_score,
    confidence_score,
    selection_weight,
    temporary_boost,
    published_result_count,
    last_used_at,
    refreshed_at
  )
  select
    p_user_id,
    p_business_profile_id,
    final_scores.hook_text_format_id,
    final_scores.campaign_purpose,
    final_scores.times_generated::integer,
    to_jsonb(final_scores.recent_view_counts),
    final_scores.median_views,
    final_scores.average_views,
    final_scores.consistency_score,
    final_scores.performance_score,
    final_scores.confidence_score,
    final_scores.selection_weight,
    final_scores.temporary_boost,
    final_scores.published_result_count::integer,
    final_scores.last_generated_at,
    now()
  from final_scores
  on conflict on constraint user_hook_text_format_performance_pkey
  do update set
    campaign_purpose = excluded.campaign_purpose,
    times_used = excluded.times_used,
    recent_results = excluded.recent_results,
    median_views = excluded.median_views,
    average_views = excluded.average_views,
    consistency_score = excluded.consistency_score,
    performance_score = excluded.performance_score,
    confidence_score = excluded.confidence_score,
    selection_weight = excluded.selection_weight,
    temporary_boost = excluded.temporary_boost,
    published_result_count = excluded.published_result_count,
    last_used_at = excluded.last_used_at,
    refreshed_at = excluded.refreshed_at;

  return query
    select
      performance.hook_text_format_id,
      performance.campaign_purpose,
      performance.times_used::bigint,
      performance.last_used_at,
      performance.published_result_count::bigint,
      array(
        select jsonb_array_elements_text(performance.recent_results)::bigint
      ),
      performance.median_views,
      performance.selection_weight,
      performance.temporary_boost
    from public.user_hook_text_format_performance as performance
    where performance.user_id = p_user_id
      and performance.business_profile_id = p_business_profile_id
    order by performance.hook_text_format_id;
end
$$;

revoke all on function public.get_hook_text_format_performance_profiles(
  text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.get_hook_text_format_performance_profiles(
  text, uuid
) to service_role;

select pg_notify('pgrst', 'reload schema');
