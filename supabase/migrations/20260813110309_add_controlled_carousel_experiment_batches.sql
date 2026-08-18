create table if not exists public.carousel_experiment_batches (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null
    references public.business_profiles(id) on delete cascade,
  business_profile_version integer not null,
  generation_batch_id uuid not null,
  batch_sequence integer not null check (batch_sequence >= 0),
  cycle_number integer not null check (cycle_number >= 1),
  cycle_batch_position smallint not null
    check (cycle_batch_position between 0 and 2),
  requested_carousel_count smallint not null default 5
    check (requested_carousel_count = 5),
  status text not null default 'reserved'
    check (status in ('reserved', 'queued', 'processing', 'completed', 'partial', 'failed')),
  planner_job_id uuid
    references public.background_jobs(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (business_profile_id, batch_sequence),
  unique (generation_batch_id, batch_sequence)
);

create table if not exists public.carousel_experiment_assignments (
  id uuid primary key default gen_random_uuid(),
  experiment_batch_id uuid not null
    references public.carousel_experiment_batches(id) on delete cascade,
  slot_index smallint not null check (slot_index between 0 and 4),
  assigned_format_id text not null,
  actual_format_id text,
  format_version integer not null check (format_version >= 1),
  hook_family_id text not null,
  carousel_generation_id uuid unique
    references public.carousel_generations(id) on delete set null,
  replacement_for_format_id text,
  status text not null default 'reserved'
    check (status in ('reserved', 'queued', 'processing', 'completed', 'not_applicable', 'failed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (experiment_batch_id, slot_index),
  check (
    (status = 'not_applicable' and actual_format_id is null)
    or status <> 'not_applicable'
  ),
  check (
    replacement_for_format_id is null
    or actual_format_id is distinct from replacement_for_format_id
  )
);

alter table public.carousel_generations
  add column if not exists carousel_experiment_batch_id uuid
    references public.carousel_experiment_batches(id) on delete set null,
  add column if not exists carousel_experiment_assignment_id uuid
    references public.carousel_experiment_assignments(id) on delete set null,
  add column if not exists content_assigned_format_id text,
  add column if not exists content_format_version integer;

create index if not exists carousel_experiment_batches_profile_created_idx
  on public.carousel_experiment_batches (
    business_profile_id,
    business_profile_version,
    created_at desc
  );

create index if not exists carousel_experiment_batches_generation_batch_idx
  on public.carousel_experiment_batches (generation_batch_id, batch_sequence);

create index if not exists carousel_experiment_assignments_batch_status_idx
  on public.carousel_experiment_assignments (experiment_batch_id, status, slot_index);

create index if not exists carousel_generations_experiment_batch_candidate_idx
  on public.carousel_generations (carousel_experiment_batch_id, candidate_index)
  where carousel_experiment_batch_id is not null;

alter table public.carousel_experiment_batches enable row level security;
alter table public.carousel_experiment_assignments enable row level security;

revoke all privileges on table public.carousel_experiment_batches
  from public, anon, authenticated;
revoke all privileges on table public.carousel_experiment_assignments
  from public, anon, authenticated;
grant select, insert, update on table public.carousel_experiment_batches
  to service_role;
grant select, insert, update on table public.carousel_experiment_assignments
  to service_role;

comment on table public.carousel_experiment_batches is
  'Durable five-carousel controlled-format batches. A row is persisted before its single batch planner request is queued.';
comment on column public.carousel_experiment_batches.batch_sequence is
  'Monotonic per-business batch number. It advances when a batch is reserved, so deletes and generation failures never rewind rotation.';
comment on column public.carousel_experiment_assignments.assigned_format_id is
  'The controlled-rotation format originally attempted for this slot.';
comment on column public.carousel_experiment_assignments.actual_format_id is
  'The format actually generated and stored; may repeat another applicable format when the assigned format is not applicable.';

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

  for v_offset in v_existing_count..(p_batch_count - 1) loop
    insert into public.carousel_experiment_batches (
      business_profile_id,
      business_profile_version,
      generation_batch_id,
      batch_sequence,
      cycle_number,
      cycle_batch_position
    ) values (
      p_business_profile_id,
      p_business_profile_version,
      p_generation_batch_id,
      v_next_sequence + (v_offset - v_existing_count),
      ((v_next_sequence + (v_offset - v_existing_count)) / 3) + 1,
      (v_next_sequence + (v_offset - v_existing_count)) % 3
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
