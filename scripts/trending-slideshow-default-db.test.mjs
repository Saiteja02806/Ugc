import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("Structure 2 defaults preserve saved mixes and allow subsequent user changes", async () => {
  const db = new PGlite();
  const tables = ["trending_content_mix_preferences", "daily_trending_feeds", "daily_carousel_feeds"];
  try {
    for (const table of tables) {
      await db.exec(`create table public.${table} (
        id integer primary key,
        helpful_tips_percent integer not null default 50,
        product_stories_cta_percent integer not null default 50,
        check (helpful_tips_percent + product_stories_cta_percent = 100)
      );
      insert into public.${table}(id) values (1);
      insert into public.${table} values (2, 80, 20);`);
    }
    await db.exec(await readFile(new URL("../supabase/migrations/20261021131000_default_trending_slideshows_to_structure_2.sql", import.meta.url), "utf8"));
    for (const table of tables) {
      await db.exec(`insert into public.${table}(id) values (3)`);
      assert.deepEqual((await db.query(`select * from public.${table} order by id`)).rows, [
        { id: 1, helpful_tips_percent: 50, product_stories_cta_percent: 50 },
        { id: 2, helpful_tips_percent: 80, product_stories_cta_percent: 20 },
        { id: 3, helpful_tips_percent: 0, product_stories_cta_percent: 100 },
      ]);
    }
    await db.exec("update public.trending_content_mix_preferences set helpful_tips_percent=30, product_stories_cta_percent=70 where id=3");
    assert.deepEqual((await db.query("select helpful_tips_percent,product_stories_cta_percent from public.trending_content_mix_preferences where id=3")).rows,
      [{ helpful_tips_percent: 30, product_stories_cta_percent: 70 }]);
  } finally {
    await db.close();
  }
});
