import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { NextResponse } from 'next/server.js';
import { mergeCarouselHookChoices } from '../carousel/hook-choices.ts';

const source = readFileSync(new URL('../../app/api/trending/carousel-hyper-hooks/route.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true);
const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'GET');
const code = ts.transpileModule(fn.getText(ast).replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const id = '20000000-0000-4000-8000-000000000001';
let authenticated = true, owner = 'owner', state = 'completed', lookups = 0;
class AuthError extends Error { constructor() { super('Sign in'); this.status = 401; } }
const get = new Function('NextResponse', 'requireFirebaseUser', 'getCarouselGenerationStatus',
  'listActiveCarouselCategoryHooks', 'resolveCarouselImageLibraryCategory', 'mergeCarouselHookChoices',
  'CAROUSEL_HYPER_HOOK_ASSETS', 'CAROUSEL_HYPER_HOOK_FOLDER', 'getCarouselHyperHookAssetUrl', 'FirebaseAuthRequestError',
  `${code}; return GET;`)(NextResponse,
  async () => { if (!authenticated) throw new AuthError(); return { uid: 'owner' }; },
  async () => ({ generation: { userId: owner, status: state, categorySlug: 'productivity' } }),
  async category => { lookups++; assert.equal(category, 'productivity'); return [{ id: 'reviewed-hook', url: 'https://storage.test/hook.webp', name: 'Reviewed', width: 1080, height: 1080 }]; },
  ({ categorySlug }) => categorySlug, mergeCarouselHookChoices,
  [{ id: 'packaged', name: 'Packaged', width: 720, height: 1280 }], { name: 'Hyper Hooks' }, () => 'https://www.getugcpilot.com/packaged.jpg', AuthError);
const request = query => new Request('https://www.getugcpilot.com/api/trending/carousel-hyper-hooks' + query);

test('owned completed carousel loads reviewed category hooks and keeps legacy choices without caching', async () => {
  const response = await get(request('?carouselId=' + id));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const body = await response.json();
  assert.deepEqual(body.assets.map(asset => asset.id), ['reviewed-hook', 'packaged']);
  assert.equal(body.folder.assetCount, 2);
  lookups = 0;
  assert.equal((await (await get(request(''))).json()).assets.length, 1);
  assert.equal(lookups, 0);
});

test('unauthenticated, foreign, incomplete and invalid carousel requests cannot read a category pool', async () => {
  lookups = 0;
  authenticated = false;
  assert.equal((await get(request('?carouselId=' + id))).status, 401);
  authenticated = true; owner = 'foreign';
  assert.equal((await get(request('?carouselId=' + id))).status, 404);
  owner = 'owner'; state = 'processing';
  assert.equal((await get(request('?carouselId=' + id))).status, 404);
  state = 'completed';
  assert.equal((await get(request('?carouselId=malformed'))).status, 400);
  assert.equal(lookups, 0);
});
