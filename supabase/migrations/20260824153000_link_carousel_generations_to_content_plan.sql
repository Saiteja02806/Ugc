alter table public.carousel_generations
  add column if not exists content_plan_id uuid
    references public.carousel_content_plans(id) on delete no action,
  add column if not exists content_plan_item_id uuid
    references public.carousel_content_plan_items(id) on delete no action,
  add column if not exists content_plan_reservation_id uuid
    references public.carousel_content_plan_reservations(id) on delete no action;

create unique index if not exists carousel_content_plan_items_provenance_uidx
  on public.carousel_content_plan_items (id, plan_id, user_id);

create unique index if not exists carousel_content_plan_reservations_provenance_uidx
  on public.carousel_content_plan_reservations (id, plan_id, user_id);

alter table public.carousel_generations
  add constraint carousel_generations_content_plan_owner_fk
    foreign key (content_plan_id, user_id)
    references public.carousel_content_plans (id, user_id)
    on delete no action,
  add constraint carousel_generations_content_plan_item_provenance_fk
    foreign key (content_plan_item_id, content_plan_id, user_id)
    references public.carousel_content_plan_items (id, plan_id, user_id)
    on delete no action,
  add constraint carousel_generations_content_plan_reservation_provenance_fk
    foreign key (content_plan_reservation_id, content_plan_id, user_id)
    references public.carousel_content_plan_reservations (id, plan_id, user_id)
    on delete no action;

alter table public.carousel_generations
  drop constraint if exists carousel_generations_content_plan_provenance_check,
  add constraint carousel_generations_content_plan_provenance_check
  check (
    (
      content_plan_id is null
      and content_plan_item_id is null
      and content_plan_reservation_id is null
    )
    or
    (
      content_plan_id is not null
      and content_plan_item_id is not null
      and content_plan_reservation_id is not null
      and generation_source = 'auto_generated'
    )
  );

create index if not exists carousel_generations_content_plan_item_idx
  on public.carousel_generations (
    content_plan_item_id,
    created_at desc
  )
  where content_plan_item_id is not null;

create index if not exists carousel_generations_content_plan_reservation_idx
  on public.carousel_generations (
    content_plan_reservation_id,
    status,
    created_at desc
  )
  where content_plan_reservation_id is not null;

comment on column public.carousel_generations.content_plan_item_id is
  'Creative seed/emotion provenance. Failed attempts may share an item; the plan item consumed_by_carousel_generation_id remains the unique successful consumer.';

select pg_notify('pgrst', 'reload schema');
