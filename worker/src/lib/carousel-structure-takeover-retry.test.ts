import assert from 'node:assert/strict';
import test from 'node:test';
import { retryCarouselStructureTakeover } from './carousel-structure-takeover-retry.ts';

test('transient takeover errors retry the same atomic operation without rerunning planning',async()=>{
  for(const code of ['55P03','57014','40001','40P01']){
    let calls=0;const waits:number[]=[];
    const result=await retryCarouselStructureTakeover(async()=>++calls<3?{error:{code},data:null}:{error:null,data:'resolved'},async ms=>{waits.push(ms);});
    assert.equal(result.data,'resolved');assert.equal(calls,3);assert.deepEqual(waits,[500,1500]);
  }
});
test('persistent contention is bounded and invalid payload errors are not retried',async()=>{
  let calls=0;
  await retryCarouselStructureTakeover(async()=>{calls++;return {error:{code:'55P03'}};},async()=>{});
  assert.equal(calls,3);calls=0;
  await retryCarouselStructureTakeover(async()=>{calls++;return {error:{code:'P0001'}};},async()=>{throw Error('unexpected retry');});
  assert.equal(calls,1);
});
