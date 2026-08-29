alter table public.carousel_experiment_batches
  add column if not exists requested_structure_id text,
  add column if not exists requested_structure_version integer,
  add column if not exists requested_structure_batch_sequence integer,
  add column if not exists structure_resolution_mode text not null
    default 'requested',
  add column if not exists structure_planning_attempt_count integer not null
    default 0,
  add column if not exists structure_fallback_reason text,
  add column if not exists structure_resolved_at timestamptz;

update public.carousel_experiment_batches
set
  requested_structure_id = structure_id,
  requested_structure_version = structure_version,
  requested_structure_batch_sequence = structure_batch_sequence
where requested_structure_id is null
   or requested_structure_version is null
   or requested_structure_batch_sequence is null;

alter table public.carousel_experiment_batches
  alter column requested_structure_id set not null,
  alter column requested_structure_version set not null,
  alter column requested_structure_batch_sequence set not null,
  drop constraint if exists carousel_experiment_batches_requested_structure_id_check,
  add constraint carousel_experiment_batches_requested_structure_id_check
    check (requested_structure_id in ('structure_1', 'structure_2')),
  drop constraint if exists carousel_experiment_batches_requested_structure_version_check,
  add constraint carousel_experiment_batches_requested_structure_version_check
    check (requested_structure_version >= 1),
  drop constraint if exists carousel_experiment_batches_requested_structure_sequence_check,
  add constraint carousel_experiment_batches_requested_structure_sequence_check
    check (requested_structure_batch_sequence >= 0),
  drop constraint if exists carousel_experiment_batches_structure_resolution_mode_check,
  add constraint carousel_experiment_batches_structure_resolution_mode_check
    check (structure_resolution_mode in ('requested', 'planning_fallback')),
  drop constraint if exists carousel_experiment_batches_planning_attempt_count_check,
  add constraint carousel_experiment_batches_planning_attempt_count_check
    check (structure_planning_attempt_count between 0 and 2),
  drop constraint if exists carousel_experiment_batches_structure_resolution_check,
  add constraint carousel_experiment_batches_structure_resolution_check
    check (
      (
        structure_resolution_mode = 'requested'
        and requested_structure_id = structure_id
        and requested_structure_version = structure_version
        and requested_structure_batch_sequence = structure_batch_sequence
        and structure_fallback_reason is null
        and structure_resolved_at is null
      )
      or
      (
        structure_resolution_mode = 'planning_fallback'
        and requested_structure_id = 'structure_1'
        and structure_id = 'structure_2'
        and structure_planning_attempt_count = 2
        and nullif(trim(coalesce(structure_fallback_reason, '')), '') is not null
        and structure_resolved_at is not null
      )
    );

comment on column public.carousel_experiment_batches.requested_structure_id is
  'Immutable structure selected by the global mode before planning. The resolved structure_id remains the analytics and generation namespace.';
comment on column public.carousel_experiment_batches.structure_resolution_mode is
  'requested for the normal path, or planning_fallback after the service-only atomic Structure 1 to Structure 2 takeover.';
comment on column public.carousel_experiment_batches.structure_planning_attempt_count is
  'Number of complete Structure 1 planning attempts made. Each attempt includes its one isolated validation repair.';
comment on column public.carousel_experiment_batches.structure_fallback_reason is
  'Bounded final Structure 1 planning failure recorded when the complete batch resolves to Structure 2.';

create or replace function public.initialize_carousel_requested_structure()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.requested_structure_id := coalesce(
    new.requested_structure_id,
    new.structure_id
  );
  new.requested_structure_version := coalesce(
    new.requested_structure_version,
    new.structure_version
  );
  new.requested_structure_batch_sequence := coalesce(
    new.requested_structure_batch_sequence,
    new.structure_batch_sequence
  );
  return new;
end;
$$;

drop trigger if exists carousel_experiment_batches_initialize_requested_structure
  on public.carousel_experiment_batches;
create trigger carousel_experiment_batches_initialize_requested_structure
before insert on public.carousel_experiment_batches
for each row execute function public.initialize_carousel_requested_structure();

revoke all on function public.initialize_carousel_requested_structure()
  from public, anon, authenticated;

alter table public.carousel_experiment_assignments
  drop constraint if exists carousel_experiment_assignments_batch_structure_fk,
  add constraint carousel_experiment_assignments_batch_structure_fk
    foreign key (experiment_batch_id, structure_id)
    references public.carousel_experiment_batches (id, structure_id)
    on delete cascade
    deferrable initially deferred;

alter table public.carousel_generations
  drop constraint if exists carousel_generations_batch_structure_fk,
  add constraint carousel_generations_batch_structure_fk
    foreign key (carousel_experiment_batch_id, structure_id)
    references public.carousel_experiment_batches (id, structure_id)
    on delete set null (carousel_experiment_batch_id)
    deferrable initially deferred;

create or replace function public.prevent_carousel_structure_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent_batch_id text;
  v_takeover_batch_id text;
begin
  v_takeover_batch_id := current_setting(
    'app.carousel_structure_takeover_batch_id',
    true
  );
  v_parent_batch_id := coalesce(
    to_jsonb(new) ->> 'experiment_batch_id',
    to_jsonb(new) ->> 'carousel_experiment_batch_id'
  );

  if nullif(v_takeover_batch_id, '') is not null
     and v_parent_batch_id = v_takeover_batch_id then
    return new;
  end if;

  if new.structure_id is distinct from old.structure_id
     or new.structure_version is distinct from old.structure_version then
    raise exception 'carousel_structure_identity_is_immutable';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_carousel_batch_structure_assignment_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_takeover_batch_id text;
begin
  v_takeover_batch_id := current_setting(
    'app.carousel_structure_takeover_batch_id',
    true
  );

  if nullif(v_takeover_batch_id, '') is not null
     and new.id::text = v_takeover_batch_id then
    return new;
  end if;

  if new.structure_planning_attempt_count < old.structure_planning_attempt_count then
    raise exception 'carousel_structure_planning_attempt_count_cannot_decrease';
  end if;

  if new.requested_structure_id is distinct from old.requested_structure_id
     or new.requested_structure_version is distinct from old.requested_structure_version
     or new.requested_structure_batch_sequence is distinct from old.requested_structure_batch_sequence
     or new.structure_resolution_mode is distinct from old.structure_resolution_mode
     or new.structure_fallback_reason is distinct from old.structure_fallback_reason
     or new.structure_resolved_at is distinct from old.structure_resolved_at
     or new.structure_id is distinct from old.structure_id
     or new.structure_version is distinct from old.structure_version
     or new.structure_selection_mode is distinct from old.structure_selection_mode
     or new.structure_mode_snapshot is distinct from old.structure_mode_snapshot
     or new.structure_batch_sequence is distinct from old.structure_batch_sequence
     or new.structure_rotation_sequence is distinct from old.structure_rotation_sequence then
    raise exception 'carousel_batch_structure_assignment_is_immutable';
  end if;

  return new;
end;
$$;

create or replace function public.take_over_carousel_experiment_batch_with_structure_2(
  p_experiment_batch_id uuid,
  p_failure_reason text,
  p_planning_attempt_count integer
)
returns setof public.carousel_experiment_batches
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_assignment_count integer;
  v_batch public.carousel_experiment_batches%rowtype;
  v_format_ids text[] := array[
    'wrong_belief',
    'perfect_plan_breaks',
    'stopped_behavior',
    'terrible_at',
    'result_without_sacrifice',
    'identity_transformation',
    'new_rule',
    'wrong_villain'
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

  select batch.*
  into v_batch
  from public.carousel_experiment_batches as batch
  where batch.id = p_experiment_batch_id;

  if not found then
    raise exception 'carousel_structure_takeover_batch_not_found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_batch.business_profile_id::text, 246813579)
  );

  select batch.*
  into v_batch
  from public.carousel_experiment_batches as batch
  where batch.id = p_experiment_batch_id
  for update;

  if v_batch.structure_resolution_mode = 'planning_fallback'
     and v_batch.requested_structure_id = 'structure_1'
     and v_batch.structure_id = 'structure_2' then
    return query
    select batch.*
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

  select count(*)::integer
  into v_generation_count
  from public.carousel_generations as generation
  where generation.carousel_experiment_batch_id = p_experiment_batch_id;

  select count(*)::integer
  into v_assignment_count
  from public.carousel_experiment_assignments as assignment
  where assignment.experiment_batch_id = p_experiment_batch_id;

  if v_generation_count <> 5
     or v_assignment_count <> 5
     or exists (
       select 1
       from public.carousel_generations as generation
       where generation.carousel_experiment_batch_id = p_experiment_batch_id
         and (
           generation.status = 'completed'
           or generation.content_plan_normalized is not null
           or generation.carousel_experiment_assignment_id is null
           or not exists (
             select 1
             from public.carousel_experiment_assignments as assignment
             where assignment.id = generation.carousel_experiment_assignment_id
               and assignment.experiment_batch_id = p_experiment_batch_id
               and assignment.carousel_generation_id = generation.id
           )
         )
     )
     or exists (
       select 1
       from public.carousel_slides as slide
       join public.carousel_generations as generation
         on generation.id = slide.carousel_generation_id
       where generation.carousel_experiment_batch_id = p_experiment_batch_id
     )
     or exists (
       select 1
       from public.carousel_performance_observations as observation
       join public.carousel_generations as generation
         on generation.id = observation.carousel_generation_id
       where generation.carousel_experiment_batch_id = p_experiment_batch_id
     ) then
    raise exception 'carousel_structure_takeover_batch_has_generation_output';
  end if;

  select coalesce(jsonb_agg(history.history_summary), '[]'::jsonb)
  into v_history_snapshot
  from (
    select generation.content_plan_normalized -> 'historySummary'
      as history_summary
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
    'app.carousel_structure_takeover_batch_id',
    p_experiment_batch_id::text,
    true
  );

  update public.carousel_experiment_assignments as assignment
  set
    assigned_format_id = v_format_ids[
      ((v_next_structure_sequence * 5 + assignment.slot_index) % 8) + 1
    ],
    actual_format_id = v_format_ids[
      ((v_next_structure_sequence * 5 + assignment.slot_index) % 8) + 1
    ],
    format_version = 1,
    hook_family_id = null,
    replacement_for_format_id = null,
    status = 'queued',
    rotation_candidate_format_id = v_format_ids[
      ((v_next_structure_sequence * 5 + assignment.slot_index) % 8) + 1
    ],
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

  return query
  select batch.*
  from public.carousel_experiment_batches as batch
  where batch.id = p_experiment_batch_id;
end;
$$;

revoke all on function public.take_over_carousel_experiment_batch_with_structure_2(
  uuid,
  text,
  integer
) from public, anon, authenticated;
grant execute on function public.take_over_carousel_experiment_batch_with_structure_2(
  uuid,
  text,
  integer
) to service_role;

comment on function public.take_over_carousel_experiment_batch_with_structure_2(
  uuid,
  text,
  integer
) is
  'Idempotently resolves one untouched five-item Structure 1 batch to Structure 2 after exactly two failed planning attempts. It preserves the original global rotation slot and atomically advances only Structure 2 format history.';

select pg_notify('pgrst', 'reload schema');
