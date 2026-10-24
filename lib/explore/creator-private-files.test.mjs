import assert from 'node:assert/strict';
import {createCipheriv, hkdfSync, randomBytes} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {mock, test} from 'node:test';
import {readCreatorPrivateFile, readCreatorPrivateJson} from './creator-private-files.ts';

test('production creator reads require the dedicated key, authenticated bytes and exact path; plaintext cannot take precedence',()=>{
 const root=fs.mkdtempSync(path.resolve('.tmp/creator-crypto-'));
 const relative='creator-accounts.json',dir=path.join(root,'lib/explore');fs.mkdirSync(dir,{recursive:true});
 const secret=randomBytes(32).toString('hex'),iv=randomBytes(12),bytes=Buffer.from(JSON.stringify({fixture:'synthetic private payload'}));
 const key=Buffer.from(hkdfSync('sha256',Buffer.from(secret,'hex'),'ugc-creator-private-package-v1',relative,32));
 const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(relative));const ciphertext=Buffer.concat([cipher.update(bytes),cipher.final()]);
 const sealed=Buffer.concat([Buffer.from('UCP1'),iv,cipher.getAuthTag(),ciphertext]);
 fs.writeFileSync(path.join(dir,relative+'.enc'),sealed);fs.writeFileSync(path.join(dir,relative),'untrusted local plaintext');
 const previous={env:process.env.NODE_ENV,key:process.env.CREATOR_PRIVATE_PACKAGE_KEY};const cwd=mock.method(process,'cwd',()=>root);
 try{
  process.env.NODE_ENV='production';delete process.env.CREATOR_PRIVATE_PACKAGE_KEY;
  assert.deepEqual(readCreatorPrivateJson(relative,{items:[]}),{items:[]});assert.throws(()=>readCreatorPrivateFile(relative),/not configured/);
  process.env.CREATOR_PRIVATE_PACKAGE_KEY=secret;assert.deepEqual(readCreatorPrivateFile(relative),bytes);
  assert.deepEqual(readCreatorPrivateJson(relative,{}),{fixture:'synthetic private payload'});
  assert.throws(()=>readCreatorPrivateFile('../.env.local'),/Unknown/);
  fs.writeFileSync(path.join(dir,'creator-slide-text.json.enc'),sealed);assert.throws(()=>readCreatorPrivateFile('creator-slide-text.json'));
  process.env.CREATOR_PRIVATE_PACKAGE_KEY=randomBytes(32).toString('hex');assert.throws(()=>readCreatorPrivateFile(relative));
  process.env.CREATOR_PRIVATE_PACKAGE_KEY=secret;const changed=Buffer.from(sealed);changed[changed.length-1]^=1;fs.writeFileSync(path.join(dir,relative+'.enc'),changed);assert.throws(()=>readCreatorPrivateFile(relative));
 }finally{cwd.mock.restore();if(previous.env===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous.env;if(previous.key===undefined)delete process.env.CREATOR_PRIVATE_PACKAGE_KEY;else process.env.CREATOR_PRIVATE_PACKAGE_KEY=previous.key;}
});
