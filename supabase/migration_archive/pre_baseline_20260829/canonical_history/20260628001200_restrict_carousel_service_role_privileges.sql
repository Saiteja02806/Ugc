revoke all privileges on table public.category_image_assets
  from service_role;

revoke all privileges on table public.carousel_generations
  from service_role;

revoke all privileges on table public.carousel_slides
  from service_role;

grant select, insert, update on table public.category_image_assets
  to service_role;

grant select, insert, update on table public.carousel_generations
  to service_role;

grant select, insert, update on table public.carousel_slides
  to service_role;
