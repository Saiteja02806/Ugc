-- Add the server-validated contract to newly saved generated video metadata.
-- Existing media, jobs and soundtrack receipts are not rewritten.
create or replace function public.explore_tag_generated_media()
returns trigger language plpgsql security definer set search_path = '' as $$
declare job_input jsonb; format text; reference_audio jsonb; generation_contract jsonb;
begin
  if new.source_type in ('generated_video','generated_image') then
    select input_json into job_input from public.background_jobs
      where id::text = new.source_record_id and user_id = new.user_id;
    format := job_input->>'exploreFormat';
    reference_audio := job_input->'referenceSoundtrack';
    generation_contract := job_input->'exploreGeneration';
    if format is null and reference_audio->>'version'='1' then format := job_input->>'referenceType'; end if;
    if (new.source_type='generated_video' and format in ('hook','wall_text')) or
       (new.source_type='generated_image' and format='slideshow') then
      new.metadata := coalesce(new.metadata,'{}'::jsonb) || jsonb_build_object('exploreFormat',format);
    end if;
    if new.source_type='generated_video' and format in ('hook','wall_text')
      and generation_contract->>'version'='1'
      and generation_contract->>'operation' in ('source_edit','generate')
      and generation_contract->>'sound' in ('off','on') then
      new.metadata := new.metadata || jsonb_build_object('exploreGeneration',generation_contract);
    end if;
    if new.source_type='generated_video' and format in ('hook','wall_text')
      and reference_audio->>'version'='1'
      and reference_audio->>'referenceId'=job_input->>'referenceId'
      and job_input->>'referenceType'=format
      and reference_audio->>'audioSha256' ~ '^[a-f0-9]{64}$' then
      new.metadata := new.metadata || jsonb_build_object('exploreReferenceId',reference_audio->>'referenceId');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.explore_tag_generated_media() from public, anon, authenticated;
