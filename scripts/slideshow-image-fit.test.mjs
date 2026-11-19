import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { slideshowImageFit, SLIDESHOW_CANVAS } from "../lib/explore/slideshow-image-fit.ts";

test("portrait, landscape and square uploads fit a 4:5 canvas without clipping their contents", () => {
  for (const [width,height] of [[1080,1920],[1920,1080],[800,800],[800,1000]]) {
    const fit=slideshowImageFit(width,height), foreground=fit.foreground;
    assert.equal(fit.width/fit.height,4/5);
    assert.ok(foreground.x>=0&&foreground.y>=0);
    assert.ok(foreground.x+foreground.width<=1080.001&&foreground.y+foreground.height<=1350.001);
    assert.ok(Math.abs(foreground.width/foreground.height-width/height)<.0001);
    assert.ok(fit.background.x<0&&fit.background.y<0);
    assert.equal(fit.alreadyFits,width/height===4/5);
  }
  for (const [width,height] of [[0,20],[NaN,3],[2,Infinity],[40000,20000],[20000,20000]]) assert.throws(()=>slideshowImageFit(width,height));
  assert.equal(SLIDESHOW_CANVAS.width/SLIDESHOW_CANVAS.height,4/5);
});

function client({width=540,height=960,decodeError=false,blobError=false,codec="image/png"}={}) {
  const calls=[],exports={};let closed=0,encoderArguments=[];
  const image={width,height,close(){closed++}};
  const makeCanvas = () => {
    const state={};const calls=[];
    return { get width(){return state.width}, set width(value){state.width=value}, get height(){return state.height}, set height(value){state.height=value}, calls,
      getContext:()=>({save:()=>calls.push('save'),restore:()=>calls.push('restore'),fillRect:(...args)=>calls.push(['fill',...args]),
        get filter(){return state.filter}, set filter(value){state.filter=value;calls.push(['filter',value])},
        get globalAlpha(){return state.alpha}, set globalAlpha(value){state.alpha=value},
        drawImage:(...args)=>calls.push(['draw',...args])}),
      toBlob:(callback, type, quality) => {
        encoderArguments.push({type,quality});
        if (blobError) return callback(null);
        callback(codec ? new Blob(['encoded'],{type:codec}) : null);
      } };
  };
  const containers=[];
  const source=ts.transpileModule(readFileSync(new URL('../lib/explore/slideshow-image-client.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{exports,require:name=>{assert.ok(name==='./slideshow-image-fit');return {slideshowImageFit}},createImageBitmap:async(file,options)=>{assert.equal(options.imageOrientation,'from-image');if(decodeError)throw Error('Invalid bitmap');return image;},document:{createElement:()=>{const canvas=makeCanvas();containers.push(canvas);return canvas;}},File,Blob});
  return {...exports,calls,canvases:containers,closed:()=>closed,encoderArguments};
}
test("conversion blurs a small scratch copy, prefers webp and releases resources before upload", async()=>{
  const h=client({codec:'image/webp'}),file=new File(['original'],'photo.jpg',{type:'image/jpeg',lastModified:123});
  const fitted=await h.fitSlideshowUpload(file);
  assert.equal(fitted.name,'photo-4x5.webp');assert.equal(fitted.type,'image/webp');assert.equal(fitted.lastModified,123);
  const [canvas,scratch]=h.canvases;
  assert.equal(canvas.width,1080);assert.equal(canvas.height,1350);
  assert.equal(scratch.width,200);assert.equal(scratch.height,250);
  const background=scratch.calls.find(call=>call[0]==='filter');
  assert.ok(background && Number(background[1].match(/([\d.]+)px/)[1])<6, "the scratch blur stays proportionally small");
  assert.equal(canvas.calls.filter(call=>call[0]==='filter').length,0,"the full-size canvas never runs its own blur filter");
  assert.equal(canvas.calls.filter(call=>call[0]==='draw').length,2);
  assert.equal(h.closed(),1);
  assert.equal(h.encoderArguments[0].type,'image/webp');
  assert.equal(await file.text(),'original');
});
test("4:5 files pass through without lossy processing, while failed conversions stop before upload", async()=>{
  const file=new File(['original'],'ready.webp',{type:'image/webp'}),same=client({width:800,height:1000});
  assert.equal(await same.fitSlideshowUpload(file),file);assert.equal(same.closed(),1);assert.equal(same.calls.length,0);
  await assert.rejects(client({decodeError:true}).fitSlideshowUpload(file),/Could not read/);
  const failure=client({blobError:true});await assert.rejects(failure.fitSlideshowUpload(file),/Could not prepare/);assert.equal(failure.closed(),1);
  await assert.rejects(client().fitSlideshowUpload(new File(['x'],'bad.svg',{type:'image/svg+xml'})),/Choose JPG/);
});
test("browsers without webp keep a small photographic payload with the codec they can produce", async()=>{
  const jpeg=client({codec:'image/jpeg'}),file=new File(['original'],'photo.png',{type:'image/png',lastModified:9});
  const fitted=await jpeg.fitSlideshowUpload(file);
  assert.equal(fitted.name,'photo-4x5.jpg');assert.equal(fitted.type,'image/jpeg');assert.equal(fitted.lastModified,9);
  assert.deepEqual(jpeg.encoderArguments.map(request=>request.type),['image/webp','image/jpeg']);
  const legacy=client({codec:'image/png'}),painted=new File(['original'],'photo.webp',{type:'image/webp'});
  const fallback=await legacy.fitSlideshowUpload(painted);
  assert.equal(fallback.name,'photo-4x5.png');assert.equal(fallback.type,'image/png');
  assert.deepEqual(legacy.encoderArguments.map(request=>request.type),['image/webp','image/jpeg','image/png']);
});
