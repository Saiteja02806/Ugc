import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeCarouselHookChoices } from './hook-choices.ts';
test('category hooks precede packaged choices and exact duplicate bytes have one choice',()=>{
  const a={id:'category',name:'Hook',url:'https://storage.example/verified.webp',width:1080,height:1350,sha256:'same'};
  assert.deepEqual(mergeCarouselHookChoices([a],[{...a,id:'packaged'}]),[{id:a.id,name:a.name,url:a.url,width:a.width,height:a.height}]);
  assert.equal(mergeCarouselHookChoices([a],[{...a,id:'other',sha256:'different'}]).length,2);
});
