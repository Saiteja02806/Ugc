import assert from "node:assert/strict";
import { mock, test, beforeEach } from "node:test";

let connections, rows, active, dispatches, dispatchFails, legacyReads;
const now = Date.now();
const connection = { id: "channel", authorizationRevision: "consent-1", connectedAt: new Date(now-86400000).toISOString(), status: "connected", platform: "youtube" };
const account = { connectionId: "channel", status: "ready", lastSyncedAt: new Date(now-600000).toISOString(), videos: [{ viewCount: 0 }] };
const savedRow = { social_connection_id: "channel", authorization_revision: "consent-1", snapshot_json: account, last_success_at: account.lastSyncedAt, attempted_at: account.lastSyncedAt, refresh_status: "ready", refresh_message: null };
mock.module("../jobs/background-jobs.ts", { namedExports: {
  listBackgroundJobsForUser: async params => {
    assert.equal(params.userId,"owner");
    return params.activeOnly ? active : [];
  },
} });
mock.module("../jobs/background-job-contract.ts", { namedExports: { getPublicBackgroundJob: job => job } });
mock.module("../social/oauth.ts", { namedExports: { listSocialConnections: async()=>connections } });
mock.module("./instagram-snapshots.ts", { namedExports: {
  getInstagramAccountInsightsSnapshotForOwner:async()=>{legacyReads++;return {accounts:[],needsRefresh:true}},
  getInstagramContentSnapshotForOwner:async()=>{legacyReads++;return {accounts:[],needsRefresh:true}},
} });
mock.module("./snapshot-store.ts", { namedExports: {
  readAccountSnapshots:async params=>rows.filter(row=>params.connections.some(c=>c.id===row.social_connection_id && (c.authorizationRevision??c.connectedAt)===row.authorization_revision)),
  snapshotRowAccount:row=>row.refresh_status === "ready" ? row.snapshot_json : {...row.snapshot_json,message:row.refresh_message+" Showing saved analytics."},
} });
mock.module("./jobs.ts", { namedExports: { enqueueAnalyticsSyncJob: async params=>{
  assert.equal(params.userId,"owner");dispatches.push(params);if(dispatchFails)throw Error("Queue offline");return{id:"refresh",status:"queued"};
} } });
const {readAnalyticsSnapshot,refreshAnalyticsSnapshot}=await import("./snapshot-service.ts");
const params={userId:"owner",operation:"youtube_channel",force:false};
beforeEach(()=>{connections=[connection];rows=[savedRow];active=[];dispatches=[];dispatchFails=false;legacyReads=0});

test("snapshot-only reads return saved values without queue access",async()=>{
  dispatchFails=true;const result=await readAnalyticsSnapshot(params);
  assert.deepEqual(result.data.accounts,[account]);assert.equal(result.needsRefresh,true);assert.equal(dispatches.length,0);assert.equal(legacyReads,0);
});
test("fresh successful snapshots bypass dispatch",async()=>{
  rows=[{...savedRow,attempted_at:new Date(now).toISOString()}];
  assert.equal((await refreshAnalyticsSnapshot(params)).jobId,undefined);assert.equal(dispatches.length,0);
});
test("stale snapshots return data and a durable revision-scoped refresh",async()=>{
  const result=await refreshAnalyticsSnapshot(params);assert.deepEqual(result.data.accounts,[account]);assert.equal(result.jobId,"refresh");
  assert.deepEqual(dispatches[0].connectionRevisions,{channel:"consent-1"});
});
test("repeated refreshes share an active job with matching authorization",async()=>{
  active=[{id:"running",status:"processing",input:{connectionRevisions:{channel:"consent-1"}}}];
  assert.equal((await refreshAnalyticsSnapshot({...params,force:true})).jobId,"running");assert.equal(dispatches.length,0);
});
test("a previous-consent active job is never reused",async()=>{
  active=[{id:"old",status:"processing",input:{connectionRevisions:{channel:"old-consent"}}}];
  assert.equal((await refreshAnalyticsSnapshot(params)).jobId,"refresh");assert.equal(dispatches.length,1);
});
test("queue failure preserves saved metrics with a warning",async()=>{
  dispatchFails=true;const result=await refreshAnalyticsSnapshot(params);assert.deepEqual(result.data.accounts,[account]);assert.match(result.warning,/Saved analytics/);
});
test("missing snapshots do not return invented metrics and never read legacy data after reconnect",async()=>{
  rows=[];dispatchFails=true;const result=await readAnalyticsSnapshot(params);assert.deepEqual(result.data.accounts,[]);assert.equal(result.needsRefresh,true);assert.equal(legacyReads,0);
  await assert.rejects(refreshAnalyticsSnapshot(params),/Queue offline/);
});
test("manual refresh observes a 30-second cooldown",async()=>{
  rows=[{...savedRow,attempted_at:new Date(now-1000).toISOString()}];
  assert.equal((await refreshAnalyticsSnapshot({...params,force:true})).jobId,undefined);assert.equal(dispatches.length,0);
});
test("provider errors retain durable display values but have a bounded retry cooldown",async()=>{
  rows=[{...savedRow,refresh_status:"error",refresh_message:"Rate limited",attempted_at:new Date(now-1000).toISOString()}];
  const result=await readAnalyticsSnapshot(params);assert.equal(result.data.accounts[0].videos[0].viewCount,0);assert.match(result.data.accounts[0].message,/Rate limited/);assert.equal(result.needsRefresh,false);
  assert.match(result.warning,/saved analytics/);
});

test("saved Instagram content is filtered to the current rolling range",async()=>{
  connections=[{...connection,platform:"instagram",platformAccountId:"ig"}];
  rows=[{...savedRow,snapshot_json:{...account,items:[{publishedAt:new Date(now).toISOString()},{publishedAt:new Date(now-40*86400000).toISOString()}]}}];
  const result=await readAnalyticsSnapshot({...params,operation:"instagram_content",days:30});
  assert.equal(result.data.accounts[0].items.length,1);
});

test("an errored first sync after reconnect still requires fresh provider values",async()=>{
  rows=[{...savedRow,last_success_at:null,refresh_status:"error",snapshot_json:{connectionId:"channel",status:"error",lastSyncedAt:null},attempted_at:new Date(now-120000).toISOString()}];
  await refreshAnalyticsSnapshot(params);assert.equal(dispatches[0].force,true);
});
test("disconnected connections suppress cached data",async()=>{
  connections=[];const result=await readAnalyticsSnapshot(params);assert.deepEqual(result.data.accounts,[]);assert.equal(result.needsRefresh,false);
});
