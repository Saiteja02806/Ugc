import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createBatchNotificationHandler } from "./batch-notification-api.ts";

function request(body: unknown, origin = "https://getugcpilot.com") {
  return new Request("https://getugcpilot.com/api/resources/hook-video-bundle/notify", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}
test("anonymous explicit consent saves normalized address; duplicates return identical success", async () => {
  const emails = new Set<string>();
  const POST = createBatchNotificationHandler(async email => { emails.add(email); return "saved"; });
  for (const email of [" Founder@Example.com ", "founder@example.com"]) {
    const response = await POST(request({ email, consent: true }));
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { saved: true });
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.deepEqual([...emails], ["founder@example.com"]);
});
test("rejects invalid consent, addresses, malformed/oversized body and cross-origin without saving", async () => {
  let saves = 0;
  const POST = createBatchNotificationHandler(async () => { saves++; return "saved"; });
  for (const body of [{email:"a@example.com",consent:false},{email:"bad",consent:true}, {email:"x\r\n@example.com",consent:true}, {email:"x@y..com",consent:true}, {email:"x@-example.com",consent:true}, {email:"a".repeat(65)+"@example.com",consent:true}, null, "x", {email:"a@example.com",consent:true,extra:"x".repeat(2100)}]) assert.equal((await POST(request(body))).status,400);
  assert.equal((await POST(request({email:"a@example.com",consent:true},"https://evil.example"))).status,403);
  const malformed = new Request("https://getugcpilot.com/api/resources/hook-video-bundle/notify",{method:"POST",headers:{origin:"https://getugcpilot.com","content-type":"application/json"},body:"{bad"});
  assert.equal((await POST(malformed)).status,400); assert.equal(saves,0);
});
test("rate limit and storage failure have no false success or PII/provider error exposure", async () => {
  const body = {email:"founder@example.com",consent:true};
  const limited = await createBatchNotificationHandler(async()=>"limited")(request(body));
  assert.equal(limited.status,429);
  const failed = await createBatchNotificationHandler(async()=>{throw new Error("secret founder@example.com")})(request(body));
  assert.equal(failed.status,503); assert.doesNotMatch(await failed.text(),/secret|founder@example/);
  let saves=0;
  const bot=await createBatchNotificationHandler(async()=>{saves++;return "saved"})(request({...body,website:"bot"}));
  assert.equal(bot.status,200);assert.equal(saves,0);
});
test("migration enforces private durable deduplication and purpose-limited consent", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(readFileSync(new URL("../../supabase/migrations/20261026213000_resource_batch_notifications.sql", import.meta.url),"utf8"));
    await db.exec("set role service_role; insert into public.resource_batch_notifications(batch,email,consent_version) values ('hook-videos-2','founder@example.com','batch-2-only-v1') on conflict(batch,email) do nothing;");
    await db.exec("insert into public.resource_batch_notifications(batch,email,consent_version) values ('hook-videos-2','founder@example.com','batch-2-only-v1') on conflict(batch,email) do nothing;");
    assert.equal((await db.query<{count:number}>("select count(*)::int as count from public.resource_batch_notifications")).rows[0].count,1);
    await assert.rejects(db.exec("insert into public.resource_batch_notifications values ('marketing','other@example.com','batch-2-only-v1',now())"));
    await assert.rejects(db.exec("insert into public.resource_batch_notifications values ('hook-videos-2','other@example.com','all-marketing',now())"));
    for (const role of ["anon","authenticated"]) {
      await db.exec(`reset role; set role ${role};`);
      await assert.rejects(db.query("select * from public.resource_batch_notifications"));
      await assert.rejects(db.exec("insert into public.resource_batch_notifications values ('hook-videos-2','intruder@example.com','batch-2-only-v1',now())"));
    }
    await db.exec("reset role; set role service_role; delete from public.resource_batch_notifications where email='founder@example.com';");
    assert.equal((await db.query<{count:number}>("select count(*)::int as count from public.resource_batch_notifications")).rows[0].count,0);
  } finally { await db.close(); }
});
