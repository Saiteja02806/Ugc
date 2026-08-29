-- Creative Assets remain immutable source media. Move any legacy editor draft
-- metadata into the dedicated editable_videos project table before removing it
-- from the source asset.
insert into public.editable_videos (
  user_id,
  project_id,
  source_video_id,
  source,
  title,
  ratio,
  source_video_url,
  thumbnail_url,
  duration_seconds,
  draft_json,
  status,
  created_at,
  updated_at
)
select
  asset.user_id,
  coalesce(asset.project_id, 'test-project-001'),
  asset.id::text,
  case
    when asset.source_type = 'demo_upload' then 'demo'
    when asset.collection = 'influencer'
      or asset.source_type in (
        'influencer_upload',
        'catalog_influencer',
        'generated_video'
      ) then 'hook'
    else 'draft'
  end,
  asset.title,
  case
    when asset.ratio in ('9:16', '1:1', '4:5', '16:9') then asset.ratio
    else '9:16'
  end,
  asset.url,
  asset.thumbnail_url,
  asset.duration_seconds,
  asset.metadata -> 'draft',
  'draft',
  asset.created_at,
  asset.updated_at
from public.media_assets asset
where asset.deleted_at is null
  and asset.collection <> 'image'
  and asset.source_type in (
    'upload',
    'influencer_upload',
    'demo_upload',
    'catalog_influencer',
    'generated_video'
  )
  and jsonb_typeof(asset.metadata -> 'draft') = 'object'
on conflict (user_id, project_id, source_video_id) do update
set
  draft_json = case
    when public.editable_videos.updated_at <= excluded.updated_at
      then excluded.draft_json
    else public.editable_videos.draft_json
  end,
  status = case
    when public.editable_videos.updated_at <= excluded.updated_at
      then 'draft'
    else public.editable_videos.status
  end,
  updated_at = greatest(public.editable_videos.updated_at, excluded.updated_at);

update public.media_assets
set metadata = metadata - 'draft'
where deleted_at is null
  and source_type in (
    'upload',
    'influencer_upload',
    'demo_upload',
    'catalog_influencer',
    'generated_video'
  )
  and metadata ? 'draft';

select pg_notify('pgrst', 'reload schema');
