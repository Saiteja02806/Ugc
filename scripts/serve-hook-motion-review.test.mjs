import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createHookReviewServer } from "./serve-hook-motion-review.mjs";

test("local review serves only its allowlisted page/media, supports video seeking and accepts no writes", async () => {
  const server = await createHookReviewServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address(), origin = `http://127.0.0.1:${address.port}`;
  const root = fileURLToPath(new URL("../", import.meta.url));
  try {
    const page = await fetch(origin); assert.equal(page.status, 200);
    const html = await page.text(); assert.match(html, /Show 10 decisions/); assert.match(html, /Show all 98/);
    assert.match(html, /8-second video/);
    assert.match(page.headers.get("content-security-policy"), /default-src 'none'/);
    for (const pathname of ["/.env.local", "/.git/config", "/package.json", "/outputs/hook-motion-rewrite-2026-10-21/review-summary.json", "/missing.mp4"]) {
      assert.equal((await fetch(origin + pathname)).status, 404, pathname);
    }
    assert.equal((await fetch(origin, { method: "POST", body: "no writes" })).status, 405);
    const summary = JSON.parse(await readFile(path.join(root, "outputs/hook-motion-rewrite-2026-10-21/review-summary.json"), "utf8"));
    const source = summary.entries[0].sourcePath;
    const pathname = "/" + path.relative(root, source).split(path.sep).map(encodeURIComponent).join("/");
    const ranged = await fetch(origin + pathname, { headers: { Range: "bytes=0-31" } });
    assert.equal(ranged.status, 206); assert.equal(ranged.headers.get("content-type"), "video/mp4");
    assert.equal((await ranged.arrayBuffer()).byteLength, 32);
    assert.equal((await fetch(origin + pathname, { method: "HEAD" })).status, 200);
    assert.equal((await fetch(origin + pathname, { headers: { Range: "bytes=999999999-" } })).status, 416);
  } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
});
