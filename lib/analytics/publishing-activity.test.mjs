import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

let queries, connections, targets;
mock.module("../social/oauth.ts", { namedExports:{listSocialConnections:async owner=>{assert.equal(owner,"owner");return connections}} });
mock.module("@supabase/supabase-js", { namedExports:{createClient:()=>({from(table){
  const entry={table,filters:[]};queries.push(entry);
  const query={select(columns){entry.columns=columns;return query},eq(...args){entry.filters.push(args);return query},in(...args){entry.filters.push(args);return query},or(value){entry.or=value;return query},order(){return query},range(start,end){entry.range=[start,end];return query},then(resolve,reject){return Promise.resolve({data:table==="scheduled_post_targets"?targets.slice(entry.range[0],entry.range[1]+1):[{id:"post",title:"Published title"}],error:null}).then(resolve,reject)}};return query;
}})} });
const {readPublishingActivity}=await import("./publishing-activity.ts");
beforeEach(()=>{queries=[];connections=[{id:"ig",platform:"instagram",platformAccountName:"Instagram"},{id:"yt",platform:"youtube"}];targets=[]});
const row={id:"target",scheduled_post_id:"post",social_connection_id:"ig",status:"published",platform_post_url:"https://instagram.com/p/test",published_at:"2026-10-19T19:00:00Z",scheduled_for:null,updated_at:"2026-10-19T19:00:00Z",platform:"instagram"};
test("activity pages thin owner-scoped targets and looks up only visible titles",async()=>{
  targets=Array.from({length:501},(_,i)=>({...row,id:`target-${i}`}));
  const result=await readPublishingActivity("owner",["2026-10-20"],-330,"all");
  assert.equal(result.published,501);assert.equal(result.activityRows.length,6);assert.equal(result.activityRows[0].title,"Published title");
  assert.deepEqual(queries.slice(0,2).map(q=>q.range),[[0,499],[500,999]]);
  for(const query of queries.slice(0,2)){
    assert.deepEqual(query.filters,[["user_id","owner"],["platform","instagram"],["social_connection_id",["ig"]]]);
    assert.doesNotMatch(query.columns,/\*|metadata|caption|media|asset/);assert.match(query.or,/2026-10-19T18:30:00.000Z/);assert.match(query.or,/2026-10-20T18:29:59.999Z/);
  }
  assert.deepEqual(queries[2].filters,[["user_id","owner"],["id",["post"]]]);
});
test("unknown or disconnected selection does not read scheduling rows",async()=>{
  assert.equal((await readPublishingActivity("owner",["2026-10-20"],0,"foreign")).published,0);
  connections=[];assert.equal((await readPublishingActivity("owner",["2026-10-20"],0,"all")).published,0);assert.deepEqual(queries,[]);
});
