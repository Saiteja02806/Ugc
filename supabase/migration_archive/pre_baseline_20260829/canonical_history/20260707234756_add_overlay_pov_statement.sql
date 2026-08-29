alter table public.overlay_creatives
  drop constraint if exists overlay_creatives_format_check;

alter table public.overlay_creatives
  add constraint overlay_creatives_format_check
  check (
    format in (
      'pick_two_list',
      'choose_one',
      'hot_take',
      'pov_statement'
    )
  );

select pg_notify('pgrst', 'reload schema');
