import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createGatewayRetryFetch } from "./gateway-retry-fetch.ts";

for (const head of [false, true]) {
  test(`recovers a ${head ? "HEAD usage count" : "GET asset list"} after a gateway timeout`, async () => {
    let calls = 0;
    const client = createClient("https://example.supabase.co", "test-key", {
      global: {fetch: createGatewayRetryFetch(async () => {
        calls += 1;
        return calls === 1 ? new Response(null, {status: 504})
          : new Response(head ? null : '[{"id":"asset"}]', {status: 200, headers: {"content-type":"application/json", "content-range":"0-0/1"}});
      }, async () => {})},
    });
    const result = await client.from("assets").select("id", {head, count:"exact"});
    assert.equal(result.error, null);
    assert.equal(result.count, 1);
    assert.equal(calls, 2);
    if (!head) assert.deepEqual(result.data, [{id:"asset"}]);
  });
}

test("does not replay writes, authorization failures, or built-in retry statuses", async () => {
  for (const [method, status] of [["POST",504],["PATCH",502],["DELETE",504],["GET",403],["GET",503],["GET",520]] as const) {
    let calls = 0;
    const request=createGatewayRetryFetch(async()=>{calls++;return new Response(null,{status});},async()=>{});
    assert.equal((await request("https://example.com",{method})).status,status);
    assert.equal(calls,1);
  }
});

test("persistent gateway failures remain errors after three attempts", async()=>{
  let calls=0;
  const request=createGatewayRetryFetch(async()=>{calls++;return new Response(null,{status:504});},async()=>{});
  assert.equal((await request("https://example.com")).status,504);
  assert.equal(calls,3);
});

test("cancellation during backoff prevents another request", async()=>{
  let calls=0;
  const controller=new AbortController();
  const request=createGatewayRetryFetch(async()=>{calls++;return new Response(null,{status:504});},async()=>{controller.abort();});
  await assert.rejects(request("https://example.com",{signal:controller.signal}),{name:"AbortError"});
  assert.equal(calls,1);
});
