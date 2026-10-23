import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { ReadDeadlineError, withReadDeadline } from "../lib/http/read-deadline.ts";

const settle = () => new Promise(setImmediate);
function fixture(kind, token, transport) {
  let options;
  const exports = {}, owners = [], calls = [];
  const file = kind === "trending" ? "lib/trending/feed-read-client.ts" : kind === "billing"
    ? "components/billing/use-billing-subscription.ts" : "components/generation/use-ai-studio-access.ts";
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, fetch: (url, init) => { calls.push({ url, init }); return transport(url, init); }, require(name) {
    if (name === "@/lib/http/read-deadline") return { withReadDeadline };
    if (name === "@/lib/firebase/auth") return { getCurrentUserIdToken: owner => { owners.push(owner); return token(owner); } };
    if (name === "@/contexts/auth-context") return { useAuth: () => ({ user: { uid: "owner-a" }, loading: false }) };
    if (name === "@tanstack/react-query") return { useQuery: value => { options = value; return value; } };
    if (name === "@/lib/billing/activation-state") return { shouldPollForSubscriptionActivation: () => false };
    throw Error(`Unexpected import ${name}`);
  } });
  if (kind === "billing") exports.useBillingSubscription();
  if (kind === "access") exports.useAIStudioAccess();
  return { owners, calls, read: signal => kind === "trending"
    ? exports.readTrendingFeed("owner-a", new URLSearchParams({ timezone: "Asia/Calcutta" }), signal)
    : options.queryFn({ signal }) };
}

for (const kind of ["trending", "billing", "access"]) {
  test(`${kind}: token timeout/cancellation releases the read and blocks late fetches`, async t => {
    for (const timeout of [true, false]) {
      const abort = new AbortController();
      if (timeout) t.mock.method(AbortSignal, "timeout", ms => { assert.equal(ms, 20_000); return abort.signal; });
      let finish;
      const h = fixture(kind, () => new Promise(resolve => { finish = resolve; }), async () => Response.json({}));
      const pending = h.read(timeout ? new AbortController().signal : abort.signal);
      abort.abort();
      await assert.rejects(pending, timeout ? error => error instanceof ReadDeadlineError : { name: "AbortError" });
      finish("late-token"); await settle();
      assert.equal(h.calls.length, 0);
      assert.deepEqual(h.owners, ["owner-a"]);
      t.mock.restoreAll();
    }
  });

  test(`${kind}: stalled headers and response bodies share the deadline; next read recovers`, async t => {
    for (const phase of ["headers", "body"]) {
      const abort = new AbortController();
      t.mock.method(AbortSignal, "timeout", () => abort.signal);
      let ready;
      const started = new Promise(resolve => { ready = resolve; });
      let fail = true;
      const h = fixture(kind, async () => "token", async () => {
        if (!fail) return Response.json({ ok: true, isPro: true, subscription: { userId: "owner-a" } });
        if (phase === "headers") { ready(); return new Promise(() => {}); }
        return { ok: true, json: () => { ready(); return new Promise(() => {}); } };
      });
      const pending = h.read(new AbortController().signal);
      await started; abort.abort();
      await assert.rejects(pending, error => error instanceof ReadDeadlineError);
      assert.equal(h.calls[0].init.signal.aborted, true);
      t.mock.restoreAll(); fail = false;
      const recovered = await h.read(new AbortController().signal);
      assert.ok(recovered);
      assert.equal(h.calls.length, 2);
    }
  });

  test(`${kind}: account switch cannot issue a request using the wrong token`, async () => {
    const h = fixture(kind, async () => { throw Error("Account changed"); }, async () => Response.json({}));
    await assert.rejects(h.read(new AbortController().signal), /Account changed/);
    assert.equal(h.calls.length, 0);
  });
}
