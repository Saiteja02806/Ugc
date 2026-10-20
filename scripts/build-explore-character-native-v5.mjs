import {copyFileSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';

// A separate native iteration: existing v3/v4 compositions remain untouched.
const root=path.resolve('design/explore-character-motion');
const old=JSON.parse(readFileSync(path.join(root,'native-study-v5.json'),'utf8'));
const clone=x=>structuredClone(x);
const ct=old.items.find(x=>x.id===165);
const tt=old.items.find(x=>x.id===288).layers.find(x=>x.type==='TextLayer');
const at=old.items.find(x=>x.id===165).layers.find(x=>x.type==='AVLayer');
const gt=old.items.find(x=>x.id===288).layers.find(x=>x.effectsGroup);
const charcoal=[31/255,31/255,31/255],white=[245/255,243/255,240/255],orange=[1,112/255,69/255];
const doc={schemaVersion:2,exportedAt:new Date().toISOString(),aeVersion:old.aeVersion,project:clone(old.project),items:[]};
const folder=6000;
doc.items.push({id:folder,name:'V5 — BRAND MOTION',type:'FolderItem',parentFolderId:0,label:14,comment:'Geist; warm brand orange; supplied transparent subject; all seven independent examples.'});
const media=path.join(root,'Media','v5'),fonts=path.join(root,'Fonts','Geist'),preview=path.join(root,'Preview','v5');
for(const p of [media,fonts,preview])mkdirSync(p,{recursive:true});
for(const face of ['Regular','Medium','SemiBold'])copyFileSync(path.resolve('node_modules/geist/dist/fonts/geist-sans/Geist-'+face+'.ttf'),path.join(fonts,'Geist-'+face+'.ttf'));
copyFileSync(path.resolve('node_modules/geist/LICENSE.txt'),path.join(fonts,'LICENSE.txt'));
const names=['bedroom','presenter','selfie','kitchen','glasses','office','standing'];
const sources=names.map((n,i)=>{
 const src=old.items.find(x=>x.id===144+i),file=path.join(media,n+'.png');copyFileSync(src.file,file);
 const s={...clone(src),id:6010+i,name:'V5 MEDIA — '+n,parentFolderId:folder,parentFolderName:'V5 — BRAND MOTION',file:file.replaceAll('\\','/')};doc.items.push(s);return s;
});
const cutFile=path.join(media,'standing-transparent.png');
copyFileSync('C:/Users/chund/OneDrive/Desktop/workflow/Contemplative_Denim_Studio_Portrait-removebg-preview.png',cutFile);
const cut={...clone(sources[6]),id:6017,name:'V5 MEDIA — supplied clean subject',width:375,height:666,file:cutFile.replaceAll('\\','/')};doc.items.push(cut);
const solid={id:6020,name:'V5 STAGE — charcoal',type:'FootageItem',parentFolderId:folder,width:960,height:540,duration:0,sourceKind:'solid',color:charcoal,sourceWidth:960,sourceHeight:540,hasAlpha:false};doc.items.push(solid);
let id=7000;
const prop=(matchName,name,type,value,keys)=>({matchName,name,propertyValueType:type,value,...(keys?{keyframes:keys.map(([time,v])=>({time,value:v,inInterp:6613,outInterp:6613}))}:{})});
const sv=v=>Array.isArray(v)?v:[v,v,100];
function tr(o={}){return {name:'Transform',matchName:'ADBE Transform Group',groups:[],properties:[
 prop('ADBE Anchor Point','Anchor Point','ThreeD_SPATIAL',o.anchor||[0,0,0]),
 prop('ADBE Position','Position','ThreeD_SPATIAL',o.position||[480,270,0],o.p),
 prop('ADBE Scale','Scale','ThreeD',sv(o.scale??100),o.s?.map(([t,v])=>[t,sv(v)])),
 prop('ADBE Orientation','Orientation','ThreeD_SPATIAL',[0,0,0]),
 prop('ADBE Rotate X','X Rotation','OneD',0,o.rx),prop('ADBE Rotate Y','Y Rotation','OneD',0,o.ry),
 prop('ADBE Rotate Z','Z Rotation','OneD',o.rotation||0,o.r),prop('ADBE Opacity','Opacity','OneD',o.opacity??100,o.o)
]};}
function base(name,start=0,end=16){return {index:1,id:id++,name,enabled:true,solo:false,shy:false,locked:false,inPoint:start,outPoint:end,startTime:0,stretch:100,parentIndex:null,parent:null,label:14};}
function comp(cid,name){const c={...clone(ct),id:cid,name,parentFolderId:folder,parentFolderName:'V5 — BRAND MOTION',layers:[],layerCount:0,markers:[],motionBlur:true,shutterAngle:144,shutterPhase:-72};doc.items.push(c);return c;}
function av(c,name,src,o={},start=0,end=16){
 const l={...clone(at),...base(name,start,end),sourceId:src.id,sourceName:src.name,width:src.width,height:src.height,threeDLayer:o.threeD??false,effectsGroup:null,materialOptionsGroup:null,masksGroup:null,motionBlur:true,transformGroup:tr({anchor:[src.width/2,src.height/2,0],...o})};c.layers.push(l);return l;
}
const revealSpecs=[];
function txt(c,name,text,size,pos,o={},start=0,end=16){
 const l={...clone(tt),...base(name,start,end),text,font:o.font||'Geist-SemiBold',fontSize:size,fillColor:o.color||white,threeDLayer:o.threeD??false,effectsGroup:null,masksGroup:null,motionBlur:true,transformGroup:tr({position:[...pos,0],...o})};
 const td=clone(tt.textGroup.properties[0].value);
 Object.assign(td,{text,font:l.font,fontFamily:'Geist',fontStyle:o.font==='Geist-Medium'?'Medium':'SemiBold',fontSize:size,fillColor:o.color||white,strokeColor:orange,strokeWidth:o.stroke?1.5:0,applyFill:!o.outline,applyStroke:!!o.stroke,justification:o.center?'7415':'7413',tracking:o.tracking??-15,leading:size*1.04,boxText:false});
 l.textGroup={name:'Text',matchName:'ADBE Text Properties',properties:[prop('ADBE Text Document','Source Text','TEXT_DOCUMENT',td)],groups:[]};c.layers.push(l);
 if(o.reveal)revealSpecs.push({comp:c.name,layer:name,start:o.reveal[0],end:o.reveal[1],fill:!!o.fillReveal});return l;
}
function shade(c,start=0,end=16,opacity=80){
 const l=av(c,'READABILITY — continuous lower falloff',solid,{opacity},start,end);l.effectsGroup=clone(gt.effectsGroup);
 const props=l.effectsGroup.groups[0].properties;
 for(const p of props){if(p.matchName==='ADBE Ramp-0001')p.value=[480,300];if(p.matchName==='ADBE Ramp-0002')p.value=[1,1,1,1];if(p.matchName==='ADBE Ramp-0003')p.value=[480,555];if(p.matchName==='ADBE Ramp-0004')p.value=[.03,.03,.03,1];}
 return l;
}
const stage=c=>av(c,'STAGE — charcoal',solid);
const montage=comp(6101,'V5 SCENE — Imagine and discover');
txt(montage,'CAPTION — imagine','Imagine your',52,[34,494],{reveal:[0,.68],p:[[0,[34,494,0]],[1.68,[34,494,0]],[2.12,[34,451,0]]],o:[[0,100],[1.68,100],[2.12,0]]},0,2.14);
txt(montage,'CAPTION — AI character','AI character.',52,[350,494],{color:orange,reveal:[.18,.9],p:[[0,[350,494,0]],[1.68,[350,494,0]],[2.12,[350,451,0]]],o:[[0,100],[1.68,100],[2.12,0]]},0,2.14);
txt(montage,'CAPTION — find your','Find your',52,[34,494],{reveal:[2.24,2.85],p:[[2.24,[34,494,0]],[4.9,[34,494,0]],[5.5,[34,451,0]]],o:[[2.24,100],[4.9,100],[5.5,0]]},2.24,5.53);
txt(montage,'CAPTION — inspiration','inspiration.',52,[278,494],{color:orange,reveal:[2.43,3.05],p:[[2.43,[278,494,0]],[4.9,[278,494,0]],[5.5,[278,451,0]]],o:[[2.43,100],[4.9,100],[5.5,0]]},2.43,5.53);
shade(montage,0,5.8,82);
for(let i=0;i<3;i++){
 const x=160+320*i,fit=320/sources[i].width*100;
 av(montage,'EXAMPLE '+(i+1)+' — '+names[i],sources[i],{threeD:true,scale:fit,p:[[0,[x,275,0]],[1.6,[x,266,0]],[2.52+i*.05,[x-1110,240,190]]],s:[[0,fit*1.03],[1.6,fit],[2.6,fit]],ry:[[0,0],[1.6,0],[2.52+i*.05,-16]]},0,2.8);
}
for(let i=3;i<7;i++){
 const x=120+(i-3)*240,start=1.9+(i-3)*.075,fit=416/sources[i].height*100;
 av(montage,'EXAMPLE '+(i+1)+' — '+names[i],sources[i],{threeD:true,scale:fit,p:[[start,[x+1070,210,220]],[2.68+(i-3)*.075,[x,211,0]],[4.95,[x,211,0]],[5.7,[x-900,185,100]]],ry:[[start,30],[2.75+(i-3)*.075,0],[4.95,0],[5.7,-14]]},start,5.8);
}
stage(montage);
const reveal=comp(6102,'V5 SCENE — Make it yours');
av(reveal,'SUBJECT — supplied clean alpha — proportions locked',cut,{threeD:true,p:[[4.72,[840,211,0]],[5.92,[648,273,-65]],[8.1,[628,273,-65]],[8.85,[1110,290,100]]],s:[[4.72,416/666*100],[5.92,79],[8.1,79],[8.85,75]],r:[[4.72,0],[5.92,-1.25],[8.1,-1.25],[8.85,5]]},4.72,8.9);
txt(reveal,'CAPTION — build a character','Build a character',44,[42,451],{reveal:[5.55,6.24],p:[[5.55,[42,451,0]],[8.1,[42,451,0]],[8.78,[42,410,0]]],o:[[5.55,100],[8.1,100],[8.78,0]]},5.55,8.85);
txt(reveal,'CAPTION — that is yours','that’s yours.',44,[42,505],{color:orange,reveal:[5.81,6.5],p:[[5.81,[42,505,0]],[8.1,[42,505,0]],[8.78,[42,464,0]]],o:[[5.81,100],[8.1,100],[8.78,0]]},5.81,8.85);
txt(reveal,'GRAPHIC TYPE — YOURS — outline to fill','YOURS',145,[455,320],{color:orange,center:true,stroke:true,threeD:true,fillReveal:true,reveal:[6.14,6.89],p:[[5.15,[-540,320,35]],[5.96,[455,320,35]],[7.7,[455,320,35]],[8.7,[-680,285,35]]],o:[[5.15,0],[5.4,90],[7.7,90],[8.7,0]]},5.15,8.85);
av(reveal,'PHOTO — source recedes as subject emerges',sources[6],{threeD:true,p:[[4.72,[840,211,0]],[5.92,[895,205,260]]],s:[[4.72,416/sources[6].height*100],[5.92,22]],ry:[[4.72,0],[5.92,18]],o:[[4.72,100],[5.03,100],[5.92,0]]},4.72,5.95);
stage(reveal);
const purpose=comp(6103,'V5 SCENE — Personal and business');
txt(purpose,'CAPTION — for yourself','For yourself.',52,[34,494],{reveal:[8.55,9.21],p:[[8.55,[34,494,0]],[9.61,[34,494,0]],[10.13,[34,443,0]]],o:[[8.55,100],[9.61,100],[10.13,0]]},8.55,10.16);
txt(purpose,'CAPTION — for your business','For your business.',52,[34,494],{color:orange,reveal:[10.29,11.03],p:[[10.29,[34,494,0]],[12.36,[34,494,0]],[13.05,[34,443,0]]],o:[[10.29,100],[12.36,100],[13.05,0]]},10.29,13.1);
shade(purpose,7.9,13.1,82);
for(const [indices,start,settle,hold,end] of [[[0,1,2],7.9,8.63,9.65,10.4],[[4,5,3],9.78,10.53,12.36,13.15]]){
 indices.forEach((i,j)=>{const x=160+j*320,fit=320/sources[i].width*100,st=start+j*.07;
 av(purpose,'DEPTH GALLERY — '+names[i],sources[i],{threeD:true,scale:fit,p:[[st,[x+1080,270,300]],[settle+j*.07,[x,270,0]],[hold,[x-15,270,0]],[end,[x-1050,230,220]]],ry:[[st,34],[settle+j*.07,0],[hold,0],[end,-25]],s:[[st,fit*.96],[settle+j*.07,fit],[hold,fit],[end,fit*.96]]},st,end);
 });
}
stage(purpose);
const finale=comp(6104,'V5 SCENE — Create yours');
txt(finale,'CAPTION — invitation','Create your AI character.',52,[480,461],{center:true,reveal:[12.8,13.52],p:[[12.8,[480,461,0]],[14.9,[480,461,0]],[15.5,[480,510,0]]],o:[[12.8,100],[14.9,100],[15.5,0]]},12.8,15.6);
txt(finale,'CAPTION — brand','with UGCpilot',28,[480,505],{font:'Geist-Medium',center:true,color:orange,reveal:[13.09,13.7],o:[[13.09,100],[14.9,100],[15.5,0]]},13.09,15.6);
shade(finale,11.98,15.75,64);
for(let i=0;i<7;i++){
 const x=73+i*136,fit=330/sources[i].height*100,y=201,st=11.98+i*.06;
 av(finale,'ALL SEVEN — independent '+names[i],sources[i],{threeD:true,scale:fit,p:[[st,[480+(x-480)*.45,195,750]],[12.96+i*.06,[x,y,0]],[14.6,[x,y,0]],[15.68,[x,260,-120]]],ry:[[st,(i-3)*12],[12.96+i*.06,0],[14.6,0],[15.68,(i-3)*3]],r:[[st,(i-3)*5],[12.96+i*.06,0],[14.6,0],[15.68,(i-3)*-2]],s:[[st,fit*.6],[12.96+i*.06,fit],[14.6,fit],[15.68,fit*1.24]]},st,15.75);
}
stage(finale);
const main=comp(6100,'AI Character v5 — Brand Motion');
const loop=av(main,'LOOP — return to opening',montage,{o:[[15.18,0],[15.83,100],[16,100]]},15.18,16);loop.startTime=15.18;
av(main,'FINALE — character invitation',finale,{o:[[11.98,0],[13.0,100],[15.18,100],[15.83,0]]},11.98,15.83);
av(main,'PURPOSE — personal and business',purpose,{o:[[7.9,0],[8.62,100],[12.48,100],[13.1,0]]},7.9,13.15);
av(main,'REVEAL — clean subject and kinetic type',reveal,{o:[[4.72,0],[5.6,100],[8.1,100],[8.88,0]]},4.72,8.9);
av(main,'OPENING — seven independent examples',montage,{o:[[0,100],[5.2,100],[5.8,0]]},0,5.8);
stage(main);
for(const c of doc.items.filter(x=>x.layers)){c.layerCount=c.layers.length;c.layers.forEach((l,i)=>l.index=i+1);}
writeFileSync(path.join(root,'native-build-v5.json'),JSON.stringify(doc,null,2)+'\n');
writeFileSync(path.join(root,'word-reveal-specs-v5.json'),JSON.stringify(revealSpecs,null,2)+'\n');
writeFileSync(path.join(root,'CONCEPT-v5.md'),`# Brand motion — v5\n\nRevision of the rejected oversized lavender captions and rough hand mask. Uses the site's Geist and #ff7045 with #f5f3f0 on #1f1f1f. All seven photographs are separate examples.\n\n0–5 s: triptych becomes four photographic panels, with compact staggered captions.\n5–9 s: the supplied transparent person emerges from her original photo. A single YOURS motif passes behind her and changes from outline to fill; smaller captions explain creating your own character.\n8–13 s: two galleries move in depth; captions explain personal and business uses.\n12–16 s: seven examples fan out, invitation appears, continuous return to the opening.\n\nNo invented character consistency, view count claims, sound, or player controls. All photos and the alpha PNG retain natural proportions. Native text animators keep wording editable. Earlier compositions and files stay available.\n`);
console.log(JSON.stringify({items:doc.items.length,comps:5,layers:doc.items.filter(x=>x.layers).reduce((n,c)=>n+c.layers.length,0),wordReveals:revealSpecs.length}));
