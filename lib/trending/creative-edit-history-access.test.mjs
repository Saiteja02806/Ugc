import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("./creative-edits.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("access.ts", source, ts.ScriptTarget.Latest, true);
const names = ["assertEditableTrendingCreative", "assertReadableTrendingCreative", "assertTrendingCreativeAssignment"];
const code = ts.transpileModule(ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text))
  .map(node => node.getText(ast).replace(/^export /, "")).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
class AccessError extends Error { constructor(message, status) { super(message); this.status = status; } }
const rows = new Map();
const scope = { assignmentId: "assignment", creativeId: "creative", userId: "owner" };
const client = { from(table) {
  const filters = [];
  return { select() { return this; }, eq(key, value) { filters.push([key, value]); return this; },
    in(key, values) { filters.push([key, values]); return this; }, async maybeSingle() {
      const row = rows.get(table);
      return { data: row && filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value) ? row : null, error: null };
    } };
} };
const access = new Function("getClient", "TrendingCreativeEditAccessError", "getTrendingCreativeEdit", `${code}\nreturn { ${names.slice(0,2).join(",")} };`)(() => client, AccessError, async params => {
  const edit = rows.get('trending_creative_edits');
  return edit?.user_id === params.userId && edit?.creative_id === params.creativeId && edit?.format === params.format ? edit : null;
});
for (const [format, table, creativeField, states] of [
  ["carousel", "user_carousel_assignments", "carousel_id", ["pending", "in_progress", "accepted"]],
  ["wall_text", "user_wall_text_assignments", "wall_text_creative_id", ["active", "selected"]],
  ["hook_video", "user_hook_video_assignments", "hook_suggestion_id", ["active", "selected"]],
]) {
  test(`${format} history reads are owner-scoped and never enable writes to skipped assignments`, async () => {
    const row = { id: scope.assignmentId, user_id: scope.userId, [creativeField]: scope.creativeId, state: "completed_skipped" };
    rows.set(table, row);
    await access.assertReadableTrendingCreative({ ...scope, format });
    await assert.rejects(access.assertEditableTrendingCreative({ ...scope, format }), { status: 404 });
    assert.equal(row.state, "completed_skipped");
    for (const state of states) { row.state = state; await access.assertEditableTrendingCreative({ ...scope, format }); }
    row.state = "completed_skipped";
    for (const key of ["user_id", "id", creativeField, "state"]) {
      const original = row[key]; row[key] = "foreign-or-deleted";
      await assert.rejects(access.assertReadableTrendingCreative({ ...scope, format }), { status: 404 }); row[key] = original;
    }
  });
}

test('an existing owned slideshow edit can reopen in skipped/saved/scheduled history without changing assignment state', async () => {
  const row = { id: scope.assignmentId, user_id: scope.userId, carousel_id: scope.creativeId, state: 'completed_skipped' };
  rows.set('user_carousel_assignments', row);
  rows.set('trending_creative_edits', { assignment_id: scope.assignmentId, user_id: scope.userId, creative_id: scope.creativeId, format: 'carousel' });
  for (const state of ['completed_skipped','completed_saved','completed_scheduled']) {
    row.state = state; await access.assertEditableTrendingCreative({ ...scope, format: 'carousel' }); assert.equal(row.state,state);
  }
  for (const key of ['assignment_id','user_id','creative_id','format']) {
    const edit=rows.get('trending_creative_edits'),original=edit[key];edit[key]='foreign';
    await assert.rejects(access.assertEditableTrendingCreative({ ...scope, format: 'carousel' }), {status:404});edit[key]=original;
  }
  rows.delete('trending_creative_edits');
});

test("Carousel saves retain only server-owned prior output while resetting render readiness and fencing revisions", async () => {
  const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "upsertTrendingCreativeEdit");
  const saveCode = ts.transpileModule(declaration.getText(ast).replace(/^export /, ""), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let existing = { id: "edit", revision: 3, render_status: "ready",
    render_output_json: { slides: [{ renderFingerprint: "server-fingerprint", renderedUrl: "https://media.test/slide.png" }] } };
  let saved;
  const filters = [];
  const query = { update(values) { saved = values; return this; }, insert(values) { saved = values; return this; },
    eq(key, value) { filters.push([key, value]); return this; }, select() { return this; },
    async maybeSingle() { return { data: { ...saved, id: "edit" }, error: null }; } };
  const save = new Function("getClient", "getTrendingCreativeEdit", "TRENDING_CREATIVE_EDITS_TABLE", "TrendingCreativeEditAccessError",
    `${saveCode}\nreturn upsertTrendingCreativeEdit;`)(() => ({ from: () => query }), async () => existing, "trending_creative_edits", AccessError);
  const params = { ...scope, expectedRevision: 3, format: "carousel", content: { format: "carousel", slides: [] }, positions: {}, render_output_json: { forged: true } };
  const row = await save(params);
  assert.strictEqual(row.render_output_json, existing.render_output_json);
  assert.equal(row.render_status, "draft");
  assert.equal(row.render_job_id, null);
  assert.equal(row.revision, 4);
  assert.deepEqual(filters, [["id", "edit"], ["user_id", "owner"], ["revision", 3]]);
  assert.equal((await save({ ...params, format: "hook_video" })).render_output_json, null);
  existing = null;
  assert.equal((await save({ ...params, expectedRevision: 0 })).render_output_json, null);
});
