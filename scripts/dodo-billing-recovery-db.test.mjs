
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../supabase/migrations/20261003080500_dodo_billing_recovery.sql", import.meta.url), "utf8");
test("old cancellation preserves current credits, reservations, customer and test access", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
create table billing_webhook_events(webhook_id text primary key,event_type text,event_timestamp timestamptz,payload jsonb,status text default 'pending',processed_at timestamptz,error_message text);
create table billing_customers(user_id text primary key,dodo_customer_id text,email text,updated_at timestamptz);
create table billing_subscriptions(dodo_subscription_id text primary key,user_id text,dodo_customer_id text,product_id text,plan_key text,billing_interval text,status text,current_period_start timestamptz,current_period_end timestamptz,cancel_at_period_end boolean,cancelled_at timestamptz,last_event_at timestamptz,last_webhook_id text,metadata jsonb,updated_at timestamptz);
create table user_subscription_plans(user_id text,plan_key text,is_active boolean,source text,updated_at timestamptz);
create table billing_credit_balances(user_id text primary key,dodo_subscription_id text,plan_key text,credit_limit int,used_credits int default 0,reserved_credits int default 0,period_start timestamptz,period_end timestamptz,updated_at timestamptz);
create table billing_credit_reservations(user_id text,status text,settled_at timestamptz,updated_at timestamptz,complimentary_plan_grant_id uuid);
create table billing_usage_outbox(status text constraint billing_usage_outbox_status_check check(status in ('pending','failed','delivered')));
insert into billing_subscriptions(dodo_subscription_id,user_id,dodo_customer_id,product_id,plan_key,billing_interval,status,last_event_at) values
 ('old-sub','test-user','old-customer','old-product','starter','monthly','cancelled',now()-interval '2 days'),
 ('current-sub','test-user','current-customer','test-product','growth','monthly','active',now()-interval '1 day');
insert into billing_customers values('test-user','current-customer',null,now());
insert into user_subscription_plans values('test-user','creator',true,'billing',now());
insert into billing_credit_balances values('test-user','current-sub','growth',600,50,20,now(),now()+interval '1 month',now());
insert into billing_credit_reservations values('test-user','reserved',null,now(),null),('test-user','reserved',null,now(),'00000000-0000-0000-0000-000000000001');
`);
    await db.exec(migration);
    const apply = (id,sub,status,offset=0) => db.query(
      "select apply_dodo_subscription_event($1,$2,now()+($3::int*interval '1 second'),$4,$5,$6,$7,$8,$9,$10,$11,null,null,false,null,$12,$13) result",
      [id,`subscription.${status}`,offset,"test-user",sub==="old-sub"?"old-customer":"current-customer",null,sub,"test-product",sub==="old-sub"?"starter":"growth","monthly",status,{},{}],
    );
    const state = async()=> (await db.query("select credit_limit,used_credits,reserved_credits,dodo_subscription_id from billing_credit_balances")).rows[0];
    const before = await state();
    await apply("old-cancel","old-sub","cancelled");
    assert.deepEqual(await state(),before);
    assert.equal((await db.query("select is_active from user_subscription_plans")).rows[0].is_active,true);
    assert.equal((await db.query("select dodo_customer_id from billing_customers")).rows[0].dodo_customer_id,"current-customer");
    assert.ok((await db.query("select status from billing_credit_reservations")).rows.every(r=>r.status==="reserved"));
    assert.equal((await apply("old-cancel","old-sub","cancelled")).rows[0].result.duplicate,true);
    await apply("current-hold","current-sub","on_hold",5);
    assert.equal((await state()).credit_limit,50);
    assert.equal((await state()).reserved_credits,0);
    assert.equal((await db.query("select is_active from user_subscription_plans")).rows[0].is_active,false);
    const held = await state();
    await apply("older-active","current-sub","active",-10);
    assert.deepEqual(await state(),held);
    await apply("old-cancel-again","old-sub","cancelled",10);
    assert.deepEqual(await state(),held);
    assert.equal((await db.query("select dodo_customer_id from billing_customers")).rows[0].dodo_customer_id,"current-customer");
    await apply("current-recovered","current-sub","active",20);
    assert.equal((await state()).credit_limit,600);
    assert.equal((await db.query("select is_active from user_subscription_plans where is_active")).rows[0].is_active,true);
    assert.equal((await db.query("select status from billing_credit_reservations where complimentary_plan_grant_id is not null")).rows[0].status,"reserved");
    await db.exec("insert into billing_usage_outbox values('skipped')");
  } finally { await db.close(); }
});
