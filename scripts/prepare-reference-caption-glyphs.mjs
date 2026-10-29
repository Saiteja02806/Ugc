import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const opentype=createRequire(new URL('../worker/package.json',import.meta.url))('opentype.js');
const fonts={};
for(const family of ['tiktoksans','dmsans']){
  const bytes=await readFile(new URL(`../worker/src/assets/fonts/explore-text/${family}-700.ttf`,import.meta.url));
  const face=opentype.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const glyphs={};for(let code=32;code<=126;code++){
    const character=String.fromCodePoint(code),glyph=face.charToGlyph(character);
    glyphs[character]={advance:glyph.advanceWidth,commands:glyph.getPath(0,0,face.unitsPerEm).commands};
  }
  fonts[family]={sha256:createHash('sha256').update(bytes).digest('hex'),units:face.unitsPerEm,glyphs};
}
await writeFile(new URL('../worker/src/lib/reference-caption-glyphs.json',import.meta.url),JSON.stringify(fonts)+'\n');
