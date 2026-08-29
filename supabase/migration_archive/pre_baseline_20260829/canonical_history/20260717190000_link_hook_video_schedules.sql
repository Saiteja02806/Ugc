do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'hook_video_drafts_scheduled_post_fk'
      and conrelid = 'public.hook_video_drafts'::regclass
  ) then
    alter table public.hook_video_drafts
      add constraint hook_video_drafts_scheduled_post_fk
      foreign key (scheduled_post_id)
      references public.scheduled_posts(id)
      on delete set null
      not valid;
  end if;
end
$$;

alter table public.hook_video_drafts
  validate constraint hook_video_drafts_scheduled_post_fk;

create unique index if not exists hook_video_drafts_unique_schedule_idx
  on public.hook_video_drafts (scheduled_post_id)
  where scheduled_post_id is not null;

create unique index if not exists scheduled_posts_active_hook_video_draft_idx
  on public.scheduled_posts ((metadata ->> 'hookVideoDraftId'))
  where
    metadata ? 'hookVideoDraftId'
    and status <> 'cancelled';

select pg_notify('pgrst', 'reload schema');
