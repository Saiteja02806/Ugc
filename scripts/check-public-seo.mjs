import assert from "node:assert/strict";
import fs from "node:fs/promises";

const canonicalOrigin = "https://getugcpilot.com";
const publicPaths = JSON.parse(await fs.readFile(new URL("../lib/marketing/public-page-paths.json", import.meta.url), "utf8"));
const expectedUrls = publicPaths.map(path => new URL(path, canonicalOrigin).href).sort();
const evidence = [];
const pages = [];
const decode = (value = "") => value.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'");
function attribute(tag, name) {
  return decode(tag.match(new RegExp(`\\b${name}=(["'])(.*?)\\1`, "i"))?.[2] ?? "");
}
function metadata(html, name) {
  return (html.match(/<meta\b[^>]*>/gi) ?? []).filter(tag => attribute(tag, "name").toLowerCase() === name).map(tag => attribute(tag, "content"));
}
async function check(name, url, inspect, options = {}) {
  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(25000) });
    const body = await response.text();
    const details = await inspect(response, body);
    evidence.push({ name, url, status: response.status, ...details, passed: true });
    return body;
  } catch (error) {
    evidence.push({ name, url, passed: false, error: error.message });
    return null;
  }
}

await check("www canonical redirect", "https://www.getugcpilot.com", response => {
  assert.equal(response.status, 308);
  assert.equal(new URL(response.headers.get("location")).origin, canonicalOrigin);
}, { redirect: "manual" });
await check("HTTPS redirect", "http://getugcpilot.com", response => {
  assert([301, 308].includes(response.status));
  assert.equal(new URL(response.headers.get("location")).origin, canonicalOrigin);
}, { redirect: "manual" });
await check("robots", `${canonicalOrigin}/robots.txt`, (response, body) => {
  assert.equal(response.status, 200);
  assert(body.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`));
});
const sitemap = await check("sitemap", `${canonicalOrigin}/sitemap.xml`, (response, body) => {
  assert.equal(response.status, 200);
  const urls = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => decode(match[1]));
  assert.deepEqual(urls.map(url => new URL(url).href).sort(), expectedUrls, "Deployed sitemap differs from the intended public release inventory");
  assert.equal(new Set(urls).size, urls.length);
  assert(urls.every(url => new URL(url).origin === canonicalOrigin));
  return { urls };
});
if (sitemap) {
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => decode(match[1]));
  for (let index = 0; index < urls.length; index += 3) {
    await Promise.all(urls.slice(index, index + 3).filter(url => new URL(url).origin === canonicalOrigin).map(url => check("public page with simulated Googlebot", url, (response, html) => {
      assert.equal(response.status, 200);
      assert.equal(new URL(response.url).href, new URL(url).href);
      const title = decode(html.match(/<title>([^<]+)<\/title>/i)?.[1]);
      const descriptions = metadata(html, "description");
      const canonical = (html.match(/<link\b[^>]*>/gi) ?? []).filter(tag => attribute(tag, "rel") === "canonical").map(tag => attribute(tag, "href"));
      const robots = [...metadata(html, "robots"), ...metadata(html, "googlebot"), response.headers.get("x-robots-tag") ?? ""].join(" ");
      assert(title.trim().length > 0);
      assert.equal(descriptions.length, 1);
      assert(descriptions[0].trim().length > 0);
      assert.deepEqual(canonical.map(value => new URL(value).href), [new URL(url).href]);
      assert.equal((html.match(/<h1\b/gi) ?? []).length, 1);
      assert(!/\b(noindex|none)\b/i.test(robots));
      const structured = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(match => JSON.parse(match[1]));
      const nodes = structured.flatMap(value => Array.isArray(value) ? value : value["@graph"] ?? [value]);
      const types = nodes.flatMap(node => Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]]).filter(Boolean);
      if (new URL(url).pathname.startsWith("/guides/")) {
        assert(types.includes("Article"));
        if (new URL(url).pathname === "/guides/how-to-create-ugc-videos-with-ai") {
          // This guide presents five steps and a video, rather than the
          // question-and-answer layout used by the other founder guides.
          assert(types.includes("HowTo"));
          assert(types.includes("VideoObject"));
          const howTo = nodes.find(node => node["@type"] === "HowTo");
          assert.equal(howTo.step.length, 5);
          for (const step of howTo.step) {
            assert(html.includes(`id="step-${step.position}"`));
          }
        } else {
          assert(types.includes("BreadcrumbList"));
          assert(types.includes("FAQPage"));
        }
      }
      const page = { title, description: descriptions[0], canonical: canonical[0], h1_count: 1, structured_data_types: types };
      pages.push(page);
      return page;
    }, { headers: { "User-Agent": "Googlebot (UGC Pilot regression simulation)" } })));
  }
  await check("unique page metadata", `${canonicalOrigin}/sitemap.xml`, () => {
    assert.equal(pages.length, publicPaths.length);
    assert.equal(new Set(pages.map(page => page.title)).size, pages.length);
    assert.equal(new Set(pages.map(page => page.description)).size, pages.length);
  });
}
await check("connect AI setup is indexable", `${canonicalOrigin}/connect-ai`, (response, html) => {
  assert.equal(response.status, 200);
  assert(!/\bnoindex\b/i.test([...metadata(html, "robots"), response.headers.get("x-robots-tag") ?? ""].join(" ")));
  assert(expectedUrls.includes(`${canonicalOrigin}/connect-ai`));
});
await check("unknown page", `${canonicalOrigin}/seo-regression-nonexistent-20261008`, (response, html) => {
  assert.equal(response.status, 404);
  assert(/\bnoindex\b/i.test([...metadata(html, "robots"), response.headers.get("x-robots-tag") ?? ""].join(" ")));
});
const result = { checked_at: new Date().toISOString(), passed: evidence.every(item => item.passed), evidence, limitations: ["A simulated user agent does not prove Google indexing, rankings, field Core Web Vitals, rich-result eligibility, or acquisition performance."] };
const outputIndex = process.argv.indexOf("--output");
if (outputIndex !== -1) {
  assert(process.argv[outputIndex + 1], "--output requires a path");
  await fs.writeFile(process.argv[outputIndex + 1], JSON.stringify(result, null, 2) + "\n");
}
console.log(JSON.stringify({ passed: result.passed, checks: evidence.length, public_pages: pages.length, failed: evidence.filter(item => !item.passed) }, null, 2));
if (!result.passed) process.exitCode = 1;
