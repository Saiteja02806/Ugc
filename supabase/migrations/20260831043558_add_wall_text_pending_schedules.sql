-- A Wall-of-text schedule is saved before its MP4 exists.  This state is
-- intentionally narrow: it cannot carry a fake asset and must identify the
-- owned Wall assignment that the worker will render.
begin;

alter table public.scheduled_posts
  drop constraint if exists scheduled_posts_source_kind_check;

alter table public.scheduled_posts
  add constraint scheduled_posts_source_kind_check
  check (
    source_kind = any (
      array['media_asset'::text, 'library_item'::text, 'wall_text_pending'::text]
    )
  );

alter table public.scheduled_posts
  drop constraint if exists scheduled_posts_check;

alter table public.scheduled_posts
  add constraint scheduled_posts_check
  check (
    (source_kind = 'media_asset' and media_asset_id is not null and library_item_id is null)
    or
    (source_kind = 'library_item' and library_item_id is not null and media_asset_id is null)
    or
    (
      source_kind = 'wall_text_pending'
      and media_asset_id is null
      and library_item_id is null
      and metadata ? 'wallTextAssignmentId'
      and jsonb_typeof(metadata -> 'wallTextAssignmentId') = 'string'
      and length(trim(metadata ->> 'wallTextAssignmentId')) > 0
    )
  );

-- Worker finalization looks up the durable Wall render identity both before
-- and after it attaches the MP4, so retries remain idempotent.
create index if not exists scheduled_posts_wall_text_render_lookup_idx
  on public.scheduled_posts (
    user_id,
    (metadata ->> 'wallTextAssignmentId'),
    (metadata ->> 'wallTextRenderId')
  )
  where metadata ? 'wallTextAssignmentId' and metadata ? 'wallTextRenderId';

commit;
