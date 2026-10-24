import assert from "node:assert/strict";
import test from "node:test";
import { assertAnalyticsProject, checkAnalyticsStorage } from "./check-analytics-storage.mjs";

function fixture(readError = null, rpcError = null) {
  const calls = [];
  return { calls, client: {
    from(table) { calls.push(table); return { select: async (...args) => { calls.push(args); return { error: readError, count: 21 }; } }; },
    rpc: async (name, params) => { calls.push({ name, params }); return { data: false, error: rpcError }; },
  } };
}
test("release readiness fails on the missing-table production incident", async () => {
  const {client,calls} = fixture({code:"PGRST205"});
  await assert.rejects(checkAnalyticsStorage(client), /table is unavailable.*PGRST205.*migration/);
  assert.equal(calls.length,2);
});
test("readiness requires the write function as well as the table", async () => {
  await assert.rejects(checkAnalyticsStorage(fixture(null,{code:"PGRST202"}).client), /write function is unavailable/);
});
test("transport failures are not mislabeled as a missing migration", async () => {
  await assert.rejects(checkAnalyticsStorage(fixture({code:"",message:"fetch failed"}).client), /network access and server credentials/);
});
test("readiness uses a head read and a function call that cannot modify a real account", async () => {
  const {client,calls}=fixture();
  assert.deepEqual(await checkAnalyticsStorage(client),{ready:true,snapshotRows:21,accountDataChanged:false});
  assert.deepEqual(calls[1],["user_id",{head:true,count:"exact"}]);
  assert.deepEqual(calls[2].params.p_account,{});
  assert.equal(calls[2].params.p_connection_id,"00000000-0000-0000-0000-000000000000");
});
test("readiness will not silently check another project", () => {
  assert.doesNotThrow(()=>assertAnalyticsProject("https://expected.supabase.co","expected"));
  assert.throws(()=>assertAnalyticsProject("https://another.supabase.co","expected"));
  assert.throws(()=>assertAnalyticsProject("https://expected.supabase.co",undefined));
});
