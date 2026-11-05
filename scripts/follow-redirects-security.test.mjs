import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

// Loopback-only regression for GHSA-mrwp-f3q8-3g9p. All credentials are fixtures.
for (const [name, manifest] of [["application", "../package.json"], ["worker", "../worker/package.json"]]) {
  test(`${name} strips cross-realm custom credentials on a cross-origin redirect`, async () => {
    const require = createRequire(new URL(manifest, import.meta.url));
    const { http } = require("follow-redirects");
    const sensitiveHeaders = vm.runInNewContext("['X-Fixture-Credential']");
    assert.equal(Array.isArray(sensitiveHeaders), true);
    assert.equal(sensitiveHeaders instanceof Array, false);
    const target = createServer((request, response) => {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(request.headers));
    });
    const redirect = createServer((_request, response) => {
      response.writeHead(302, { Location: `http://127.0.0.1:${target.address().port}/` });
      response.end();
    });
    const listen = server => new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    try {
      await listen(target);
      await listen(redirect);
      const headers = await new Promise((resolve, reject) => {
        const request = http.get({ hostname: "127.0.0.1", port: redirect.address().port, path: "/",
          sensitiveHeaders, headers: { "X-Fixture-Credential": "dummy-test-only", "X-Harmless": "retained" } }, response => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", chunk => { body += chunk; });
          response.on("end", () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
          response.on("error", reject);
        });
        request.on("error", reject);
        request.setTimeout(5_000, () => request.destroy(Error("Loopback redirect timed out")));
      });
      assert.equal(headers["x-fixture-credential"], undefined);
      assert.equal(headers["x-harmless"], "retained");
    } finally {
      for (const server of [redirect, target]) {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
      }
    }
  });
}
