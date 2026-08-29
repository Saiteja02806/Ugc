create table if not exists public.carousel_global_settings (
  singleton boolean primary key default true check (singleton),
  structure_mode text not null default 'structure_1_only'
    check (
      structure_mode in (
        'rotate',
        'structure_1_only',
        'structure_2_only'
      )
    ),
  structure_config_version integer not null default 1
    check (structure_config_version >= 1),
  updated_by_user_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.carousel_global_settings (
  singleton,
  structure_mode,
  structure_config_version
)
values (true, 'structure_1_only', 1)
on conflict (singleton) do nothing;

alter table public.carousel_global_settings enable row level security;

revoke all privileges on table public.carousel_global_settings
  from public, anon, authenticated;
grant select, update on table public.carousel_global_settings
  to service_role;

comment on table public.carousel_global_settings is
  'Service-only singleton controlling the global Carousel structure mode. It is seeded to structure_1_only so this foundation migration cannot activate unfinished Structure 2 behavior.';
comment on column public.carousel_global_settings.structure_mode is
  'Global owner-controlled mode applied only when a later implementation reserves a new five-Carousel batch.';

alter table public.carousel_experiment_batches
  add column if not exists structure_id text not null default 'structure_1',
  add column if not exists structure_version integer not null default 1,
  add column if not exists structure_selection_mode text not null
    default 'legacy_default',
  add column if not exists structure_mode_snapshot text not null
    default 'structure_1_only',
  add column if not exists structure_batch_sequence integer,
  add column if not exists structure_rotation_sequence integer;

with ranked as (
  select
    batch.id,
    row_number() over (
      partition by batch.business_profile_id, batch.structure_id
      order by batch.batch_sequence, batch.created_at, batch.id
    ) - 1 as structure_batch_sequence
  from public.carousel_experiment_batches as batch
)
update public.carousel_experiment_batches as batch
set structure_batch_sequence = ranked.structure_batch_sequence
from ranked
where batch.id = ranked.id
  and batch.structure_batch_sequence is null;

alter table public.carousel_experiment_batches
  alter column structure_batch_sequence set not null,
  alter column cycle_number drop not null,
  alter column cycle_batch_position drop not null,
  drop constraint if exists carousel_experiment_batches_structure_id_check,
  add constraint carousel_experiment_batches_structure_id_check
    check (structure_id in ('structure_1', 'structure_2')),
  drop constraint if exists carousel_experiment_batches_structure_version_check,
  add constraint carousel_experiment_batches_structure_version_check
    check (structure_version >= 1),
  drop constraint if exists carousel_experiment_batches_structure_selection_mode_check,
  add constraint carousel_experiment_batches_structure_selection_mode_check
    check (
      structure_selection_mode in (
        'legacy_default',
        'rotation',
        'global_override'
      )
    ),
  drop constraint if exists carousel_experiment_batches_structure_mode_snapshot_check,
  add constraint carousel_experiment_batches_structure_mode_snapshot_check
    check (
      structure_mode_snapshot in (
        'rotate',
        'structure_1_only',
        'structure_2_only'
      )
    ),
  drop constraint if exists carousel_experiment_batches_structure_batch_sequence_check,
  add constraint carousel_experiment_batches_structure_batch_sequence_check
    check (structure_batch_sequence >= 0),
  drop constraint if exists carousel_experiment_batches_structure_rotation_sequence_check,
  add constraint carousel_experiment_batches_structure_rotation_sequence_check
    check (
      (
        structure_selection_mode = 'rotation'
        and structure_rotation_sequence is not null
        and structure_rotation_sequence >= 0
      )
      or
      (
        structure_selection_mode <> 'rotation'
        and structure_rotation_sequence is null
      )
    );

create unique index if not exists carousel_experiment_batches_id_structure_uidx
  on public.carousel_experiment_batches (id, structure_id);

create unique index if not exists carousel_experiment_batches_profile_structure_sequence_uidx
  on public.carousel_experiment_batches (
    business_profile_id,
    structure_id,
    structure_batch_sequence
  );

create unique index if not exists carousel_experiment_batches_profile_rotation_sequence_uidx
  on public.carousel_experiment_batches (
    business_profile_id,
    structure_rotation_sequence
  )
  where structure_rotation_sequence is not null;

comment on column public.carousel_experiment_batches.structure_id is
  'Persisted structure identity for the complete five-Carousel batch. One batch may never mix Structure 1 and Structure 2.';
comment on column public.carousel_experiment_batches.structure_batch_sequence is
  'Monotonic per-business, per-structure sequence used by that structure own independent format rotation.';
comment on column public.carousel_experiment_batches.structure_rotation_sequence is
  'Monotonic per-business sequence used only by batches selected through global rotate mode. Global overrides do not consume it.';
comment on column public.carousel_experiment_batches.cycle_number is
  'Legacy Structure 1 three-group rotation metadata. It is nullable so a later Structure 2 reservation does not need to imitate Structure 1 grouping.';
comment on column public.carousel_experiment_batches.cycle_batch_position is
  'Legacy Structure 1 three-group rotation position. It is nullable for non-Structure-1 batches.';

alter table public.carousel_experiment_assignments
  add column if not exists structure_id text not null default 'structure_1',
  add column if not exists structure_version integer not null default 1;

update public.carousel_experiment_assignments as assignment
set
  structure_id = batch.structure_id,
  structure_version = batch.structure_version
from public.carousel_experiment_batches as batch
where batch.id = assignment.experiment_batch_id
  and (
    assignment.structure_id is distinct from batch.structure_id
    or assignment.structure_version is distinct from batch.structure_version
  );

alter table public.carousel_experiment_assignments
  drop constraint if exists carousel_experiment_assignments_structure_id_check,
  add constraint carousel_experiment_assignments_structure_id_check
    check (structure_id in ('structure_1', 'structure_2')),
  drop constraint if exists carousel_experiment_assignments_structure_version_check,
  add constraint carousel_experiment_assignments_structure_version_check
    check (structure_version >= 1),
  drop constraint if exists carousel_experiment_assignments_batch_structure_fk,
  add constraint carousel_experiment_assignments_batch_structure_fk
    foreign key (experiment_batch_id, structure_id)
    references public.carousel_experiment_batches (id, structure_id)
    on delete cascade;

create unique index if not exists carousel_experiment_assignments_id_structure_uidx
  on public.carousel_experiment_assignments (id, structure_id);

create index if not exists carousel_experiment_assignments_structure_format_idx
  on public.carousel_experiment_assignments (
    structure_id,
    actual_format_id,
    created_at desc
  );

comment on column public.carousel_experiment_assignments.structure_id is
  'Structure namespace for assigned, rotation-candidate, and actual format IDs. Format identity is the pair (structure_id, format_id).';

alter table public.carousel_generations
  add column if not exists structure_id text not null default 'structure_1',
  add column if not exists structure_version integer not null default 1;

update public.carousel_generations as generation
set
  structure_id = batch.structure_id,
  structure_version = batch.structure_version
from public.carousel_experiment_batches as batch
where batch.id = generation.carousel_experiment_batch_id
  and (
    generation.structure_id is distinct from batch.structure_id
    or generation.structure_version is distinct from batch.structure_version
  );

alter table public.carousel_generations
  drop constraint if exists carousel_generations_structure_id_check,
  add constraint carousel_generations_structure_id_check
    check (structure_id in ('structure_1', 'structure_2')),
  drop constraint if exists carousel_generations_structure_version_check,
  add constraint carousel_generations_structure_version_check
    check (structure_version >= 1),
  drop constraint if exists carousel_generations_batch_structure_fk,
  add constraint carousel_generations_batch_structure_fk
    foreign key (carousel_experiment_batch_id, structure_id)
    references public.carousel_experiment_batches (id, structure_id)
    on delete set null (carousel_experiment_batch_id);

create unique index if not exists carousel_generations_id_structure_uidx
  on public.carousel_generations (id, structure_id);

create index if not exists carousel_generations_profile_structure_history_idx
  on public.carousel_generations (
    business_profile_id,
    structure_id,
    created_at desc,
    candidate_index desc
  )
  where business_profile_id is not null
    and generation_source = 'auto_generated'
    and status in ('processing', 'completed');

create index if not exists carousel_generations_profile_structure_format_idx
  on public.carousel_generations (
    business_profile_id,
    structure_id,
    content_format_id,
    created_at desc
  )
  where business_profile_id is not null
    and content_format_id is not null;

comment on column public.carousel_generations.structure_id is
  'Authoritative structure namespace for the generation, its compact history snapshot, format ID, planner, validator, and renderer.';

alter table public.carousel_performance_observations
  add column if not exists structure_id text not null default 'structure_1',
  add column if not exists structure_version integer not null default 1;

update public.carousel_performance_observations as observation
set
  structure_id = generation.structure_id,
  structure_version = generation.structure_version
from public.carousel_generations as generation
where generation.id = observation.carousel_generation_id
  and (
    observation.structure_id is distinct from generation.structure_id
    or observation.structure_version is distinct from generation.structure_version
  );

alter table public.carousel_performance_observations
  drop constraint if exists carousel_performance_observations_structure_id_check,
  add constraint carousel_performance_observations_structure_id_check
    check (structure_id in ('structure_1', 'structure_2')),
  drop constraint if exists carousel_performance_observations_structure_version_check,
  add constraint carousel_performance_observations_structure_version_check
    check (structure_version >= 1),
  drop constraint if exists carousel_performance_observations_generation_structure_fk,
  add constraint carousel_performance_observations_generation_structure_fk
    foreign key (carousel_generation_id, structure_id)
    references public.carousel_generations (id, structure_id)
    on delete cascade;

create index if not exists carousel_performance_profile_structure_evaluated_idx
  on public.carousel_performance_observations (
    user_id,
    business_profile_id,
    structure_id,
    evaluated_at desc,
    content_format_id,
    hook_family_id
  )
  include (view_count, published_at)
  where evaluated_at is not null and view_count is not null;

comment on column public.carousel_performance_observations.structure_id is
  'Structure namespace captured from the attributed generation. Later learning must compare formats only inside this structure.';

create or replace function public.prevent_carousel_structure_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
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
begin
  if new.structure_id is distinct from old.structure_id
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

drop trigger if exists carousel_experiment_batches_structure_immutable
  on public.carousel_experiment_batches;
create trigger carousel_experiment_batches_structure_immutable
before update on public.carousel_experiment_batches
for each row execute function
  public.prevent_carousel_batch_structure_assignment_change();

drop trigger if exists carousel_experiment_assignments_structure_immutable
  on public.carousel_experiment_assignments;
create trigger carousel_experiment_assignments_structure_immutable
before update on public.carousel_experiment_assignments
for each row execute function public.prevent_carousel_structure_identity_change();

drop trigger if exists carousel_generations_structure_immutable
  on public.carousel_generations;
create trigger carousel_generations_structure_immutable
before update on public.carousel_generations
for each row execute function public.prevent_carousel_structure_identity_change();

drop trigger if exists carousel_performance_observations_structure_immutable
  on public.carousel_performance_observations;
create trigger carousel_performance_observations_structure_immutable
before update on public.carousel_performance_observations
for each row execute function public.prevent_carousel_structure_identity_change();

revoke all on function public.prevent_carousel_structure_identity_change()
  from public, anon, authenticated;
revoke all on function public.prevent_carousel_batch_structure_assignment_change()
  from public, anon, authenticated;

create or replace function public.reserve_carousel_experiment_batches(
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_generation_batch_id uuid,
  p_batch_count integer
)
returns setof public.carousel_experiment_batches
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing_count integer;
  v_next_sequence integer;
  v_next_structure_sequence integer;
  v_offset integer;
begin
  if p_batch_count < 1 or p_batch_count > 10 then
    raise exception 'carousel_experiment_batch_count_invalid';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_business_profile_id::text, 246813579)
  );

  select count(*)::integer
  into v_existing_count
  from public.carousel_experiment_batches as batch
  where batch.generation_batch_id = p_generation_batch_id
    and batch.business_profile_id = p_business_profile_id
    and batch.business_profile_version = p_business_profile_version;

  if v_existing_count > p_batch_count then
    raise exception 'carousel_experiment_batch_count_cannot_shrink';
  end if;

  select coalesce(max(batch.batch_sequence), -1) + 1
  into v_next_sequence
  from public.carousel_experiment_batches as batch
  where batch.business_profile_id = p_business_profile_id;

  select coalesce(max(batch.structure_batch_sequence), -1) + 1
  into v_next_structure_sequence
  from public.carousel_experiment_batches as batch
  where batch.business_profile_id = p_business_profile_id
    and batch.structure_id = 'structure_1';

  for v_offset in v_existing_count..(p_batch_count - 1) loop
    insert into public.carousel_experiment_batches (
      business_profile_id,
      business_profile_version,
      generation_batch_id,
      batch_sequence,
      cycle_number,
      cycle_batch_position,
      structure_id,
      structure_version,
      structure_selection_mode,
      structure_mode_snapshot,
      structure_batch_sequence,
      structure_rotation_sequence
    ) values (
      p_business_profile_id,
      p_business_profile_version,
      p_generation_batch_id,
      v_next_sequence + (v_offset - v_existing_count),
      ((v_next_sequence + (v_offset - v_existing_count)) / 3) + 1,
      (v_next_sequence + (v_offset - v_existing_count)) % 3,
      'structure_1',
      1,
      'legacy_default',
      'structure_1_only',
      v_next_structure_sequence + (v_offset - v_existing_count),
      null
    );
  end loop;

  return query
  select batch.*
  from public.carousel_experiment_batches as batch
  where batch.generation_batch_id = p_generation_batch_id
    and batch.business_profile_id = p_business_profile_id
    and batch.business_profile_version = p_business_profile_version
  order by batch.batch_sequence asc;
end;
$$;

revoke all on function public.reserve_carousel_experiment_batches(
  uuid,
  integer,
  uuid,
  integer
) from public, anon, authenticated;
grant execute on function public.reserve_carousel_experiment_batches(
  uuid,
  integer,
  uuid,
  integer
) to service_role;

select pg_notify('pgrst', 'reload schema');
