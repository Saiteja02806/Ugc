import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {registerHooks} from "node:module";
import {mock, test, afterEach} from "node:test";
import ts from "typescript";
const target=new URL("./oauth.ts",import.meta.url).href;
// Expose only to this test loader, without widening the application API.
registerHooks({load(url,context,next){
 if(url!==target)return next(url,context);
 return {shortCircuit:true,format:"module",source:ts.transpileModule(readFileSync(new URL(url),"utf8")+"\nexport {readInstagramTokenResponse};",{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};
}});
const {readInstagramTokenResponse}=await import("./oauth.ts");
afterEach(()=>mock.restoreAll());
for(const stage of ["headers","body"]){test(`Instagram exchange bounds stalled ${stage}, sanitizes errors and never retries`,async()=>{
 let deadline,calls=0;
 mock.method(AbortSignal,"timeout",ms=>{assert.equal(ms,15000);deadline=new AbortController();return deadline.signal;});
 mock.method(globalThis,"fetch",async(_url,init)=>{calls++;assert.ok(init.signal);if(stage==="headers")return new Promise(()=>{});return {json:()=>new Promise(()=>{})};});
 const pending=readInstagramTokenResponse("https://example.test/token?secret=fixture",{method:"POST"});deadline.abort();
 await assert.rejects(pending,e=>e.code==="provider_exchange_failed" && !e.message.includes("fixture"));assert.equal(calls,1);
});}
test("successful Instagram exchange preserves provider status and body",async()=>{
 mock.method(globalThis,"fetch",async()=>({status:200,json:async()=>({access_token:"fixture"})}));
 const result=await readInstagramTokenResponse("https://example.test");assert.equal(result.response.status,200);assert.equal(result.data.access_token,"fixture");
});
