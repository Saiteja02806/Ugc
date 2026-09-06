-- The six-slide reservation function assigns an image to slide 6. The
-- original ownership constraint was still limited to slides 1 through 5,
-- causing every otherwise-valid six-slide reservation to fail at insert time.
-- Keep the constraint NOT VALID, matching its original rollout semantics:
-- existing rows are preserved while every new assigned usage is checked.
alter table public.carousel_image_usage
  drop constraint if exists carousel_image_usage_role_assignment_chk;

alter table public.carousel_image_usage
  add constraint carousel_image_usage_role_assignment_chk
  check (
    usage_type <> 'assigned'
    or (
      business_profile_id is not null
      and category_slug is not null
      and asset_role = any (array['hook', 'human', 'static', 'product_asset']::text[])
      and cycle_number > 0
      and slide_number between 1 and 6
      and carousel_id is not null
    )
  ) not valid;

notify pgrst, 'reload schema';
