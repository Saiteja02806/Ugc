import {createCipheriv, hkdfSync, randomBytes, createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const secret=process.env.CREATOR_PRIVATE_PACKAGE_KEY?.trim();
if(!/^[a-f0-9]{64}$/i.test(secret??''))throw Error('Set the dedicated 32-byte creator package key. Never pass it on the command line.');
const base=path.resolve('lib/explore');
const files=['creator-accounts.json','creator-account-reviews.json','creator-middle-frame-prompts.json','creator-slideshows.json','creator-slide-text.json',...['creator-account-media','creator-slideshow-media'].flatMap(dir=>fs.readdirSync(path.join(base,dir)).filter(file=>/^[a-f0-9]{64}\.(?:png|mp4|jpg|webp)$/.test(file)).map(file=>dir+'/'+file))];
const receipt=[];
for(const relative of files){const original=fs.readFileSync(path.join(base,relative));const key=Buffer.from(hkdfSync('sha256',Buffer.from(secret,'hex'),'ugc-creator-private-package-v1',relative,32));const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(relative));const encrypted=Buffer.concat([cipher.update(original),cipher.final()]);const packaged=Buffer.concat([Buffer.from('UCP1'),iv,cipher.getAuthTag(),encrypted]);fs.writeFileSync(path.join(base,relative+'.enc'),packaged);receipt.push({file:relative+'.enc',bytes:packaged.length,plaintextSha256:createHash('sha256').update(original).digest('hex')});}
fs.mkdirSync('.tmp/release-20261024',{recursive:true});fs.writeFileSync('.tmp/release-20261024/encrypted-package.json',JSON.stringify({version:1,cipher:'AES-256-GCM',keyDerivation:'HKDF-SHA256 with per-path binding',files:receipt},null,2));
console.log(JSON.stringify({encryptedFiles:receipt.length,bytes:receipt.reduce((sum,row)=>sum+row.bytes,0),plaintextIncluded:false}));
