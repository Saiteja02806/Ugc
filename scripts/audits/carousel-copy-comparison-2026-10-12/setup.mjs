import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=process.cwd(), dir=path.join(root,'.tmp/carousel-quality-experiment-2026-10-12');
mkdirSync(dir,{recursive:true});
const prior=JSON.parse(readFileSync(path.join(root,'docs/carousel-live-text-quality-provider-evidence-2026-10-12.json'),'utf8'));
function hashes(relative){const out={};function walk(p){for(const e of readdirSync(path.join(root,p),{withFileTypes:true})){const q=path.join(p,e.name);if(e.isDirectory())walk(q);else out[q.replaceAll('\\','/')]=createHash('sha256').update(readFileSync(path.join(root,q))).digest('hex');}}walk(relative);return out;}
const manifest={capturedAt:new Date().toISOString(),files:{...hashes('worker/src'),...hashes('lib/carousel')}};
writeFileSync(path.join(dir,'source-manifest.json'),JSON.stringify(manifest,null,2));
for(const arm of ['control','evidence','lesson']){
 const dest=path.join(dir,arm); if(existsSync(dest))throw new Error('Refusing to overwrite snapshot '+arm);
 mkdirSync(path.join(dest,'worker'),{recursive:true});mkdirSync(path.join(dest,'lib'),{recursive:true});
 cpSync(path.join(root,'worker/src'),path.join(dest,'worker/src'),{recursive:true});
 cpSync(path.join(root,'lib/carousel'),path.join(dest,'lib/carousel'),{recursive:true});
 if(arm==='control')continue;
 const config=path.join(dest,'worker/src/lib/carousel-config/structure-2-formats.json');
 const f=JSON.parse(readFileSync(config,'utf8'));
 for(const format of f.formats){
  format.generationRules=format.generationRules.map(x=>x.replaceAll('first-person','reader-scenario'));
  format.generationRules.push('Without supplied customer evidence, describe a plausible reader situation rather than an event that happened to a narrator. Do not invent observed results.');
  for(const slide of format.slides){slide.perspective='reader_first';slide.instruction=slide.instruction.replaceAll('first-person','reader-scenario').replaceAll('narrator', 'reader');
   if(slide.slideNumber===4)slide.instruction='Introduce a supported product feature as an action the reader could take in this situation. Show the interaction without claiming that anyone used it or achieved a result.';
   if(slide.slideNumber===5)slide.instruction='Demonstrate the feature with a conditional example or explain its limitation. Return to the lesson, without claimed personal outcomes or a testimonial. Keep a CTA on Slide 6 only.';
  }
 }
 writeFileSync(config,JSON.stringify(f,null,2));
 const story=path.join(dest,'worker/src/lib/carousel-structure-2-story-plan.ts');
 let code=readFileSync(story,'utf8');
 code=code.replaceAll('first-person','reader-scenario').replaceAll('I/me/my','you/your or impersonal instructions').replaceAll('(I, me, or my)','(you, your, or impersonal descriptions)').replaceAll('only Slide 1 may lead with direct reader wording','Slides 1-6 may use direct reader wording').replaceAll('Only Slide 1 may lead with direct reader wording','Slides 1-6 may use direct reader wording').replaceAll('modest proof or result','conditional demonstration or limitation');
 writeFileSync(story,code);
}
const businesses=prior.businesses.map(b=>({...b,briefs:prior[b.id+'Briefs'].items.slice(0,5)}));
const facts={
 'ugc-pilot':[['context','Generate business-specific creative from website/business context'],['formats','Generate hooks, text videos and slideshows; supported publication formats vary by platform'],['review','Review generated creative and approve scheduling to connected accounts']],
 'cal-ai':[['methods','Record food by meal photo, barcode scan or description'],['recipes','Add custom foods and recipes'],['estimates','Nutrition estimates vary; clear focused photos and good lighting help scans, but do not ensure exactness']],
 'calendly':[['booking','Share a booking link for invitees to choose an available meeting time'],['availability','Define meeting availability and connect calendars'],['buffers','Set before or after meeting buffers per event type; updates apply to new bookings'],['limits','Set meeting limits; availability and feature access depend on account configuration']]
};
for(const b of businesses)b.facts=facts[b.id].map(([id,statement])=>({id:b.id+'-'+id,statement,sourceUrl:b.id==='calendly'&&id==='buffers'?'https://calendly.com/help/how-to-use-buffers':b.id==='calendly'&&id==='limits'?'https://calendly.com/help/how-to-set-meeting-limits':b.sourceUrl}));
const moo={...businesses[0],id:'moo',businessName:'MOO',sourceUrl:'https://www.moo.com/us/business-cards',category:'printed business cards',businessModel:'physical printing retailer',targetAudience:['freelancers and small business owners choosing printed business cards'],productSummary:'MOO prints business cards. A customer can start with a template, build a design in an online designer, or upload ready design files. Sample packs let customers compare papers and finishes physically. Product options and finishes vary. No customer results or personal testimony are supplied. It does not guarantee leads, sales or that a design will impress clients.',mainProblem:'Choosing a readable business card and paper finish is difficult when the design and material have only been seen on a screen.',mainPromise:'Provide design entry points and printed paper/finish choices for business cards.',painPoints:['Not knowing whether to start from a template or a ready design file','Choosing a paper finish without handling it','Trying to fit too much information onto a small business card'],valueProps:['Templates, blank online design or upload finished artwork','Physical sample packs for paper and finish comparisons'],differentiators:['Multiple design starting points','Paper and finish sample packs'],claimsToAvoid:['Guaranteed leads or sales','Guaranteed legibility or automated design correction','Specific price or delivery promises','Invented personal or customer outcomes'],briefs:null,facts:[['templates','Start a business card design from a template'],['designer','Use the blank online designer to build a card and add a logo'],['upload','Upload complete ready design files for printing'],['samples','Order a sample pack to compare paper and finishes physically']].map(([id,statement])=>({id:'moo-'+id,statement,sourceUrl:'https://www.moo.com/us/business-cards'}))};
businesses.push(moo);
writeFileSync(path.join(dir,'fixtures.json'),JSON.stringify({businesses,notes:'Public product descriptions only; no testimonial supplied even if a business has testimonials elsewhere. MOO is a held-out new category. The first three business creative briefs are reused unchanged from the preceding live test.'},null,2));
console.log(JSON.stringify({snapshots:3,businesses:businesses.map(b=>b.id),sourceFiles:Object.keys(manifest.files).length}));
