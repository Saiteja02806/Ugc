-- Persist the backend-selected Slide 1 hook-template pattern alongside the
-- existing Structure 1 format and hook-family assignment. Both columns remain
-- nullable so historic generations and an explicit feature rollback keep the
-- legacy hook-family-only path.

alter table public.carousel_experiment_assignments
  add column hook_template_id text,
  add column hook_template_version integer;

alter table public.carousel_generations
  add column hook_template_id text,
  add column hook_template_version integer;

alter table public.carousel_experiment_assignments
  add constraint carousel_experiment_assignments_hook_template_pair_check
  check (
    (hook_template_id is null and hook_template_version is null)
    or (
      structure_id = 'structure_1'
      and hook_template_id ~ '^[a-z0-9]+(_[a-z0-9]+)*$'
      and hook_template_version >= 1
    )
  );

alter table public.carousel_generations
  add constraint carousel_generations_hook_template_pair_check
  check (
    (hook_template_id is null and hook_template_version is null)
    or (
      structure_id = 'structure_1'
      and hook_template_id ~ '^[a-z0-9]+(_[a-z0-9]+)*$'
      and hook_template_version >= 1
    )
  );

-- A Structure 1 batch can be atomically re-routed to Structure 2 after two
-- planning failures. Clear the persisted Structure 1-only template in the
-- same update that changes the structure, otherwise the new invariant would
-- reject that established fallback transaction.
create or replace function public.take_over_carousel_experiment_batch_with_structure_2(
  p_experiment_batch_id uuid,
  p_failure_reason text,
  p_planning_attempt_count integer
)
returns setof public.carousel_experiment_batches
language plpgsql
set search_path to ''
as $function$
declare
  v_assignment_count integer;
  v_batch public.carousel_experiment_batches%rowtype;
  v_format_ids text[] := array[
    'wrong_belief', 'perfect_plan_breaks', 'stopped_behavior', 'terrible_at',
    'result_without_sacrifice', 'identity_transformation', 'new_rule', 'wrong_villain'
  ];
  v_generation_count integer;
  v_history_snapshot jsonb;
  v_next_structure_sequence integer;
begin
  if p_experiment_batch_id is null
     or p_planning_attempt_count <> 2
     or nullif(trim(coalesce(p_failure_reason, '')), '') is null then
    raise exception 'carousel_structure_takeover_input_invalid';
  end if;

  select batch.* into v_batch
  from public.carousel_experiment_batches as batch
  where batch.id = p_experiment_batch_id;
  if not found then
    raise exception 'carousel_structure_takeover_batch_not_found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_batch.business_profile_id::text, 246813579)
  );

  select batch.* into v_batch
  from public.carousel_experiment_batches as batch
  where batch.id = p_experiment_batch_id
  for update;

  if v_batch.structure_resolution_mode = 'planning_fallback'
     and v_batch.requested_structure_id = 'structure_1'
     and v_batch.structure_id = 'structure_2' then
    return query select batch.*
    from public.carousel_experiment_batches as batch
    where batch.id = p_experiment_batch_id;
    return;
  end if;

  if v_batch.structure_resolution_mode <> 'requested'
     or v_batch.requested_structure_id <> 'structure_1'
     or v_batch.structure_id <> 'structure_1'
     or v_batch.requested_carousel_count <> 5
     or v_batch.status not in ('reserved', 'queued', 'processing', 'failed') then
    raise exception 'carousel_structure_takeover_batch_not_eligible';
  end if;

  select count(*)::integer into v_generation_count
  from public.carousel_generations as generation
  where generation.carousel_experiment_batch_id = p_experiment_batch_id;
  select count(*)::integer into v_assignment_count
  from public.carousel_experiment_assignments as assignment
  where assignment.experiment_batch_id = p_experiment_batch_id;

  if v_generation_count <> 5
     or v_assignment_count <> 5
     or exists (
       select 1 from public.carousel_generations as generation
       where generation.carousel_experiment_batch_id = p_experiment_batch_id
         and (
           generation.status = 'completed'
           or generation.content_plan_normalized is not null
           or generation.carousel_experiment_assignment_id is null
           or not exists (
             select 1 from public.carousel_experiment_assignments as assignment
             where assignment.id = generation.carousel_experiment_assignment_id
               and assignment.experiment_batch_id = p_experiment_batch_id
               and assignment.carousel_generation_id = generation.id
           )
         )
     )
     or exists (
       select 1 from public.carousel_slides as slide
       join public.carousel_generations as generation
         on generation.id = slide.carousel_generation_id
       where generation.carousel_experiment_batch_id = p_experiment_batch_id
     )
     or exists (
       select 1 from public.carousel_performance_observations as observation
       join public.carousel_generations as generation
         on generation.id = observation.carousel_generation_id
       where generation.carousel_experiment_batch_id = p_experiment_batch_id
     ) then
    raise exception 'carousel_structure_takeover_batch_has_generation_output';
  end if;

  select coalesce(jsonb_agg(history.history_summary), '[]'::jsonb)
  into v_history_snapshot
  from (
    select generation.content_plan_normalized -> 'historySummary' as history_summary
    from public.carousel_generations as generation
    where generation.business_profile_id = v_batch.business_profile_id
      and generation.structure_id = 'structure_2'
      and generation.status = 'completed'
      and generation.generation_batch_id <> v_batch.generation_batch_id
      and jsonb_typeof(generation.content_plan_normalized -> 'historySummary') = 'object'
    order by generation.created_at desc, generation.candidate_index desc
    limit 10
  ) as history;

  select coalesce(max(batch.structure_batch_sequence), -1) + 1
  into v_next_structure_sequence
  from public.carousel_experiment_batches as batch
  where batch.business_profile_id = v_batch.business_profile_id
    and batch.structure_id = 'structure_2';

  perform set_config(
    'app.carousel_structure_takeover_batch_id', p_experiment_batch_id::text, true
  );

  update public.carousel_experiment_assignments as assignment
  set
    assigned_format_id = v_format_ids[((v_next_structure_sequence * 5 + assignment.slot_index) % 8) + 1],
    actual_format_id = v_format_ids[((v_next_structure_sequence * 5 + assignment.slot_index) % 8) + 1],
    format_version = 1,
    hook_family_id = null,
    hook_template_id = null,
    hook_template_version = null,
    replacement_for_format_id = null,
    status = 'queued',
    rotation_candidate_format_id = v_format_ids[((v_next_structure_sequence * 5 + assignment.slot_index) % 8) + 1],
    format_selection_mode = 'controlled_rotation',
    format_selection_multiplier = 1,
    hook_selection_mode = null,
    hook_selection_multiplier = null,
    structure_id = 'structure_2',
    structure_version = 1,
    updated_at = timezone('utc', now())
  where assignment.experiment_batch_id = p_experiment_batch_id;

  update public.carousel_generations as generation
  set
    content_angle = null,
    content_assigned_format_id = assignment.assigned_format_id,
    content_audience_id = null,
    content_format_id = assignment.actual_format_id,
    content_format_version = assignment.format_version,
    content_goal_id = null,
    content_grammar_version = 'carousel-structure-2-formats-v1',
    content_history_snapshot = v_history_snapshot,
    content_plan_fallback_reason = null,
    content_plan_normalized = null,
    content_plan_raw_response = null,
    content_plan_source = null,
    content_plan_validation = null,
    content_planner_model = null,
    content_planner_version = null,
    content_problem_id = null,
    content_selector_version = 'carousel-structure-2-selector-v1-eight-format-rotation',
    content_topic = null,
    content_topic_id = null,
    error_message = null,
    hook_family_id = null,
    hook_template_id = null,
    hook_template_version = null,
    renderer_version = null,
    status = 'processing',
    structure_id = 'structure_2',
    structure_version = 1,
    updated_at = timezone('utc', now())
  from public.carousel_experiment_assignments as assignment
  where generation.carousel_experiment_batch_id = p_experiment_batch_id
    and assignment.id = generation.carousel_experiment_assignment_id
    and assignment.experiment_batch_id = p_experiment_batch_id;

  update public.carousel_experiment_batches
  set
    cycle_number = null,
    cycle_batch_position = null,
    status = 'processing',
    structure_id = 'structure_2',
    structure_version = 1,
    structure_batch_sequence = v_next_structure_sequence,
    structure_resolution_mode = 'planning_fallback',
    structure_planning_attempt_count = 2,
    structure_fallback_reason = left(trim(p_failure_reason), 1000),
    structure_resolved_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = p_experiment_batch_id;

  return query select batch.*
  from public.carousel_experiment_batches as batch
  where batch.id = p_experiment_batch_id;
end;
$function$;

comment on column public.carousel_experiment_assignments.hook_template_id is
  'Optional backend-selected Slide 1 hook pattern for Structure 1. It is null for legacy rows, a disabled rollout, and all Structure 2 assignments.';

comment on column public.carousel_experiment_assignments.hook_template_version is
  'Version of the optional persisted Structure 1 Slide 1 hook pattern.';

comment on column public.carousel_generations.hook_template_id is
  'Optional persisted Slide 1 hook pattern passed to the Structure 1 planner; Slides 2-6 continue to use content_format_id only.';

comment on column public.carousel_generations.hook_template_version is
  'Version of the optional persisted Structure 1 Slide 1 hook pattern.';

select pg_notify('pgrst', 'reload schema');
