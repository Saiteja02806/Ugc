import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
let bootstrap, calls, upstream;
mock.module("./api.ts", { namedExports: {
  handleAudioBootstrap: async () => bootstrap,
  audioApiError: error => Response.json({error:error.message},{status:error.status ?? 500}),
} });
const { handleAudioVoiceSample, trustedVoiceSample } = await import("./voice-sample.ts");
const request = () => new Request("https://www.getugcpilot.com/api/audio/voices/default/sample");
const voice = {id:"default",previewUrl:"https://storage.googleapis.com/eleven-public-prod/premade/voices/default/sample.mp3"};
beforeEach(()=>{
  calls=[];
  bootstrap=Response.json({account:{paid:true},voices:[voice]});
  upstream=()=>new Response(new Uint8Array([1,2,3]),{headers:{"Content-Type":"audio/mpeg"}});
  globalThis.fetch=async(url,init)=>{calls.push({url,init});return upstream();};
});
test("samples use only the authenticated owner's catalogue without forwarding credentials or generating",async()=>{
  const result=await handleAudioVoiceSample(request(),"default");
  assert.equal(result.status,200); assert.equal(result.headers.get("Cache-Control"),"private, no-store");
  assert.equal((await result.arrayBuffer()).byteLength,3);
  assert.deepEqual(calls[0].init.headers,{Accept:"audio/*"}); assert.equal(calls[0].init.redirect,"error");
});
test("unauthenticated, foreign and preview-only choices never fetch a recording",async()=>{
  bootstrap=Response.json({error:"Sign in"},{status:401}); assert.equal((await handleAudioVoiceSample(request(),"default")).status,401);
  bootstrap=Response.json({account:{paid:true},voices:[voice]}); assert.equal((await handleAudioVoiceSample(request(),"foreign-private")).status,404);
  bootstrap=Response.json({account:null,voices:[voice]}); assert.equal((await handleAudioVoiceSample(request(),"default")).status,403);
  assert.equal(calls.length,0);
});
test("URLs are restricted to provider audio hosts with credentials, ports and external redirects denied",()=>{
  for(const value of ["http://storage.googleapis.com/eleven-public-prod/x", "https://storage.googleapis.com.evil.invalid/eleven-public-prod/x","https://user:pass@api.elevenlabs.io/v1/voices/default/previews/audio","https://storage.googleapis.com:8443/eleven-public-prod/x","https://storage.googleapis.com/private-other-bucket/x","https://api.elevenlabs.io/v1/voices/foreign/previews/audio"]) assert.equal(trustedVoiceSample(value,"default"),false);
  assert.equal(trustedVoiceSample(voice.previewUrl,"default"),true);
});
test("non-audio, excessive declared sizes, and excessive streamed sizes cannot become references",async()=>{
  upstream=()=>new Response("html",{headers:{"Content-Type":"text/html"}});
  assert.equal((await handleAudioVoiceSample(request(),"default")).status,503);
  bootstrap=Response.json({account:{paid:true},voices:[voice]});
  upstream=()=>new Response(new Uint8Array([1]),{headers:{"Content-Type":"audio/mpeg","Content-Length":String(4*1024*1024)}});
  assert.equal((await handleAudioVoiceSample(request(),"default")).status,413);
  bootstrap=Response.json({account:{paid:true},voices:[voice]});
  upstream=()=>new Response(new Uint8Array(4*1024*1024),{headers:{"Content-Type":"audio/mpeg"}});
  assert.equal((await handleAudioVoiceSample(request(),"default")).status,413);
});
