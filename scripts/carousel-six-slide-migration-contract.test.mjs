import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baselinePath = new URL(
  "../supabase/migrations/20260829093001_production_baseline_v1.sql",
  import.meta.url,
);
const migrationPath = new URL(
  "../supabase/migrations/20260905044832_expand_carousel_role_asset_reservation_to_six_slides.sql",
  import.meta.url,
);

test("six-slide reservation migration keeps queued five-slide jobs compatible", async () => {
  const [baselineRaw, migrationRaw] = await Promise.all([
    readFile(baselinePath, "utf8"),
    readFile(migrationPath, "utf8"),
  ]);
  const baseline = baselineRaw.replaceAll("\r\n", "\n");
  const migration = migrationRaw.replaceAll("\r\n", "\n");
  const functionStart = baseline.indexOf(
    "CREATE OR REPLACE FUNCTION public.reserve_carousel_role_assets_v2",
  );
  const functionEnd = baseline.indexOf(
    "GRANT EXECUTE ON FUNCTION \"public\".\"reserve_carousel_role_assets_v2\"",
    functionStart,
  );
  assert.ok(functionStart >= 0 && functionEnd > functionStart);

  const original = baseline.slice(functionStart, functionEnd);
  const planValidation = `  if p_slide_plan is null
    or jsonb_typeof(p_slide_plan) <> 'array'
    or jsonb_array_length(p_slide_plan) <> 5
  then
    raise exception 'carousel_image_slide_plan_requires_five_items';
  end if;
`;
  const roleValidation = `  if not (
    v_requested_roles = array['hook', 'human', 'static', 'human', 'static']::text[]
    or v_requested_roles = array['hook', 'static', 'human', 'static', 'human']::text[]
  ) then
    raise exception 'carousel_image_slide_role_ratio_invalid';
  end if;
`;

  assert.match(migration, /v_slide_count not in \(5, 6\)/);
  assert.match(migration, /carousel_image_slide_plan_requires_five_or_six_items/);
  assert.match(migration, /'takeaway_cta'::text/);
  assert.match(migration, /carousel_six_slide_reservation:20260905044832/);
  assert.ok(original.includes(planValidation));
  assert.ok(original.includes(roleValidation));

  const transformed = original
    .replace(
      "  select generation.user_id",
      `  if p_slide_plan is null
    or jsonb_typeof(p_slide_plan) <> 'array'
  then
    raise exception 'carousel_image_slide_plan_requires_five_or_six_items';
  end if;

  v_slide_count := jsonb_array_length(p_slide_plan);
  if v_slide_count not in (5, 6) then
    raise exception 'carousel_image_slide_plan_requires_five_or_six_items';
  end if;

  select generation.user_id`,
    )
    .replace(
      "declare",
      "declare\n  -- carousel_six_slide_reservation:20260905044832\n  v_slide_count integer;",
    )
    .replaceAll(
      "array[null, null, null, null, null]::text[]",
      "array_fill(null::text, array[v_slide_count])",
    )
    .replaceAll("v_existing_count <> 5", "v_existing_count <> v_slide_count")
    .replace(planValidation, "  -- p_slide_plan was validated before any existing reservation is returned.\n")
    .replaceAll("for v_index in 1..5", "for v_index in 1..v_slide_count")
    .replaceAll(
      "for v_index in reverse 5..1",
      "for v_index in reverse v_slide_count..1",
    )
    .replace(
      roleValidation,
      `  if not (
    (v_slide_count = 5 and (
      v_requested_roles = array['hook', 'human', 'static', 'human', 'static']::text[]
      or v_requested_roles = array['hook', 'static', 'human', 'static', 'human']::text[]
    ))
    or (v_slide_count = 6 and (
      v_requested_roles = array['hook', 'human', 'static', 'human', 'static', 'static']::text[]
      or v_requested_roles = array['hook', 'static', 'human', 'static', 'human', 'static']::text[]
    ))
  ) then
    raise exception 'carousel_image_slide_role_ratio_invalid';
  end if;
`,
    )
    .replaceAll(
      "v_asset_count < case when v_product_available then 1 else 2 end",
      "v_asset_count < case when v_product_available then v_slide_count - 4 else v_slide_count - 3 end",
    );

  assert.match(transformed, /v_slide_count not in \(5, 6\)/);
  assert.match(transformed, /v_existing_count <> v_slide_count/);
  assert.match(transformed, /for v_index in reverse v_slide_count\.\.1/);
  assert.match(
    transformed,
    /array\['hook', 'human', 'static', 'human', 'static', 'static'\]::text\[\]/,
  );
  assert.match(
    transformed,
    /array\['hook', 'static', 'human', 'static', 'human', 'static'\]::text\[\]/,
  );
});
