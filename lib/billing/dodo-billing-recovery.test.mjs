
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

process.env.SUPABASE_URL="https://billing-fixture.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY="fixture";
process.env.DODO_PAYMENTS_API_KEY="fixture";
process.env.DODO_PAYMENTS_ENVIRONMENT="live_mode";
const local = p=>pathToFileURL(path.resolve(p)).href;
registerHooks({resolve(s,c,next){if(s==="next/server")return next("next/server.js",c);return next(s,c);}});
mock.module(local("lib/firebase/server-auth.ts"),{namedExports:{FirebaseAuthRequestError:class extends Error{},requireFirebaseUser:async()=>({uid:"fixture-user"})}});
let subscriptionStatus="on_hold", mode="accepted", outbox=null, sent=[], oldCancellation=false;
const fixture={dodo_subscription_id:"current-sub",billing_interval:"monthly",plan_key:"starter",cancel_at_period_end:false,current_period_start:new Date().toISOString(),current_period_end:new Date(Date.now()+86400000).toISOString(),last_event_at:new Date().toISOString()};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Content-Range":"*/0"}});
globalThis.fetch=async(input,init)=>{
  const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
  const method=init?.method??input.method??"GET";
  if(url.hostname==="live.dodopayments.com"){
    sent.push({method,path:url.pathname,body:init?.body?JSON.parse(init.body):null});
    if(url.pathname.includes("/customer-portal")) return response({link:"https://checkout-fixture.invalid/portal"});
    if(url.pathname.startsWith("/customers/")) return mode==="test-customer"?response({message:"not found"},404):mode==="retry"?response({message:"unavailable"},503):response({customer_id:"customer"});
    if(url.pathname==="/events/ingest") return response({ingested_count:mode==="accepted"?1:0});
    if(url.pathname.startsWith("/events/")){
      if(mode==="expired")return response({message:"not found"},404);
      return response({customer_id:mode==="mismatch"?"other":"customer",event_name:"image.generation",event_id:"event",timestamp:outbox.occurred_at,metadata:{job_id:"job"}});
    }
    throw new Error("Unexpected Dodo path "+url.pathname);
  }
  assert.equal(url.hostname,"billing-fixture.invalid","No real network calls allowed");
  const table=url.pathname.split("/").pop();
  if(table==="ensure_free_generation_credit_balance")return response({granted:2,remaining:2,reserved:0,used:0});
  if(table==="billing_usage_outbox"){
    if(method==="PATCH"){Object.assign(outbox,JSON.parse(init.body));return response(null);}
    if(url.searchParams.has("background_job_id"))return response([outbox]);
    return response(outbox&&["pending","failed"].includes(outbox.status)?[{background_job_id:"job",event_id:"event"}]:[]);
  }
  if(table==="billing_subscriptions")return response(url.searchParams.has("status")?(subscriptionStatus==="active"?[{...fixture,status:subscriptionStatus}]:[]):(oldCancellation?[{...fixture,dodo_subscription_id:"old-sub",status:"cancelled"},{...fixture,status:subscriptionStatus}]:[{...fixture,status:subscriptionStatus}]));
  if(table==="billing_customers")return response([{dodo_customer_id:"customer"}]);
  if(table==="billing_credit_balances")return response([{dodo_subscription_id:"current-sub",credit_limit:0,used_credits:0,reserved_credits:0}]);
  if(table==="subscription_entitlements")return response([{plan_key:"free",daily_trending_limit:10},{plan_key:"pro",daily_trending_limit:20}]);
  if(method==="HEAD")return new Response(null,{status:200,headers:{"Content-Range":"*/0"}});
  return response(url.pathname.includes("/rpc/")?null:[]);
};
const {getUserSubscription,deliverBillingUsageForJob,flushPendingBillingUsageEvents}=await import(local("lib/billing/subscription-db.ts"));
const {POST}=await import(local("app/api/billing/portal/route.ts"));
const fresh=()=>{outbox={attempt_count:0,credit_cost:1,dodo_customer_id:"customer",event_id:"event",generation_kind:"image",next_attempt_at:new Date(0).toISOString(),occurred_at:new Date().toISOString(),status:"pending",user_id:"fixture-user"};sent=[];};
test("held subscriber can open portal without recovering unpaid access",async()=>{
  for(const status of ["on_hold","paused","failed"]){
    subscriptionStatus=status;mode="accepted";
    const subscription=await getUserSubscription("fixture-user",{refreshCredits:false});
    assert.equal(subscription.isActive,false);
    assert.equal(subscription.isDodoManaged,true);
    assert.equal(subscription.creditsRemaining,2);
    assert.equal(subscription.freeGenerationCredits.remaining,2);
    assert.equal(subscription.sharedMonthlyCredits,0);
    const r=await POST(new Request("https://getugcpilot.com/api/billing/portal",{method:"POST"}));
    assert.equal(r.status,200);
    assert.equal((await r.json()).portalUrl,"https://checkout-fixture.invalid/portal");
  }
});
test("free account cannot open another customer's portal",async()=>{
  subscriptionStatus="free";
  const r=await POST(new Request("https://getugcpilot.com/api/billing/portal",{method:"POST"}));
  assert.equal(r.status,409);
});
test("fresh usage is acknowledged and numeric credits are sent",async()=>{
  fresh();mode="accepted";
  assert.equal(await deliverBillingUsageForJob("job"),"delivered");
  assert.equal(outbox.status,"delivered");
  assert.equal(sent.find(x=>x.path==="/events/ingest").body.events[0].metadata.credits_cost,1);
  assert.equal(await deliverBillingUsageForJob("job"),"deferred");
  assert.equal(sent.filter(x=>x.path==="/events/ingest").length,1);
});
test("duplicate usage requires matching provider event",async()=>{
  fresh();mode="duplicate";
  assert.equal(await deliverBillingUsageForJob("job"),"delivered");
  fresh();mode="mismatch";
  await assert.rejects(deliverBillingUsageForJob("job"),/acknowledge/);
  assert.equal(outbox.status,"failed");
});
test("historical usage is retained without being re-dated or ingested",async()=>{
  fresh();mode="expired";outbox.occurred_at=new Date(Date.now()-7200000).toISOString();
  const r=await flushPendingBillingUsageEvents();
  assert.equal(r.skipped,1);assert.equal(r.delivered,0);assert.equal(outbox.status,"skipped");
  assert.match(outbox.last_error,/ingestion window/);
  assert.ok(!sent.some(x=>x.path==="/events/ingest"));
  assert.equal((await flushPendingBillingUsageEvents()).inspected,0);
});
test("test customer in live mode is retained without ingestion",async()=>{
  fresh();mode="test-customer";
  assert.equal(await deliverBillingUsageForJob("job"),"skipped");
  assert.equal(outbox.status,"skipped");assert.equal(outbox.next_attempt_at,null);
  assert.ok(!sent.some(x=>x.path==="/events/ingest"));
});
test("temporary provider failure is retried and cannot appear delivered",async()=>{
  fresh();mode="retry";
  await assert.rejects(deliverBillingUsageForJob("job"));
  assert.equal(outbox.status,"failed");assert.equal(outbox.attempt_count,1);
  assert.ok(Date.parse(outbox.next_attempt_at)>Date.now());
});

test("old cancellation cannot hide the held credit owner's billing recovery",async()=>{
  oldCancellation=true;subscriptionStatus="on_hold";
  try {
    const subscription=await getUserSubscription("fixture-user",{refreshCredits:false});
    assert.equal(subscription.status,"on_hold");
    assert.equal(subscription.isDodoManaged,true);
    assert.equal(subscription.isActive,false);
  }finally{oldCancellation=false;}
});
test("already accepted historical event can recover a lost database acknowledgement",async()=>{
  fresh();mode="duplicate";outbox.occurred_at=new Date(Date.now()-7200000).toISOString();
  assert.equal(await deliverBillingUsageForJob("job"),"delivered");
  assert.ok(!sent.some(x=>x.path==="/events/ingest"));
});
