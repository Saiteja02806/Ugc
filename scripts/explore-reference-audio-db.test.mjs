import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import catalog from "../worker/src/lib/explore-paired-reference-catalog.json" with { type: "json" };

const migration = readFileSync(new URL("../supabase/migrations/20261010160317_explore_reference_audio_pairing.sql", import.meta.url), "utf8");
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function database(t) {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated;
    create table public.background_jobs(id uuid primary key,user_id text,input_json jsonb);
    create table public.media_assets(id uuid primary key,user_id text,source_type text,source_record_id text,metadata jsonb);`);
  await db.exec(migration);
  await db.exec("create trigger explore_tag_generated_media before insert or update on public.media_assets for each row execute function public.explore_tag_generated_media()");
  let sequence = 1;
  return { db, async save(input, { jobOwner = "owner-a", assetOwner = "owner-a", sourceType = "generated_video" } = {}) {
    const job = id(sequence++), asset = id(sequence++);
    await db.query("insert into background_jobs values($1,$2,$3::jsonb)", [job, jobOwner, JSON.stringify(input)]);
    return (await db.query("insert into media_assets values($1,$2,$3,$4,'{\"retained\":true}') returning metadata", [asset, assetOwner, sourceType, job])).rows[0].metadata;
  } };
}

test("pair identity survives generated-media saving for both formats and legacy Explore requests", async t => {
  const f = await database(t);
  for (const format of ["hook", "wall_text"]) {
    const reference = catalog.items.find(item => item.format === format);
    const input = { exploreFormat: format, referenceType: format, referenceId: reference.id,
      referenceSoundtrack: { version: 1, referenceId: reference.id, audioSha256: reference.audioSha256, volume: .2 } };
    assert.deepEqual(await f.save(input), { retained: true, exploreFormat: format, exploreReferenceId: reference.id });
    delete input.exploreFormat;
    assert.deepEqual(await f.save(input), { retained: true, exploreFormat: format, exploreReferenceId: reference.id });
    for (const referenceSoundtrack of [{ ...input.referenceSoundtrack, version: 2 }, { ...input.referenceSoundtrack, referenceId: "another" }, { ...input.referenceSoundtrack, audioSha256: "invalid" }]) {
      const metadata = await f.save({ ...input, exploreFormat: format, referenceSoundtrack });
      assert.equal(metadata.exploreFormat, format); assert.equal(metadata.exploreReferenceId, undefined);
    }
    assert.deepEqual(await f.save(input, { assetOwner: "owner-b" }), { retained: true });
    assert.equal((await f.save({ ...input, exploreFormat: format, referenceType: "other" })).exploreReferenceId, undefined);
  }
  assert.equal((await f.db.query("select has_function_privilege('authenticated','public.explore_tag_generated_media()','execute') allowed")).rows[0].allowed, false);
});

test("existing Explore tags, ordinary Studio media and unrelated sources keep their behavior", async t => {
  const f = await database(t);
  assert.deepEqual(await f.save({ exploreFormat: "hook" }), { retained: true, exploreFormat: "hook" });
  assert.deepEqual(await f.save({ exploreFormat: "slideshow" }, { sourceType: "generated_image" }), { retained: true, exploreFormat: "slideshow" });
  assert.deepEqual(await f.save({}), { retained: true });
  assert.deepEqual(await f.save({ exploreFormat: "hook" }, { sourceType: "upload" }), { retained: true });
});
