import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const id = "00000000-0000-4000-8000-000000000099";
function route({signedIn=true, missing=false, exists=true, failed=false}={}) {
  const calls = [], exports = {};
  class AuthError extends Error { status=401; }
  const code = ts.transpileModule(readFileSync(new URL("../../app/api/library/carousels/[itemId]/route.ts",import.meta.url),"utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const dependencies = {
    "next/server":{NextResponse:{json:(body,options)=>Response.json(body,options)}},
    "@/lib/firebase/server-auth":{FirebaseAuthRequestError:AuthError,requireFirebaseUser:async()=>{if(!signedIn)throw new AuthError("Sign in");return {uid:"verified-owner"};}},
    "@/lib/library/db":{getMissingLibraryDbEnvVars:()=>missing?["database"]:[],getLibraryCarouselItemForUser:async value=>{calls.push(value);if(failed)throw new Error("private internals");return exists?{id,slides:[{slideNumber:1},{slideNumber:2}]}:null;},removeLibraryCarouselItem:()=>assert.fail("Reading cannot remove content")},
  };
  vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in dependencies,name);return dependencies[name];},console});
  return {calls,get:(itemId=id)=>exports.GET(new Request("https://app.test/api/library/carousels/"+itemId),{params:Promise.resolve({itemId})})};
}
test("exact carousel reads use the authenticated owner and return a noncached ordered item", async()=>{
  const h=route(),response=await h.get(); assert.equal(response.status,200);
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls)),[{itemId:id,userId:"verified-owner"}]);
  assert.equal(response.headers.get("Cache-Control"),"no-store");
  assert.deepEqual((await response.json()).item.slides.map(slide=>slide.slideNumber),[1,2]);
});
test("unauthenticated, malformed and unconfigured reads never query saved data",async()=>{
  for(const [options,itemId,status] of [[{signedIn:false},id,401],[{},"invalid-id",400],[{missing:true},id,503]]){
    const h=route(options); assert.equal((await h.get(itemId)).status,status); assert.equal(h.calls.length,0);
  }
});
test("foreign or removed items are unavailable and internal failures never expose data",async()=>{
  const absent=route({exists:false}); assert.equal((await absent.get()).status,404);
  const h=route({failed:true}),response=await h.get(); assert.equal(response.status,503);
  assert.doesNotMatch(JSON.stringify(await response.json()),/private internals/);
});
