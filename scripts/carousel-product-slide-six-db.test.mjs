import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("the actual migration permits eligible screenshot slide 6 and retains existing metadata restrictions", async () => {
  const db = new PGlite();
  try {
    const baseline = readFileSync(new URL("../supabase/migrations/20260829093001_production_baseline_v1.sql", import.meta.url), "utf8");
    const predicate = baseline.match(/CONSTRAINT "carousel_slides_structure_2_metadata_check"\s+(CHECK[\s\S]+?),\s+CONSTRAINT/)[1];
    await db.exec(`create table public.carousel_slides (
      structure_id text, story_format_id text, story_role text, story_layout_variant text,
      story_text_treatment text, visual_role text, product_visual_eligibility text, slide_number integer,
      constraint carousel_slides_structure_2_metadata_check ${predicate});`);
    const insert = (number, eligibility = "preferred", role = "product_asset") => db.query(
      "insert into carousel_slides values ('structure_2','wrong_belief','takeaway_cta','story_product_reveal','overlay',$1,$2,$3)", [role, eligibility, number]);
    await insert(4); await insert(5);
    await assert.rejects(insert(6), /carousel_slides_structure_2_metadata_check/);
    const migration = readFileSync(new URL("../supabase/migrations/20261009202401_align_six_slide_product_screenshot_metadata.sql", import.meta.url), "utf8");
    await db.exec(migration);
    await insert(6); await insert(6, "allowed");
    for (const number of [1, 2, 3, 7]) await assert.rejects(insert(number), /metadata_check/);
    await assert.rejects(insert(6, "forbidden"), /metadata_check/);
    await assert.rejects(db.exec("insert into carousel_slides values ('structure_2',null,'takeaway_cta','story_product_reveal','overlay','product_asset','preferred',6)"), /metadata_check/);
    await assert.rejects(db.exec("insert into carousel_slides values ('structure_1','unexpected',null,null,null,null,null,1)"), /metadata_check/);
    await db.exec("insert into carousel_slides values ('structure_1',null,null,null,null,null,null,1)");
    await db.exec(migration);
    assert.equal((await db.query("select convalidated from pg_constraint where conname='carousel_slides_structure_2_metadata_check'")).rows[0].convalidated, true);
    assert.equal((await db.query("select count(*)::int as count from carousel_slides")).rows[0].count, 5);
  } finally { await db.close(); }
});
