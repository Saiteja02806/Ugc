import assert from 'node:assert/strict';import test from 'node:test';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
test('preload hook performs no work on mount, anonymous/preview/slideshow/invalid inputs; verified owner warms only requested source',()=>{
 const exports={},calls=[];let user={uid:'owner',emailVerified:true},loading=false,search='';
 const code=ts.transpileModule(fs.readFileSync('components/explore/use-starting-frame-preload.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports,URLSearchParams,window:{location:{get search(){return search;}}},require(name){
  if(name==='@/contexts/auth-context')return{useAuth:()=>({user,loading})};
  if(name==='@/lib/explore/hook-starting-frame-client')return{hookSourceSha256:()=>null,prefetchHookStartingFrame:input=>calls.push(input)};
  throw Error('Unexpected '+name);
 }});
 const ref={id:'hook',format:'hook',sourceSha256:'a'.repeat(64)};
 const warm=exports.useStartingFramePreload();assert.equal(calls.length,0);warm(ref);assert.equal(calls.length,1);assert.equal(calls[0].ownerId,'owner');
 for(const patch of [{format:'slideshow'},{sourceSha256:'invalid'}])warm({...ref,...patch});
 search='?preview=1';warm(ref);search='';
 user=null;exports.useStartingFramePreload()(ref);user={uid:'other',emailVerified:false};exports.useStartingFramePreload()(ref);
 loading=true;user={uid:'other',emailVerified:true};exports.useStartingFramePreload()(ref);assert.equal(calls.length,1);
 loading=false;exports.useStartingFramePreload()(ref);assert.equal(calls[1].ownerId,'other');
});
