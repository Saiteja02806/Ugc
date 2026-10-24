import assert from "node:assert/strict";
import fs from "node:fs/promises";

// Exercise the actual rendered release, not source-text or keyword assertions.
const baseFlag = process.argv.indexOf("--base-url");
assert(baseFlag >= 0 && process.argv[baseFlag + 1], "Supply --base-url for a running built site");
const base = new URL(process.argv[baseFlag + 1]);
const canonicalOrigin = "https://getugcpilot.com";
const paths = JSON.parse(await fs.readFile(new URL("../lib/marketing/public-page-paths.json", import.meta.url), "utf8"));
assert.equal(new Set(paths).size, paths.length, "Public page registry has duplicates");
const decode = value => value.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&#39;", "'");
const attr = (tag, name) => decode(tag.match(new RegExp(`\\b${name}=(["'])(.*?)\\1`, "i"))?.[2] ?? "");
const report = { baseUrl: base.href, status: "passed", pages: [], reachableFromHome: [], limitation: "Rendered release validation does not establish production deployment, Google indexing or measured traffic." };

async function fetchPage(path) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30000) });
  const html = await response.text();
  assert.equal(response.status, 200, `Unexpected status: ${path}`);
  assert.equal(new URL(response.url).pathname.replace(/\/$/, "") || "/", path.replace(/\/$/, "") || "/", `Unexpected redirect: ${path}`);
  const canonical = (html.match(/<link\b[^>]*>/gi) ?? []).filter(tag => attr(tag, "rel") === "canonical").map(tag => attr(tag, "href"));
  assert.deepEqual(canonical.map(url => new URL(url).href), [new URL(path, canonicalOrigin).href], `Canonical mismatch: ${path}`);
  const h1s = html.match(/<h1\b/gi) ?? [];
  assert.equal(h1s.length, 1, `Expected one H1: ${path}`);
  const meta = html.match(/<meta\b[^>]*>/gi) ?? [];
  const robots = [...meta.filter(tag => /^(robots|googlebot)$/i.test(attr(tag, "name"))).map(tag => attr(tag, "content")), response.headers.get("x-robots-tag") ?? ""].join(" ");
  assert(!/\b(noindex|none)\b/i.test(robots), `Public page blocks indexing: ${path}`);
  const description = meta.filter(tag => attr(tag, "name") === "description").map(tag => attr(tag, "content"));
  assert.equal(description.length, 1, `Description count: ${path}`);
  assert(description[0].trim(), `Empty description: ${path}`);
  const title = decode(html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "");
  assert(title.trim(), `Missing title: ${path}`);
  const links = (html.match(/<a\b[^>]*>/gi) ?? []).map(tag => attr(tag, "href")).filter(Boolean).flatMap(href => {
    const url = new URL(href, new URL(path, canonicalOrigin));
    return url.origin === canonicalOrigin ? [url.pathname.replace(/\/$/, "") || "/"] : [];
  });
  // Pricing has its own account-aware header; its home link connects it to the graph.
  assert(links.includes("/guides") || path === "/pricing" && links.includes("/"), `Public navigation does not reach the guide network: ${path}`);
  const graphs = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(match => JSON.parse(match[1]));
  const nodes = graphs.flatMap(graph => graph["@graph"] ?? [graph]);
  if (path.startsWith("/guides/")) {
    const article = nodes.find(node => node["@type"] === "Article");
    assert(article, `Article schema missing: ${path}`);
    assert.equal(article.mainEntityOfPage, new URL(path, canonicalOrigin).href);
    assert(article.image && article.publisher?.logo && article.author?.url, `Article identity/image missing: ${path}`);
    const h1Text = decode(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1].replace(/<[^>]*>/g, "") ?? "");
    assert.equal(article.headline, h1Text, `Visible headline/schema mismatch: ${path}`);
  }
  if (path === "/guides") {
    const items = nodes.find(node => node["@type"] === "CollectionPage")?.mainEntity?.itemListElement;
    assert(Array.isArray(items));
    assert.deepEqual(items.map(item => new URL(item.url).pathname).sort(), paths.filter(p => p.startsWith("/guides/")).sort());
  }
  return { path, title, description: description[0], canonical: canonical[0], links: [...new Set(links)] };
}

for (let i = 0; i < paths.length; i += 3) report.pages.push(...await Promise.all(paths.slice(i, i + 3).map(fetchPage)));
assert.equal(new Set(report.pages.map(page => page.title)).size, paths.length, "Duplicate page titles");
assert.equal(new Set(report.pages.map(page => page.description)).size, paths.length, "Duplicate page descriptions");
const sitemap = await fetch(new URL("/sitemap.xml", base));
assert.equal(sitemap.status, 200);
const xml = await sitemap.text();
const sitemapUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(decode(match[1])).href).sort();
assert.deepEqual(sitemapUrls, paths.map(path => new URL(path, canonicalOrigin).href).sort(), "Sitemap/public inventory mismatch");
const robots = await fetch(new URL("/robots.txt", base));
assert.equal(robots.status, 200);
assert((await robots.text()).includes(`${canonicalOrigin}/sitemap.xml`), "Robots does not advertise canonical sitemap");
for (const path of ["/brand/ugc-pilot-logo.png", "/guides/opengraph-image"]) {
  const asset = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30000) });
  assert.equal(asset.status, 200, `Schema image unavailable: ${path}`);
  assert(asset.headers.get("content-type")?.startsWith("image/"), `Schema asset is not an image: ${path}`);
}
const visited = new Set();
const queue = ["/"];
while (queue.length) {
  const path = queue.shift();
  if (visited.has(path)) continue;
  visited.add(path);
  const page = report.pages.find(item => item.path === path);
  for (const link of page?.links ?? []) if (paths.includes(link) && !visited.has(link)) queue.push(link);
}
assert.deepEqual([...visited].sort(), [...paths].sort(), "A sitemap page is orphaned from homepage links");
report.reachableFromHome = [...visited].sort();
const outputFlag = process.argv.indexOf("--output");
if (outputFlag >= 0) await fs.writeFile(process.argv[outputFlag + 1], JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ status: report.status, pages: report.pages.length, reachableFromHome: visited.size, sitemap: "matches", schema: "matches visible guides", deployment: "not established by this check" }));
