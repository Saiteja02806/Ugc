-- Explore image sequences share Library and publishing, without inventing an
-- automatic Carousel generation record for user-edited reference slides.
alter table public.library_carousel_slides alter column carousel_generation_id drop not null;

create or replace function public.explore_tag_generated_media()
returns trigger language plpgsql security definer set search_path = '' as $$
declare format text;
begin
  if new.source_type in ('generated_video','generated_image') then
    select input_json->>'exploreFormat' into format from public.background_jobs
      where id::text=new.source_record_id and user_id=new.user_id;
    if (new.source_type='generated_video' and format in ('hook','wall_text')) or
       (new.source_type='generated_image' and format='slideshow') then
      new.metadata := coalesce(new.metadata,'{}'::jsonb) || jsonb_build_object('exploreFormat',format);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.explore_tag_generated_media() from public, anon, authenticated;
create trigger explore_tag_generated_media before insert or update of source_record_id, metadata on public.media_assets
  for each row execute function public.explore_tag_generated_media();

create function public.explore_save_slideshow(p_user_id text,p_request_key uuid,p_fingerprint text,p_title text,p_slides jsonb,p_metadata jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare item public.library_items%rowtype; slide jsonb; count integer; result uuid;
begin
  if p_user_id is null or p_fingerprint !~ '^[0-9a-f]{64}$' or jsonb_typeof(p_slides)<>'array' or jsonb_array_length(p_slides) not between 2 and 10 then raise exception 'explore_slideshow_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id || ':explore-slideshow:' || p_request_key::text,0));
  select * into item from public.library_items where user_id=p_user_id and source_type='generated_carousel' and source_id='explore-slideshow:' || p_request_key::text;
  if found then
    if item.deleted_at is not null or item.metadata->>'fingerprint' is distinct from p_fingerprint then raise exception 'explore_slideshow_conflict'; end if;
    return item.id;
  end if;
  count := 0;
  for slide in select value from jsonb_array_elements(p_slides) loop
    count := count + 1;
    if coalesce((slide->>'slideNumber')::integer,0)<>count or coalesce(slide->>'renderedUrl','') !~ '^https://' then raise exception 'explore_slideshow_invalid'; end if;
    if slide->>'mediaAssetId' is not null and not exists(select 1 from public.media_assets where id=(slide->>'mediaAssetId')::uuid and user_id=p_user_id and collection='image' and status='ready' and deleted_at is null and url=slide->>'renderedUrl') then raise exception 'explore_slideshow_asset_unavailable'; end if;
  end loop;
  insert into public.library_items(user_id,project_id,source_type,source_id,media_type,title,cover_url,thumbnail_url,metadata)
    values(p_user_id,'explore','generated_carousel','explore-slideshow:' || p_request_key::text,'carousel',left(p_title,160),p_slides->0->>'renderedUrl',p_slides->0->>'renderedUrl',coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('exploreFormat','slideshow','fingerprint',p_fingerprint,'requestKey',p_request_key)) returning id into result;
  for slide in select value from jsonb_array_elements(p_slides) loop
    insert into public.library_carousel_slides(library_item_id,carousel_generation_id,carousel_slide_id,slide_number,slide_type,rendered_url,rendered_s3_key,metadata)
      values(result,null,null,(slide->>'slideNumber')::integer,'image',slide->>'renderedUrl',slide->>'renderedS3Key',jsonb_build_object('referenceSlideId',slide->>'referenceSlideId','mediaAssetId',slide->>'mediaAssetId'));
  end loop;
  return result;
end;
$$;
revoke all on function public.explore_save_slideshow(text,uuid,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.explore_save_slideshow(text,uuid,text,text,jsonb,jsonb) to service_role;
