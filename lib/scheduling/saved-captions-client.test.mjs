import assert from "node:assert/strict";
import { mock, test } from "node:test";

let token, requests=[];
mock.module("../firebase/auth.ts",{namedExports:{getCurrentUserIdToken:async owner=>{assert.equal(owner,"owner-a");return typeof token==="function"?token():token;}}});
mock.method(globalThis,"fetch",async (url,options)=>{requests.push({url,options});return Response.json({ok:true,library:{revision:1,captions:[],defaultId:null}});});
const{requestSavedCaptions}=await import("./saved-captions-client.ts");
test("caption requests bind authentication to the owner, prohibit cache and never repeat writes",async()=>{
  token="owner-a-token";requests=[];
  const library={revision:0,captions:[],defaultId:null};await requestSavedCaptions("owner-a",library);
  assert.equal(requests.length,1);assert.equal(requests[0].options.method,"PUT");assert.equal(requests[0].options.cache,"no-store");
  assert.equal(requests[0].options.headers.Authorization,"Bearer owner-a-token");assert.equal(requests[0].options.body,JSON.stringify(library));
  await requestSavedCaptions("owner-a");assert.equal(requests[1].options.method,"GET");
});
test("late or unavailable owner tokens cannot trigger a caption write after cancellation",async()=>{
  let finish;token=()=>new Promise(resolve=>{finish=resolve;});requests=[];const abort=new AbortController();
  const result=requestSavedCaptions("owner-a",{revision:0,captions:[],defaultId:null},abort.signal);abort.abort();
  await assert.rejects(result);finish("late-token");await new Promise(setImmediate);assert.equal(requests.length,0);
  token=null;await assert.rejects(requestSavedCaptions("owner-a"),/Sign in/);assert.equal(requests.length,0);
});
