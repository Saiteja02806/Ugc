import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

test('all five Explore waiting posters match their actual video opening pixels', async () => {
  let count=0;
  for(const file of ['lib/explore/workflows.ts','components/explore/ai-character-card.tsx']) {
    const text=readFileSync(file,'utf8');
    const videos=[...text.matchAll(/"(\/explore\/covers\/[^"\n]+\.mp4)"/g)].map(x=>x[1]);
    const posters=[...text.matchAll(/"(\/explore\/covers\/[^"\n]+\.webp)"/g)].map(x=>x[1]);
    assert.equal(videos.length,posters.length);
    for(let i=0;i<videos.length;i++) {
      const data=readFileSync('public'+posters[i]);
      const digest=createHash('sha256').update(data).digest('hex').slice(0,12);
      assert(posters[i].endsWith(`-opening-${digest}.webp`),'New immutable poster URL required');
      assert(data.length<100000,'Waiting images must remain lightweight');
      const png=execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i','public'+videos[i],'-frames:v','1','-f','image2pipe','-c:v','png','pipe:1'],{maxBuffer:12e6});
      const opening=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
      const poster=await sharp(data).removeAlpha().raw().toBuffer({resolveWithObject:true});
      assert.equal(poster.info.width,768);assert.equal(poster.info.height,432);
      assert.deepEqual(poster.data,opening.data,posters[i]);
      count++;
    }
  }
  assert.equal(count,5);
});
