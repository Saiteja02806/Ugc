-- New Wall-of-Text copy is freeform. The historic 30-format registry remains
-- readable for old content, but freeform text must not enter format learning.

alter table public.wall_text_generation_assignments
  drop constraint if exists wall_text_generation_assignments_selection_mode_check;

alter table public.wall_text_generation_assignments
  add constraint wall_text_generation_assignments_selection_mode_check
  check (
    selection_mode in (
      'controlled_rotation',
      'performance_exploration',
      'performance_weighted',
      'instagram_template',
      'freeform'
    )
  );

create or replace function public.prevent_freeform_wall_text_format_learning()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.format_id is null then
    new.performance_eligible := false;
    new.performance_exclusion_reason := 'freeform_copy_has_no_format_learning';
  end if;
  return new;
end;
$$;

drop trigger if exists wall_text_content_history_freeform_learning_guard
  on public.wall_text_content_history;

create trigger wall_text_content_history_freeform_learning_guard
before insert or update of format_id, performance_eligible
on public.wall_text_content_history
for each row
execute function public.prevent_freeform_wall_text_format_learning();

select pg_notify('pgrst', 'reload schema');
