-- Save every successful builder candidate and variation when its durable job
-- completes, including when the browser has left the workspace. Keep the
-- existing media row/reference contract and leave ordinary AI Studio images alone.
create or replace function public.save_character_generation_image(p_job_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $function$
  update public.media_assets as asset
  set collection = 'influencer',
      title = case
        when asset.metadata->'characterIdentity' @> jsonb_build_object(
          'source', 'ugc-pilot-characters', 'version', 1, 'jobId', job.id::text
        ) then asset.title
        else 'My AI influencer'
      end,
      metadata = coalesce(asset.metadata, '{}'::jsonb) || jsonb_build_object(
        'characterIdentity', case
          when asset.metadata->'characterIdentity' @> jsonb_build_object(
            'source', 'ugc-pilot-characters', 'version', 1, 'jobId', job.id::text
          ) then asset.metadata->'characterIdentity'
          else jsonb_build_object(
            'source', 'ugc-pilot-characters', 'version', 1,
            'jobId', job.id::text,
            'selectedAt', coalesce(job.completed_at, asset.created_at),
            'automatic', true
          )
        end
      ),
      updated_at = coalesce(job.completed_at, asset.updated_at)
  from public.background_jobs as job
  where job.id = p_job_id
    and job.job_type = 'generate_image' and job.status = 'completed'
    and job.input_json->>'characterSource' = 'ugc-pilot-characters'
    and job.input_json->>'characterVersion' in ('1', '2')
    and job.input_json->>'candidateIndex' in ('1', '2', '3')
    and job.input_json->>'model' in ('gpt_image', 'gpt_image_2_5', 'gemini_3_pro', 'nano_banana_2', 'seedream_5_pro')
    and nullif(trim(job.input_json->>'generationId'), '') is not null
    and (job.input_json->>'characterVersion' = '1' or (
      job.input_json->>'mode' = 'custom' and job.input_json->>'promptSource' = 'user'
      and nullif(trim(job.input_json->>'prompt'), '') is not null
    ))
    and asset.user_id = job.user_id
    and asset.source_type = 'generated_image' and asset.source_record_id = job.id::text
    and asset.id::text = job.output_json->>'mediaAssetId'
    and asset.status = 'ready' and asset.deleted_at is null
    and asset.collection in ('image', 'influencer') and asset.mime_type like 'image/%'
    and asset.url ~ '^https://' and asset.url = job.output_json->>'url'
    and asset.storage_key = job.output_json->>'key'
    and job.output_json->>'generationId' = job.input_json->>'generationId'
    and job.output_json->>'model' = job.input_json->>'model'
    and (asset.collection <> 'influencer' or not coalesce(
      asset.metadata->'characterIdentity' @> jsonb_build_object(
        'source', 'ugc-pilot-characters', 'version', 1, 'jobId', job.id::text
      ), false
    ));
$function$;

revoke all on function public.save_character_generation_image(uuid) from public, anon, authenticated;
grant execute on function public.save_character_generation_image(uuid) to postgres, service_role;

create or replace function public.save_completed_character_generation_image()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  perform public.save_character_generation_image(new.id);
  return new;
end;
$function$;

revoke all on function public.save_completed_character_generation_image() from public, anon, authenticated;
grant execute on function public.save_completed_character_generation_image() to postgres, service_role;

drop trigger if exists save_completed_character_generation_image on public.background_jobs;
create trigger save_completed_character_generation_image
after update of status, output_json on public.background_jobs
for each row
when (new.status = 'completed' and new.job_type = 'generate_image'
  and new.input_json->>'characterSource' = 'ugc-pilot-characters')
execute function public.save_completed_character_generation_image();

-- Make existing successful, unselected candidates visible in My influencers.
-- Reapplying is safe: saved names/selection markers and deleted assets are preserved.
select public.save_character_generation_image(job.id)
from public.background_jobs as job
where job.job_type = 'generate_image' and job.status = 'completed'
  and job.input_json->>'characterSource' = 'ugc-pilot-characters';
