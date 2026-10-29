import assert from "node:assert/strict";
import { mock, test } from "node:test";
let cleanup;
mock.module("react", { namedExports: {
  useEffect: effect => { cleanup = effect(); },
  useRef: value => ({ current: value }),
} });
const { useAnalyticsWake } = await import("./use-analytics-wake.ts");

test("return events revalidate stale data once, respect visibility/offline/cooldown, and clean up", async () => {
  const events = new EventTarget();
  const page = { visibilityState: "visible" };
  let online = true, calls = 0, now = 1_000_000;
  const fetches = [];
  mock.method(Date,"now",()=>now);
  const originals = new Map(["window","document","navigator"].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  Object.defineProperty(globalThis,"window", { value: events, configurable: true });
  Object.defineProperty(globalThis,"document", { value: page, configurable: true });
  Object.defineProperty(globalThis,"navigator", { value: { get onLine() { return online; } }, configurable: true });
  try {
    const resource = { dataUpdatedAt: now - 61_000, errorUpdatedAt: 0,
      refetch: async options => { calls++; fetches.push(options); } };
    useAnalyticsWake(resource,true);
    assert.equal(calls,0,"Installing observers does not add a timer or another mount request");
    events.dispatchEvent(new Event("focus"));events.dispatchEvent(new Event("pageshow"));events.dispatchEvent(new Event("online"));
    assert.equal(calls,1);assert.deepEqual(fetches,[{cancelRefetch:false}]);
    now+=61_000;page.visibilityState="hidden";events.dispatchEvent(new Event("focus"));assert.equal(calls,1);
    page.visibilityState="visible";online=false;events.dispatchEvent(new Event("focus"));assert.equal(calls,1);
    online=true;events.dispatchEvent(new Event("online"));assert.equal(calls,2);
    cleanup();now+=61_000;events.dispatchEvent(new Event("focus"));assert.equal(calls,2);
    useAnalyticsWake({...resource,dataUpdatedAt:now},true);events.dispatchEvent(new Event("focus"));assert.equal(calls,2,"Fresh data adds no request");cleanup();
    useAnalyticsWake({...resource,errorUpdatedAt:now},true);events.dispatchEvent(new Event("focus"));assert.equal(calls,2,"Failed reads have a cooldown");cleanup();
    useAnalyticsWake(resource,false);events.dispatchEvent(new Event("focus"));assert.equal(calls,2,"Inactive platforms do not revalidate");
  } finally { cleanup?.();mock.restoreAll();for(const [key,descriptor] of originals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]; }
});

test("opt-in open-screen checks refresh stale reads, pause hidden/offline, back off errors and release timers", async () => {
  const events = new EventTarget();
  const page = { visibilityState: "visible" };
  let online = true, now = 1_000_000, calls = 0, tick, intervalMs, cleared = 0;
  events.setInterval = (fn, ms) => { tick = fn; intervalMs = ms; return 7; };
  events.clearInterval = id => { assert.equal(id, 7); tick = undefined; cleared++; };
  mock.method(Date, "now", () => now);
  const originals = new Map(["window", "document", "navigator"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, "window", { value: events, configurable: true });
  Object.defineProperty(globalThis, "document", { value: page, configurable: true });
  Object.defineProperty(globalThis, "navigator", { value: { get onLine() { return online; } }, configurable: true });
  const resource = { dataUpdatedAt: now, errorUpdatedAt: 0, refetch: async () => { calls++; } };
  try {
    useAnalyticsWake(resource, true, 60_000, true);
    assert.equal(intervalMs, 60_000); assert.equal(calls, 0);
    tick(); assert.equal(calls, 0, "A fresh snapshot needs no read");
    now += 60_000; tick(); assert.equal(calls, 1, "No click or focus is required");
    events.dispatchEvent(new Event("focus")); tick(); assert.equal(calls, 1, "Timer and wake bursts coalesce");
    now += 60_000; page.visibilityState = "hidden"; tick(); assert.equal(calls, 1);
    page.visibilityState = "visible"; online = false; tick(); assert.equal(calls, 1);
    online = true; tick(); assert.equal(calls, 2); cleanup(); assert.equal(tick, undefined);
    useAnalyticsWake({ ...resource, errorUpdatedAt: now }, true, 60_000, true);
    tick(); assert.equal(calls, 2, "Errors keep their cooldown");
    now += 60_000; tick(); assert.equal(calls, 3, "Failed initial reads recover automatically"); cleanup();
    useAnalyticsWake(resource, false, 60_000, true); assert.equal(tick, undefined, "Inactive resources have no timer");
    useAnalyticsWake(resource, true); assert.equal(tick, undefined, "Refresh POST observers remain event-only"); cleanup();
    assert.equal(cleared, 2);
  } finally {
    cleanup?.(); mock.restoreAll();
    for (const [key, descriptor] of originals) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
});
