import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const root=path.resolve("design/explore-character-motion");
const old=JSON.parse(readFileSync(path.join(root,"native-project-v3.json"),"utf8"));
const study=JSON.parse(readFileSync(path.join(root,"source-study.json"),"utf8"));
const ls=old.items.filter(i=>i.layers).flatMap(i=>i.layers);
const tt=ls.find(l=>l.type==="TextLayer"), at=ls.find(l=>l.type==="AVLayer"&&l.sourceId===13);
const ct=old.items.find(i=>i.id===1), ft=old.items.find(i=>i.id===13);
const clone=x=>structuredClone(x);
const charcoal=[31/255,31/255,31/255], white=[245/255,245/255,241/255], lilac=[178/255,183/255,1];
const doc={schemaVersion:2,exportedAt:new Date().toISOString(),aeVersion:old.aeVersion,project:{...old.project},items:[]};
doc.items.push({id:4000,name:"V4 — CREATE YOURS",type:"FolderItem",parentFolderId:0,label:14,comment:"Seven independent examples; native text and subject mask."});
const media=path.join(root,"Media","v4"), output=path.join(root,"Preview","v4");
mkdirSync(media,{recursive:true});mkdirSync(output,{recursive:true});
const names=["bedroom","presenter","selfie","kitchen","glasses","office","standing"];
const sources=study.sources.map((s,i)=>{
  const file=path.join(media,names[i]+".png");copyFileSync(s.source,file);
  const item={...clone(ft),id:4010+i,name:"V4 MEDIA — "+names[i],parentFolderId:4000,width:s.width,height:s.height,file:file.replaceAll("\\","/")};
  doc.items.push(item);return item;
});
const solid={id:4020,name:"V4 STAGE — charcoal",type:"FootageItem",parentFolderId:4000,width:960,height:540,duration:0,sourceKind:"solid",color:charcoal,sourceWidth:960,sourceHeight:540,hasAlpha:false};
doc.items.push(solid);
let id=5000;
function prop(matchName,name,type,value,keys){
  const p={matchName,name,propertyValueType:type,value};
  if(keys)p.keyframes=keys.map(([time,v])=>({time,value:v,inInterp:6613,outInterp:6613}));
  return p;
}
function tr(o={}){
  const sv=v=>Array.isArray(v)?v:[v,v,100];
  return {name:"Transform",matchName:"ADBE Transform Group",groups:[],properties:[
    prop("ADBE Anchor Point","Anchor Point","ThreeD_SPATIAL",o.anchor||[0,0,0]),
    prop("ADBE Position","Position","ThreeD_SPATIAL",o.position||[480,270,0],o.p),
    prop("ADBE Scale","Scale","ThreeD",sv(o.scale??100),o.s?.map(([t,v])=>[t,sv(v)])),
    prop("ADBE Orientation","Orientation","ThreeD_SPATIAL",[0,0,0]),
    prop("ADBE Rotate Z","Rotation","OneD",o.rotation||0,o.r),
    prop("ADBE Opacity","Opacity","OneD",o.opacity??100,o.o)
  ]};
}
function base(name,start=0,end=16){return {index:1,id:id++,name,enabled:true,solo:false,shy:false,locked:false,inPoint:start,outPoint:end,startTime:0,stretch:100,parentIndex:null,parent:null,label:14};}
function comp(cid,name){
  const c={...clone(ct),id:cid,name,parentFolderId:4000,duration:16,workAreaStart:0,workAreaDuration:16,bgColor:charcoal,layers:[],layerCount:0,markers:[],motionBlur:true,shutterAngle:144,shutterPhase:-72};
  doc.items.push(c);return c;
}
function av(c,name,src,o={},start=0,end=16){
  const l={...clone(at),...base(name,start,end),sourceId:src.id,sourceName:src.name,width:src.width,height:src.height,threeDLayer:o.threeD??false,effectsGroup:null,materialOptionsGroup:null,masksGroup:null,motionBlur:true,transformGroup:tr({anchor:[src.width/2,src.height/2,0],...o})};
  c.layers.push(l);return l;
}
function txt(c,name,text,size,pos,o={},start=0,end=16){
  const l={...clone(tt),...base(name,start,end),text,font:"Bahnschrift-Bold",fontSize:size,fillColor:o.color||white,threeDLayer:o.threeD??false,effectsGroup:null,masksGroup:null,transformGroup:tr({position:[...pos,0],...o})};
  const td=clone(tt.textGroup.properties.find(p=>p.matchName==="ADBE Text Document").value);
  Object.assign(td,{text,font:"Bahnschrift-Bold",fontFamily:"Bahnschrift",fontStyle:"Bold",fontSize:size,fillColor:o.color||white,justification:o.center?"7415":"7413",tracking:-10,leading:size*1.02,applyStroke:false,boxText:false});
  l.textGroup={name:"Text",matchName:"ADBE Text Properties",properties:[prop("ADBE Text Document","Source Text","TEXT_DOCUMENT",td)],groups:[]};
  c.layers.push(l);return l;
}
const stage=c=>av(c,"STAGE — charcoal",solid);
const montage=comp(4101,"V4 SCENE — Seven possibilities");
txt(montage,"COPY — imagine","Imagine your",55,[42,432],{p:[[0,[42,432,0]],[1.9,[42,432,0]],[2.5,[42,413,0]],[4.5,[42,413,0]],[5.15,[42,373,0]]]});
txt(montage,"COPY — AI character","AI character.",86,[40,513],{color:lilac,p:[[0,[40,513,0]],[1.9,[40,513,0]],[2.5,[40,500,0]],[4.5,[40,500,0]],[5.15,[40,460,0]]]});
av(montage,"READABILITY — lower shade",solid,{anchor:[480,0,0],position:[480,354,0],scale:[100,35,100],opacity:80});
for(let i=0;i<3;i++){
  av(montage,"EXAMPLE "+(i+1)+" — "+names[i],sources[i],{scale:540/sources[i].height*100,p:[[0,[160+320*i,270,0]],[1.7,[160+320*i,270,0]],[2.55+i*.06,[-1020+320*i,260,0]]],r:[[0,0],[1.7,0],[2.55+i*.06,-4+i*2]]},0,2.85);
}
for(let i=3;i<7;i++){
  const x=120+(i-3)*240, t=1.85+(i-3)*.08;
  av(montage,"EXAMPLE "+(i+1)+" — "+names[i],sources[i],{scale:416/sources[i].height*100,p:[[t,[x+1100,221,0]],[2.65+(i-3)*.08,[x,211,0]],[4.55,[x,211,0]],[5.3,[x-800,180,0]]],r:[[1.85,3],[2.85,0],[4.55,0],[5.3,-3]]},1.85,5.35);
}
stage(montage);
const reveal=comp(4102,"V4 SCENE — Build your own");
av(reveal,"SUBJECT — standing creator — native silhouette",sources[6],{threeD:true,p:[[4.72,[840,211,0]],[5.9,[704,270,-100]],[7.3,[692,270,-100]],[8.25,[1050,285,20]]],s:[[4.72,416/1672*100],[5.9,30.5],[7.3,30.5],[8.25,29]],r:[[4.72,0],[5.9,-1.5],[7.3,-1.5],[8.25,6]]},4.72,8.3);
txt(reveal,"COPY — build","Build",114,[43,182],{threeD:true,p:[[5.05,[-500,220,70]],[5.75,[43,182,70]],[7.45,[43,182,70]],[8.12,[-650,132,70]]],o:[[5.05,0],[5.22,100],[7.55,100],[8.12,0]]},5.05,8.15);
txt(reveal,"COPY — your","your",114,[43,285],{threeD:true,p:[[5.18,[-470,326,60]],[5.86,[43,285,60]],[7.45,[43,285,60]],[8.12,[-520,235,60]]],o:[[5.18,0],[5.36,100],[7.55,100],[8.12,0]]},5.18,8.15);
txt(reveal,"COPY — own — passes behind subject","own.",150,[43,423],{color:lilac,threeD:true,p:[[5.35,[626,432,35]],[6.1,[43,423,35]],[7.45,[43,423,35]],[8.12,[-480,373,35]]],o:[[5.35,0],[5.53,100],[7.55,100],[8.12,0]]},5.35,8.15);
txt(reveal,"COPY — product meaning","An AI character, made for you.",26,[48,481],{o:[[5.9,0],[6.2,100],[7.45,100],[8.05,0]]},5.9,8.05);
av(reveal,"PHOTO — background recedes",sources[6],{threeD:true,p:[[4.72,[840,211,0]],[5.9,[840,211,180]]],s:[[4.72,416/1672*100],[5.9,23]],o:[[4.72,100],[5.04,100],[5.9,0]]},4.72,5.95);
stage(reveal);
const purpose=comp(4103,"V4 SCENE — For you and your business");
txt(purpose,"COPY — personal","For\nyourself.",101,[414,241],{p:[[7.9,[960,300,0]],[8.6,[414,241,0]],[9.55,[414,241,0]],[10.12,[414,-180,0]]],o:[[7.9,0],[8.15,100],[9.6,100],[10.12,0]]},7.9,10.14);
txt(purpose,"COPY — business","For your\nbusiness.",97,[410,241],{color:lilac,p:[[9.66,[410,700,0]],[10.3,[410,241,0]],[11.65,[410,241,0]],[12.45,[1060,241,0]]],o:[[9.66,0],[9.96,100],[11.65,100],[12.45,0]]},9.66,12.5);
for(const [i,start,hold,end] of [[0,7.9,8.5,10.25],[5,9.75,10.4,12.5]]){
  av(purpose,"FOCUS — independent "+names[i]+" example",sources[i],{scale:516/sources[i].height*100,p:[[start,[-220,302,0]],[hold,[188,270,0]],[end-.6,[188,270,0]],[end,[-300,180,0]]],r:[[start,-6],[hold,0],[end-.6,0],[end,-5]]},start,end);
}
stage(purpose);
const finale=comp(4104,"V4 SCENE — Create yours");
txt(finale,"COPY — create","Create your",77,[480,334],{center:true,p:[[12.15,[480,620,0]],[12.9,[480,334,0]],[14.6,[480,334,0]],[15.3,[480,382,0]]],o:[[12.15,0],[12.38,100],[14.6,100],[15.3,0]]},12.15,15.3);
txt(finale,"COPY — AI character","AI character.",94,[480,427],{center:true,color:lilac,p:[[12.27,[480,713,0]],[13.02,[480,427,0]],[14.6,[480,427,0]],[15.3,[480,475,0]]],o:[[12.27,0],[12.5,100],[14.6,100],[15.3,0]]},12.27,15.3);
txt(finale,"COPY — UGCpilot","with UGCpilot",29,[480,488],{center:true,o:[[12.8,0],[13.1,100],[14.65,100],[15.3,0]]},12.8,15.3);
for(let i=0;i<7;i++){
  const x=73+i*136,fit=230/sources[i].height*100;
  av(finale,"ALL SEVEN — "+names[i],sources[i],{scale:fit,p:[[11.98+i*.05,[x,-280,0]],[12.78+i*.05,[x,139,0]],[14.58,[x,139,0]],[15.6,[x,260,0]]],s:[[12,fit],[14.58,fit],[15.6,fit*1.65]],r:[[12,(i-3)*3],[13.1,0],[14.58,0],[15.6,(i-3)*-1.5]]},11.98,15.65);
}
stage(finale);
const main=comp(4100,"AI Character v4 — Create Yours");
const loop=av(main,"LOOP — return to opening",montage,{o:[[15.16,0],[15.75,100],[16,100]]},15.16,16);
loop.startTime=15.16;
av(main,"FINALE — all seven and invitation",finale,{o:[[11.98,100],[15.16,100],[15.75,0]]},11.98,15.75);
av(main,"PURPOSE — yourself and business",purpose,{o:[[7.9,0],[8.25,100],[11.98,100],[12.48,0]]},7.9,12.5);
av(main,"REVEAL — person and spatial typography",reveal,{o:[[4.72,0],[5.05,100],[7.95,100],[8.3,0]]},4.72,8.3);
av(main,"OPENING — every example",montage,{o:[[0,100],[4.72,100],[5.2,0]]},0,5.2);
stage(main);
for(const c of doc.items.filter(i=>i.layers)){c.layerCount=c.layers.length;c.layers.forEach((l,i)=>l.index=i+1);}
writeFileSync(path.join(root,"native-build-v4.json"),JSON.stringify(doc,null,2)+"\n");
writeFileSync(path.join(root,"CONCEPT-v4.md"),[
"# Create Yours — AI character cover v4","",
"All seven supplied pictures are independent reference examples. The film explains creating an AI character for yourself or your business.","",
"## Timing","",
"- 0–5 s: three portraits, then four; Imagine your AI character.",
"- 5–8 s: standing person separates from her photograph; Build your own passes behind the subject.",
"- 8–12 s: two independent examples; For yourself / For your business.",
"- 12–16 s: all seven; Create your AI character with UGCpilot; return to the opening.","",
"## Construction","",
"960×540, 24 fps, 16 seconds. Native editable text, sparse keys, layered depth and one native silhouette mask. Bahnschrift Bold is installed. Seven unmodified original PNGs are packaged in Media/v4. No proprietary effects are required.",
"Old v2/v3 projects remain available. The new file keeps the old v3 hierarchy and a separate V4 — CREATE YOURS hierarchy.",""
].join("\n"));
console.log(JSON.stringify({comps:5,layers:doc.items.filter(i=>i.layers).reduce((n,i)=>n+i.layers.length,0),sources:sources.length,duration:16}));
