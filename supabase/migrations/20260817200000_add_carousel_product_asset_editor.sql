-- Keep shared role-library deduplication global, while allowing the same
-- customer-owned screenshot to exist independently for different businesses.
drop index if exists public.category_image_assets_role_source_hash_uidx;

create unique index category_image_assets_role_source_hash_uidx
  on public.category_image_assets (source_file_sha256)
  where library_asset_id is not null
    and source_file_sha256 is not null
    and owner_business_profile_id is null;

create unique index if not exists category_image_assets_product_owner_hash_uidx
  on public.category_image_assets (
    owner_business_profile_id,
    category_slug,
    source_file_sha256
  )
  where asset_role = 'product_asset'
    and is_active
    and source_file_sha256 is not null;

comment on index public.category_image_assets_product_owner_hash_uidx is
  'Prevents duplicate active product screenshots inside one business category without coupling separate customer libraries.';

notify pgrst, 'reload schema';
