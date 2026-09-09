import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrations = new URL("../supabase/migrations/", import.meta.url);
const currentMigration = "20260908172213_apply_wall_text_b_52px_typography_v13.sql";

test("B migration preserves stored typography and only admits the approved new contract", { timeout: 60_000 }, async () => {
  const db = new PGlite();
  try {
    // Execute the actual baseline CHECK and every subsequent typography migration.
    // Other production tables are unnecessary to exercise this constraint.
    const baseline = await readFile(new URL("20260829093001_production_baseline_v1.sql", migrations), "utf8");
    const constraint = baseline.match(/CONSTRAINT "wall_text_creatives_text_content_chk"\s+(CHECK[\s\S]+?),\s+CONSTRAINT "wall_text_creatives_user_id_check"/);
    assert.ok(constraint, "Baseline content constraint must be available");
    await db.exec(`create table public.wall_text_creatives (
      id integer generated always as identity primary key,
      generator_version text not null default 'business-profile-wall-text-v9',
      text_content jsonb not null,
      constraint wall_text_creatives_text_content_chk ${constraint[1]}
    )`);
    for (const file of (await readdir(migrations)).filter((f) => f.endsWith(".sql") && f > "20260829093001" && f < currentMigration).sort()) {
      if (file.includes("production_baseline")) continue;
      const sql = await readFile(new URL(file, migrations), "utf8");
      if (sql.includes("wall_text_creatives_text_content_chk")) await db.exec(sql);
    }
    const lines = [
      "Scoop after scoop", "from a family casserole", "leaves you guessing portions,",
      "but a quick photo with", "Cal AI's depth sensor gives", "a volume-based calorie and",
      "nutrient estimate that restores", "confidence in your tracking.",
    ];
    const current = {
      kind: "wall_text", layoutVersion: "wall-text-overlay-v13", formatId: "freeform",
      fullText: lines.join(" "), sourceContent: { kind: "text", text: lines.join(" ") },
      finalLayout: {
        version: "wall-text-final-layout-v9", fontFamily: "Arial", fontWeight: 700,
        fontSizePx: 52, lineHeightPx: 57.2,
        textBox: { x: 150 / 1080, y: 800 / 1920, width: 780 / 1080, height: 480 / 1920 },
        blocks: [{ role: "text", lines }],
      },
    };
    const previous = structuredClone(current);
    previous.layoutVersion = "wall-text-overlay-v12";
    Object.assign(previous.finalLayout, { version: "wall-text-final-layout-v8", fontSizePx: 44, lineHeightPx: 48.4 });
    const insert = (content) => db.query("insert into wall_text_creatives(text_content) values ($1) returning text_content, generator_version", [content]);
    await insert(previous);
    await assert.rejects(insert(current), { code: "23514" });
    await db.exec(await readFile(new URL(currentMigration, migrations), "utf8"));
    assert.deepEqual((await db.query("select text_content from wall_text_creatives where id = 1")).rows[0].text_content, previous);
    const result = (await insert(current)).rows[0];
    assert.deepEqual(result.text_content, current);
    assert.equal(result.generator_version, "business-profile-wall-text-v9");
    await insert(previous); // Older app instances can still write during rollout.
    for (const [field, value] of [["fontSizePx", 44], ["fontSizePx", 48], ["fontWeight", 400], ["fontFamily", "Inter"]]) {
      const invalid = structuredClone(current);
      invalid.finalLayout[field] = value;
      await assert.rejects(insert(invalid), { code: "23514" }, `${field}=${value} must not be stored as B`);
    }
    for (const count of [4, 9]) {
      const invalid = structuredClone(current);
      invalid.finalLayout.blocks[0].lines = Array.from({ length: count }, () => "Some example words");
      await assert.rejects(insert(invalid), { code: "23514" });
    }
  } finally {
    await db.close();
  }
});
