import {copyFileSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';

// Candidates never overwrite approved media or their native projects.
const root=path.resolve('design/explore-cover-revision/2026-10-04');
const media=path.join(root,'Media'),preview=path.join(root,'Preview'),baseline=path.join(root,'Baseline');
for(const p of [media,preview,baseline])mkdirSync(p,{recursive:true});
const files=['public/explore/covers/create-hook-v6','public/explore/covers/recreate-v2','public/explore/covers/creator-phone-v7','public/explore/characters/ai-character-create-yours-v5'];
const snapshot=files.map(f=>({path:f,files:['mp4','webp'].map(ext=>{const src=f+'.'+ext,b=readFileSync(src);copyFileSync(src,path.join(baseline,path.basename(src)));return {path:src,sha256:createHash('sha256').update(b).digest('hex')};})}));
writeFileSync(path.join(root,'baseline.json'),JSON.stringify(snapshot,null,2)+'\n');
copyFileSync('lib/explore/workflows.ts',path.join(baseline,'workflows.ts.txt'));
const old=JSON.parse(readFileSync('design/explore-character-motion/native-project-v5.json','utf8'));
const clone=x=>structuredClone(x);
const ct=old.items.find(x=>x.type==='CompItem');
const tt=old.items.flatMap(x=>x.layers||[]).find(x=>x.type==='TextLayer');
const at=old.items.flatMap(x=>x.layers||[]).find(x=>x.type==='AVLayer'&&!x.nullLayer);
const charcoal=[31/255,31/255,31/255],white=[245/255,243/255,240/255],orange=[1,112/255,69/255];
const doc={schemaVersion:2,exportedAt:new Date().toISOString(),aeVersion:old.aeVersion,project:clone(old.project),items:[]};
doc.project.file=path.join(root,'Explore cover candidates.aep').replaceAll('\\','/');
const folder=9000;
doc.items.push({id:folder,name:'2026-10-04 — reversible cover candidates',type:'FolderItem',parentFolderId:0,label:14});
let next=9001;
function probe(p){const r=spawnSync(ffprobe.path,['-v','error','-show_streams','-of','json',p],{encoding:'utf8',windowsHide:true});if(r.status)throw Error(r.stderr);return JSON.parse(r.stdout).streams.find(s=>s.codec_type==='video');}
function source(input,name){const f=path.join(media,name+path.extname(input));copyFileSync(input,f);const s=probe(f);const i={id:next++,name,type:'FootageItem',parentFolderId:folder,file:f.replaceAll('\\','/'),sourceKind:'file',width:s.width,height:s.height,duration:Number(s.duration)||0};doc.items.push(i);return i;}
const solid={id:next++,name:'STAGE — Explore charcoal',type:'FootageItem',parentFolderId:folder,width:960,height:540,duration:0,sourceKind:'solid',color:charcoal,sourceWidth:960,sourceHeight:540,hasAlpha:false};doc.items.push(solid);
function prop(matchName,type,value,keys){return {name:matchName,matchName,propertyValueType:type,value,...(keys?{keyframes:keys.map(([time,value])=>({time,value,inInterp:6612,outInterp:6612}))}:{})};}
const sv=v=>Array.isArray(v)?v:[v,v,100];
function tr(o={}){return {name:'Transform',matchName:'ADBE Transform Group',groups:[],properties:[prop('ADBE Anchor Point','ThreeD_SPATIAL',o.anchor||[0,0,0]),prop('ADBE Position','ThreeD_SPATIAL',o.position||[480,270,0],o.p),prop('ADBE Scale','ThreeD',sv(o.scale??100),o.s?.map(([t,v])=>[t,sv(v)])),prop('ADBE Orientation','ThreeD_SPATIAL',[0,0,0]),prop('ADBE Rotate X','OneD',0),prop('ADBE Rotate Y','OneD',0,o.ry),prop('ADBE Rotate Z','OneD',o.rotation||0,o.r),prop('ADBE Opacity','OneD',o.opacity??100,o.o)]};}
function base(name,start,end){return {index:1,id:next++,name,enabled:true,solo:false,shy:false,locked:false,inPoint:start,outPoint:end,startTime:0,stretch:100,parentIndex:null,parent:null,label:14};}
function comp(name,duration=16.5,width=960,height=540){const c={...clone(ct),id:next++,name,parentFolderId:folder,width,height,duration,workAreaStart:0,workAreaDuration:duration,frameRate:24,layers:[],layerCount:0,markers:[],motionBlur:true,shutterAngle:144,shutterPhase:-72,bgColor:charcoal};doc.items.push(c);return c;}
function av(c,name,src,o={},start=0,end=c.duration){const l={...clone(at),...base(name,start,end),sourceId:src.id,sourceName:src.name,width:src.width,height:src.height,threeDLayer:!!o.threeD,effectsGroup:null,masksGroup:null,materialOptionsGroup:null,audioEnabled:false,timeRemapEnabled:false,nullLayer:false,motionBlur:true,transformGroup:tr({anchor:[src.width/2,src.height/2,0],...o})};delete l.timeRemap;delete l.audioGroup;c.layers.push(l);return l;}
function txt(c,name,text,size,pos,o={},start=0,end=c.duration){const l={...clone(tt),...base(name,start,end),text,fontSize:size,font:o.font||'Geist-SemiBold',fillColor:o.color||white,threeDLayer:false,effectsGroup:null,masksGroup:null,motionBlur:true,transformGroup:tr({position:[...pos,0],...o})};const td=clone(tt.textGroup.properties[0].value);Object.assign(td,{text,font:l.font,fontSize:size,fontFamily:o.font?.startsWith('Bodoni')?'Bodoni MT':'Geist',fontStyle:'SemiBold',fillColor:l.fillColor,applyFill:true,applyStroke:false,strokeWidth:0,justification:o.center?'7415':'7413',tracking:-20,leading:size*1.07,boxText:false});l.textGroup={name:'Text',matchName:'ADBE Text Properties',properties:[prop('ADBE Text Document','TEXT_DOCUMENT',td)],groups:[]};c.layers.push(l);return l;}
const stage=c=>av(c,'STAGE — charcoal',solid);
const ease=[];
function label(c,name,text,size,pos,start,end,o={}){const l=txt(c,name,text,size,pos,{p:[[start,[pos[0],pos[1]+32,0]],[start+.32,[...pos,0]],[end-.2,[...pos,0]],[end,[pos[0],pos[1]-18,0]]],o:[[start,0],[start+.16,100],[end-.16,100],[end,0]],...o},start,end);ease.push({comp:c.name,layer:name,property:'ADBE Position',keys:[1,2,3,4]});return l;}

// Recreate: six original examples, uncropped and explicitly labelled.
const srcRoot='C:/Users/chund/OneDrive/Desktop/workflow/format2';
const examples=['hook.mp4','hook1.mp4','WOT_1-Vmake.mp4','WOT_2-Vmake.mp4'].map((f,i)=>source(path.join(srcRoot,f),'recreate-example-'+(i+1)));
for(const [j,dir,count] of [[0,'1',4],[1,'New folder',6]]){
 const inputFiles=Array.from({length:count},(_,i)=>source(path.join(srcRoot,dir,(i+1)+'.jpg'),'recreate-deck-'+j+'-slide-'+(i+1)));
 const deck=comp('RECREATE — Slideshow '+(j+1),3,720,1280);
 inputFiles.forEach((src,i)=>{const start=i*3/count,end=(i+1)*3/count,l=av(deck,'Slide '+(i+1),src,{position:[360,640,0],scale:Math.min(720/src.width,1280/src.height)*100},start,end);});
 examples.push(deck);
}
const recreate=comp('Recreate v3 — Six labelled formats');
label(recreate,'OPEN — lead','Recreate the',60,[52,210],0,1.6);
label(recreate,'OPEN — headline','viral formats.',70,[52,292],0,1.6,{color:orange});
const beats=[[1.5,3.25,0],[3.25,5,1],[5,7.25,2],[7.25,9.5,3],[9.5,11.5,4],[11.5,14.5,5]];
for(const [a,b,i] of beats){const src=examples[i],fit=500/src.height*100,l=av(recreate,'EXAMPLE '+(i+1)+' — full portrait',src,{scale:fit,p:[[a,[1080,270,0]],[a+.25,[740,270,0]],[b-.2,[740,270,0]],[b,[500,270,0]]],s:[[a,fit*.92],[a+.25,fit],[b-.2,fit],[b,fit*1.08]],o:[[a,100],[b-.12,100],[b,0]]},a,b);l.startTime=a;ease.push({comp:recreate.name,layer:l.name,property:'ADBE Position',keys:[1,2,3,4]});}
for(const [a,b,name,line] of [[1.5,5,'Hooks','Catch attention.'],[5,9.5,'Wall of\rText','Tell your story.'],[9.5,14.5,'Slideshows','One slide at a time.']]){
 label(recreate,'FORMAT — '+name,name,name==='Slideshows'?66:76,[52,238],a,b,{color:orange});
 label(recreate,'PURPOSE — '+name,line,34,[54,418],a+.1,b);
 label(recreate,'SOURCE — '+name,'Start with a reference.',29,[54,470],a+.16,b,{font:'Geist-Regular'});
}
label(recreate,'END — lead','Make it',68,[52,220],14.5,16.2);
label(recreate,'END — keyword','yours.',100,[52,325],14.5,16.2,{color:orange});
label(recreate,'END — brand','with UGCpilot',30,[54,407],14.6,16.2,{font:'Geist-Medium'});
// The same three-card pose starts and ends the loop; no black/loading frame.
for(const [a,b,closing] of [[0,1.6,false],[14.5,16.5,true]])examples.filter((_,i)=>[0,2,4].includes(i)).forEach((src,i)=>{
 const fit=390/src.height*100,x=610+i*120,y=270+(i-1)*34,l=av(recreate,(closing?'END':'OPEN')+' GALLERY — '+i,src,{threeD:true,scale:fit,position:[x,y,0],ry:[[a,(i-1)*8],[b,(i-1)*8]],p:closing?[[a,[x+330,y+70,200]],[a+.45,[x,y,0]],[b,[x,y,0]]]:[[0,[x,y,0]],[1.25,[x,y-12,0]],[b,[x+180,y,130]]],o:closing?[[a,0],[a+.24,100],[b,100]]:[[0,100],[1.3,100],[b,0]]},a,b);l.startTime=a;
});
// A frozen first frame at the seam brings the closing pose/copy exactly home.
const rHome=comp('RECREATE — opening pose for seam',1);
examples.filter((_,i)=>[0,2,4].includes(i)).forEach((src,i)=>{const l=av(rHome,'Gallery '+i,src,{threeD:true,scale:390/src.height*100,position:[610+i*120,270+(i-1)*34,0],ry:[[0,(i-1)*8],[1,(i-1)*8]]});});stage(rHome);
const rLoop=av(recreate,'LOOP — first frame',rHome,{o:[[16.08,0],[16.46,100],[16.5,100]]},16.08,16.5);rLoop.startTime=16.08;recreate.layers.pop();recreate.layers.unshift(rLoop);
stage(recreate);

// Hook: preserve the editorial keyword and immediate 4s -> 2.5s demo handoff.
const hookSources=[1,2,3].map(i=>source('design/explore-hook-motion/Media/v6/creator-'+i+'.mp4','hook-creator-'+i));
const demo=source('design/explore-hook-motion/Media/v6/demo.mp4','hook-real-demo');
const opening=comp('HOOK — native diagonal creators',4.0);
hookSources.forEach((src,i)=>{const scale=55,x=160+320*i,l=av(opening,'Creator '+(i+1),src,{position:[x,270,0],scale});
 const polygon=i===0?[[0,0],[380,0],[260,540],[0,540]]:i===1?[[380,0],[700,0],[580,540],[260,540]]:[[700,0],[960,0],[960,540],[580,540]];
 const v=polygon.map(([cx,cy])=>[(cx-x)/(scale/100)+src.width/2,(cy-270)/(scale/100)+src.height/2]);
 l.masksGroup={name:'Masks',matchName:'ADBE Mask Parade',properties:[],groups:[{name:'Sharp diagonal panel',matchName:'ADBE Mask Atom',properties:[prop('ADBE Mask Shape','SHAPE',{__kind:'Shape',closed:true,vertices:v,inTangents:v.map(()=>[0,0]),outTangents:v.map(()=>[0,0])}),prop('ADBE Mask Feather','TwoD',[0,0]),prop('ADBE Mask Opacity','OneD',100)],groups:[]}]};
});stage(opening);
const hook=comp('Hook v7 — Hook and demo story',12);
label(hook,'OPEN — lead','Create a talking',44,[48,360],0,4,{font:'Geist-Medium'});
label(hook,'OPEN — editorial hook','hook',104,[48,460],0,4,{font:'BodoniMTBlack-Italic',color:orange});
label(hook,'OPEN — suffix','video',44,[277,452],.2,4,{font:'Geist-Medium'});
label(hook,'DEMO — lead','Add your own',52,[52,232],4,6.5,{font:'Geist-Medium'});
label(hook,'DEMO — editorial demo','demo',108,[52,344],4,6.5,{font:'BodoniMTBlack-Italic',color:orange});
label(hook,'END — lead','Your creator.',56,[52,220],6.5,8.5);
label(hook,'END — keyword','Your hook.',62,[52,297],6.5,8.5,{color:orange});
label(hook,'END — story','Hook + demo.',58,[52,220],8.5,11.5);
label(hook,'END — outcome','One video.',65,[52,298],8.5,11.5,{color:orange});
label(hook,'END — brand','with UGCpilot',30,[54,380],8.6,11.5,{font:'Geist-Medium'});
const demoL=av(hook,'DEMO — complete supplied recording',demo,{scale:500/demo.height*100,position:[735,270,0],p:[[4,[1100,270,0]],[4.25,[735,270,0]],[6.25,[735,270,0]],[6.5,[1100,270,0]]]},4,6.5);demoL.startTime=2;
for(const [a,b,i] of [[6.5,7.5,0],[7.5,8.5,1],[8.5,10,2],[10,11.5,0]]){const src=hookSources[i],l=av(hook,'RESULT — creator '+i+' at '+a,src,{scale:500/src.height*100,position:[735,270,0],p:[[a,[900,270,0]],[a+.2,[735,270,0]],[b,[735,270,0]]]},a,b);l.startTime=a;}
// A discreet native ramp gives the opening caption contrast, not footage blur.
const rampTemplate=old.items.flatMap(x=>x.layers||[]).find(l=>l.effectsGroup?.groups?.some(g=>g.matchName==='ADBE Ramp'));
const shade=av(hook,'OPEN — lower contrast gradient',solid,{opacity:88},0,4);shade.effectsGroup=clone(rampTemplate.effectsGroup);shade.blendingMode=5216;
const props=shade.effectsGroup.groups.find(g=>g.matchName==='ADBE Ramp').properties;
for(const p of props){if(p.matchName==='ADBE Ramp-0001')p.value=[480,290];if(p.matchName==='ADBE Ramp-0002')p.value=[1,1,1,1];if(p.matchName==='ADBE Ramp-0003')p.value=[480,540];if(p.matchName==='ADBE Ramp-0004')p.value=[0,0,0,1];}
av(hook,'OPEN — diagonal examples',opening,{},0,4);
const hHome=comp('HOOK — opening pose for seam',1);
const hShade=av(hHome,'Gradient',solid,{opacity:88});hShade.effectsGroup=clone(shade.effectsGroup);hShade.blendingMode=5216;
av(hHome,'Diagonal creators',opening);stage(hHome);
const hLoop=av(hook,'LOOP — first frame',hHome,{o:[[11.25,0],[11.75,100],[12,100]]},11.25,12);hLoop.startTime=11.25;hook.layers.pop();hook.layers.unshift(hLoop);stage(hook);

// Phone: preserve the existing match-cut geometry, follow only the Cal AI example.
const phoneDoc=JSON.parse(readFileSync('design/explore-phone-motion/native-project-v7.json','utf8'));
const phoneItems=phoneDoc.items.filter(i=>[397,409,592,593].includes(i.id));
const mapping=new Map(phoneItems.map(i=>[i.id,next++]));
for(const i of phoneItems){const n=clone(i);n.id=mapping.get(i.id);n.name='PHONE CANDIDATE — '+i.name;n.parentFolderId=folder;if(n.file){const f=path.join(media,path.basename(n.file));copyFileSync(n.file,f);n.file=f.replaceAll('\\','/');}if(n.layers)for(const l of n.layers){l.id=next++;l.sourceId=mapping.get(l.sourceId)||l.sourceId;l.parent=null;l.parentIndex=null;l.audioEnabled=false;}doc.items.push(n);}
const phone=comp('Phone v8 — One coherent app',9);
label(phone,'OUTPUT — lead','Create your',56,[52,224],3.125,8.375);
label(phone,'OUTPUT — keyword','video.',95,[52,331],3.125,8.375,{color:orange});
label(phone,'TRANSFER — lead','On their',56,[52,224],1.875,3.2);
label(phone,'TRANSFER — keyword','phone.',95,[52,331],1.875,3.2,{color:orange});
txt(phone,'INPUT — lead','Your',76,[500,233],{o:[[0,100],[1.1,100],[1.35,0],[8.375,0],[8.7,100],[9,100]]});
txt(phone,'INPUT — keyword','app.',115,[498,351],{color:orange,o:[[0,100],[1.15,100],[1.4,0],[8.375,0],[8.8,100],[9,100]]});
const originalMain=phoneDoc.items.find(x=>x.id===445),hero=clone(originalMain.layers.find(l=>l.name==='PHONE — framed transfer'));
hero.id=next++;hero.sourceId=mapping.get(397);hero.parent=null;hero.parentIndex=null;phone.layers.push(hero);
const creator=doc.items.find(i=>i.id===mapping.get(409));
av(phone,'RESULT — same app, continuous creator',creator,{o:[[0,0],[1.45,0],[1.75,100],[8.3,100],[8.375,0]]});stage(phone);

for(const c of doc.items.filter(x=>x.layers)){c.layerCount=c.layers.length;c.layers.forEach((l,i)=>l.index=i+1);}
writeFileSync(path.join(root,'native-candidates.json'),JSON.stringify(doc,null,2)+'\n');
writeFileSync(path.join(root,'easing.json'),JSON.stringify(ease,null,2)+'\n');
writeFileSync(path.join(root,'candidates.json'),JSON.stringify([{comp:recreate.name,file:'recreate-v3',duration:16.5},{comp:hook.name,file:'create-hook-v7',duration:12},{comp:phone.name,file:'creator-phone-v8',duration:9}],null,2)+'\n');
console.log(JSON.stringify({items:doc.items.length,comps:doc.items.filter(x=>x.layers).length,baseline:snapshot.length,output:root}));
