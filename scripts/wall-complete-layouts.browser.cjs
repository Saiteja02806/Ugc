/* eslint-disable @typescript-eslint/no-require-imports -- Local fixture only. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const filename = path.join(process.cwd(), 'scripts/wall-automatic-text.browser.cjs');
let code = fs.readFileSync(filename, 'utf8');
const match = code.match(/id:(\['explore-wall-text-02'.*?\])\[i-6\]/);
if (!match) throw Error('Browser fixture mapping changed.');
const baseline = vm.runInNewContext(match[1]);
const rows = fs.readFileSync('worker/src/lib/wall-initial-text-layout.ts', 'utf8').split('\n')
  .filter(line => /^\s*\{\s*(?:"version"|version):\s*1,/.test(line))
  .map(line => vm.runInNewContext('(' + line.trim().replace(/,$/, '') + ')'))
  .filter(row => !baseline.includes(row.referenceId));
const ids = [...baseline, ...rows.map(row => row.referenceId)];
code = code.replace(match[0], 'id:' + JSON.stringify(ids) + '[i-6]');
const loop = code.match(/for\(const \[i,color\] of (\[\[.*?\]\])\)/);
if (!loop) throw Error('Browser fixture loop changed.');
const checks = [...vm.runInNewContext(loop[1]), ...rows.map((row, i) => [baseline.length + 6 + i, row.regions?.[0].color || row.color || '#ffffff'])];
code = code.replace(loop[0], 'for(const [i,color] of ' + JSON.stringify(checks) + ')');
code = code.replace('assert.equal(writes,31)', `assert.equal(writes,${31 + rows.length})`);
code = code.replace('import {initialWallText,wallTextProfile}', 'import {initialWallText,initialWallRegions,wallTextProfile}');
code = code.replace('textOverlays:[initialWallText(source.blocks[0].text,wallTextProfile(item.id),12000)]', 'textOverlays:wallTextProfile(item.id).regions?initialWallRegions(source.blocks[0].text,wallTextProfile(item.id),12000):[initialWallText(source.blocks[0].text,wallTextProfile(item.id),12000)]');
const fixture = new Module(filename, module);
code = code.replace('PASS Wall profiles editable', `PASS ${ids.length + 6} actual Wall profiles editable`);
// The additional references include multiple simultaneous source regions.
code = code.replaceAll("page.locator('svg[aria-label=\"Wall preview\"]').waitFor()", "page.locator('svg[aria-label=\"Wall preview\"]').first().waitFor()");
fixture.filename = filename;
fixture.paths = module.paths;
fixture._compile(code, filename);
