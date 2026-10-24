import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import {atomicJsonSync} from './reference-text-atomic-write.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const file of ['lib/explore/slideshow-reference-oct23.json','worker/src/lib/explore-hook-reference-oct23-release.json'])if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file)).mediaStatus==='published')throw Error('Published import is immutable');
const root=process.cwd(),stage=path.join(root,'.tmp/explore-upload-batch-20261023/media');fs.mkdirSync(stage,{recursive:true});
const save=(file,data)=>atomicJsonSync(path.join(root,file),data);
const texts=[
 ['“I don’t feel like studying/working today”','Tell me something that will break my heart so much that it’ll make me work/study','Imagine waking up one day to find that all the people you care about have moved on, achieving their dreams and living fulfilling lives, while you’re still stuck in the same place, paralyzed by inaction. The opportunities you once had are gone, and time lost can never be reclaimed.\nThe person you could have become—the one with the skills, the knowledge, and the confidence—is now just a distant dream, someone you’ll never meet because you didn’t put in the effort when it mattered most. And the worst part? You’ll have to live with that regret forever.'],
 ["Your SaaS doesn’t need another feature.",'Then what am I doing wrong?\nYou’re avoiding distribution.',"But I’m building every day.\nI know. Building feels productive, so it looks like progress.",'Why does posting feel so hard?\nWithout a proven format, 0 views and 0 likes feel personal.','So I just keep coding?\nYes. AI made coding easier, so it feels safer than posting.','So what should I do instead?\nMake distribution your next feature.\nUse a proven content format.\nPost the problem.\nShow the demo.\nFind your first users.'],
 ["I’ve been posting consistently for 1 month and these’re the 5 major things I’ve learned",'1. Post 1-4x a day\nanything that fits ur niche, quality doesn’t need to be perfect. just post and see what sticks\n2. Don’t sleep on stories\nposting to story daily gives tiktok more signals. ur video start reaching new ppl.\n3. Stop just scrolling\nengage on other ppls posts. shows tiktok ur real and need to boost ur stuff\n4. Stop guessing why ur videos flop.\nreel view shows how many ppl actually watch, when they swipe, and where they go. u can fix it instead of overthinking.\n5. Post at random times\ntry different time slots tiktok let u test ur content with different ppl. u might be surprised what works'],
 ["i’ve been posting consistently for 3 months and these’re the 4 major things i’ve learnt",'1. don’t sleep on tiktok stories\nposting daily gives tik tok more signals\nand your videos get shown to new ppl.\n2. post 1-4 times daily\ndepending on your niche\nbut quality > quantity.\none good video beats 4 rushed ones.\n3. stop just scrolling\nengage on posts in your niche\nshows tik tok you’re a real account\nand gets your content pushed to new viewers\n4. stop guessing why ur videos flop.\nreel view shows what people actually watch,\nwhen they swipe, and what grabs their attention\nyou stop guessing what works,\nand post smarter.']
];
const slideshowRoot='D:/slideshow/slideshow explore/NONE',items=[],textItems=[],objects=new Map();
function stageBytes(bytes,ext,contentType,prefix){const sha256=hash(bytes),file=`${sha256}.${ext}`,key=`${prefix}/${file}`;fs.writeFileSync(path.join(stage,file),bytes);objects.set(key,{file,key,sha256,contentType,bytes:bytes.length});return {file,sha256,key};}
const existingCatalog=[...JSON.parse(fs.readFileSync('lib/explore/imported-catalog.json')).items,...JSON.parse(fs.readFileSync('lib/explore/slideshow-reference-additions.json')).items];
for(let i=0;i<4;i++){
 const folder=i?`New folder (${i+1})`:'New folder';const dir=path.join(slideshowRoot,folder);
 const images=fs.readdirSync(dir).filter(n=>/^\d+\.(png|jpe?g)$/i.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 if(images.length!==texts[i].length)throw Error('Slide/text count mismatch');
 const slides=[];for(const [index,name] of images.entries()){const bytes=fs.readFileSync(path.join(dir,name)),m=await sharp(bytes).metadata();const ext=path.extname(name).slice(1).toLowerCase();const asset=stageBytes(bytes,ext,ext==='png'?'image/png':'image/jpeg','explore/recreate/v1');slides.push({id:`slide-${index+1}-${asset.sha256.slice(0,12)}`,file:asset.file,width:m.width,height:m.height});}
 const signature=slides.map(s=>s.file).join('|');if(existingCatalog.some(x=>x.format==='slideshow'&&x.slides.map(s=>s.file).join('|')===signature))throw Error(`Already imported slideshow: ${folder}`);
 const id=`explore-slideshow-general-${hash(signature).slice(0,16)}`;items.push({id,format:'slideshow',title:`Slideshow ${i+1}`,category:null,categoryLabel:null,posterFile:slides[0].file,slides});
 for(const [index,slide] of slides.entries())textItems.push({referenceId:id,slideId:slide.id,sourceSha256:slide.file.split('.')[0],format:'slideshow',status:'ready',blocks:[{text:texts[i][index],startMs:null,endMs:null}],extractedAt:new Date().toISOString(),model:'manual-visual-review',notes:'Visible source copy reviewed against supplied numbered image. Application chrome, timestamps and incidental interface icons omitted. Source wording retained.'});
}
const hookRoot='D:/hookswithlinks/notbeen/New folder';const videoFile=fs.readdirSync(hookRoot).find(n=>n.includes('online-video-cutter')&&n.endsWith('.mp4'));const videoPath=path.join(hookRoot,videoFile),videoBytes=fs.readFileSync(videoPath);
const metadata=JSON.parse(execFileSync(ffprobe.path,['-v','error','-count_frames','-show_streams','-of','json',videoPath],{encoding:'utf8',windowsHide:true}));const stream=metadata.streams.find(s=>s.codec_type==='video');
const video=stageBytes(videoBytes,'mp4','video/mp4','explore/paired-references/v1');
const audioPath=path.join(root,'.tmp/explore-upload-batch-20261023/native-audio.mp3');
execFileSync(ffmpeg,['-y','-v','error','-i',videoPath,'-vn','-c:a','libmp3lame','-q:a','2',audioPath],{windowsHide:true});
const audioBytes=fs.readFileSync(audioPath),audio=stageBytes(audioBytes,'mp3','audio/mpeg','explore/paired-references/v1');
const audioDuration=Number(JSON.parse(execFileSync(ffprobe.path,['-v','error','-show_format','-of','json',audioPath],{encoding:'utf8',windowsHide:true})).format.duration);
const posterBuffer=execFileSync(ffmpeg,['-v','error','-i',videoPath,'-frames:v','1','-vf','scale=360:-2','-f','image2pipe','-vcodec','png','-'],{windowsHide:true,maxBuffer:5e6});const poster=stageBytes(await sharp(posterBuffer).webp({quality:85}).toBuffer(),'webp','image/webp','explore/paired-references/v1');
const hookId=`explore-paired-hook-${hash(`${video.sha256}:${audio.sha256}`).slice(0,24)}`;
const hook={id:hookId,format:'hook',title:'Hook 99',sourceUrl:fs.readFileSync(path.join(hookRoot,'New Text Document.txt'),'utf8').trim(),sourcePlatform:'tiktok',videoStorageKey:video.key,audioStorageKey:audio.key,posterStorageKey:poster.key,previewStorageKey:video.key,videoSha256:video.sha256,audioSha256:audio.sha256,posterSha256:poster.sha256,previewSha256:video.sha256,durationSeconds:Number(stream.duration),audioDurationSeconds:audioDuration,width:stream.width,height:stream.height,audioTitle:'Original Hook audio',sourceFolder:'New folder'};
const priorHooks=['explore-hook-reference-release.json','explore-hook-reference-addition-release.json','explore-hook-reference-new-batch-release.json'].flatMap(f=>JSON.parse(fs.readFileSync('worker/src/lib/'+f)).items);
if(priorHooks.some(x=>x.videoSha256===hook.videoSha256||x.id===hookId||x.sourceUrl===hook.sourceUrl))throw Error('Hook duplicates an existing reference');
textItems.push({referenceId:hookId,slideId:null,sourceSha256:video.sha256,format:'hook',status:'ready',blocks:[{text:'You’re telling me this is what the cool girls use for their Pinterest??',startMs:0,endMs:4100}],extractedAt:new Date().toISOString(),model:'manual-visual-review',notes:'Caption visually checked across all 123 decoded source frames. Only the supplied reaction-only 4.1s clip is imported; full download retains an unrelated screen tail and is not the Hook source. Native source audio retained; separate MP3 derived from that same clip, no music invented.'});
const slideshowFile='lib/explore/slideshow-reference-oct23.json',hookFile='worker/src/lib/explore-hook-reference-oct23-release.json';
for(const file of [slideshowFile,hookFile])if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file)).mediaStatus==='published')throw Error('Published import is immutable');
save(slideshowFile,{version:1,mediaStatus:'staged',items});save(hookFile,{version:1,mediaStatus:'staged',activation:'pending',excludedReferenceIds:[],items:[hook]});
save('.tmp/explore-upload-batch-20261023/upload-manifest.json',{version:1,files:[slideshowFile,hookFile],objects:[...objects.values()],omitted:[{file:'D:/slideshow/slideshow explore/NONE/New folder (2)/middle.mp4',reason:'User explicitly requested image-only import.'},{file:'D:/hookswithlinks/notbeen/New folder/ssstik.io_1792736653143.mp4',reason:'Full original supplied for provenance; reaction-only derivative is the intended Hook.'}]});
save('.tmp/explore-upload-batch-20261023/text-reviews.json',{version:1,items:textItems});
const batches=JSON.parse(fs.readFileSync('lib/explore/reference-upload-batches.json'));if(batches.batches.some(b=>b.id.startsWith('explore-20261023')&&b.status==='published'))throw Error('Published batch is immutable');
batches.batches=batches.batches.filter(b=>!b.id.startsWith('explore-20261023'));
for(const [format,ids] of [['hook',[hookId]],['slideshow',items.map(i=>i.id)]])batches.batches.push({id:`explore-20261023-${format}`,format,sequence:Math.max(0,...batches.batches.filter(b=>b.format===format).map(b=>b.sequence))+1,status:'staged',referenceIds:ids});save('lib/explore/reference-upload-batches.json',batches);
console.log(JSON.stringify({slideshows:items.length,images:13,hook,objects:objects.size,bytes:[...objects.values()].reduce((n,o)=>n+o.bytes,0),textReviews:textItems.length},null,2));
