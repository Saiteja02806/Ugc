import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { slideshowImageFit } from "../lib/explore/slideshow-image-fit.ts";

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
});

function client({width=540,height=960,decodeError=false,blobError=false}={}) {
  const calls=[],exports={};let closed=0;
  const image={width,height,close(){closed++}};
  const context={save:()=>calls.push('save'),restore:()=>calls.push('restore'),fillRect:(...args)=>calls.push(['fill',...args]),drawImage:(...args)=>calls.push(['draw',...args])};
  const canvas={getContext:()=>context,toBlob:callback=>callback(blobError?null:new Blob(['png'],{type:'image/png'}))};
  const source=ts.transpileModule(readFileSync(new URL('../lib/explore/slideshow-image-client.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{exports,require:name=>{assert.equal(name,'./slideshow-image-fit');return {slideshowImageFit}},createImageBitmap:async(file,options)=>{assert.equal(options.imageOrientation,'from-image');if(decodeError)throw Error('Invalid bitmap');return image;},document:{createElement:()=>canvas},File,Blob});
  return {...exports,calls,canvas,closed:()=>closed};
}
test("conversion uses full oriented pixels, releases resources and creates a PNG derivative before upload", async()=>{
  const h=client(),file=new File(['original'],'photo.jpg',{type:'image/jpeg',lastModified:123});
  const fitted=await h.fitSlideshowUpload(file);
  assert.equal(fitted.name,'photo-4x5.png');assert.equal(fitted.type,'image/png');assert.equal(fitted.lastModified,123);
  assert.equal(h.canvas.width,1080);assert.equal(h.canvas.height,1350);assert.equal(h.calls.filter(call=>call[0]==='draw').length,2);assert.equal(h.closed(),1);
  assert.equal(await file.text(),'original');
});
test("4:5 files pass through without lossy processing, while failed conversions stop before upload", async()=>{
  const file=new File(['original'],'ready.webp',{type:'image/webp'}),same=client({width:800,height:1000});
  assert.equal(await same.fitSlideshowUpload(file),file);assert.equal(same.closed(),1);assert.equal(same.calls.length,0);
  await assert.rejects(client({decodeError:true}).fitSlideshowUpload(file),/Could not read/);
  const failure=client({blobError:true});await assert.rejects(failure.fitSlideshowUpload(file),/Could not prepare/);assert.equal(failure.closed(),1);
  await assert.rejects(client().fitSlideshowUpload(new File(['x'],'bad.svg',{type:'image/svg+xml'})),/Choose JPG/);
});
