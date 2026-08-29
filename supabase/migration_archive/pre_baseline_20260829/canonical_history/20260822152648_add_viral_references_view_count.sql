alter table public.viral_references
  add column if not exists view_count bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'viral_references_view_count_nonnegative'
      and conrelid = 'public.viral_references'::regclass
  ) then
    alter table public.viral_references
      add constraint viral_references_view_count_nonnegative
      check (view_count is null or view_count >= 0);
  end if;
end
$$;

comment on column public.viral_references.view_count is
  'Latest known Instagram view count. Null means the count is unknown.';

notify pgrst, 'reload schema';
