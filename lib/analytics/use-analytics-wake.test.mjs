import assert from "node:assert/strict";
import { mock, test } from "node:test";
let cleanup;
mock.module("react", { namedExports: {
  useEffect: effect => { cleanup = effect(); },
  useRef: value => ({ current: value }),
} });
const { useAnalyticsWake } = await import("./use-analytics-wake.ts");

function fakeDocument(page) {
  const events = new EventTarget();
  page.addEventListener = (...args) => events.addEventListener(...args);
  page.removeEventListener = (...args) => events.removeEventListener(...args);
  page.dispatchEvent = (...args) => events.dispatchEvent(...args);
  return page;
}

test("return events revalidate stale data once, respect visibility/offline/cooldown, and clean up", async () => {
  const events = new EventTarget();
  const page = fakeDocument({ visibilityState: "visible" });
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

test("open-screen checks are scheduled from the stale moment and survive hidden/offline pauses", async () => {
  const events = new EventTarget();
  const page = fakeDocument({ visibilityState: "visible" });
  let online = true, now = 1_000_000, calls = 0;
  const timers = new Map();
  let nextId = 1;
  events.setTimeout = (fn, ms) => { const id = nextId++; timers.set(id, { at: now + Math.max(0, ms), fn }); return id; };
  events.clearTimeout = id => { timers.delete(id); };
  mock.method(Date, "now", () => now);
  const originals = new Map(["window", "document", "navigator"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, "window", { value: events, configurable: true });
  Object.defineProperty(globalThis, "document", { value: page, configurable: true });
  Object.defineProperty(globalThis, "navigator", { value: { get onLine() { return online; } }, configurable: true });
  const fireDueTimer = () => {
    const next = [...timers.entries()].sort((left, right) => left[1].at - right[1].at)[0];
    if (!next) return false;
    timers.delete(next[0]);
    now = Math.max(now, next[1].at);
    next[1].fn();
    return true;
  };
  const resource = { dataUpdatedAt: now, errorUpdatedAt: 0, refetch: async () => { calls++; } };
  try {
    useAnalyticsWake(resource, true, 60_000, true);
    // The first open-screen check is scheduled for the moment the saved data
    // becomes stale, not one full interval after mount.
    assert.equal(timers.size, 1);
    const [first] = [...timers.values()];
    assert.equal(first.at, now + 60_100);
    now += 30_000;
    assert.ok([...timers.values()].every(entry => entry.at > now), "No check before the data is stale");
    assert.equal(calls, 0);
    now = 1_060_000;
    assert.equal(fireDueTimer(), true);
    assert.equal(calls, 1, "A visible screen checks without any user event");
    assert.equal(timers.size, 1, "The next check is scheduled after the read");
    events.dispatchEvent(new Event("focus"));
    assert.equal(calls, 1, "Focus bursts coalesce inside the cooldown");
    // Hidden: the pending timer fires without a read and no timer is left.
    page.visibilityState = "hidden";
    events.dispatchEvent(new Event("focus"));
    assert.equal(fireDueTimer(), true);
    assert.equal(calls, 1, "Hidden screens send no reads");
    assert.equal(timers.size, 0);
    page.visibilityState = "visible";
    page.dispatchEvent(new Event("visibilitychange"));
    assert.equal(calls, 2, "Returning to the tab catches up");
    assert.equal(timers.size, 1);
    // Offline: pause, then recover on the online event.
    online = false;
    events.dispatchEvent(new Event("focus"));
    assert.equal(fireDueTimer(), true);
    assert.equal(calls, 2);
    assert.equal(timers.size, 0);
    online = true;
    events.dispatchEvent(new Event("online"));
    assert.equal(calls, 3);
    assert.equal(timers.size, 1);
    cleanup();
    assert.equal(timers.size, 0, "Unmount releases the timer");
    useAnalyticsWake(resource, false, 60_000, true);
    assert.equal(timers.size, 0, "Inactive resources have no timer");
    useAnalyticsWake(resource, true);
    assert.equal(timers.size, 0, "Refresh POST observers remain event-only");
    cleanup();
  } finally {
    cleanup?.(); mock.restoreAll();
    for (const [key, descriptor] of originals) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
});
