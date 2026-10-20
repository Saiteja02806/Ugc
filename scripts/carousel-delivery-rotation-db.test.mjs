import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, after, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20261011095743_carousel_delivery_aware_image_rotation.sql');
const profile = '10000000-0000-4000-8000-000000000001';
const uuid = (group, n) => `${group}0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const roles = ['hook','human','static','human','static','static'];
const plan = roles.map((role,i)=>({slide_number:i+1,asset_role:role,category_slug:'productivity',selection_type:'primary',relevance_level:'none',relevance_reason:null}));
let db;
before(async()=>{
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table carousel_generations(id uuid primary key,user_id text,business_profile_id uuid,business_profile_version integer,status text,created_at timestamptz default now(),available_on_local_date date);
    create table category_image_assets(id uuid primary key,category_slug text,asset_role text,owner_business_profile_id uuid,library_asset_id text,is_active boolean,status text,subject_review_status text,runtime_exclusion_reason text,source_file_sha256 text,base_s3_key text,base_url text,source_metadata jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now(),usage_count integer default 0);
    create table carousel_image_usage(id uuid primary key default gen_random_uuid(),user_id text,business_profile_id uuid,asset_id uuid,duplicate_family_id text,carousel_id uuid,category_slug text,requested_category_slug text,primary_category_slug text,asset_role text,selection_type text,relevance_level text,relevance_reason text,cycle_number integer,slide_number integer,usage_type text,reuse_reason text);
    create unique index carousel_image_usage_cycle_asset_uidx on carousel_image_usage(business_profile_id,category_slug,asset_role,cycle_number,asset_id) where usage_type='assigned';
    create unique index carousel_image_usage_carousel_slide_uidx on carousel_image_usage(carousel_id,slide_number) where usage_type='assigned';
    create table carousel_image_rotation_pools(business_profile_id uuid,category_slug text,asset_role text,cycle_number integer default 1,last_asset_id uuid,updated_at timestamptz default now(),primary key(business_profile_id,category_slug,asset_role));
    create table user_carousel_assignments(id uuid primary key,carousel_id uuid unique,first_assigned_at timestamptz default now());
    create table daily_carousel_feed_items(assignment_id uuid);
    create table daily_trending_feed_slots(carousel_assignment_id uuid);
  `);
  await db.exec(migration);
});
after(async()=>{await db.close();});
async function fixture(counts={hook:4,human:8,static:12}) {
  let n=0;
  for(const [role,count] of Object.entries(counts))for(let i=0;i<count;i++){
    n++;
    await db.query(`insert into category_image_assets(id,category_slug,asset_role,library_asset_id,is_active,status,subject_review_status,source_file_sha256,base_s3_key,base_url) values($1,'productivity',$2,$3,true,'ready','approved',$3,$3,$3)`,[uuid('3',n),role,'asset-'+n]);
  }
}
async function reserve(n,date='2026-10-11') {
  const id=uuid('2',n);
  await db.query(`insert into carousel_generations(id,user_id,business_profile_id,business_profile_version,status,available_on_local_date) values($1,'fixture-user',$2,1,'processing',$3) on conflict do nothing`,[id,profile,date]);
  return (await db.query(`select * from reserve_carousel_role_assets_v2($1,$2,'productivity',$3,false)`,[profile,id,JSON.stringify(plan)])).rows;
}
async function deliver(n) {
  await db.query(`update carousel_generations set status='completed' where id=$1`,[uuid('2',n)]);
  await db.query(`insert into user_carousel_assignments(id,carousel_id) values($1,$2)`,[uuid('4',n),uuid('2',n)]);
  await db.query(`insert into daily_trending_feed_slots values($1)`,[uuid('4',n)]);
}
async function isolated(run){await db.exec('begin');try{await run();}finally{await db.exec('rollback');}}

test('failed-only images are recovered without deleting reservations, with retry stability',()=>isolated(async()=>{
  await fixture({hook:1,human:2,static:3});
  const failed=await reserve(1);
  await db.query(`update carousel_generations set status='failed' where id=$1`,[uuid('2',1)]);
  const successor=await reserve(2);
  assert.deepEqual(successor.map(r=>r.asset_id),failed.map(r=>r.asset_id));
  assert(successor.every(r=>r.cycle_number===2));
  assert.equal((await db.query('select count(*)::int as n from carousel_image_usage')).rows[0].n,12);
  assert.deepEqual(await reserve(2),successor);
}));

test('fresh inventory remains distinct across four carousels in one daily pack',()=>isolated(async()=>{
  await fixture();
  const chosen=[];
  for(let i=1;i<=4;i++){const rows=await reserve(i);chosen.push(...rows.map(r=>r.asset_id));await deliver(i);}
  assert.equal(chosen.length,24);assert.equal(new Set(chosen).size,24);
}));

test('a cycle boundary avoids already delivered images from this day when alternatives exist',()=>isolated(async()=>{
  await fixture();
  for(let i=1;i<=4;i++){await reserve(i,'2026-10-10');await deliver(i);}
  const first=await reserve(5);await deliver(5);
  const next=await reserve(6);
  assert(!next.some(row=>first.some(old=>old.asset_id===row.asset_id)));
}));

test('outstanding inventory is protected ahead of terminal-failed reservations',()=>isolated(async()=>{
  await fixture({hook:2,human:4,static:6});
  const pending=await reserve(1);
  const failed=await reserve(2);await db.query(`update carousel_generations set status='failed' where id=$1`,[uuid('2',2)]);
  const successor=await reserve(3);
  assert(!successor.some(r=>pending.some(p=>p.asset_id===r.asset_id)));
  assert(successor.every(r=>failed.some(f=>f.asset_id===r.asset_id)));
}));

test('small pools degrade to bounded reuse without duplicate slides or generation failure',()=>isolated(async()=>{
  await fixture({hook:1,human:2,static:3});
  await reserve(1);await deliver(1);
  const next=await reserve(2);assert.equal(new Set(next.map(r=>r.asset_id)).size,6);
}));

test('a reviewed category alias retains canonical identity and returns reservation category',()=>isolated(async()=>{
  await fixture({hook:1,human:2,static:3});
  await db.query(`update category_image_assets set category_slug='gym',source_metadata='{"reviewedRoleCategories":["gym","productivity"]}' where asset_role='hook'`);
  const rows=await reserve(1);
  assert.equal(rows[0].category_slug,'productivity');assert.equal(rows[0].asset_id,uuid('3',1));
  assert.deepEqual(await reserve(1),rows);
}));

test('archived sources stay blocked on fresh selection and reservation replay',()=>isolated(async()=>{
  await fixture();const selected=await reserve(1);
  await db.query(`update category_image_assets set is_active=false,status='archived',runtime_exclusion_reason='user_requested_retirement' where id=$1`,[selected[0].asset_id]);
  await assert.rejects(reserve(1),/carousel_image_reserved_source_retired/);
}));

test('new profiles receive deterministic diverse starting hooks rather than one newest hook',()=>isolated(async()=>{
  await fixture();const hooks=[];
  for(let n=1;n<=8;n++){
    const p=uuid('1',n);const id=uuid('2',n);
    await db.query(`insert into carousel_generations(id,user_id,business_profile_id,business_profile_version,status,available_on_local_date) values($1,'fixture-user',$2,1,'processing','2026-10-11')`,[id,p]);
    const rows=(await db.query(`select * from reserve_carousel_role_assets_v2($1,$2,'productivity',$3,false)`,[p,id,JSON.stringify(plan)])).rows;
    hooks.push(rows[0].asset_id);
  }
  assert(new Set(hooks).size>1);
}));
