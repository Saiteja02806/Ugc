import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

for (const rendererAvailable of [false, true]) {
  test(`schedule route auth/read/cancel/edit and Wall recovery with renderer available=${rendererAvailable}`, () => {
    // A separate process prevents failed module initialization/cache state from
    // leaking between the missing-renderer and healthy-renderer scenarios.
    const script = `
      import assert from 'node:assert/strict';
      import { mock } from 'node:test';
      import { registerHooks } from 'node:module';
      import { NextResponse } from 'next/server';
      const rendererAvailable = ${rendererAvailable};
      let rendererLoads = 0;
      globalThis.renderStarts = [];
      registerHooks({ resolve(specifier, context, next) {
        if (specifier === '@/lib/scheduling/wall-text-render-start') {
          rendererLoads++;
          const source = rendererAvailable
            ? 'export async function startWallTextScheduleRender(input) { globalThis.renderStarts.push(input); }'
            : 'throw new Error("Simulated renderer initialization failure"); export function startWallTextScheduleRender() {}';
          return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) };
        }
        return next(specifier, context);
      }});
      let signedIn = false, conflict = false;
      const owner = 'verified-owner', id = '00000000-0000-4000-8000-000000000001';
      let post = { id, status: 'scheduled', sourceKind: 'library_item', metadata: {} };
      const cancels = [], edits = [], continuations = [];
      class FirebaseAuthRequestError extends Error { constructor() { super('Sign in'); this.status=401; } }
      class SchedulingRequestError extends Error { constructor() { super('Publishing has already started.'); this.status=409; this.code='schedule_publish_started'; } }
      mock.module('next/server', { namedExports: { NextResponse, after: work => continuations.push(work) } });
      mock.module('@/lib/firebase/server-auth', { namedExports: { FirebaseAuthRequestError, requireFirebaseUser: async () => {
        if (!signedIn) throw new FirebaseAuthRequestError();
        return { uid: owner };
      } }});
      mock.module('@/lib/scheduling/service', { namedExports: {
        getMissingSchedulingRuntimeEnvVars: () => [], SchedulingRequestError,
        cancelUserSchedule: async input => { cancels.push(input); if(conflict)throw new SchedulingRequestError(); return { ...post, status:'cancelled' }; },
        updateUserSchedule: async input => { edits.push(input); return post; },
      } });
      mock.module('@/lib/scheduling/db', { namedExports: { getScheduledPostForUser: async input => {
        assert.deepEqual(input, { postId:id, userId:owner }); return post;
      } }});
      mock.module('@/lib/social/tiktok-beta-access', { namedExports: { hasTikTokBetaAccess: () => true } });
      mock.module('@/lib/social/youtube-beta-access', { namedExports: { hasYouTubeBetaAccess: () => true } });
      const route = await import('./app/api/schedules/[scheduleId]/route.ts');
      assert.equal(rendererLoads, 0, 'The schedule route must initialize without loading a renderer');
      const context = { params: Promise.resolve({ scheduleId:id }) };
      const request = method => new Request('https://vidmake.io/api/schedules/'+id, {method, ...(method==='PATCH'?{body:JSON.stringify({title:'edited',userId:'foreign-owner'})}:{})});
      for(const method of ['GET','DELETE','PATCH']) {
        const response = await route[method](request(method),context);
        assert.equal(response.status,401); assert.equal((await response.json()).ok,false);
      }
      assert.equal(cancels.length,0); assert.equal(edits.length,0); assert.equal(rendererLoads,0);
      signedIn=true;
      const loaded = await route.GET(request('GET'), context);
      assert.deepEqual((await loaded.json()).schedule,post);
      const cancelled = await route.DELETE(request('DELETE'),context);
      assert.equal(cancelled.status,200); assert.equal((await cancelled.json()).schedule.status,'cancelled');
      assert.deepEqual(cancels,[{postId:id,userId:owner}]);
      conflict=true;
      const refused=await route.DELETE(request('DELETE'),context);
      assert.equal(refused.status,409); assert.equal((await refused.json()).code,'schedule_publish_started');
      const edited=await route.PATCH(request('PATCH'),context);
      assert.equal(edited.status,200); assert.equal(edits[0].userId,owner); assert.equal(edits[0].postId,id);
      assert.equal(rendererLoads,0); assert.equal(continuations.length,0);
      post={...post,status:'draft',sourceKind:'wall_text_pending',metadata:{wallTextRenderStatus:'not_requested'}};
      const recovery=await route.GET(request('GET'),context);
      assert.equal(recovery.status,200); assert.equal(rendererLoads,0); assert.equal(continuations.length,1);
      const errors=[]; console.error=(...args)=>errors.push(args);
      await continuations[0]();
      assert.equal(rendererLoads,1);
      if(rendererAvailable) {assert.deepEqual(globalThis.renderStarts,[{schedule:post,userId:owner}]);assert.equal(errors.length,0);}
      else {assert.equal(globalThis.renderStarts.length,0);assert.equal(errors.length,1);assert.match(JSON.stringify(errors),/Simulated renderer initialization failure/);}
      assert.equal((await route.DELETE(request('DELETE'),context)).status,409,'A render failure must not prevent the cancellation route from responding');
      console.log('PASS route owner/auth/conflict/edit plus bounded Wall continuation');
    `;
    const result = spawnSync(process.execPath, [
      "--import", "./scripts/next-server-only-test-loader.mjs",
      "--experimental-test-module-mocks", "--experimental-transform-types",
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--input-type=module", "-e", script,
    ], { cwd: new URL("../../", import.meta.url), encoding: "utf8", timeout: 30_000 });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  });
}
