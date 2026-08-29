revoke all privileges on table public.category_image_assets
  from anon, authenticated;

revoke all privileges on table public.carousel_generations
  from anon, authenticated;

revoke all privileges on table public.carousel_slides
  from anon, authenticated;

grant select, insert, update on table public.category_image_assets
  to service_role;

grant select, insert, update on table public.carousel_generations
  to service_role;

grant select, insert, update on table public.carousel_slides
  to service_role;
