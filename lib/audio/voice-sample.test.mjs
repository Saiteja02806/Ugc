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
// ID3v2 followed by two complete MPEG-1 Layer III frames (128 kbps, 44.1 kHz).
const mp3 = new Uint8Array(10 + 2 * 417);
mp3.set([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0]);
for (const offset of [10, 427]) mp3.set([0xff, 0xfb, 0x90, 0], offset);
beforeEach(()=>{
  calls=[];
  bootstrap=Response.json({account:{paid:true},voices:[voice]});
  upstream=()=>new Response(mp3,{headers:{"Content-Type":"audio/mpeg"}});
  globalThis.fetch=async(url,init)=>{calls.push({url,init});return upstream();};
});
test("samples use only the authenticated owner's catalogue without forwarding credentials or generating",async()=>{
  const result=await handleAudioVoiceSample(request(),"default");
  assert.equal(result.status,200); assert.equal(result.headers.get("Cache-Control"),"private, no-store");
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()),mp3);
  assert.deepEqual(calls[0].init.headers,{Accept:"audio/*"}); assert.equal(calls[0].init.redirect,"error");
});
test("real MP3 samples with the provider's text/plain label attach with the correct audio type",async()=>{
  for (const type of ["text/plain", "text/plain; charset=UTF-8", "application/octet-stream", "binary/octet-stream", "", "Audio/MPEG; charset=binary"]) {
    bootstrap=Response.json({account:{paid:true},voices:[voice]});
    upstream=()=>new Response(mp3,{headers:type ? {"Content-Type":type} : {}});
    const result=await handleAudioVoiceSample(request(),"default");
    assert.equal(result.status,200,type);
    assert.equal(result.headers.get("Content-Type"),"audio/mpeg",type);
    assert.equal(result.headers.get("X-Content-Type-Options"),"nosniff");
    assert.deepEqual(new Uint8Array(await result.arrayBuffer()),mp3);
  }
});
test("a .mp3 URL or ID3 tag alone does not turn text, errors or truncated data into audio",async()=>{
  for (const body of ["<html>Unavailable</html>", '{"error":"not audio"}', new Uint8Array(), mp3.slice(0,10), mp3.slice(0,500)]) {
    for (const type of ["text/plain", "application/octet-stream", "audio/mpeg"]) {
      bootstrap=Response.json({account:{paid:true},voices:[voice]});
      upstream=()=>new Response(body,{headers:{"Content-Type":type}});
      const result=await handleAudioVoiceSample(request(),"default");
      assert.equal(result.status,503,type);
      assert.match((await result.json()).error,/not a supported audio file/);
    }
  }
});
test("MP3 detection supports raw frames, VBR, lower sample rates and ID3 metadata",async()=>{
  const frame = (header, length) => { const bytes = new Uint8Array(length); bytes.set(header); return bytes; };
  const join = (...parts) => { const bytes = new Uint8Array(parts.reduce((size, part) => size + part.length, 0)); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.length; } return bytes; };
  const frames = mp3.slice(10);
  for (const body of [
    frames,
    join(frame([0xff,0xfb,0x90,0],417),frame([0xff,0xfb,0xa0,0],522)),
    join(frame([0xff,0xf3,0x80,0],208),frame([0xff,0xf3,0x80,0],208)),
    join(frame([0xff,0xe3,0x80,0],417),frame([0xff,0xe3,0x80,0],417)),
    join(new Uint8Array([0x49,0x44,0x33,4,0,0,0,0,0,4,1,2,3,4]),frames),
    join(mp3.slice(0,10),mp3),
  ]) {
    bootstrap=Response.json({account:{paid:true},voices:[voice]});
    upstream=()=>new Response(body,{headers:{"Content-Type":"text/plain"}});
    const result=await handleAudioVoiceSample(request(),"default");
    assert.equal(result.status,200);
    assert.deepEqual(new Uint8Array(await result.arrayBuffer()),body);
  }
});
test("malformed ID3 sizes and invalid or mismatched MPEG frame headers are rejected",async()=>{
  for (const [offset,value] of [[6,0x80],[9,0x7f],[11,0xeb],[12,0xf0],[12,0x9c],[428,0xf3],[429,0x94]]) {
    const invalid=mp3.slice(); invalid[offset]=value;
    bootstrap=Response.json({account:{paid:true},voices:[voice]});
    upstream=()=>new Response(invalid,{headers:{"Content-Type":"text/plain"}});
    assert.equal((await handleAudioVoiceSample(request(),"default")).status,503,`offset ${offset}`);
  }
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
