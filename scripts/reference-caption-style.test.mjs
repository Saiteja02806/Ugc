import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {applyFormatTextPreset,formatTextLayout,createFormatTextSvg,parseExploreFormatEdit,REFERENCE_FORMAT_TEXT_STYLE} from '../worker/src/lib/explore-format-edit.ts';
import {createOutlinedFormatTextSvg} from '../worker/dist/lib/explore-text-outlines.js';
import {automaticHookEdit} from '../worker/src/lib/automatic-hook-text.ts';
import {readFormatEditDraft} from '../lib/explore/format-edit-draft.ts';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {referenceCaptionPaths} from '../worker/src/lib/reference-caption-paths.ts';
import glyphData from '../worker/src/lib/reference-caption-glyphs.json' with {type:'json'};
const original={value:'Computer Science students!!\nThis website is EVERYTHING',font:'proximanovaa',fontWeight:600,fontSize:67,width:.94,x:.51,y:.28,outlineWidth:8,color:'#ffffff',startMs:200,endMs:1800};
const edit=text=>({version:1,format:'hook',trimStartMs:0,trimEndMs:2000,originalVolume:1,musicVolume:0,text});
for(const [preset,font] of [['reference-social','tiktoksans'],['reference-classic','dmsans']]){
  test(`${preset}: exact copy, timing, geometry and explicit rendering survive save/reopen`,async()=>{
    const text=applyFormatTextPreset(original,preset),saved=readFormatEditDraft(JSON.parse(JSON.stringify(edit(text))));
    assert.deepEqual(saved.text,text);assert.equal(text.font,font);assert.equal(text.fontWeight,700);
    for(const key of ['value','startMs','endMs','fontSize','width','x','y'])assert.equal(text[key],original[key]);
    assert.equal(text.lineHeight,1.2);assert.equal(text.outlineWidth,6);
    for(const width of [360,1080]){
      const layout=formatTextLayout(text,width,width*16/9);assert.equal(layout.outlineJoin,'round');assert.equal(layout.outlineWidth,6*width/1080);
      assert.match(createFormatTextSvg(text,width,width*16/9),/stroke-linejoin="round"/);
      const native=await createOutlinedFormatTextSvg(text,width,width*16/9,resolve('worker/src/assets/fonts'));
      assert.match(native,/stroke-linejoin="round"/);assert.match(native,/<path d=/);assert.doesNotMatch(native,/<text /);
    }
    const source=readFileSync(new URL('../components/explore/format-video-text-overlay.tsx',import.meta.url),'utf8');
    assert.match(source,/strokeLinejoin=\{background \? undefined : layout.outlineJoin\}/);
  });
}
test('saved legacy typography is not migrated or rounded without explicit selection',()=>{
  assert.deepEqual(parseExploreFormatEdit(edit(original)),edit(original));
  assert.equal(formatTextLayout(original,1080,1920).outlineJoin,'miter');
  const classic=applyFormatTextPreset({...original,boxColor:'#000000'},'reference-classic');assert.equal(classic.boxColor,undefined);
  assert.throws(()=>parseExploreFormatEdit(edit({...original,preset:'invalid'})),/preset/);
});
test('new automatic plans freeze reference style; old automatic receipts retain original Proxima',()=>{
  const plan={version:1,source:{format:'hook',referenceId:'fixture',sourceSha256:'a'.repeat(64),blocks:[{text:'A short message',startMs:0,endMs:2000}]}};
  const output={blocks:['A short message'],heading:'',body:''};
  assert.equal(automaticHookEdit(output,plan,2,'9:16').textOverlays[0].font,'proximanovaa');
  const next=automaticHookEdit(output,{...plan,textStyleVersion:1},2,'9:16').textOverlays[0];
  for(const [key,value]of Object.entries(REFERENCE_FORMAT_TEXT_STYLE))assert.equal(next[key],value);
  assert.throws(()=>automaticHookEdit(output,{...plan,textStyleVersion:999},2,'9:16'),/not supported/);
});
test('reference glyph geometry is bound to packaged real fonts and never substitutes unsupported text',()=>{
  for(const font of ['tiktoksans','dmsans']){
    const bytes=readFileSync(resolve(`worker/src/assets/fonts/explore-text/${font}-700.ttf`));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),glyphData[font].sha256);
    assert.equal(Object.keys(glyphData[font].glyphs).length,95);
    const paths=referenceCaptionPaths('Only AVMW!',font,700,'reference-social',22,10,30);
    assert.equal(paths.length,10);assert.ok(paths.some(d=>d.startsWith('M')));
    assert.ok(paths.every(d=>!d.includes('NaN')));
  }
  assert.equal(referenceCaptionPaths('字幕','tiktoksans',700,'reference-social',22,10,30),null);
  assert.equal(referenceCaptionPaths('Legacy','tiktoksans',700,undefined,22,10,30),null);
  assert.equal(referenceCaptionPaths('Custom','poppins',700,'reference-social',22,10,30),null);
});
