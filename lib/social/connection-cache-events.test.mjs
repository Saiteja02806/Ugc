import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { invalidateConnectionAnalytics, subscribeConnectionChanges } from "./connection-cache-events.ts";

test("connection changes invalidate matching owners across tabs without rebroadcasting",async()=>{
  const original=globalThis.BroadcastChannel, channels=new Set();let posts=0;
  globalThis.BroadcastChannel=class {
    constructor(){channels.add(this)}
    postMessage(data){posts++;for(const channel of channels)if(channel!==this)channel.onmessage?.({data})}
    close(){channels.delete(this)}
  };
  const local=new QueryClient(),sameOwner=new QueryClient(),otherOwner=new QueryClient();
  const keys=[['account','owner','analytics','youtube'],['account','owner','analytics-activity'],['account','owner','social-connections']];
  for(const key of keys){sameOwner.setQueryData(key,[]);otherOwner.setQueryData(key,[])}
  const stopSame=subscribeConnectionChanges(sameOwner,'owner'),stopOther=subscribeConnectionChanges(otherOwner,'other');
  try{
    invalidateConnectionAnalytics(local,'owner');
    for(const key of keys){assert.equal(sameOwner.getQueryState(key).isInvalidated,true);assert.equal(otherOwner.getQueryState(key).isInvalidated,false)}
    assert.equal(posts,1);
  }finally{stopSame();stopOther();local.clear();sameOwner.clear();otherOwner.clear();globalThis.BroadcastChannel=original}
});
