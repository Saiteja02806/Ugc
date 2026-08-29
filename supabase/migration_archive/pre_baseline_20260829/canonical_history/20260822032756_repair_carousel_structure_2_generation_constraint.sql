set lock_timeout = '5s';
set statement_timeout = '30s';

alter table public.carousel_generations
  drop constraint if exists carousel_generations_content_selection_pair_check,
  add constraint carousel_generations_content_selection_pair_check
    check (
      (
        structure_id = 'structure_1'
        and (
          (
            content_format_id is null
            and hook_family_id is null
            and content_grammar_version is null
            and content_selector_version is null
          )
          or
          (
            content_format_id is not null
            and hook_family_id is not null
            and content_grammar_version is not null
            and content_selector_version is not null
          )
        )
      )
      or
      (
        structure_id = 'structure_2'
        and content_format_id is not null
        and hook_family_id is null
        and content_grammar_version is not null
        and content_selector_version is not null
      )
    ) not valid;

alter table public.carousel_generations
  validate constraint carousel_generations_content_selection_pair_check;

comment on constraint carousel_generations_content_selection_pair_check
  on public.carousel_generations is
  'Structure 1 requires its hook family whenever content grammar is selected. Structure 2 owns a separate format grammar and must not store a Structure 1 hook family.';

create or replace function public.fail_unqueued_carousel_preparation(
  p_generation_batch_id uuid,
  p_error_message text
)
returns table(
  failed_generation_count integer,
  failed_assignment_count integer,
  failed_batch_count integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_error_message text;
begin
  if p_generation_batch_id is null then
    raise exception 'carousel_generation_batch_id_required';
  end if;

  v_error_message := left(
    coalesce(nullif(btrim(p_error_message), ''), 'Carousel preparation failed before queue dispatch.'),
    1000
  );

  update public.carousel_generations as generation
  set
    error_message = v_error_message,
    status = 'failed',
    updated_at = timezone('utc', now())
  where generation.generation_batch_id = p_generation_batch_id
    and generation.status = 'processing'
    and generation.trigger_run_id is null;

  get diagnostics failed_generation_count = row_count;

  update public.carousel_experiment_assignments as assignment
  set
    status = 'failed',
    updated_at = timezone('utc', now())
  where assignment.status in ('reserved', 'queued', 'processing')
    and exists (
      select 1
      from public.carousel_experiment_batches as batch
      where batch.id = assignment.experiment_batch_id
        and batch.generation_batch_id = p_generation_batch_id
        and batch.planner_job_id is null
        and batch.status in ('reserved', 'queued', 'processing', 'partial')
    );

  get diagnostics failed_assignment_count = row_count;

  update public.carousel_experiment_batches as batch
  set
    status = 'failed',
    updated_at = timezone('utc', now())
  where batch.generation_batch_id = p_generation_batch_id
    and batch.planner_job_id is null
    and batch.status in ('reserved', 'queued', 'processing', 'partial');

  get diagnostics failed_batch_count = row_count;

  return next;
end;
$$;

revoke all on function public.fail_unqueued_carousel_preparation(uuid, text)
  from public, anon, authenticated;
grant execute on function public.fail_unqueued_carousel_preparation(uuid, text)
  to service_role;

comment on function public.fail_unqueued_carousel_preparation(uuid, text) is
  'Fails only Carousel preparation rows that never received a durable planner job. Queued and completed work is preserved.';

select pg_notify('pgrst', 'reload schema');
