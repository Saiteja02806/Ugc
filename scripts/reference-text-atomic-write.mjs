import { renameSync, writeFileSync } from "node:fs";

const pause = milliseconds => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
const transient = new Set(["EACCES", "EPERM", "EBUSY"]);

// Windows/OneDrive may briefly hold the destination. Keep the old file intact
// until replacement succeeds; retain the staged file if the lock persists.
export function renameWithRetrySync(source, destination, { rename = renameSync, sleep = pause } = {}) {
  const delays = [50, 100, 200, 400, 800];
  for (let attempt = 0; ; attempt++) {
    try { rename(source, destination); return; }
    catch (error) {
      if (!transient.has(error.code) || attempt === delays.length) throw error;
      sleep(delays[attempt]);
    }
  }
}

export function atomicJsonSync(file, value, compact = false) {
  const pending = `${file}.${process.pid}.part`;
  writeFileSync(pending, JSON.stringify(value, null, compact ? undefined : 2) + "\n");
  renameWithRetrySync(pending, file);
}
