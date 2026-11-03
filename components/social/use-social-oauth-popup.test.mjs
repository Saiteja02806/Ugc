import assert from "node:assert/strict";
import { mock, beforeEach, afterEach, test } from "node:test";
let cells, cursor, effects, intervals, token, popup, calls, deadlines, fetcher;
mock.module("react", { namedExports: {
  useState(initial) { const i=cursor++; if (!(i in cells)) cells[i]=initial; return [cells[i], v=>{cells[i]=v;}]; },
  useRef(initial) { const i=cursor++; return cells[i] ??= {current:initial}; },
  useEffect(effect) { effects.push(effect); }, useCallback: fn=>fn,
}});
mock.module("../../lib/firebase/auth.ts", {namedExports:{getCurrentUserIdToken:()=>token()}});
const {useSocialOAuthPopup}=await import("./use-social-oauth-popup.ts");
function Harness(params) {cursor=0; return useSocialOAuthPopup(params);}
function deferred() {let resolve; const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
const flush=()=>new Promise(r=>setImmediate(r));
const input={platform:"instagram",returnTo:"settings"};
beforeEach(()=>{
 cells=[];cursor=0;effects=[];intervals=new Map();calls=0;deadlines=[];
 token=async()=>"fixture-token";
 popup={closed:false,close(){this.closed=true;},focus(){},location:{replace(url){this.url=url;}}};
 globalThis.window={location:{origin:"https://vidmake.io"},open:()=>popup,addEventListener(){},removeEventListener(){},setInterval(fn){const id=intervals.size+1;intervals.set(id,fn);return id;},clearInterval(id){intervals.delete(id);}};
 fetcher=async()=>({ok:true,json:async()=>({ok:true,authorizationUrl:"https://www.instagram.com/oauth/authorize"})});
 mock.method(globalThis,"fetch",async(...args)=>{calls++;return fetcher(...args);});
 mock.method(AbortSignal,"timeout",()=>{const c=new AbortController();deadlines.push(c);return c.signal;});
 Harness();effects.forEach(fn=>fn());
});
afterEach(()=>{mock.restoreAll();delete globalThis.window;});
test("stalled token times out, resets loading, and a late token never starts a POST",async()=>{
 const d=deferred();token=()=>d.promise;const request=Harness().startConnection(input);
 deadlines[0].abort();await request;
 assert.equal(Harness().connectingPlatform,null);assert.match(Harness().popupError,/too long/);assert.equal(popup.closed,true);
 d.resolve("late-token");await flush();assert.equal(calls,0);
});
for(const stage of ["headers","body"]){test(`stalled ${stage} is bounded and never retried`,async()=>{
 const d=deferred();fetcher=stage==="headers"?()=>d.promise:async()=>({ok:true,json:()=>d.promise});
 const request=Harness().startConnection(input);await flush();deadlines[0].abort();await request;
 assert.equal(calls,1);assert.equal(Harness().connectingPlatform,null);assert.match(Harness().popupError,/too long/);assert.equal(popup.location.url,undefined);
 d.resolve({ok:true,authorizationUrl:"https://late.example"});await flush();assert.equal(popup.location.url,undefined);
});}
test("closing blank popup cancels pending auth and permits another attempt",async()=>{
 const d=deferred();token=()=>d.promise;const request=Harness().startConnection(input);popup.closed=true;
 [...intervals.values()].forEach(fn=>fn());await request;assert.equal(Harness().connectingPlatform,null);
 d.resolve("late");await flush();assert.equal(calls,0);
});
test("cancelled stale request cannot clear or navigate a newer popup",async()=>{
 const d=deferred();token=()=>d.promise;const first=Harness().startConnection(input);Harness().closePopup();
 popup={closed:false,close(){this.closed=true;},focus(){},location:{replace(url){this.url=url;}}};
 token=async()=>"new";await Harness().startConnection(input);d.resolve("old");await first;await flush();
 assert.equal(calls,1);assert.equal(popup.closed,false);assert.equal(Harness().connectingPlatform,"instagram");assert.match(popup.location.url,/instagram/);
});
test("normal start preserves POST shape and leaves time for provider consent",async()=>{
 await Harness().startConnection(input);assert.equal(calls,1);assert.equal(Harness().connectingPlatform,"instagram");assert.equal(popup.closed,false);
 deadlines[0].abort();await flush();assert.equal(popup.closed,false);
});
test("rejected close reconciliation is recovered without unhandled rejection",async()=>{
 Harness({onPopupClosed:async()=>{throw new Error("offline");}});effects.slice(-3).forEach(fn=>fn());
 await Harness().startConnection(input);popup.closed=true;[...intervals.values()].forEach(fn=>fn());await flush();
 assert.equal(Harness().connectingPlatform,null);assert.match(Harness().popupError,/closed before/);
});

test("unmount cancels pending auth without a late request or state write",async()=>{
 const d=deferred();token=()=>d.promise;const request=Harness().startConnection(input);
 const cleanup=effects[2]();cleanup();const before=[...cells];d.resolve("late");await request;await flush();
 assert.equal(calls,0);assert.equal(popup.closed,true);assert.deepEqual(cells,before);
});
test("blocked popup resets loading without acquiring credentials",async()=>{
 window.open=()=>null;let tokens=0;token=async()=>{tokens++;return "fixture";};
 await Harness().startConnection(input);assert.equal(tokens,0);assert.equal(calls,0);assert.equal(Harness().connectingPlatform,null);assert.match(Harness().popupError,/blocked/);
});
test("failed start response resets state and preserves the server error",async()=>{
 fetcher=async()=>({ok:false,json:async()=>({ok:false,message:"Try again later"})});
 await Harness().startConnection(input);assert.equal(Harness().connectingPlatform,null);assert.equal(Harness().popupError,"Try again later");assert.equal(popup.closed,true);assert.equal(calls,1);
});
