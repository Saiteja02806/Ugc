import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Execute the real UI handler without a website build. Only auth, HTTP and
// React state setters are replaced; Response parsing is the platform's own.
const source = readFileSync(new URL("../components/scheduling/scheduling-workspace.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function declaration(name) {
  let found;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, `${name} must exist`);
  return found.getText(ast);
}
const code = ts.transpileModule([
  declaration("handleConfirmScheduleCancellation"),
  declaration("getApiResponseMessage"),
  declaration("getErrorMessage"),
].join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const postId = "00000000-0000-4000-8000-000000000001";

function fixture(response, token = "owner-token", selection = { id: postId }) {
  const state = { stored: [], errors: [], notices: [], pending: [], busy: [], requests: [], refreshes: [] };
  const dependencies = {
    schedulePendingCancellation: selection,
    getCurrentUserIdToken: async () => token,
    fetch: async (url, init) => {
      state.requests.push({ url, init });
      if (response instanceof Error) throw response;
      return response;
    },
    setCancellingScheduleId: value => state.busy.push(value),
    setCancelScheduleError: value => state.errors.push(value),
    setActionNotice: value => state.notices.push(value),
    setSchedulePendingCancellation: value => state.pending.push(value),
    storeServerSchedule: value => state.stored.push(value),
    loadSchedules: async options => { state.refreshes.push(options); },
  };
  const run = new Function(...Object.keys(dependencies), `${code}\nreturn handleConfirmScheduleCancellation;`)(...Object.values(dependencies));
  return { run, state };
}
function assertUnconfirmed(state) {
  assert.equal(state.stored.length, 0, "Never store an unconfirmed cancellation");
  assert.deepEqual(state.pending, [], "Keep the existing dialog open");
  assert.ok(state.errors.at(-1), "Show the reason in the existing dialog");
  assert.doesNotMatch(state.errors.at(-1), /JSON|Unexpected|Cannot read/);
  assert.deepEqual(state.refreshes, [{ force: true }]);
  assert.deepEqual(state.busy, [postId, null]);
  assert.ok(state.notices.every(value => value === null));
}

for (const [name, body, status] of [
  ["empty server failure", "", 500],
  ["HTML gateway failure", "<html>Gateway error</html>", 502],
  ["empty success", "", 200],
  ["empty no-content response", null, 204],
  ["truncated success JSON", '{"ok":true,', 200],
]) {
  test(`${name} remains unconfirmed with readable feedback and a refresh`, async () => {
    const { run, state } = fixture(new Response(body, { status }));
    await run();
    assertUnconfirmed(state);
    assert.match(state.errors.at(-1), /confirm|cancel/i);
    assert.equal(state.requests.length, 1, "Never automatically repeat DELETE");
    assert.equal(state.requests[0].url, `/api/schedules/${postId}`);
    assert.equal(state.requests[0].init.method, "DELETE");
    assert.equal(state.requests[0].init.headers.Authorization, "Bearer owner-token");
    assert.ok(state.requests[0].init.signal instanceof AbortSignal);
  });
}

for (const schedule of [undefined, { id: "another-post", status: "cancelled" }, { id: postId, status: "scheduled" }, { id: postId, status: "published" }]) {
  test(`HTTP 200 cannot confirm the wrong or absent cancelled receipt: ${JSON.stringify(schedule)}`, async () => {
    const { run, state } = fixture(Response.json({ ok: true, schedule }));
    await run();
    assertUnconfirmed(state);
  });
}

test("the exact cancelled receipt closes the dialog and refreshes durable state", async () => {
  const schedule = { id: postId, status: "cancelled" };
  const { run, state } = fixture(Response.json({ ok: true, schedule }));
  await run();
  assert.deepEqual(state.stored, [schedule]);
  assert.deepEqual(state.pending, [null]);
  assert.equal(state.errors.at(-1), null);
  assert.match(state.notices.at(-1), /Schedule cancelled/);
  assert.deepEqual(state.refreshes, [{ force: true }]);
});

test("a publish claim conflict preserves the authoritative server reason", async () => {
  const message = "Publishing has already started, so this post can no longer be cancelled.";
  const { run, state } = fixture(Response.json({ ok: false, code: "schedule_publish_started", message }, { status: 409 }));
  await run();
  assertUnconfirmed(state);
  assert.equal(state.errors.at(-1), message);
});

test("timeout never claims cancellation and never repeats the mutation", async () => {
  const { run, state } = fixture(new DOMException("deadline", "TimeoutError"));
  await run();
  assertUnconfirmed(state);
  assert.match(state.errors.at(-1), /not confirmed/);
  assert.equal(state.requests.length, 1);
});

test("missing sign-in sends no cancellation request", async () => {
  const { run, state } = fixture(Response.json({ ok: true }), null);
  await run();
  assertUnconfirmed(state);
  assert.equal(state.requests.length, 0);
  assert.match(state.errors.at(-1), /Sign in/);
});

test("a cleared selection sends no request or success feedback", async () => {
  const { run, state } = fixture(Response.json({ ok: true }), "owner-token", null);
  await run();
  assert.deepEqual(state.requests, []);
  assert.deepEqual(state.busy, []);
  assert.deepEqual(state.notices, []);
});

test("switching from post A to B cancels only the selected B", async () => {
  const id = "00000000-0000-4000-8000-000000000002";
  const schedule = { id, status: "cancelled" };
  const { run, state } = fixture(Response.json({ ok: true, schedule }), "owner-token", { id });
  await run();
  assert.equal(state.requests.length, 1);
  assert.equal(state.requests[0].url, `/api/schedules/${id}`);
  assert.deepEqual(state.stored, [schedule]);
});
