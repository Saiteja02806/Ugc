import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
for(const arm of ['evidence','lesson']){
 const file=path.join(process.cwd(),'.tmp/carousel-quality-experiment-2026-10-12',arm,'worker/src/lib/carousel-structure-2-formats.ts');
 const code=readFileSync(file,'utf8');
 const old='slideIndex === 4 ? "first_person_then_viewer" : "first_person"';
 if(!code.includes(old)&&!code.includes('const expectedPerspective =\n    "reader_first"'))throw new Error('Unexpected snapshot backbone');
 writeFileSync(file,code.replace(old,'"reader_first"').replace('perspective: "first_person",','perspective: "reader_first",').replace('A short first-person open loop such as \'I thought...\' or \'I used to...\' is welcome.','Use a reader scenario or direct reader statement without an invented personal experience.').replace('Give a modest, supportable proof or result that follows from the mechanism.','Give a conditional example demonstrating the supported mechanism, or explain its limitation.'));
}
console.log('Experimental backbone requires reader_first; all other locked checks preserved.');
