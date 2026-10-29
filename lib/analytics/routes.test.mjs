import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { registerHooks } from "node:module";

registerHooks({resolve:(specifier,context,nextResolve)=>nextResolve(specifier === "next/server" ? "next/server.js" : specifier,context)});

let authError, snapshotError, reads, refreshes, activity, afterWork, dispatches, connections, refreshError;
class FirebaseAuthRequestError extends Error { constructor(status) { super("Auth failed"); this.status = status; } }
const snapshot = { ok:true, data:{accounts:[]}, needsRefresh:true, refreshKey:"current", connections:[], lastAttemptAt:0 };
mock.module("next/server", { namedExports: { NextResponse:{json:(body,init)=>Response.json(body,init)}, after:fn=>afterWork.push(fn) } });
mock.module("../firebase/server-auth.ts", { namedExports:{ FirebaseAuthRequestError, requireFirebaseUser:async()=>{if(authError)throw authError;return{uid:"owner"}} } });
mock.module("./snapshot-service.ts", { namedExports:{
  readAnalyticsSnapshot:async params=>{reads.push(params);if(snapshotError)throw snapshotError;return snapshot},
  refreshAnalyticsSnapshot:async params=>{refreshes.push(params);if(refreshError)throw refreshError;return {...snapshot,jobId:"job"}},
  publicSnapshot:value=>({ok:value.ok,data:value.data,needsRefresh:value.needsRefresh,refreshKey:value.refreshKey}),
} });
mock.module("./publishing-activity.ts", { namedExports:{readPublishingActivity:async(...args)=>{activity.push(args);return{published:0}}} });
mock.module("../social/oauth.ts", { namedExports:{listSocialConnections:async()=>connections,logSocialOAuthTrace:()=>{}} });
mock.module("./jobs.ts", { namedExports:{enqueueAnalyticsSyncJob:async params=>dispatches.push(params)} });
const {createAnalyticsRoute}=await import("./route.ts");
const activityRoute=await import("../../app/api/analytics/activity/route.ts");
const connectionsRoute=await import("../../app/api/social/connections/route.ts");
beforeEach(()=>{authError=null;snapshotError=null;reads=[];refreshes=[];activity=[];afterWork=[];dispatches=[];refreshError=null;connections=[{id:"connection",status:"connected",profileNeedsRefresh:true}]});
const request=(path,body)=>new Request(`https://www.getugcpilot.com${path}`,body===undefined?{}:{method:"POST",body:JSON.stringify(body)});

test("GET reads private snapshots without dispatch and includes timing",async()=>{
  const response=await createAnalyticsRoute("instagram_content").GET(request("/api/analytics/instagram/content?days=30"));
  assert.equal(response.status,200);assert.match(response.headers.get("cache-control"),/private, no-store/);assert.match(response.headers.get("server-timing"),/auth;dur=.*analytics;dur=/);
  assert.deepEqual(reads,[{userId:"owner",operation:"instagram_content",days:30}]);assert.equal(refreshes.length,0);
  const body=await response.json();assert.equal(body.connections,undefined);assert.equal(body.lastAttemptAt,undefined);
});
test("POST uses authenticated ownership and explicit force only",async()=>{
  const route=createAnalyticsRoute("youtube_channel");
  await route.POST(request("/api/analytics/youtube/channel",{userId:"foreign",force:"true"}));
  assert.deepEqual(refreshes,[{userId:"owner",operation:"youtube_channel",days:undefined,force:false}]);
  assert.equal(reads.length,0);
});
test("unsupported ranges and authentication fail before storage or dispatch",async()=>{
  assert.equal((await createAnalyticsRoute("instagram_insights").GET(request("/api/analytics/instagram/insights?days=8"))).status,400);
  for(const status of [401,403]){authError=new FirebaseAuthRequestError(status);assert.equal((await createAnalyticsRoute("youtube_channel").GET(request("/api/analytics/youtube/channel"))).status,status)}
  assert.equal(reads.length,0);assert.equal(refreshes.length,0);
});
test("storage failures return a scoped error without private details",async()=>{
  snapshotError=Error("private database detail");
  const response=await createAnalyticsRoute("tiktok_videos").GET(request("/api/analytics/tiktok/videos"));
  assert.equal(response.status,502);assert.doesNotMatch(JSON.stringify(await response.json()),/private database detail/);
});
test("activity validates real calendar dates and passes viewer timezone and owner",async()=>{
  assert.equal((await activityRoute.GET(request("/api/analytics/activity?days=7&end=2026-02-31&offset=-330"))).status,400);
  assert.equal((await activityRoute.GET(request("/api/analytics/activity?days=7&end=2026-10-20&offset=-330&connection=bad"))).status,400);
  const response=await activityRoute.GET(request("/api/analytics/activity?days=7&end=2026-10-20&offset=-330"));
  assert.equal(response.status,200);assert.deepEqual(activity,[['owner',['2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18','2026-10-19','2026-10-20'],-330,'all']]);
});
test("account identity returns before profile refresh is queued",async()=>{
  const response=await connectionsRoute.GET(request("/api/social/connections"));
  assert.equal(response.status,200);assert.equal((await response.json()).connections[0].id,"connection");assert.equal(dispatches.length,0);
  assert.equal(afterWork.length,1);await afterWork[0]();assert.deepEqual(dispatches,[{operation:"connection_profiles",userId:"owner"}]);
});


test("Analytics visit checks due TikTok refresh after returning accounts, without forcing provider work",async()=>{
  connections=[{id:"tiktok",platform:"tiktok",status:"connected"}];
  const response=await connectionsRoute.GET(request("/api/social/connections?analytics=1&userId=foreign"));
  assert.equal(response.status,200);assert.equal((await response.json()).connections[0].id,"tiktok");
  assert.equal(refreshes.length,0);assert.equal(afterWork.length,1);
  await afterWork[0]();
  assert.deepEqual(refreshes,[{userId:"owner",operation:"tiktok_videos",force:false}]);
});

test("ordinary pickers, disconnected TikTok and unauthenticated visits do not start analytics work",async()=>{
  connections=[{id:"tiktok",platform:"tiktok",status:"connected"}];
  await connectionsRoute.GET(request("/api/social/connections"));assert.equal(afterWork.length,0);
  connections[0].status="revoked";
  await connectionsRoute.GET(request("/api/social/connections?analytics=1"));assert.equal(afterWork.length,0);
  authError=new FirebaseAuthRequestError(401);
  assert.equal((await connectionsRoute.GET(request("/api/social/connections?analytics=1"))).status,401);
  assert.equal(refreshes.length,0);
});

test("background TikTok failure cannot discard account cards or become a posting request",async()=>{
  connections=[{id:"tiktok",platform:"tiktok",status:"connected"}];refreshError=Error("Queue unavailable");
  const response=await connectionsRoute.GET(request("/api/social/connections?analytics=1"));
  assert.equal(response.status,200);await afterWork[0]();assert.equal(dispatches.length,0);
  assert.deepEqual((await response.json()).connections,connections);
});
